import { BLUR_SCALE, cssContainer, cssPlaceholder, cssRunStyle, cssTextBox, type CssContext, type Place } from './css';
import { gradientAngle, gradientHandles } from './gradient';
import { childrenOf, hex2, isAxisAligned, isFlow, isMirrored, isMixed, matrixOf, paintsOf, round, shorten, visiblePaints } from './shared';

type NodeKind = 'text' | 'placeholder' | 'container';

// What a container's children measure their xy from: the container itself, or for a group the nearest frame above it.
type Origin = { ref: string; x: number; y: number };

// A text node's font and quoted characters are kept apart from `line` so the default font can be left out when rendering.
// `css` is the same line written as CSS declarations, used when the css format is asked for.
// `sig` is the node's layout and style with names, ids and text left out, so look-alike siblings can be told apart from real copies.
// `texts` are the quoted strings in reading order; `repeat` is set on the first of a run of copies that are folded into it.
type OutlineNode = {
  kind: NodeKind;
  line: string;
  ref?: string;
  tail?: string;
  font?: string;
  origin?: Origin;
  children: OutlineNode[];
  css?: string;
  sig: string;
  texts: string[];
  repeat?: { count: number; texts: string[][] };
};

type Draft = Omit<OutlineNode, 'sig' | 'texts'>;

const seal = (draft: Draft, shape: string): OutlineNode => ({
  ...draft,
  sig: `${shape}${draft.font ?? ''}[${draft.children.map((child) => child.sig).join('|')}]`,
  texts: [...(draft.tail ? [draft.tail.trim()] : []), ...draft.children.reduce<string[]>((all, child) => all.concat(child.texts), [])],
});

type Stats = { visited: number; hidden: number; fonts: Record<string, number>; placeholders: Set<string> };

type Box = { width: number; height: number };

type TypeStyle = {
  fontSize: number;
  fontWeight: number;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  fills: ReadonlyArray<Paint> | symbol;
  textDecoration: TextDecoration;
  textCase: TextCase;
};

type Weight = { chars: number; lines: number };

// A chunk is a run of sibling subtrees under one parent; the parent's own line is repeated as context.
type Chunk = { path: OutlineNode[]; parent: OutlineNode | null; siblings: ReadonlyArray<OutlineNode>; start: number; count: number };

const CHUNK_CHARS = 16000;

const ART_TYPES: ReadonlySet<string> = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON']);
const TYPE_TAGS: Record<string, string> = {
  INSTANCE: 'INST',
  COMPONENT: 'COMP',
  COMPONENT_SET: 'COMPSET',
  RECTANGLE: 'RECT',
};
const DECORATIONS: Record<string, string> = { UNDERLINE: ' underline', STRIKETHROUGH: ' strike' };
const CASES: Record<string, string> = { UPPER: ' upper', LOWER: ' lower', TITLE: ' title', SMALL_CAPS: ' small-caps', SMALL_CAPS_FORCED: ' small-caps' };
const TEXT_RESIZE: Record<string, string> = { HEIGHT: ' wrap', NONE: ' fixed', TRUNCATE: ' ellipsis' };

// Each line of the legend is sent only when its marker shows up in the output.
type LegendEntry = { when: RegExp; text: string };

const LEGEND_START = '# FrameLink outline (px). [n] = number of children, copies included. Frames clip unless noclip; groups never.';
const LEGEND_END = 'If one node looks incomplete, get_node_info(nodeId=<its @id>, format="json") returns its raw tree (large, never for a whole frame).';
const QUOTED = /"(?:[^"\\]|\\.)*"/g;

