// The raw tree behind format "json", for the one node whose outline looks incomplete.
// Figma nodes expose different properties per type, so they are read by name from a loose view of the node;
// that is the one place `unknown` is used, and every value is type-checked before it is kept.
type Loose = Record<string, unknown>;

type Plain = string | number | boolean;

type Rgba = { r: number; g: number; b: number; a: number };

type PaintData = { type: string; opacity: number; color?: Rgba; gradientStops?: Array<{ position: number; color: Rgba }>; gradientTransform?: number[][]; imageHash?: string; scaleMode?: string; blendMode?: string };

type EffectData = { type: string; opacity: number; blurRadius?: number; offset?: { x: number; y: number }; color?: Rgba; spread?: number };

const PLAIN_KEYS = [
  'opacity',
  'layoutMode',
  'layoutSizingHorizontal',
  'layoutSizingVertical',
  'layoutPositioning',
  'layoutWrap',
  'primaryAxisSizingMode',
  'counterAxisSizingMode',
  'primaryAxisAlignItems',
  'counterAxisAlignItems',
  'itemSpacing',
  'counterAxisSpacing',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'minWidth',
  'maxWidth',
  'minHeight',
  'maxHeight',
  'clipsContent',
  'isMask',
  'blendMode',
  'strokeWeight',
  'strokeTopWeight',
  'strokeRightWeight',
  'strokeBottomWeight',
  'strokeLeftWeight',
  'strokeAlign',
  'cornerRadius',
  'topLeftRadius',
  'topRightRadius',
  'bottomLeftRadius',
  'bottomRightRadius',
  'fontSize',
  'fontWeight',
  'textAlignHorizontal',
  'textAlignVertical',
  'textAutoResize',
  'textCase',
] as const;

type PlainKey = (typeof PLAIN_KEYS)[number];

type NodeData = {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  width: number;
  height: number;
  x: number;
  y: number;
  rotation?: number;
  constraints?: { horizontal: string; vertical: string };
  fills?: PaintData[];
  strokes?: PaintData[];
  dashPattern?: number[];
  effects?: EffectData[];
  characters?: string;
  fontFamily?: string;
  italic?: boolean;
  letterSpacing?: { value: number; unit: string };
  lineHeight?: { value?: number; unit: string };
  textDecoration?: string;
  children?: NodeData[];
} & Partial<Record<PlainKey, Plain>>;

const isPlain = (value: unknown): value is Plain => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';

const isRecord = (value: unknown): value is Loose => typeof value === 'object' && value !== null;

const numberOr = (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback);

// A paint's colour has no alpha of its own (its opacity does); a gradient stop does. Zero is a real alpha.
const rgbaOf = (value: unknown): Rgba => {
  const color = isRecord(value) ? value : {};
  return { r: numberOr(color.r, 0), g: numberOr(color.g, 0), b: numberOr(color.b, 0), a: numberOr(color.a, 1) };
};

const isShown = (item: unknown): item is Loose => isRecord(item) && item.visible !== false;

const paintOf = (paint: Loose): PaintData => {
  const data: PaintData = { type: String(paint.type), opacity: numberOr(paint.opacity, 1) };
  if (paint.type === 'SOLID') data.color = rgbaOf(paint.color);
  if (typeof paint.blendMode === 'string' && paint.blendMode !== 'NORMAL') data.blendMode = paint.blendMode;
  if (Array.isArray(paint.gradientStops)) {
    data.gradientStops = paint.gradientStops.map((stop: unknown) => {
      const item = isRecord(stop) ? stop : {};
      return { position: numberOr(item.position, 0), color: rgbaOf(item.color) };
    });
    if (Array.isArray(paint.gradientTransform)) data.gradientTransform = paint.gradientTransform.map((row: number[]) => row.slice());
  }
  if (paint.type === 'IMAGE') {
    if (typeof paint.imageHash === 'string') data.imageHash = paint.imageHash;
    if (typeof paint.scaleMode === 'string') data.scaleMode = paint.scaleMode;
  }
  return data;
};

