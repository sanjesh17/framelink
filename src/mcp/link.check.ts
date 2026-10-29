// Run with: npm run check. A scripted WebSocket client plays the Figma plugin, so the bridge is exercised without Figma.
import assert from 'node:assert/strict';
import { createServer, request, type IncomingHttpHeaders } from 'node:http';
import { createServer as createSocketServer, type AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { createLink, NoSelectionError, PluginUnavailableError, TimeoutError } from './link';
import { figmaPluginManifest, nextStep } from './setup';

const freePort = (): Promise<number> =>
  new Promise((resolve) => {
    const probe = createSocketServer();
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });

const until = async (ready: () => Promise<boolean> | boolean): Promise<void> => {
  for (let tries = 0; tries < 100; tries += 1) {
    if (await ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('condition never became true');
};

// Answers the way the real plugin does; GET_NODES_INFO is left unanswered to provoke a timeout.
const connectPlugin = (port: number): Promise<WebSocket> =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('error', reject);
    ws.on('open', () => resolve(ws));
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as { type: string; requestId: string; format?: string; chunk?: number; nodeId?: string };
      const reply = (body: object): void => ws.send(JSON.stringify({ requestId: msg.requestId, ...body }));
      if (msg.type === 'GET_SELECTION') reply({ type: 'RESPONSE', data: `outline:${msg.format}:${msg.chunk}` });
      else if (msg.type === 'GET_NODE_INFO') reply({ type: 'RESPONSE', data: `node:${msg.nodeId}` });
      else if (msg.type === 'GET_DOCUMENT_INFO') reply({ type: 'RESPONSE', data: { name: 'Doc' } });
      else if (msg.type === 'EXPORT_NODE') reply({ type: 'RESPONSE', data: { id: '1:2', name: 'Card', png: 'AAAA', boxes: [] } });
      else if (msg.type === 'GET_ANNOTATIONS') reply({ type: 'ERROR', message: 'NO_SELECTION' });
    });
  });

const status = (port: number, path: string, headers: IncomingHttpHeaders, method = 'GET', body = ''): Promise<number> =>
  new Promise((resolve) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      res.resume();
      resolve(res.statusCode ?? 0);
    });
    req.end(body);
  });

const refusal = (port: number, origin: string): Promise<string> =>
  new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, { origin });
    ws.on('error', (error) => resolve(error.message));
    ws.on('open', () => {
      ws.close();
      resolve('opened');
    });
  });

const port = await freePort();
const first = createLink(port);

// With no plugin yet, the first call makes this process the bridge and reports what to do.
await assert.rejects(first.selection(), (error: Error) => error instanceof PluginUnavailableError && error.message.includes('Plugins → Development → FrameLink'));
assert.equal((await first.diagnostics()).role, 'bridge');

const plugin = await connectPlugin(port);
await until(async () => (await first.diagnostics()).pluginConnected === true);
assert.equal(await first.selection({ format: 'css', chunk: 2 }), 'outline:css:2', 'read options reach the plugin');
assert.equal(await first.nodeInfo('1:2'), 'node:1:2');
assert.deepEqual(await first.documentInfo(), { name: 'Doc' });
assert.equal((await first.exportNode('1:2', 2)).name, 'Card');
await assert.rejects(first.annotations(), NoSelectionError, 'a plugin error is mapped to a typed error');
await assert.rejects(first.call('GET_NODES_INFO', {}, 150), TimeoutError, 'an unanswered request times out');

// A second process finds the port taken and goes through the first.
const second = createLink(port);
assert.equal(await second.selection(), 'outline:outline:undefined', 'a follower reaches the plugin through the bridge');
const seen = await second.diagnostics();
assert.deepEqual([seen.role, seen.versionMatch, (seen.bridge as { pluginConnected: boolean }).pluginConnected], ['follower', true, true]);
await assert.rejects(second.annotations(), NoSelectionError, 'errors keep their type through the bridge');
await assert.rejects(second.call('GET_NODES_INFO', {}, 150), TimeoutError);

// Security: a web page (an Origin, or a foreign Host) is refused, and only known request types are forwarded.
assert.equal(await status(port, '/health', {}), 200);
assert.equal(await status(port, '/health', { Origin: 'https://evil.example' }), 403, 'a request with an Origin is refused');
assert.equal(await status(port, '/health', { Host: 'evil.example' }), 403, 'a foreign Host (DNS rebinding) is refused');
assert.equal(await status(port, '/rpc', { 'Content-Type': 'application/json' }, 'POST', JSON.stringify({ type: 'EVAL' })), 400, 'an unknown request type is refused');
assert.equal(await status(port, '/rpc', { Origin: 'https://evil.example' }, 'POST', JSON.stringify({ type: 'GET_SELECTION' })), 403);
assert.ok((await refusal(port, 'https://evil.example')).includes('403'), 'a WebSocket from a web page is refused');
assert.equal(await refusal(port, 'null'), 'opened', 'the plugin page (origin null) is accepted');

// The bridge's session ends: the follower takes over, and the plugin reconnects to it.
await first.close();
await until(() => plugin.readyState === WebSocket.CLOSED);
await assert.rejects(second.selection(), PluginUnavailableError, 'the follower becomes the bridge');
assert.equal((await second.diagnostics()).role, 'bridge');
const again = await connectPlugin(port);
await until(async () => (await second.diagnostics()).pluginConnected === true);
assert.equal(await second.selection(), 'outline:outline:undefined', 'the plugin works with the new bridge');

// Two first calls at once elect only one bridge.
const racePort = await freePort();
const racer = createLink(racePort);
const both = await Promise.allSettled([racer.documentInfo(), racer.documentInfo()]);
assert.ok(both.every((result) => result.status === 'rejected' && result.reason instanceof PluginUnavailableError), 'simultaneous first calls do not collide');

// Something else on the port is reported, not mistaken for a bridge.
const foreignPort = await freePort();
const foreign = createServer((req, res) => res.end('hello'));
await new Promise<void>((resolve) => foreign.listen(foreignPort, '127.0.0.1', resolve));
const blocked = createLink(foreignPort);
await assert.rejects(blocked.documentInfo(), /another program/);
await assert.rejects(blocked.diagnostics(), /another program/);

// Setup guidance: the packed plugin is found beside the bundle (not here, in the source tree) and the next step follows the connection.
assert.equal(figmaPluginManifest(), null, 'no packed plugin beside the source files');
assert.ok(nextStep(false).includes('figmaPlugin') && nextStep(true).includes('get_selection'), 'the next step follows the connection state');
assert.equal((await second.diagnostics()).pluginConnected, true, 'diagnostics report the plugin state at the top level');

again.close();
await Promise.all([second.close(), racer.close(), blocked.close()]);
foreign.closeAllConnections();
foreign.close();
console.log('link check passed');
