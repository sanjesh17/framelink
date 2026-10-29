// What the MCP side and the bridge both need to know about a request to the Figma plugin and how it can fail.
export class PluginUnavailableError extends Error { name = 'PluginUnavailableError'; }
export class NoSelectionError extends Error { name = 'NoSelectionError'; }
export class TimeoutError extends Error { name = 'TimeoutError'; }

// Only these may be forwarded to the plugin; anything else is refused before it gets there.
export const RPC_TYPES: ReadonlySet<string> = new Set(['GET_SELECTION', 'GET_DOCUMENT_INFO', 'GET_NODE_INFO', 'GET_NODES_INFO', 'GET_ANNOTATIONS', 'EXPORT_NODE']);

export type RpcRequest = { type: string; params?: Record<string, unknown>; timeout?: number };

export type RpcFailure = { code: 'PLUGIN_UNAVAILABLE' | 'NO_SELECTION' | 'TIMEOUT' | 'ERROR'; message: string };

const PLUGIN_HINT = 'Figma plugin is not connected. In Figma, open Plugins → Development → FrameLink and keep its window open, then try again.';

export const failureOf = (error: Error | string): RpcFailure => {
  const message = typeof error === 'string' ? error : error.message;
  if (message.includes('NO_SELECTION')) return { code: 'NO_SELECTION', message: 'No node selected in Figma. Select a frame or component.' };
  if (message.includes('TIMEOUT')) return { code: 'TIMEOUT', message: 'The plugin did not answer in time. Select the node again or restart the plugin.' };
  if (message.includes('PLUGIN_UNAVAILABLE')) return { code: 'PLUGIN_UNAVAILABLE', message: PLUGIN_HINT };
  return { code: 'ERROR', message };
};

export const errorOf = (failure: RpcFailure): Error => {
  if (failure.code === 'PLUGIN_UNAVAILABLE') return new PluginUnavailableError(failure.message);
  if (failure.code === 'NO_SELECTION') return new NoSelectionError(failure.message);
  if (failure.code === 'TIMEOUT') return new TimeoutError(failure.message);
  return new Error(failure.message);
};
