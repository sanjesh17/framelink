export const isMixed = (value: unknown): value is symbol => typeof value === 'symbol';

export const round = (value: number): string => String(Math.round(value * 10) / 10);

export const hex2 = (channel: number): string => {
  const hex = Math.round(channel * 255).toString(16);
  return hex.length === 1 ? `0${hex}` : hex;
};

// #ffffff reads as #fff to anyone writing CSS, and costs fewer tokens.
export const shorten = (hex: string): string => (/^(.)\1(.)\2(.)\3$/.test(hex) ? `${hex[0]}${hex[2]}${hex[4]}` : hex);

export const visiblePaints = (paints: ReadonlyArray<Paint> | symbol): ReadonlyArray<Paint> | null =>
  isMixed(paints) ? null : paints.filter((paint) => paint.visible !== false);

export const paintsOf = (node: SceneNode, key: 'fills' | 'strokes'): ReadonlyArray<Paint> | symbol =>
  key in node ? (node as GeometryMixin)[key] : [];

export const childrenOf = (node: SceneNode): ReadonlyArray<SceneNode> => ('children' in node ? node.children : []);

export const isFlow = (node: SceneNode): boolean => 'layoutMode' in node && (node.layoutMode === 'HORIZONTAL' || node.layoutMode === 'VERTICAL');

const EPSILON = 1e-6;

export const matrixOf = (node: SceneNode): Transform | null => ('relativeTransform' in node ? node.relativeTransform : null);

export const isMirrored = (node: SceneNode): boolean => {
  const matrix = matrixOf(node);
  return matrix !== null && matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0] < -EPSILON;
};

export const isAxisAligned = (matrix: Transform): boolean => Math.abs(matrix[0][1]) < EPSILON && Math.abs(matrix[1][0]) < EPSILON;
