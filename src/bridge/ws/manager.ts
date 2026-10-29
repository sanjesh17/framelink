import { WebSocket } from 'ws';
import { randomUUID } from 'node:crypto';
import { logger } from '../logger';

interface PendingRequest {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  type: string;
  startedAt: number;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private pendingRequests = new Map<string, PendingRequest>();

  setConnection(ws: WebSocket) {
    this.ws = ws;
    logger.success('Plugin connected');

    ws.on('message', (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString()) as Record<string, unknown>;
        const requestId = msg.requestId as string | undefined;
        if (!requestId) return;

        const pending = this.pendingRequests.get(requestId);
        if (!pending) return;

        this.pendingRequests.delete(requestId);
        clearTimeout(pending.timeout);

        const ms = Date.now() - pending.startedAt;
        logger.request(pending.type, ms);

        if (msg.type === 'ERROR') {
          pending.reject(new Error(msg.message as string));
        } else {
          pending.resolve(msg.data);
        }
      } catch (error) {
        logger.error(`Failed to parse message: ${error}`);
      }
    });

    ws.on('close', () => {
      logger.warn('Plugin disconnected');
      this.ws = null;
      this.rejectAll('WebSocket disconnected');
    });

    ws.on('error', (error) => {
      logger.error(`Plugin error: ${error}`);
      this.ws = null;
      this.rejectAll('WebSocket error');
    });
  }

  private rejectAll(reason: string) {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
    }
    this.pendingRequests.clear();
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  async request(type: string, params?: Record<string, unknown>, timeout = 5000): Promise<unknown> {
    if (!this.isConnected()) throw new Error('PLUGIN_UNAVAILABLE');

    const requestId = randomUUID();
    const startedAt = Date.now();
    this.ws!.send(JSON.stringify({ type, requestId, ...params }));

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        logger.warn(`Timeout: ${type}`);
        reject(new Error('TIMEOUT'));
      }, timeout);

      this.pendingRequests.set(requestId, { resolve, reject, timeout: timeoutHandle, type, startedAt });
    });
  }
}

