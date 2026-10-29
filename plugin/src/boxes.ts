type NodeBox = { id: string; name: string; type: string; parent: string | null; x: number; y: number; w: number; h: number; placeholder?: true };

const MAX_BOXES = 5000;

// Where every visible layer sits inside the exported image, so a pixel difference can be traced back to the layer that caused it.
// A layer inside a placeholder is part of the stub, so it is marked too: its differences are expected.
export const boxesOf = (root: SceneNode, scale: number, placeholders: ReadonlySet<string> = new Set()): NodeBox[] => {
  const origin = root.absoluteBoundingBox;
  const boxes: NodeBox[] = [];
  if (!origin) return boxes;

  const visit = (node: SceneNode, parent: string | null, inStub: boolean): void => {
    if (boxes.length >= MAX_BOXES) return;
    const stub = inStub || placeholders.has(node.id);
    const bounds = node.absoluteBoundingBox;
    if (bounds) {
      boxes.push({
        id: node.id,
        name: node.name,
        type: node.type,
        parent,
        x: Math.round((bounds.x - origin.x) * scale),
        y: Math.round((bounds.y - origin.y) * scale),
        w: Math.round(bounds.width * scale),
        h: Math.round(bounds.height * scale),
        ...(stub ? { placeholder: true as const } : {}),
      });
    }
    if ('children' in node) {
      // A layer with no box of its own hands its children to the nearest ancestor that has one.
      const owner = bounds ? node.id : parent;
      node.children.forEach((child) => {
        if (child.visible) visit(child, owner, stub);
      });
    }
  };

  visit(root, null, false);
  return boxes;
};
