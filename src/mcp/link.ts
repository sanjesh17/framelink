import { startBridge, type Bridge } from '../bridge/server';
import { WebSocketManager } from '../bridge/ws/manager';
import { errorOf, failureOf, type RpcFailure } from '../rpc';
import type { ExportResult } from './verify';

export { NoSelectionError, PluginUnavailableError, TimeoutError } from '../rpc';

declare const __VERSION__: string;
export const VERSION = typeof __VERSION__ === 'undefined' ? 'dev' : __VERSION__;

export type OutputFormat = 'outline' | 'json' | 'css';

export type ReadOptions = { format?: OutputFormat; chunk?: number };

type RpcReply = { ok: true; data: unknown } | ({ ok: false } & RpcFailure);

class LeaderGone extends Error {}

const readParams = ({ format = 'outline', chunk }: ReadOptions): Record<string, unknown> => ({ format, chunk });

// The path from an agent to the Figma plugin. The first FrameLink process to bind the port is the bridge
// and talks to the plugin itself; every other one (another agent, another session) sends its requests through it.
// Nothing binds until the first call, so idle sessions never hold the port.
export const createLink = (port: number) => {
  const manager = new WebSocketManager();
  let bridge: Bridge | null | undefined;
  let electing: Promise<Bridge | null> | null = null;

  const elect = (): Promise<Bridge | null> => {
    electing ??= startBridge(port, VERSION, manager)
      .then((won) => {
        bridge = won;
        return won;
      })
      .finally(() => {
        electing = null;
      });
    return electing;
  };

  const viaBridge = async (type: string, params: Record<string, unknown> | undefined, timeout: number): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetch(`http://127.0.0.1:${port}/rpc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, params, timeout }),
      });
    } catch {
      throw new LeaderGone();
    }
    const reply = (await response.json().catch(() => null)) as RpcReply | null;
    if (!reply || typeof reply.ok !== 'boolean') {
      throw new Error(`Port ${port} is used by another program, not FrameLink. Free it (lsof -ti :${port}) and try again.`);
    }
    if (reply.ok) return reply.data;
    throw errorOf(reply);
  };

  const call = async (type: string, params?: Record<string, unknown>, timeout = 5000): Promise<unknown> => {
    for (let attempt = 0; ; attempt += 1) {
      const owner = bridge === undefined ? await elect() : bridge;
      if (owner) {
        try {
          return await manager.request(type, params, timeout);
        } catch (error) {
          throw errorOf(failureOf(error instanceof Error ? error : String(error)));
        }
      }
      try {
        return await viaBridge(type, params, timeout);
      } catch (error) {
        if (!(error instanceof LeaderGone)) throw error;
        if (attempt > 0) throw new Error(`The FrameLink bridge on port ${port} stopped responding.`);
        // The bridge's session ended: try to become the bridge, and the plugin reconnects to whoever wins.
        bridge = undefined;
      }
    }
  };

  const diagnostics = async (): Promise<Record<string, unknown>> => {
    const owner = bridge === undefined ? await elect() : bridge;
    if (owner) return { role: 'bridge', port, version: VERSION, pluginConnected: manager.isConnected() };
    try {
      const health = (await (await fetch(`http://127.0.0.1:${port}/health`)).json()) as Record<string, unknown>;
      return { role: 'follower', port, version: VERSION, pluginConnected: health.pluginConnected === true, bridge: health, versionMatch: health.version === VERSION };
    } catch {
      throw new Error(`Port ${port} is used by another program, not FrameLink. Free it (lsof -ti :${port}) and try again.`);
    }
  };

  return {
    call,
    selection: (options: ReadOptions = {}) => call('GET_SELECTION', readParams(options), 20000),
    documentInfo: () => call('GET_DOCUMENT_INFO'),
    nodeInfo: (nodeId: string, options: ReadOptions = {}) => call('GET_NODE_INFO', { nodeId, ...readParams(options) }, 20000),
    nodesInfo: (nodeIds: string[], options: ReadOptions = {}) => call('GET_NODES_INFO', { nodeIds, ...readParams(options) }, 20000),
    annotations: (nodeId?: string) => call('GET_ANNOTATIONS', nodeId ? { nodeId } : undefined),
    exportNode: (nodeId?: string, scale = 1) => call('EXPORT_NODE', { nodeId, scale }, 60000) as Promise<ExportResult>,
    diagnostics,
    close: async (): Promise<void> => {
      const owner = bridge;
      bridge = undefined;
      if (owner) await owner.close();
    },
  };
};

export type Link = ReturnType<typeof createLink>;
