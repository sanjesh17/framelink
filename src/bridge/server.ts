import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { WebSocketServer } from 'ws';
import { failureOf, RPC_TYPES, type RpcRequest } from '../rpc';
import { logger } from './logger';
import type { WebSocketManager } from './ws/manager';

export type Bridge = { port: number; close: () => Promise<void> };

const MAX_BODY = 1_000_000;

const send = (res: ServerResponse, status: number, body: object): void => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const readBody = (req: IncomingMessage): Promise<string | null> =>
  new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > MAX_BODY) {
        resolve(null);
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(null));
  });

const parseRpc = (body: string | null): RpcRequest | null => {
  if (body === null) return null;
  try {
    const rpc = JSON.parse(body) as RpcRequest;
    return typeof rpc.type === 'string' && RPC_TYPES.has(rpc.type) ? rpc : null;
  } catch {
    return null;
  }
};

// Binds the local port and serves two things: the Figma plugin's WebSocket, and a small HTTP door
// (/health, /rpc) so other agents' FrameLink processes can use this one instead of fighting for the port.
// Resolves null when the port is already taken, which means someone else is the bridge.
export const startBridge = (port: number, version: string, manager: WebSocketManager): Promise<Bridge | null> =>
  new Promise((resolve, reject) => {
    const hosts = [`127.0.0.1:${port}`, `localhost:${port}`];
    // A web page cannot make the bridge answer it: it would send an Origin, or reach it under a different Host (DNS rebinding).
    const trusted = (req: IncomingMessage): boolean => hosts.includes(req.headers.host ?? '');
    const wss = new WebSocketServer({ noServer: true });

    const server = createServer(async (req, res) => {
      if (!trusted(req) || req.headers.origin !== undefined) return send(res, 403, { error: 'forbidden' });
      if (req.method === 'GET' && req.url === '/health') {
        return send(res, 200, { service: 'framelink', status: 'ok', version, pid: process.pid, pluginConnected: manager.isConnected() });
      }
      if (req.method === 'POST' && req.url === '/rpc') {
        const rpc = parseRpc(await readBody(req));
        if (!rpc) return send(res, 400, { error: 'bad request' });
        try {
          return send(res, 200, { ok: true, data: await manager.request(rpc.type, rpc.params, rpc.timeout) });
        } catch (error) {
          return send(res, 200, { ok: false, ...failureOf(error instanceof Error ? error : String(error)) });
        }
      }
      return send(res, 404, { error: 'not found' });
    });

    // The Figma plugin page has no origin of its own ("null"); a real web page has one and is refused.
    server.on('upgrade', (req, socket, head) => {
      const origin = req.headers.origin;
      if (!trusted(req) || req.url !== '/' || (origin !== undefined && origin !== 'null')) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => manager.setConnection(ws));
    });

    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') resolve(null);
      else reject(error);
    });

    server.listen(port, '127.0.0.1', () => {
      logger.info(`bridge listening on ws://localhost:${port}`);
      resolve({
        port,
        close: () =>
          new Promise((done) => {
            wss.clients.forEach((client) => client.terminate());
            server.close(() => done());
            server.closeAllConnections?.();
          }),
      });
    });
  });
