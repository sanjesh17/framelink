import { gradientAngle, gradientHandles } from './gradient';
import { childrenOf, hex2, isAxisAligned, isFlow, isMirrored, matrixOf, paintsOf, round, shorten, visiblePaints } from './shared';

// What the css format needs to know about a node beyond the node itself.
export type Place = { x: number; y: number } | null;
export type CssContext = { parent: SceneNode | null; place: Place; placedChildren: boolean };

type Mode = 'FIXED' | 'HUG' | 'FILL';

export type RunStyle = {
  fontSize: number;
  fontWeight: number;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  fills: ReadonlyArray<Paint>;
  textDecoration: TextDecoration;
  textCase: TextCase;
};

// Images and vectors are stand-ins, so they are drawn visibly: a light fill and a dashed outline that takes no layout room.
const PLACEHOLDER = '#e6e6e6';
const PLACEHOLDER_LOOK = `background:${PLACEHOLDER};outline:1px dashed #9a9a9a;outline-offset:-1px`;

// A CSS blur() is this fraction of Figma's blur radius. Measured, not assumed: Figma layer blurs of 201.7 and 34.8 were exported and compared
// with Chrome renderings at many factors, position-controlled. Both were best at 0.42 to 0.425 (mean error under 0.4 of 255); 0.5 was far worse.
// The browser's blur may differ slightly in other engines.
export const BLUR_SCALE = 0.425;

const JUSTIFY: Record<string, string> = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', SPACE_BETWEEN: 'space-between' };
const ALIGN: Record<string, string> = { MIN: 'flex-start', CENTER: 'center', MAX: 'flex-end', BASELINE: 'baseline' };
const TEXT_ALIGN: Record<string, string> = { CENTER: 'center', RIGHT: 'right', JUSTIFIED: 'justify' };
const TEXT_CASE: Record<string, string> = { UPPER: 'uppercase', LOWER: 'lowercase', TITLE: 'capitalize' };
const TEXT_DECORATION: Record<string, string> = { UNDERLINE: 'underline', STRIKETHROUGH: 'line-through' };

const px = (value: number): string => `${round(value)}px`;

const fine = (value: number): string => String(Math.round(value * 1000) / 1000);

const cssColor = (color: RGB, alpha: number): string => {
  const rounded = Math.round(alpha * 100) / 100;
  if (rounded >= 1) return `#${shorten(`${hex2(color.r)}${hex2(color.g)}${hex2(color.b)}`)}`;
  return `rgba(${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${rounded})`;
};

const colorOfPaint = (paint: Paint): string => {
  if (paint.type === 'SOLID') return cssColor(paint.color, paint.opacity ?? 1);
  if ('gradientStops' in paint && paint.gradientStops.length > 0) return cssColor(paint.gradientStops[0].color, paint.gradientStops[0].color.a * (paint.opacity ?? 1));
  return PLACEHOLDER;
};

const gradientLayer = (paint: GradientPaint, box: { width: number; height: number }): string => {
  const stops = paint.gradientStops.map((stop) => `${cssColor(stop.color, stop.color.a * (paint.opacity ?? 1))} ${Math.round(stop.position * 100)}%`).join(',');
  if (paint.type === 'GRADIENT_LINEAR') return `linear-gradient(${gradientAngle(paint.gradientTransform, box)}deg,${stops})`;
  const handles = gradientHandles(paint.gradientTransform, box);
  const at = handles ? ` at ${round(handles.cx * 100)}% ${round(handles.cy * 100)}%` : '';
  // ponytail: a radial gradient that is also turned is drawn unturned; the outline reports the turn.
  if (paint.type === 'GRADIENT_RADIAL') return `radial-gradient(ellipse ${handles ? `${px(handles.rx)} ${px(handles.ry)}` : 'farthest-corner'}${at},${stops})`;
  if (paint.type === 'GRADIENT_ANGULAR') return `conic-gradient(from ${handles ? Math.round((((90 + handles.turn) % 360) + 360) % 360) : 0}deg${at},${stops})`;
  return `linear-gradient(${stops})`;
};