const effectOf = (effect: Loose): EffectData => {
  const data: EffectData = { type: String(effect.type), opacity: numberOr(effect.opacity, 1) };
  if (typeof effect.radius === 'number') data.blurRadius = effect.radius;
  if (isRecord(effect.offset)) data.offset = { x: numberOr(effect.offset.x, 0), y: numberOr(effect.offset.y, 0) };
  if (isRecord(effect.color)) data.color = rgbaOf(effect.color);
  if (typeof effect.spread === 'number') data.spread = effect.spread;
  return data;
};

// Hidden paints and effects are left out: they draw nothing.
const shownList = <T>(value: unknown, convert: (item: Loose) => T): T[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const list = value.filter(isShown).map(convert);
  return list.length ? list : undefined;
};

const stub = (node: Loose): NodeData => ({ id: String(node.id ?? ''), name: String(node.name ?? ''), type: String(node.type ?? 'UNKNOWN'), visible: true, width: 0, height: 0, x: 0, y: 0 });

// One node that cannot be read must not lose its siblings, so the read is guarded here and nowhere deeper.
const readNode = (node: Loose): NodeData => {
  const data: NodeData = {
    id: String(node.id ?? ''),
    name: String(node.name ?? ''),
    type: String(node.type ?? ''),
    visible: node.visible !== false,
    width: numberOr(node.width, 0),
    height: numberOr(node.height, 0),
    x: numberOr(node.x, 0),
    y: numberOr(node.y, 0),
  };

  // A mixed value (a symbol) or a missing one is simply skipped.
  PLAIN_KEYS.forEach((key) => {
    const value = node[key];
    if (isPlain(value)) (data as Record<PlainKey, Plain | undefined>)[key] = value;
  });
  if (data.layoutMode === 'NONE') delete data.layoutMode;

  const fills = shownList(node.fills, paintOf);
  if (fills) data.fills = fills;
  const strokes = shownList(node.strokes, paintOf);
  if (strokes) data.strokes = strokes;
  const effects = shownList(node.effects, effectOf);
  if (effects) data.effects = effects;
  if (Array.isArray(node.dashPattern) && node.dashPattern.length) data.dashPattern = node.dashPattern.map(Number);

  if (isRecord(node.constraints)) data.constraints = { horizontal: String(node.constraints.horizontal ?? 'LEFT'), vertical: String(node.constraints.vertical ?? 'TOP') };
  if (typeof node.rotation === 'number' && node.rotation !== 0) data.rotation = node.rotation;

  if (node.type === 'TEXT') {
    if (typeof node.characters === 'string') data.characters = node.characters;
    if (isRecord(node.fontName)) {
      data.fontFamily = String(node.fontName.family);
      data.italic = String(node.fontName.style).toLowerCase().includes('italic');
    }
    if (isRecord(node.letterSpacing)) data.letterSpacing = { value: numberOr(node.letterSpacing.value, 0), unit: String(node.letterSpacing.unit) };
    if (isRecord(node.lineHeight)) {
      data.lineHeight = node.lineHeight.unit === 'AUTO' ? { unit: 'AUTO' } : { value: numberOr(node.lineHeight.value, 0), unit: String(node.lineHeight.unit) };
    }
    if (typeof node.textDecoration === 'string' && node.textDecoration !== 'NONE') data.textDecoration = node.textDecoration;
  }

  if (Array.isArray(node.children)) data.children = node.children.map((child: Loose) => serialize(child));
  return data;
};

const serialize = (node: Loose): NodeData => {
  try {
    return readNode(node);
  } catch (error) {
    console.error('[Plugin] Serialization error:', error);
    return stub(node);
  }
};

export const serializeNode = (node: SceneNode): NodeData => serialize(node as unknown as Loose);
