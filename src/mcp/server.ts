import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createLink, VERSION, type ReadOptions } from './link.js';
import { figmaPluginManifest, nextStep } from './setup.js';
import { DEFAULT_OPTIONS, describeExport, saveExport, verifyRender } from './verify.js';

const link = createLink(Number(process.env.FRAMELINK_PORT) || 3333);

const server = new Server(
  { name: 'framelink', version: VERSION },
  { capabilities: { tools: {} } }
);

const READ_PROPERTIES = {
  format: {
    type: 'string',
    enum: ['outline', 'css', 'json'],
    description: '"outline" (default, compact shorthand), "css" (the same tree as CSS declarations, longer but ready to paste), or "json" (raw tree, very large).',
  },
  chunk: {
    type: 'integer',
    minimum: 1,
    description: 'For large selections: omit it to get a manifest of numbered chunks, then call again with chunk=N. The legend is in chunk 1.',
  },
};

const TOOLS = [
  {
    name: 'connection_diagnostics',
    description: 'Starts the local bridge if needed and reports whether the Figma plugin is connected, with the plugin path and what to do next. Call it first when setting up or when a read fails.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_document_info',
    description: 'Reads the document name, pages and current page.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_selection',
    description: 'Reads the current Figma selection as a compact text outline for code generation: layout, colors, spacing, typography, text. Images and vectors are IMG placeholders with their size; hidden layers are skipped. Large selections return numbered chunks. If one node looks incomplete, read it alone with get_node_info.',
    inputSchema: { type: 'object' as const, properties: READ_PROPERTIES },
  },
  {
    name: 'get_node_info',
    description: 'Reads one node by ID (the @id in an outline) as the same outline. format "json" is a last resort for a node whose outline looks incomplete; never use it on a whole frame.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        nodeId: { type: 'string', description: 'Figma node ID, e.g. "454:23657"' },
        ...READ_PROPERTIES,
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'get_nodes_info',
    description: 'Reads several nodes by ID as one outline.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        nodeIds: { type: 'array', items: { type: 'string' }, description: 'Figma node IDs' },
        ...READ_PROPERTIES,
      },
      required: ['nodeIds'],
    },
  },
  {
    name: 'export_node',
    description: 'Saves a PNG of a node (default: the selection) as the pixel reference and returns its path and size. Render your component, screenshot just that element at the same size, then call verify_render. No image enters the conversation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        nodeId: { type: 'string', description: 'Optional node ID. Defaults to the single selected node.' },
        scale: { type: 'number', description: 'Export scale, matching your screenshot\'s device pixel ratio. Default 1.' },
      },
    },
  },
  {
    name: 'verify_render',
    description: 'Compares a screenshot of your rendered component with an export_node reference and returns a text report: match percentage and the layers that differ most. Use it to fix differences before saying the component matches.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        reference: { type: 'string', description: 'Path returned by export_node.' },
        screenshot: { type: 'string', description: 'Path to a PNG screenshot of the rendered component.' },
        threshold: { type: 'number', description: 'Color tolerance from 0 to 1. Default 0.1.' },
        top: { type: 'integer', minimum: 1, description: 'How many differing layers to list. Default 5.' },
      },
      required: ['reference', 'screenshot'],
    },
  },
  {
    name: 'get_annotations',
    description: 'Reads designer annotations on a node (defaults to the selection).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        nodeId: { type: 'string', description: 'Optional node ID.' },
      },
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const params = (args ?? {}) as Record<string, unknown>;
  const readOptionsOf = (input: Record<string, unknown>): ReadOptions => ({
    format: input.format === 'json' || input.format === 'css' ? input.format : 'outline',
    chunk: typeof input.chunk === 'number' ? input.chunk : undefined,
  });

  const ok = (data: unknown) => ({
    content: [{ type: 'text' as const, text: typeof data === 'string' ? data : JSON.stringify(data) }],
  });

  const err = (message: string) => ({
    content: [{ type: 'text' as const, text: `Error: ${message}` }],
    isError: true,
  });

  const mapError = (error: unknown): string => (error instanceof Error ? error.message : 'Unknown error');

  try {
    switch (name) {
      case 'connection_diagnostics': {
        const info = await link.diagnostics();
        return ok({ ...info, figmaPlugin: figmaPluginManifest(), next: nextStep(info.pluginConnected === true) });
      }

      case 'get_document_info':
        return ok(await link.documentInfo());

      case 'get_selection':
        return ok(await link.selection(readOptionsOf(params)));

      case 'get_node_info':
        return ok(await link.nodeInfo(params.nodeId as string, readOptionsOf(params)));

      case 'get_nodes_info':
        return ok(await link.nodesInfo(params.nodeIds as string[], readOptionsOf(params)));

      case 'export_node': {
        const scale = typeof params.scale === 'number' && params.scale > 0 ? params.scale : 1;
        const exported = await link.exportNode(params.nodeId as string | undefined, scale);
        return ok(describeExport(await saveExport(exported, scale), scale));
      }

      case 'verify_render':
        return ok(
          await verifyRender(params.reference as string, params.screenshot as string, {
            threshold: typeof params.threshold === 'number' ? params.threshold : DEFAULT_OPTIONS.threshold,
            top: typeof params.top === 'number' ? params.top : DEFAULT_OPTIONS.top,
          })
        );

      case 'get_annotations':
        return ok(await link.annotations(params.nodeId as string | undefined));

      default:
        return err(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return err(mapError(error));
  }
});

// A listening bridge would keep this process alive after the agent leaves and hold the port, so leave explicitly.
const stop = (): void => {
  void link.close().finally(() => process.exit(0));
};

async function main() {
  await server.connect(new StdioServerTransport());
  server.onclose = stop;
  process.stdin.on('close', stop);
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((error) => {
  console.error('[framelink] fatal:', error);
  process.exit(1);
});