const layerOf = (paint: Paint, box: { width: number; height: number }): string => {
  if (paint.type === 'SOLID') return cssColor(paint.color, paint.opacity ?? 1);
  if ('gradientStops' in paint) return gradientLayer(paint, box);
  return PLACEHOLDER;
};

// Figma lists fills bottom first, CSS lists backgrounds top first; only the bottom layer may be a bare colour.
const backgroundOf = (node: SceneNode): string[] => {
  const paints = visiblePaints(paintsOf(node, 'fills'));
  if (!paints || paints.length === 0) return [];
  const layers = paints.map((paint) => layerOf(paint, node)).reverse();
  const stacked = layers.map((layer, index) => (index < layers.length - 1 && !layer.includes('gradient(') ? `linear-gradient(${layer},${layer})` : layer));
  return [`background:${stacked.join(',')}`];
};

const hasFill = (node: SceneNode): boolean => (visiblePaints(paintsOf(node, 'fills'))?.length ?? 0) > 0;

type Look = { shadows: string[]; filters: string[]; backdrop: string[]; textShadows: string[]; extra: string[] };

const sideWeights = (node: SceneNode): [number, number, number, number] | null => {
  if (!('strokeWeight' in node)) return null;
  if (typeof node.strokeWeight === 'number') return [node.strokeWeight, node.strokeWeight, node.strokeWeight, node.strokeWeight];
  if (!('strokeTopWeight' in node)) return null;
  return [node.strokeTopWeight, node.strokeRightWeight, node.strokeBottomWeight, node.strokeLeftWeight];
};

// Strokes become inset or spread shadows, not borders, because Figma strokes take no room in the layout.
const strokeLook = (node: SceneNode, look: Look): void => {
  const strokes = visiblePaints(paintsOf(node, 'strokes'));
  const weights = sideWeights(node);
  if (!strokes || strokes.length === 0 || !weights) return;
  const color = colorOfPaint(strokes[strokes.length - 1]);
  const [top, right, bottom, left] = weights;
  const dashed = 'dashPattern' in node && node.dashPattern.length > 0;
  if (node.type === 'LINE') {
    look.extra.push(`border-top:${px(top)} ${dashed ? 'dashed' : 'solid'} ${color}`, 'height:0');
    return;
  }
  const even = top === right && right === bottom && bottom === left;
  if (even && dashed) {
    look.extra.push(`border:${px(top)} dashed ${color}`);
    return;
  }
  if (even) {
    const align = 'strokeAlign' in node ? node.strokeAlign : 'INSIDE';
    if (align === 'OUTSIDE') look.shadows.push(`0 0 0 ${px(top)} ${color}`);
    else if (align === 'CENTER') look.shadows.push(`inset 0 0 0 ${px(top / 2)} ${color}`, `0 0 0 ${px(top / 2)} ${color}`);
    else look.shadows.push(`inset 0 0 0 ${px(top)} ${color}`);
    // A shadow cannot carry a gradient, so it shows the first colour and the gradient travels as a custom property to draw as an overlay.
    const paint = strokes[strokes.length - 1];
    if ('gradientStops' in paint) look.extra.push(`--figma-stroke:${px(top)} ${gradientLayer(paint, node)}`);
    return;
  }
  // ponytail: sides that differ are always drawn inside, whatever the stroke alignment says.
  if (top) look.shadows.push(`inset 0 ${px(top)} 0 0 ${color}`);
  if (right) look.shadows.push(`inset ${px(-right)} 0 0 0 ${color}`);
  if (bottom) look.shadows.push(`inset 0 ${px(-bottom)} 0 0 ${color}`);
  if (left) look.shadows.push(`inset ${px(left)} 0 0 0 ${color}`);
};

