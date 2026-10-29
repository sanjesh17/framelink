import { serializeNode } from './serializer';
import { outlineSelection, placeholderIds, type OutlineFormat } from './outline';
import { boxesOf } from './boxes';

figma.showUI(__html__, { width: 300, height: 220 });

console.log('[Plugin Main] Started');

function respond(requestId: string, data: unknown) {
  figma.ui.postMessage({ type: 'RESPONSE', requestId, data });
}

function respondError(requestId: string, message: string) {
  figma.ui.postMessage({ type: 'ERROR', requestId, message });
}

type SerializedNode = ReturnType<typeof serializeNode>;

// One node keeps its original shape so existing callers don't break; several come back as an array.
const serializeSelection = (selection: readonly SceneNode[]): SerializedNode | SerializedNode[] =>
  selection.length === 1 ? serializeNode(selection[0]) : selection.map((node) => serializeNode(node));

const chunkOf = (value: number | undefined): number | undefined => (typeof value === 'number' ? value : undefined);

const formatOf = (value: string | undefined): OutlineFormat => (value === 'css' ? 'css' : 'outline');

const isSceneNode = (node: BaseNode): node is SceneNode => node.type !== 'DOCUMENT' && node.type !== 'PAGE';

const isPresentScene = (node: BaseNode | null): node is SceneNode => node !== null && isSceneNode(node);

figma.ui.onmessage = async (msg: any) => {
  const { type, requestId } = msg;
  console.log('[Plugin Main] Received:', type);

  try {
    switch (type) {
      case 'GET_SELECTION': {
        const selection = figma.currentPage.selection;
        if (selection.length === 0) return respondError(requestId, 'NO_SELECTION');
        respond(requestId, msg.format === 'json' ? serializeSelection(selection) : outlineSelection(selection, chunkOf(msg.chunk), undefined, formatOf(msg.format)));
        break;
      }

      case 'GET_DOCUMENT_INFO': {
        const doc = figma.root;
        const page = figma.currentPage;
        respond(requestId, {
          documentId: doc.id,
          documentName: doc.name,
          pageId: page.id,
          pageName: page.name,
          pageCount: doc.children.length,
          pages: doc.children.map((p) => ({ id: p.id, name: p.name })),
        });
        break;
      }

      case 'GET_NODE_INFO': {
        const node = await figma.getNodeByIdAsync(msg.nodeId);
        if (!node) return respondError(requestId, `Node not found: ${msg.nodeId}`);
        if (msg.format === 'json') return respond(requestId, serializeNode(node as SceneNode));
        if (!isSceneNode(node)) return respondError(requestId, `Node ${msg.nodeId} is a page or document, pass a frame id or use format "json"`);
        respond(requestId, outlineSelection([node], chunkOf(msg.chunk), undefined, formatOf(msg.format)));
        break;
      }

      case 'GET_NODES_INFO': {
        const nodeIds: string[] = msg.nodeIds || [];
        const found = await Promise.all(nodeIds.map((id) => figma.getNodeByIdAsync(id)));
        if (msg.format === 'json') return respond(requestId, found.map((node) => (node ? serializeNode(node as SceneNode) : null)));
        respond(requestId, outlineSelection(found.filter(isPresentScene), chunkOf(msg.chunk), undefined, formatOf(msg.format)));
        break;
      }

      case 'GET_ANNOTATIONS': {
        const target = msg.nodeId
          ? await figma.getNodeByIdAsync(msg.nodeId)
          : figma.currentPage.selection[0];
        if (!target) return respondError(requestId, 'No target node');
        respond(requestId, (target as any).annotations ?? []);
        break;
      }

      case 'EXPORT_NODE': {
        const selection = figma.currentPage.selection;
        if (!msg.nodeId && selection.length === 0) return respondError(requestId, 'NO_SELECTION');
        if (!msg.nodeId && selection.length > 1) return respondError(requestId, 'Select one node to export, or pass a node id');
        const target = msg.nodeId ? await figma.getNodeByIdAsync(msg.nodeId) : selection[0];
        if (!target || !isSceneNode(target)) return respondError(requestId, `Node not found or not exportable: ${msg.nodeId}`);
        const scale = typeof msg.scale === 'number' && msg.scale > 0 ? msg.scale : 1;
        // The node's own size, whatever is clipped or spills out, so the image matches the box a browser will render.
        const bytes = await target.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: scale }, useAbsoluteBounds: true });
        respond(requestId, { id: target.id, name: target.name, png: figma.base64Encode(bytes), boxes: boxesOf(target, scale, placeholderIds(target)) });
        break;
      }

      default:
        respondError(requestId, `Unknown message type: ${type}`);
    }
  } catch (error) {
    console.error('[Plugin Main] Error handling', type, ':', error);
    respondError(requestId, String(error));
  }
};