const LEGEND_ENTRIES: ReadonlyArray<LegendEntry> = [
  { when: /^\s*\+\d+ copies/m, text: '+N copies = N more identical copies of the node above (same layout and style); each (...) holds that copy\'s texts in order, = meaning the same as the first copy.' },
  { when: /^\s*IMG /m, text: 'IMG = image/vector placeholder, same size. Draw it visibly: background #e6e6e6 with outline:1px dashed #9a9a9a;outline-offset:-1px.' },
  { when: /~|\bhug[xy]\b|\bfill[xy]\b/, text: '~ = size set by content or siblings (hugx/hugy/fillx/filly); no size at all = both axes.' },
  { when: / xy-?\d/, text: 'xy = position in parent, only where auto-layout does not place it (group children: from the nearest frame above).' },
  { when: / at-?\d/, text: 'at = page position of a selected root.' },
  { when: / rot-?\d/, text: 'rot = clockwise degrees about the top-left (xy is where that corner lands).' },
  { when: / flip[xy]| matrix\(/, text: 'flipx/flipy = mirrored; matrix(a,b,c,d,tx,ty) = CSS matrix, origin 0 0, replaces xy/rot.' },
  { when: / (row|col)\b/, text: 'row/col = auto-layout direction; gap, pad (t/r/b/l), align (main/cross axis).' },
  { when: / flexwrap/, text: 'flexwrap = wraps onto new rows, rowgapN = space between rows.' },
  { when: / (min|max)[wh]\d/, text: 'minw/maxw/minh/maxh = size limits.' },
  { when: /fill:|stroke:/, text: 'fill/stroke = #hex[@alpha] or img.' },
  { when: /linear-grad\(/, text: 'linear-grad(angle stops), stops are color pos%.' },
  { when: /radial-grad\(/, text: 'radial-grad(at cx%,cy% rx,ry [rot deg] stops) = an ellipse; radii in px.' },
  { when: /angular-grad\(/, text: 'angular-grad(at cx%,cy% fromNdeg stops) = conic, clockwise.' },
  { when: /stroke:/, text: 'stroke = color/width (t/r/b/l if sides differ), inside unless stroke-center/stroke-outside, dashN,M = dashed.' },
  { when: / r\d/, text: 'r = radius (tl/tr/br/bl if mixed).' },
  { when: / fx:/, text: 'fx = shadow(x y blur spread color) | inner-shadow(...) | blur(r) | bg-blur(r).' },
  { when: /dropshadow\(/, text: 'dropshadow = CSS filter drop-shadow: follows the content, not the box.' },
  { when: /(?:fx:|;)(?:bg-)?blur\(/, text: `blur(r) and bg-blur(r) give Figma's blur radius; in CSS use blur(${BLUR_SCALE} x r px), and backdrop-filter for bg-blur.` },
  { when: / blend:/, text: 'blend:mode = mix-blend-mode.' },
  { when: / mask\b/, text: 'mask = not drawn, clips the siblings listed after it.' },
  { when: / op\d/, text: 'op = opacity.' },
  { when: /^\s*TEXT /m, text: 'TEXT = size/lineHeight wWeight ls=letterSpacing, underline/strike/upper/lower/title; wrap = wraps at width, fixed = fixed box, ellipsis = truncated, none of these = hugs, never wraps (\\n = line break).' },
  { when: / t[av]:/, text: 'ta/tv = text align (tv only in fixed-height boxes).' },
  { when: /^\s*SPAN /m, text: 'SPAN = a styled run inside mixed text.' },
  { when: / font:/, text: 'font:Name only where it differs from the default font in the summary.' },
];

export type OutlineFormat = 'outline' | 'css';

// The layers the outline stubs out as images or icons, found by reading the node the same way the outline does.
export const placeholderIds = (root: SceneNode): Set<string> => {
  const stats: Stats = { visited: 0, hidden: 0, fonts: {}, placeholders: new Set() };
  build(root, stats, null, null);
  return stats.placeholders;
};

const CSS_LEGEND =
  '# FrameLink css (px). Each line is a layer with its CSS declarations in {…}, same tree as the outline. Assume box-sizing:border-box. ' +
  'position:absolute is relative to the nearest ancestor with position:relative, which is already set. Fill is background; strokes are inset or spread box-shadows because they take no layout room; ' +
  'image fills are #e6e6e6 placeholders. IMG = image/vector placeholder: size it exactly and keep the light fill and dashed outline it comes with, so it is visible. ' +
  '--figma-stroke:W gradient = a gradient stroke: draw it as an overlay (for example a ::before with that gradient as its background, cut to a W-wide inside ring with mask-composite:exclude); the box-shadow shows only its first colour. ' +
  '--figma-mask = not drawn, clips the siblings listed after it. ' +
  '[n] = number of children, copies included. +N copies = N more identical copies of the node above; each (...) holds that copy\'s texts in order, = meaning the same as the first copy. ' +
  'Text uses the default font in the summary unless font:Name is shown. ' +
  LEGEND_END;

// The css format reuses the whole tree, folding and chunking; only the text of each line changes.
const useCss = (node: OutlineNode): OutlineNode => ({ ...node, line: node.css ?? node.line, children: node.children.map(useCss) });

// Names and text are cut out first, so a layer called "mask" or a label saying "rot90" cannot switch an entry on.
const legendFor = (lines: ReadonlyArray<string>): string => {
  const bare = lines.map((line) => line.replace(QUOTED, '""')).join('\n');
  const used = LEGEND_ENTRIES.filter((entry) => entry.when.test(bare)).map((entry) => entry.text);
  return [LEGEND_START, ...used, LEGEND_END].join(' ');
};

const isPresent = <T>(value: T | null): value is T => value !== null;

const quote = (text: string): string => JSON.stringify(text);

const withAlpha = (color: RGB, alpha: number): string => {
  const rounded = Math.round(alpha * 100) / 100;
  return `#${shorten(`${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`)}${rounded === 1 ? '' : `@${rounded}`}`;
};

const describeGradient = (paint: GradientPaint, box: Box): string => {
  const opacity = paint.opacity ?? 1;
  const stops = paint.gradientStops.map((stop) => `${withAlpha(stop.color, stop.color.a * opacity)} ${Math.round(stop.position * 100)}%`).join(',');
  if (paint.type === 'GRADIENT_LINEAR') return `linear-grad(${gradientAngle(paint.gradientTransform, box)}deg ${stops})`;

  const handles = gradientHandles(paint.gradientTransform, box);
  const centre = handles ? `at${round(handles.cx * 100)}%,${round(handles.cy * 100)}% ` : '';
  // An ellipse looks the same turned half a revolution, so only a turn within a quarter either way is reported.
  const wrapped = handles ? ((handles.turn % 180) + 180) % 180 : 0;
  const turned = wrapped > 90 ? wrapped - 180 : wrapped;
  if (paint.type === 'GRADIENT_RADIAL') {
    const radii = handles ? `r${round(handles.rx)},${round(handles.ry)} ` : '';
    return `radial-grad(${centre}${radii}${Math.abs(turned) > 1 ? `rot${round(turned)} ` : ''}${stops})`;
  }
  if (paint.type === 'GRADIENT_ANGULAR') {
    return `angular-grad(${centre}${handles ? `from${Math.round(((90 + handles.turn) % 360 + 360) % 360)}deg ` : ''}${stops})`;
  }
  return `${paint.type.slice('GRADIENT_'.length).toLowerCase()}-grad(${stops})`;
};

const describePaint = (paint: Paint, box: Box): string => {
  if (paint.type === 'SOLID') return withAlpha(paint.color, paint.opacity ?? 1);
  if (paint.type === 'IMAGE') return 'img';
  if ('gradientStops' in paint) return describeGradient(paint, box);
  return paint.type.toLowerCase();
};

const NO_BOX: Box = { width: 1, height: 1 };

const describePaints = (paints: ReadonlyArray<Paint> | symbol, box: Box = NO_BOX): string => {
  const list = visiblePaints(paints);
  return list === null ? 'mixed' : list.map((paint) => describePaint(paint, box)).join(',');
};

const hasPaint = (paints: ReadonlyArray<Paint> | symbol, test: (paint: Paint) => boolean): boolean => {
  const list = visiblePaints(paints);
  return list !== null && list.some(test);
};

const isImage = (paint: Paint): boolean => paint.type === 'IMAGE';
const isAnyPaint = (): boolean => true;

const sizeOf = (node: SceneNode): string => `${round(node.width)}x${round(node.height)}`;

// Which axes hug their content or fill their parent, so the number Figma resolved for them is not a real constraint.
const flexOf = (node: SceneNode): { x: boolean; y: boolean } =>
  'layoutSizingHorizontal' in node
    ? { x: node.layoutSizingHorizontal !== 'FIXED', y: node.layoutSizingVertical !== 'FIXED' }
    : { x: false, y: false };

// A derived axis is shown as ~, and the size is left out when both are.
const dimsOf = (node: SceneNode, flexible: { x: boolean; y: boolean }): string =>
  flexible.x && flexible.y ? '' : ` ${flexible.x ? '~' : round(node.width)}x${flexible.y ? '~' : round(node.height)}`;

// Text only needs to say when it fills; hugging is already what "no wrap, no size" means.
const describeFilling = (node: SceneNode): string =>
  'layoutSizingHorizontal' in node
    ? `${node.layoutSizingHorizontal === 'FILL' ? ' fillx' : ''}${node.layoutSizingVertical === 'FILL' ? ' filly' : ''}`
    : '';

// A grid frame is not flowed like a row or column, so its children keep their own coordinates.
const isAutoLayout = isFlow;

// Auto-layout positions its own children; everything else, and absolutely positioned children, needs coordinates.
const positionOf = (node: SceneNode, parent: SceneNode | null): Place => {
  if (parent === null) return null;
  const absolute = 'layoutPositioning' in node && node.layoutPositioning === 'ABSOLUTE';
  if (isAutoLayout(parent) && !absolute) return null;
  const matrix = matrixOf(node);
  if (matrix !== null && isMirrored(node)) {
    // A mirrored node's x/y is its far edge, so the visible top-left is shifted back by the size. A mirror that is also turned is positioned by its matrix.
    if (!isAxisAligned(matrix)) return null;
    return { x: matrix[0][2] + Math.min(0, matrix[0][0]) * node.width, y: matrix[1][2] + Math.min(0, matrix[1][1]) * node.height };
  }
  return { x: node.x, y: node.y };
};

const placeOf = (at: Place): string => (at ? ` xy${round(at.x)},${round(at.y)}` : '');

// Page position of a selected root, only needed when several are selected so their spacing survives.
const pageAt = (node: SceneNode): string => {
  const [[, , x], [, , y]] = 'absoluteTransform' in node ? node.absoluteTransform : [[0, 0, 0], [0, 0, 0]];
  return ` at${round(x)},${round(y)}`;
};

// Figma's own names ("Frame 1204") say nothing the type tag does not.
const DEFAULT_NAME = /^(Frame|Group|Rectangle|Ellipse|Vector|Line|Polygon|Star|Component|Instance|Slice) \d+$/;

const nameOf = (node: SceneNode): string => (DEFAULT_NAME.test(node.name) ? '' : `${quote(node.name)} `);

const refOf = (node: SceneNode): string => `${nameOf(node)}@${node.id}`;

const originOf = (node: SceneNode): Origin => {
  const [[, , x], [, , y]] = 'absoluteTransform' in node ? node.absoluteTransform : [[0, 0, 0], [0, 0, 0]];
  return { ref: refOf(node), x, y };
};

const fine = (value: number): string => String(Math.round(value * 1000) / 1000);

// Figma reports rotation counter-clockwise; CSS rotates clockwise. A mirrored node is described by its flip instead.
// ponytail: a mirrored-and-turned node inside auto-layout still gets a matrix; its translation is then the layout slot, not exact.
const describeTransform = (node: SceneNode): string => {
  const matrix = matrixOf(node);
  if (matrix !== null && isMirrored(node)) {
    if (!isAxisAligned(matrix)) return ` matrix(${[matrix[0][0], matrix[1][0], matrix[0][1], matrix[1][1], matrix[0][2], matrix[1][2]].map(fine).join(',')})`;
    return `${matrix[0][0] < 0 ? ' flipx' : ''}${matrix[1][1] < 0 ? ' flipy' : ''}`;
  }
  return 'rotation' in node && Math.abs(node.rotation) > 0.05 ? ` rot${round(-node.rotation)}` : '';
};

const describeSizing = (node: SceneNode): string => {
  if (!('layoutSizingHorizontal' in node)) return '';
  const parts: string[] = [];
  if (node.layoutSizingHorizontal !== 'FIXED') parts.push(`${node.layoutSizingHorizontal.toLowerCase()}x`);
  if (node.layoutSizingVertical !== 'FIXED') parts.push(`${node.layoutSizingVertical.toLowerCase()}y`);
  return parts.length ? ` ${parts.join(' ')}` : '';
};

const describeLimits = (node: SceneNode): string => {
  if (!('minWidth' in node)) return '';
  const limits: Array<[string, number | null]> = [['minw', node.minWidth], ['maxw', node.maxWidth], ['minh', node.minHeight], ['maxh', node.maxHeight]];
  return limits.map(([name, value]) => (value === null ? '' : ` ${name}${round(value)}`)).join('');
};

// Padding, gap and alignment only mean something on auto-layout frames, so they are skipped elsewhere.
const describeLayout = (node: SceneNode): string => {
  if (!('layoutMode' in node) || !isAutoLayout(node)) return '';
  const parts = [node.layoutMode === 'HORIZONTAL' ? 'row' : 'col'];
  if ('layoutWrap' in node && node.layoutWrap === 'WRAP') {
    parts.push('flexwrap');
    if (node.counterAxisSpacing && node.counterAxisSpacing !== node.itemSpacing) parts.push(`rowgap${round(node.counterAxisSpacing)}`);
  }
  if (node.itemSpacing) parts.push(`gap${round(node.itemSpacing)}`);
  const pads = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft];
  if (pads.some(Boolean)) parts.push(`pad${pads.map(round).join('/')}`);
  if (node.primaryAxisAlignItems !== 'MIN' || node.counterAxisAlignItems !== 'MIN') {
    parts.push(`align:${node.primaryAxisAlignItems}/${node.counterAxisAlignItems}`);
  }
  return ` ${parts.join(' ')}`;
};

const describeFill = (node: SceneNode): string => {
  const fills = describePaints(paintsOf(node, 'fills'), node);
  return fills ? ` fill:${fills}` : '';
};

// Figma reports the single weight as mixed when the sides differ; then each side is given, top/right/bottom/left.
const describeStrokeWeight = (node: SceneNode): string => {
  if (!('strokeWeight' in node)) return '';
  if (typeof node.strokeWeight === 'number') return `/${round(node.strokeWeight)}`;
  if (!('strokeTopWeight' in node)) return '';
  return `/${[node.strokeTopWeight, node.strokeRightWeight, node.strokeBottomWeight, node.strokeLeftWeight].map(round).join('/')}`;
};

const describeDash = (node: SceneNode): string =>
  'dashPattern' in node && node.dashPattern.length ? ` dash${node.dashPattern.map(round).join(',')}` : '';

const describeStroke = (node: SceneNode): string => {
  const strokes = describePaints(paintsOf(node, 'strokes'), node);
  if (!strokes) return '';
  // Lines have no inside, so their alignment says nothing.
  const align = 'strokeAlign' in node && node.strokeAlign !== 'INSIDE' && node.type !== 'LINE' ? ` stroke-${node.strokeAlign.toLowerCase()}` : '';
  return ` stroke:${strokes}${describeStrokeWeight(node)}${align}${describeDash(node)}`;
};

const describeRadius = (node: SceneNode): string => {
  if (!('cornerRadius' in node)) return '';
  if (typeof node.cornerRadius === 'number') return node.cornerRadius ? ` r${round(node.cornerRadius)}` : '';
  if (!('topLeftRadius' in node)) return '';
  const corners = [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius];
  return ` r${corners.map(round).join('/')}`;
};

const describeOpacity = (node: SceneNode): string =>
  'opacity' in node && node.opacity < 1 ? ` op${Math.round(node.opacity * 100) / 100}` : '';

const describeBlend = (node: SceneNode): string =>
  'blendMode' in node && node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL' ? ` blend:${node.blendMode.toLowerCase().replace(/_/g, '-')}` : '';

// A mask is not drawn itself; it cuts the siblings that come after it.
const describeMask = (node: SceneNode): string => {
  if (!('isMask' in node) || !node.isMask) return '';
  return 'maskType' in node && node.maskType !== 'ALPHA' ? ` mask:${node.maskType.toLowerCase()}` : ' mask';
};

// How a node mixes with what is behind it and what follows it.
const describeCompose = (node: SceneNode): string => `${describeOpacity(node)}${describeBlend(node)}${describeMask(node)}`;

const describeClip =(node: SceneNode): string => ('clipsContent' in node && node.clipsContent === false ? ' noclip' : '');

// A shadow on a layer with no fill of its own follows the shape of what it holds, which a CSS box-shadow cannot do.
const describeEffect = (effect: Effect, followsContent: boolean): string => {
  if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
    const name = effect.type === 'INNER_SHADOW' ? 'inner-shadow' : followsContent ? 'dropshadow' : 'shadow';
    const values = [effect.offset.x, effect.offset.y, effect.radius, effect.spread ?? 0].map(round).join(' ');
    return `${name}(${values} ${withAlpha(effect.color, effect.color.a)})`;
  }
  if (effect.type === 'LAYER_BLUR') return `blur(${round(effect.radius)})`;
  if (effect.type === 'BACKGROUND_BLUR') return `bg-blur(${round(effect.radius)})`;
  return '';
};

const describeEffects = (node: SceneNode): string => {
  if (!('effects' in node)) return '';
  const followsContent = node.type !== 'TEXT' && !hasPaint(paintsOf(node, 'fills'), isAnyPaint);
  const effects = node.effects
    .filter((effect) => effect.visible !== false)
    .map((effect) => describeEffect(effect, followsContent))
    .filter(Boolean);
  return effects.length ? ` fx:${effects.join(';')}` : '';
};

const describeLineHeight = (lineHeight: LineHeight): string =>
  lineHeight.unit === 'AUTO' ? 'auto' : `${round(lineHeight.value)}${lineHeight.unit === 'PERCENT' ? '%' : ''}`;

const describeLetterSpacing = (letterSpacing: LetterSpacing): string =>
  letterSpacing.value ? ` ls${round(letterSpacing.value)}${letterSpacing.unit === 'PERCENT' ? '%' : ''}` : '';

const describeTypeStyle = (style: TypeStyle): string => {
  const fill = describePaints(style.fills);
  const base = `${round(style.fontSize)}/${describeLineHeight(style.lineHeight)} w${style.fontWeight}`;
  const marks = `${DECORATIONS[style.textDecoration] ?? ''}${CASES[style.textCase] ?? ''}`;
  return `${base}${describeLetterSpacing(style.letterSpacing)}${marks}${fill ? ` fill:${fill}` : ''}`;
};

const fontOf = (font: FontName): string => `${font.family}${font.style.toLowerCase().includes('italic') ? '/italic' : ''}`;

const isItalic = (font: FontName): boolean => font.style.toLowerCase().includes('italic');

const countFont = (stats: Stats, font: string): void => {
  stats.fonts[font] = (stats.fonts[font] ?? 0) + 1;
};

const textNode = (node: TextNode, place: string, stats: Stats, isRoot: boolean, ctx: CssContext): OutlineNode => {
  // Vertical alignment only shows when the box has a height of its own to align within.
  const fixedHeight = node.textAutoResize === 'NONE' || node.textAutoResize === 'TRUNCATE';
  const across = node.textAlignHorizontal !== 'LEFT' ? ` ta:${node.textAlignHorizontal}` : '';
  const down = fixedHeight && node.textAlignVertical !== 'TOP' ? ` tv:${node.textAlignVertical}` : '';
  const align = `${across}${down}`;
  // A selected root keeps its size; below that, text that hugs or fills has no size of its own to give.
  const flex = flexOf(node);
  const hugs = node.textAutoResize === 'WIDTH_AND_HEIGHT';
  const dims = isRoot ? ` ${sizeOf(node)}` : dimsOf(node, { x: hugs || flex.x, y: hugs || node.textAutoResize === 'HEIGHT' || flex.y });
  const box = `${dims}${place}${describeFilling(node)}${describeTransform(node)}${TEXT_RESIZE[node.textAutoResize] ?? ''}${describeCompose(node)}${describeEffects(node)}`;
  const { fontSize, fontWeight, lineHeight, letterSpacing, fills, fontName, textDecoration, textCase } = node;

  if (
    typeof fontSize === 'number' &&
    typeof fontWeight === 'number' &&
    !isMixed(lineHeight) &&
    !isMixed(letterSpacing) &&
    !isMixed(fills) &&
    !isMixed(fontName) &&
    !isMixed(textDecoration) &&
    !isMixed(textCase)
  ) {
    const font = fontOf(fontName);
    countFont(stats, font);
    const style = describeTypeStyle({ fontSize, fontWeight, lineHeight, letterSpacing, fills, textDecoration, textCase });
    const line = `TEXT${box} ${style}${align}`;
    const css = `TEXT {${cssTextBox(node, ctx, isRoot)};${cssRunStyle({ fontSize, fontWeight, lineHeight, letterSpacing, fills, textDecoration, textCase }, isItalic(fontName))}}`;
    return seal({ kind: 'text', children: [], font, line, css, tail: ` ${quote(node.characters)}` }, line);
  }

  // Mixed styles inside one text layer: report each run on its own line.
  const segments = node.getStyledTextSegments(['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'fills', 'fontName', 'textDecoration', 'textCase']);
  const children = segments.map((segment): OutlineNode => {
    const font = fontOf(segment.fontName);
    countFont(stats, font);
    const line = `SPAN ${describeTypeStyle(segment)}`;
    const css = `SPAN {${cssRunStyle(segment, isItalic(segment.fontName))}}`;
    return seal({ kind: 'text', children: [], font, line, css, tail: ` ${quote(segment.characters)}` }, line);
  });
  const line = `TEXT${box} mixed${align}`;
  return seal({ kind: 'text', children, line, css: `TEXT {${cssTextBox(node, ctx, isRoot)}}` }, line);
};

const isArtLeaf = (node: SceneNode): boolean => {
  if (ART_TYPES.has(node.type)) return true;
  return hasPaint(paintsOf(node, 'fills'), isImage) && childrenOf(node).length === 0;
};

// A vector's stroke and radius belong to the drawing, so only image boxes report them.
const placeholder = (node: SceneNode, place: string, ctx: CssContext, stats: Stats): OutlineNode => {
  stats.placeholders.add(node.id);
  const shape = node.type === 'ELLIPSE' ? ' ellipse' : '';
  const box = ART_TYPES.has(node.type) ? '' : `${describeStroke(node)}${describeRadius(node)}`;
  const look = `${describeCompose(node)}${describeTransform(node)}${describeEffects(node)}`;
  const rest = `${sizeOf(node)}${place}${shape}${box}${look}`;
  const css = `IMG ${nameOf(node)}{${cssPlaceholder(node, ctx, !ART_TYPES.has(node.type))}}`;
  return seal({ kind: 'placeholder', ref: refOf(node), children: [], line: `IMG ${nameOf(node)}${rest}`, css }, `IMG ${rest}`);
};

// Anything painted, clipped to a radius or shadowed is lost if the frame is folded into its icon.
const hasOwnLook = (node: SceneNode): boolean =>
  hasPaint(paintsOf(node, 'fills'), isAnyPaint) || hasPaint(paintsOf(node, 'strokes'), isAnyPaint) || describeRadius(node) !== '' || describeEffects(node) !== '';

// `parent` is null for a selected root. Instances are kept whole: buttons, cards and chips are instances.
const build = (node: SceneNode, stats: Stats, parent: SceneNode | null, parentOrigin: Origin | null, rootPlace = ''): OutlineNode | null => {
  stats.visited += 1;
  if (!node.visible && parent !== null) {
    stats.hidden += 1;
    return null;
  }
  const at = positionOf(node, parent);
  const place = parent === null ? rootPlace : placeOf(at);
  const ctx: CssContext = { parent, place: at, placedChildren: childrenOf(node).some((child) => child.visible && positionOf(child, node) !== null) };
  if (node.type === 'TEXT') return textNode(node, place, stats, parent === null, ctx);
  if (isArtLeaf(node)) return placeholder(node, place, ctx, stats);

  const origin = node.type === 'GROUP' && parentOrigin ? parentOrigin : originOf(node);
  const children = childrenOf(node)
    .map((child) => build(child, stats, node, origin))
    .filter(isPresent);

  // A frame that only wraps images/icons and has no look of its own is just an icon: one placeholder.
  // An auto-layout row of several pieces is real layout, so it stays.
  const isIcon = children.length === 1 || !isAutoLayout(node);
  if (children.length > 0 && isIcon && !hasOwnLook(node) && children.every((child) => child.kind === 'placeholder')) {
    return placeholder(node, place, ctx, stats);
  }

  const tag = TYPE_TAGS[node.type] ?? node.type;
  const count = children.length ? ` [${children.length}]` : '';
  const dims = parent === null ? ` ${sizeOf(node)}` : dimsOf(node, flexOf(node));
  const style = `${describeFill(node)}${describeStroke(node)}${describeRadius(node)}${describeCompose(node)}${describeTransform(node)}${describeClip(node)}${describeEffects(node)}`;
  const rest = `${count}${dims}${place}${describeSizing(node)}${describeLimits(node)}${describeLayout(node)}${style}`;
  const css = `${tag} ${refOf(node)}${count} {${cssContainer(node, ctx, parent === null)}}`;
  return seal({ kind: 'container', ref: refOf(node), origin, children, line: `${tag} ${refOf(node)}${rest}`, css }, `${tag}${rest}`);
};

const renderLine = (node: OutlineNode, defaultFont: string | undefined): string => {
  const font = node.font && node.font !== defaultFont ? ` font:${node.font}` : '';
  return `${node.line}${font}${node.tail ?? ''}`;
};

// Folded copies sit right after the node they copy, as one line holding each copy's texts.
const SAME = '=';

const repeatLine = (node: OutlineNode): string => {
  if (!node.repeat) return '';
  // A text equal to the first copy's is written as a bare =; when nothing differs there is no list at all.
  const differs = node.repeat.texts.some((texts) => texts.some((text) => text !== SAME));
  const tuples = differs ? node.repeat.texts.map((texts) => `(${texts.join(',')})`) : [];
  return `+${node.repeat.count} copies${tuples.length ? ` ${tuples.join(' ')}` : ''}`;
};

const render = (node: OutlineNode, depth: number, lines: string[], defaultFont: string | undefined): void => {
  lines.push(`${'  '.repeat(depth)}${renderLine(node, defaultFont)}`);
  node.children.forEach((child) => render(child, depth + 1, lines, defaultFont));
  if (node.repeat) lines.push(`${'  '.repeat(depth)}${repeatLine(node)}`);
};

const renderedChars = (node: OutlineNode): number => {
  const out: string[] = [];
  render(node, 0, out, undefined);
  return out.join('\n').length + 1;
};

// Adjacent siblings with the same layout and style differ only in their text, so the first is kept and the rest become one line.
// A run is folded only when that is shorter, and the kept copy is left whole inside. ponytail: adjacent runs only, an alternating pattern is not folded.
const compress = (nodes: ReadonlyArray<OutlineNode>): OutlineNode[] => {
  const out: OutlineNode[] = [];
  let start = 0;
  while (start < nodes.length) {
    let end = start + 1;
    while (end < nodes.length && nodes[end].sig === nodes[start].sig) end += 1;
    const run = nodes.slice(start, end);
    const folded: OutlineNode = { ...run[0], repeat: { count: run.length - 1, texts: run.slice(1).map((copy) => copy.texts.map((text, index) => (text === run[0].texts[index] ? SAME : text))) } };
    const saved = run.slice(1).reduce((sum, copy) => sum + renderedChars(copy), 0) - repeatLine(folded).length - 1;
    if (run.length > 1 && saved > 0) out.push(folded);
    else out.push(...run.map((node) => ({ ...node, children: compress(node.children) })));
    start = end;
  }
  return out;
};

const countPlaceholders = (nodes: ReadonlyArray<OutlineNode>): number =>
  nodes.reduce((sum, node) => sum + (node.kind === 'placeholder' ? 1 : 0) + countPlaceholders(node.children), 0);

// Size of a subtree when printed at depth 0; each level down adds two spaces of indent per line.
const weigh = (node: OutlineNode, defaultFont: string | undefined, memo: Map<OutlineNode, Weight>): void => {
  const repeat = node.repeat ? repeatLine(node).length + 1 : 0;
  let chars = renderLine(node, defaultFont).length + 1 + repeat;
  let lines = node.repeat ? 2 : 1;
  node.children.forEach((child) => {
    weigh(child, defaultFont, memo);
    const weight = memo.get(child) ?? { chars: 0, lines: 0 };
    chars += weight.chars + 2 * weight.lines;
    lines += weight.lines;
  });
  memo.set(node, { chars, lines });
};

const sizeAt = (node: OutlineNode, depth: number, memo: Map<OutlineNode, Weight>): number => {
  const weight = memo.get(node) ?? { chars: 0, lines: 0 };
  return weight.chars + 2 * depth * weight.lines;
};

const planChunks = (roots: ReadonlyArray<OutlineNode>, defaultFont: string | undefined, memo: Map<OutlineNode, Weight>, budget: number): Chunk[] => {
  const chunks: Chunk[] = [];

  const pack = (parent: OutlineNode | null, siblings: ReadonlyArray<OutlineNode>, path: OutlineNode[]): void => {
    const depth = parent ? 1 : 0;
    const headerChars = parent ? renderLine(parent, defaultFont).length + 1 : 0;
    let start = 0;
    let used = headerChars;

    const flush = (end: number): void => {
      if (end > start) chunks.push({ path, parent, siblings, start, count: end - start });
      start = end;
      used = headerChars;
    };

    siblings.forEach((sibling, index) => {
      const size = sizeAt(sibling, depth, memo);
      if (size > budget && sibling.children.length > 0) {
        // Too big to sit in one chunk: its own line is shown as context by its sub-chunks instead.
        flush(index);
        start = index + 1;
        pack(sibling, sibling.children, [...path, sibling]);
        return;
      }
      if (used + size > budget) flush(index);
      used += size;
    });
    flush(siblings.length);
  };

  pack(null, roots, []);
  return chunks;
};

const approxTokens = (chars: number): string => `~${Math.round(chars / 400) / 10}K`;

const chunkChars = (chunk: Chunk, defaultFont: string | undefined, memo: Map<OutlineNode, Weight>): number => {
  const depth = chunk.parent ? 1 : 0;
  const header = chunk.parent ? renderLine(chunk.parent, defaultFont).length + 1 : 0;
  return chunk.siblings.slice(chunk.start, chunk.start + chunk.count).reduce((sum, node) => sum + sizeAt(node, depth, memo), header);
};

const brief = (node: OutlineNode): string => node.ref ?? (node.line.length > 40 ? `${node.line.slice(0, 40)}...` : node.line);

const renderManifest = (chunks: ReadonlyArray<Chunk>, header: string[], defaultFont: string | undefined, memo: Map<OutlineNode, Weight>): string => {
  const out = [
    ...header,
    `# Too large for one response: ${chunks.length} chunks. Call again with chunk=1..${chunks.length}. ` +
      'Each chunk repeats its parent line so xy stay unambiguous; the chunks together cover everything once. The legend is in chunk 1, so read that first.',
  ];
  chunks.forEach((chunk, index) => {
    const nodes = chunk.siblings.slice(chunk.start, chunk.start + chunk.count);
    const names = nodes.slice(0, 4).map(brief).join(', ') + (nodes.length > 4 ? `, +${nodes.length - 4} more` : '');
    const where = chunk.parent ? `in ${chunk.path.map((node) => node.ref ?? '').join(' > ')}` : 'at the top level';
    out.push(`chunk ${index + 1}/${chunks.length} ${approxTokens(chunkChars(chunk, defaultFont, memo))} tokens, ${where}: ${names}`);
  });
  return out.join('\n');
};

const renderChunk = (chunks: ReadonlyArray<Chunk>, number: number, header: string[], defaultFont: string | undefined): string => {
  const chunk = chunks[number - 1];
  const out = [...header, `# chunk ${number}/${chunks.length}`];
  const depth = chunk.parent ? 1 : 0;
  const indent = '  '.repeat(depth);

  if (chunk.parent) {
    out.push(`# in: ${chunk.path.map((node) => node.ref ?? '').join(' > ')}`);
    const origin = chunk.parent.origin;
    if (origin) out.push(`# xy below are measured from ${origin.ref}, which sits at page ${round(origin.x)},${round(origin.y)}`);
    out.push(renderLine(chunk.parent, defaultFont));
  }
  if (chunk.start > 0) out.push(`${indent}# ... ${chunk.start} earlier sibling(s) are in other chunks`);
  chunk.siblings.slice(chunk.start, chunk.start + chunk.count).forEach((node) => render(node, depth, out, defaultFont));
  const after = chunk.siblings.length - chunk.start - chunk.count;
  if (after > 0) out.push(`${indent}# ... ${after} later sibling(s) are in other chunks`);
  return out.join('\n');
};

const describeFonts = (fonts: Record<string, number>): string => {
  const names = Object.keys(fonts).sort((a, b) => fonts[b] - fonts[a]);
  const listed = names.map((name, index) => `${name} (${fonts[name]}${index === 0 ? ', default' : ''})`);
  return names.length ? `. Fonts: ${listed.join(', ')}` : '';
};

// `budget` is how many characters one response may hold; it is a parameter only so the check can force chunking on a small fixture.
export const outlineSelection = (selection: ReadonlyArray<SceneNode>, chunk?: number, budget: number = CHUNK_CHARS, format: OutlineFormat = 'outline'): string => {
  const stats: Stats = { visited: 0, hidden: 0, fonts: {}, placeholders: new Set() };
  const several = selection.length > 1;
  const built = selection.map((node) => build(node, stats, null, null, several ? pageAt(node) : '')).filter(isPresent);
  const defaultFont = Object.keys(stats.fonts).sort((a, b) => stats.fonts[b] - stats.fonts[a])[0];
  const placeholders = countPlaceholders(built);
  const folded = compress(built);
  const trees = format === 'css' ? folded.map(useCss) : folded;
  const lines: string[] = [];
  trees.forEach((tree) => render(tree, 0, lines, defaultFont));
  const summary = `# ${stats.visited} nodes read, ${placeholders} placeholders, ${stats.hidden} hidden skipped${describeFonts(stats.fonts)}`;
  const header = [format === 'css' ? CSS_LEGEND : legendFor(lines), summary];

  if (lines.join('\n').length <= budget) {
    if (chunk !== undefined && chunk !== 1) return `# chunk ${chunk} does not exist: this selection fits in one response, so only chunk 1 (or no chunk) is valid`;
    return [...header, ...lines].join('\n');
  }

  const memo = new Map<OutlineNode, Weight>();
  trees.forEach((tree) => weigh(tree, defaultFont, memo));
  const chunks = planChunks(trees, defaultFont, memo, budget);
  // The legend is sent once, with chunk 1; later chunks only point back to it.
  if (chunk === undefined) return renderManifest(chunks, [summary], defaultFont, memo);
  if (!Number.isInteger(chunk) || chunk < 1 || chunk > chunks.length) return `# chunk ${chunk} does not exist: this selection has ${chunks.length} chunks`;
  const continued = `# FrameLink outline, continued: the legend is in chunk 1${defaultFont ? `; default font ${defaultFont}` : ''}`;
  return renderChunk(chunks, chunk, chunk === 1 ? header : [continued], defaultFont);
};