const effectLook = (node: SceneNode, look: Look): void => {
  if (!('effects' in node)) return;
  const isText = node.type === 'TEXT';
  const followsContent = !isText && !hasFill(node);
  node.effects
    .filter((effect) => effect.visible !== false)
    .forEach((effect) => {
      if (effect.type === 'LAYER_BLUR') look.filters.push(`blur(${px(effect.radius * BLUR_SCALE)})`);
      else if (effect.type === 'BACKGROUND_BLUR') look.backdrop.push(`blur(${px(effect.radius * BLUR_SCALE)})`);
      else if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        const color = cssColor(effect.color, effect.color.a);
        const reach = `${px(effect.offset.x)} ${px(effect.offset.y)} ${px(effect.radius)}`;
        if (effect.type === 'INNER_SHADOW') look.shadows.push(`inset ${reach} ${px(effect.spread ?? 0)} ${color}`);
        else if (isText) look.textShadows.push(`${reach} ${color}`);
        else if (followsContent) look.filters.push(`drop-shadow(${reach} ${color})`);
        else look.shadows.push(`${reach} ${px(effect.spread ?? 0)} ${color}`);
      }
    });
};

const radiusOf = (node: SceneNode): string[] => {
  if (node.type === 'ELLIPSE') return ['border-radius:50%'];
  if (!('cornerRadius' in node)) return [];
  if (typeof node.cornerRadius === 'number') return node.cornerRadius ? [`border-radius:${px(node.cornerRadius)}`] : [];
  if (!('topLeftRadius' in node)) return [];
  return [`border-radius:${[node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius].map(px).join(' ')}`];
};

const composeOf = (node: SceneNode): string[] => {
  const out: string[] = [];
  if ('opacity' in node && node.opacity < 1) out.push(`opacity:${Math.round(node.opacity * 100) / 100}`);
  if ('blendMode' in node && node.blendMode !== 'PASS_THROUGH' && node.blendMode !== 'NORMAL') out.push(`mix-blend-mode:${node.blendMode.toLowerCase().replace(/_/g, '-')}`);
  if ('isMask' in node && node.isMask) out.push(`--figma-mask:${'maskType' in node ? node.maskType.toLowerCase() : 'alpha'}`);
  return out;
};

const transformOf = (node: SceneNode): string[] => {
  const matrix = matrixOf(node);
  if (matrix !== null && isMirrored(node)) {
    if (!isAxisAligned(matrix)) {
      return [`transform:matrix(${[matrix[0][0], matrix[1][0], matrix[0][1], matrix[1][1], matrix[0][2], matrix[1][2]].map(fine).join(',')})`, 'transform-origin:0 0'];
    }
    return [`transform:${[matrix[0][0] < 0 ? 'scaleX(-1)' : '', matrix[1][1] < 0 ? 'scaleY(-1)' : ''].filter(Boolean).join(' ')}`];
  }
  return 'rotation' in node && Math.abs(node.rotation) > 0.05 ? [`transform:rotate(${round(-node.rotation)}deg)`, 'transform-origin:0 0'] : [];
};

type Appearance = { fill: boolean; box: boolean };

// `box` is off for vectors and text, whose stroke and radius belong to the drawing or the glyphs.
const appearanceOf = (node: SceneNode, { fill, box }: Appearance): string[] => {
  const look: Look = { shadows: [], filters: [], backdrop: [], textShadows: [], extra: [] };
  if (box) strokeLook(node, look);
  effectLook(node, look);
  return [
    ...(fill ? backgroundOf(node) : []),
    ...(box ? radiusOf(node) : []),
    ...(look.shadows.length ? [`box-shadow:${look.shadows.join(',')}`] : []),
    ...(look.filters.length ? [`filter:${look.filters.join(' ')}`] : []),
    ...(look.backdrop.length ? [`backdrop-filter:${look.backdrop.join(' ')}`] : []),
    ...(look.textShadows.length ? [`text-shadow:${look.textShadows.join(',')}`] : []),
    ...look.extra,
    ...composeOf(node),
    ...transformOf(node),
  ];
};

const flowOf = (ctx: CssContext): 'row' | 'column' | null =>
  ctx.parent !== null && 'layoutMode' in ctx.parent && isFlow(ctx.parent) ? (ctx.parent.layoutMode === 'HORIZONTAL' ? 'row' : 'column') : null;

const positionRules = (node: SceneNode, ctx: CssContext): string[] => {
  if (ctx.place) return ['position:absolute', `left:${px(ctx.place.x)}`, `top:${px(ctx.place.y)}`];
  const matrix = matrixOf(node);
  return ctx.parent !== null && matrix !== null && isMirrored(node) && !isAxisAligned(matrix) ? ['position:absolute', 'left:0', 'top:0'] : [];
};

// Fixed sizes are written out; hugging needs nothing; filling is flex growth along the parent's main axis and stretch across it.
const sizeRules = (node: SceneNode, ctx: CssContext, isRoot: boolean, modes: { x: Mode; y: Mode }): string[] => {
  const flow = flowOf(ctx);
  const rule = (axis: 'width' | 'height', mode: Mode, length: number): string[] => {
    if (isRoot || mode === 'FIXED') return [`${axis}:${px(length)}`];
    if (mode === 'HUG') return [];
    if (flow === null) return [`${axis}:100%`];
    const main = (flow === 'row' && axis === 'width') || (flow === 'column' && axis === 'height');
    return main ? ['flex:1 1 0', `min-${axis}:0`] : ['align-self:stretch'];
  };
  return [...rule('width', modes.x, node.width), ...rule('height', modes.y, node.height)];
};

const modesOf = (node: SceneNode): { x: Mode; y: Mode } =>
  'layoutSizingHorizontal' in node ? { x: node.layoutSizingHorizontal, y: node.layoutSizingVertical } : { x: 'FIXED', y: 'FIXED' };

const limitsOf = (node: SceneNode): string[] => {
  if (!('minWidth' in node)) return [];
  const limits: Array<[string, number | null]> = [['min-width', node.minWidth], ['max-width', node.maxWidth], ['min-height', node.minHeight], ['max-height', node.maxHeight]];
  return limits.map(([name, value]) => (value === null ? '' : `${name}:${px(value)}`)).filter(Boolean);
};

const paddingOf = (node: SceneNode & AutoLayoutMixin): string[] => {
  const pads = [node.paddingTop, node.paddingRight, node.paddingBottom, node.paddingLeft];
  if (!pads.some(Boolean)) return [];
  const [top, right, bottom, left] = pads;
  if (top === right && right === bottom && bottom === left) return [`padding:${px(top)}`];
  return [`padding:${top === bottom && right === left ? `${px(top)} ${px(right)}` : pads.map(px).join(' ')}`];
};

const gapOf = (node: SceneNode & AutoLayoutMixin): string[] => {
  const between = node.counterAxisSpacing;
  if (node.layoutWrap === 'WRAP' && between !== null && between !== node.itemSpacing) {
    const [row, column] = node.layoutMode === 'HORIZONTAL' ? [between, node.itemSpacing] : [node.itemSpacing, between];
    return [`gap:${px(row)} ${px(column)}`];
  }
  return node.itemSpacing ? [`gap:${px(node.itemSpacing)}`] : [];
};

const layoutOf = (node: SceneNode, ctx: CssContext): string[] => {
  if (isFlow(node) && 'layoutMode' in node) {
    return [
      'display:flex',
      `flex-direction:${node.layoutMode === 'HORIZONTAL' ? 'row' : 'column'}`,
      ...(node.layoutWrap === 'WRAP' ? ['flex-wrap:wrap'] : []),
      ...gapOf(node),
      ...paddingOf(node),
      ...(JUSTIFY[node.primaryAxisAlignItems] && node.primaryAxisAlignItems !== 'MIN' ? [`justify-content:${JUSTIFY[node.primaryAxisAlignItems]}`] : []),
      `align-items:${ALIGN[node.counterAxisAlignItems] ?? 'flex-start'}`,
    ];
  }
  return ctx.placedChildren && ctx.place === null ? ['position:relative'] : [];
};

// ponytail: a group becomes display:contents, so its own opacity or shadow is not drawn; its children keep their frame-relative positions.
export const cssContainer = (node: SceneNode, ctx: CssContext, isRoot: boolean): string => {
  if (node.type === 'GROUP') return 'display:contents';
  const clips = 'clipsContent' in node && node.clipsContent && childrenOf(node).length > 0;
  return [
    ...positionRules(node, ctx),
    ...sizeRules(node, ctx, isRoot, modesOf(node)),
    ...limitsOf(node),
    ...layoutOf(node, ctx),
    ...appearanceOf(node, { fill: true, box: true }),
    ...(clips ? ['overflow:hidden'] : []),
  ].join(';');
};

// `box` is false for vectors, which draw their own stroke and corners.
export const cssPlaceholder = (node: SceneNode, ctx: CssContext, box: boolean): string =>
  [...positionRules(node, ctx), `width:${px(node.width)}`, `height:${px(node.height)}`, ...appearanceOf(node, { fill: false, box }), PLACEHOLDER_LOOK].join(';');

export const cssTextBox = (node: TextNode, ctx: CssContext, isRoot: boolean): string => {
  const resize = node.textAutoResize;
  const sizing = modesOf(node);
  const x: Mode = sizing.x === 'FILL' ? 'FILL' : resize === 'WIDTH_AND_HEIGHT' ? 'HUG' : 'FIXED';
  const y: Mode = sizing.y === 'FILL' ? 'FILL' : resize === 'WIDTH_AND_HEIGHT' || resize === 'HEIGHT' ? 'HUG' : 'FIXED';
  const lines = node.characters.includes('\n');
  const space =
    resize === 'WIDTH_AND_HEIGHT'
      ? [lines ? 'white-space:pre' : 'white-space:nowrap']
      : resize === 'TRUNCATE'
        ? ['white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis']
        : lines
          ? ['white-space:pre-wrap']
          : [];
  const fixedHeight = resize === 'NONE' || resize === 'TRUNCATE';
  const down = fixedHeight && node.textAlignVertical !== 'TOP' ? ['display:flex', 'flex-direction:column', `justify-content:${node.textAlignVertical === 'CENTER' ? 'center' : 'flex-end'}`] : [];
  const across = TEXT_ALIGN[node.textAlignHorizontal] ? [`text-align:${TEXT_ALIGN[node.textAlignHorizontal]}`] : [];
  return [...positionRules(node, ctx), ...sizeRules(node, ctx, isRoot, { x, y }), ...space, ...down, ...across, ...appearanceOf(node, { fill: false, box: false })].join(';');
};

export const cssRunStyle = (style: RunStyle, italic: boolean): string => {
  const paints = visiblePaints(style.fills);
  const top = paints && paints.length ? paints[paints.length - 1] : null;
  const lineHeight = style.lineHeight.unit === 'AUTO' ? 'normal' : style.lineHeight.unit === 'PIXELS' ? px(style.lineHeight.value) : `${round(style.lineHeight.value)}%`;
  const spacing = style.letterSpacing.value ? (style.letterSpacing.unit === 'PIXELS' ? px(style.letterSpacing.value) : `${fine(style.letterSpacing.value / 100)}em`) : '';
  return [
    `font-size:${px(style.fontSize)}`,
    `font-weight:${style.fontWeight}`,
    `line-height:${lineHeight}`,
    spacing ? `letter-spacing:${spacing}` : '',
    top ? `color:${colorOfPaint(top)}` : '',
    italic ? 'font-style:italic' : '',
    TEXT_DECORATION[style.textDecoration] ? `text-decoration:${TEXT_DECORATION[style.textDecoration]}` : '',
    TEXT_CASE[style.textCase] ? `text-transform:${TEXT_CASE[style.textCase]}` : '',
    style.textCase === 'SMALL_CAPS' || style.textCase === 'SMALL_CAPS_FORCED' ? 'font-variant:small-caps' : '',
  ]
    .filter(Boolean)
    .join(';');
};
