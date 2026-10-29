// Run with: npm run check.
import assert from 'node:assert/strict';
import { outlineSelection, placeholderIds } from './src/outline';
import { boxesOf } from './src/boxes';
import { fake, solid, text, toNodes, type Fake } from './fixtures';

const stop = (position: number, r: number, g: number, b: number, a = 1): Fake => ({ position, color: { r, g, b, a } });

const gradient = (gradientTransform: number[][], gradientStops: Fake[]): Fake => ({
  type: 'GRADIENT_LINEAR',
  opacity: 1,
  gradientTransform,
  gradientStops,
});

const VERTICAL = [[0, 1, 0], [-1, 0, 1]];
const HORIZONTAL = [[1, 0, 0], [0, 1, 0]];

const card = fake('FRAME', 'Card', {
  width: 300,
  height: 200,
  layoutMode: 'VERTICAL',
  itemSpacing: 8,
  paddingTop: 16,
  paddingRight: 16,
  paddingBottom: 16,
  paddingLeft: 16,
  primaryAxisAlignItems: 'MIN',
  counterAxisAlignItems: 'MIN',
  cornerRadius: 16,
  clipsContent: true,
  fills: [solid(1, 1, 1)],
  children: [
    text('Title', 'Hello'),
    text('Price', '4004', { textDecoration: 'STRIKETHROUGH', textCase: 'UPPER' }),
    text('Para', 'a long paragraph', { textAutoResize: 'HEIGHT' }),
    fake('RECTANGLE', 'Outlined', { strokes: [solid(0, 0, 0)], strokeWeight: 2, strokeAlign: 'OUTSIDE' }),
    fake('VECTOR', 'Star'),
    fake('FRAME', 'IconFrame', { width: 101, children: [fake('VECTOR', 'Path')] }),
    fake('FRAME', 'RoundButton', { fills: [solid(0, 0, 0)], children: [fake('VECTOR', 'Arrow')] }),
    fake('RECTANGLE', 'Ghost', { visible: false }),
    fake('FRAME', 'Loose', { layoutMode: 'NONE', paddingTop: 12, clipsContent: false, children: [fake('RECTANGLE', 'Pinned', { x: 10, y: 20, fills: [solid(0, 0, 0)] })] }),
    fake('ELLIPSE', 'AbsDot', { layoutPositioning: 'ABSOLUTE', x: 5, y: 6, fills: [solid(0, 0, 0)] }),
    fake('RECTANGLE', 'GradV', { fills: [gradient(VERTICAL, [stop(0, 1, 1, 1), stop(1, 0, 0, 0, 0.5)])] }),
    fake('RECTANGLE', 'GradH', { fills: [gradient(HORIZONTAL, [stop(0, 1, 0, 0), stop(1, 0, 0, 1)])] }),
    fake('RECTANGLE', 'Tilted', { rotation: 30 }),
    fake('RECTANGLE', 'Shadowy', {
      effects: [
        { type: 'DROP_SHADOW', visible: true, color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 4 }, radius: 8, spread: 0 },
        { type: 'DROP_SHADOW', visible: false, color: { r: 0, g: 0, b: 0, a: 1 }, offset: { x: 9, y: 9 }, radius: 99 },
        { type: 'LAYER_BLUR', visible: true, radius: 4 },
      ],
    }),
    fake('LINE', 'Divider', { strokes: [solid(0.8, 0.8, 0.8)], strokeWeight: 1 }),
    fake('RECTANGLE', 'Photo', { fills: [{ type: 'IMAGE' }] }),
    fake('INSTANCE', 'IconButton', {
      fills: [solid(1, 1, 1)],
      children: [fake('FRAME', 'Box', { fills: [solid(0, 0, 0)], children: [fake('VECTOR', 'Glyph')] })],
    }),
    fake('INSTANCE', 'Button', {
      children: [fake('FRAME', 'Inner', { children: [text('Label', 'Buy'), fake('VECTOR', 'Chevron')] })],
    }),
    text('Mixed', 'AB', {
      fontSize: Symbol('mixed'),
      getStyledTextSegments: () => [
        { characters: 'A', fontSize: 12, fontWeight: 400, fontName: { family: 'Inter', style: 'Regular' }, lineHeight: { unit: 'AUTO' }, letterSpacing: { unit: 'PIXELS', value: 0 }, fills: [], textDecoration: 'NONE', textCase: 'ORIGINAL' },
        { characters: 'B', fontSize: 16, fontWeight: 700, fontName: { family: 'Roboto', style: 'Bold Italic' }, lineHeight: { unit: 'AUTO' }, letterSpacing: { unit: 'PIXELS', value: 0 }, fills: [], textDecoration: 'UNDERLINE', textCase: 'ORIGINAL' },
      ],
    }),
  ],
});

const output = outlineSelection(toNodes([card]));
const lines = output.split('\n');
const body = lines.slice(2);
const find = (needle: string): string | undefined => body.find((line) => line.includes(needle));

assert.match(lines[0], /^# FrameLink outline/);
assert.match(lines[0], /get_node_info\(nodeId=<its @id>, format="json"\)/, 'the legend tells the model the raw tree exists as a last resort');
assert.ok(find('FRAME "Card"')?.includes('col gap8 pad16/16/16/16'), 'auto-layout frame keeps gap and padding');
assert.ok(find('FRAME "Card"')?.includes('fill:#fff r16'), 'fill and radius are shown');
assert.ok(find('TEXT 14/20 w500')?.includes('fill:#30363d'), 'text shows type style and colour');
assert.ok(find('IMG "Star"'), 'vector becomes a placeholder');
assert.ok(find('IMG "IconFrame"') && !find('Path'), 'a frame holding only vectors becomes one placeholder');
assert.ok(find('FRAME "RoundButton"') && find('IMG "Arrow"'), 'a filled frame stays, its icon is a placeholder');
assert.ok(!find('Ghost'), 'hidden layers are skipped');
assert.ok(!find('"Loose"')?.includes('pad'), 'padding is ignored without auto-layout');
assert.ok(find('LINE "Divider"')?.includes('stroke:#ccc/1'), 'lines keep their stroke');
assert.ok(find('IMG "Photo"'), 'image fill becomes a placeholder');
assert.ok(find('INST "Button"')?.includes('[1]') && find('FRAME "Inner"')?.includes('[2]') && find('"Buy"') && find('IMG "Chevron"'), 'instances keep their structure, text and icons');
const iconAt = body.findIndex((line) => line.includes('INST "IconButton"'));
assert.ok(body[iconAt + 1].includes('FRAME "Box"') && body[iconAt + 2].includes('IMG "Glyph"'), 'a painted container inside an instance is kept');
assert.ok(find('SPAN 12/auto w400 "A"') && find('SPAN 16/auto w700 underline font:Roboto/italic "B"'), 'mixed text is split into runs, odd fonts are named');
assert.ok(find('TEXT 14/20 w500') && !find('font:Inter'), 'the default font is left out of each line');
assert.ok(find('RECT "Pinned"')?.includes('100x40 xy10,20'), 'children of a non-auto-layout frame get xy');
assert.ok(!find('FRAME "Loose"')?.includes('xy') && !find('"Title"')?.includes('xy'), 'children placed by auto-layout get no xy');
assert.ok(find('ELLIPSE "AbsDot"')?.includes('xy5,6'), 'absolutely positioned children keep xy');
assert.ok(find('"Buy"')?.includes('xy0,0'), 'instance internals report xy like any other frame');
assert.ok(find('FRAME "Loose"')?.includes('noclip') && !find('FRAME "Card"')?.includes('noclip'), 'only frames that do not clip are marked');
assert.ok(find('FRAME "Loose"')?.includes('[1]') && /FRAME "Card" @1:Card \[\d+\]/.test(find('FRAME "Card"') ?? ''), 'containers show how many children they list');
assert.ok(find('"4004"')?.includes('strike upper'), 'text decoration and case are shown');
assert.ok(find('wrap 14/20'), 'text that wraps in a fixed width is marked');
assert.ok(find('RECT "Outlined"')?.includes('stroke:#000/2 stroke-outside'), 'stroke alignment is shown when not inside');
assert.ok(!find('LINE "Divider"')?.includes('stroke-'), 'line stroke alignment is not reported');
assert.ok(find('RECT "GradV"')?.includes('fill:linear-grad(180deg #fff 0%,#000@0.5 100%)'), 'vertical gradient is 180deg with stops');
assert.ok(find('RECT "GradH"')?.includes('fill:linear-grad(90deg #f00 0%,#00f 100%)'), 'horizontal gradient is 90deg');
assert.ok(find('RECT "Tilted"')?.includes(' rot-30'), 'rotation is flipped to the CSS direction');
assert.ok(find('RECT "Shadowy"')?.includes('fx:dropshadow(0 4 8 0 #000@0.25);blur(4)') && !find('99'), 'visible effects carry values, hidden ones are skipped; a fill-less layer gets a content-following shadow');
assert.equal(lines[1], '# 28 nodes read, 6 placeholders, 1 hidden skipped. Fonts: Inter (5, default), Roboto/italic (1)');

// Placeholder fidelity and when a frame is folded into its icon.
const shadow = { type: 'DROP_SHADOW', visible: true, color: { r: 0, g: 0, b: 0, a: 0.25 }, offset: { x: 0, y: 4 }, radius: 8, spread: 0 };
const IMAGE_FILL = [{ type: 'IMAGE' }];
const media = fake('FRAME', 'Media', {
  layoutMode: 'VERTICAL',
  children: [
    fake('RECTANGLE', 'Avatar', { fills: IMAGE_FILL, cornerRadius: 8, strokes: [solid(0, 0, 0)], strokeWeight: 2, opacity: 0.5, effects: [shadow] }),
    fake('ELLIPSE', 'Orb', { fills: [gradient(HORIZONTAL, [stop(0, 1, 0, 0), stop(1, 0, 0, 1)])] }),
    fake('ELLIPSE', 'Face', { fills: IMAGE_FILL }),
    fake('VECTOR', 'Glyph', { strokes: [solid(0, 0, 0)], strokeWeight: 2, cornerRadius: 4 }),
    fake('FRAME', 'GradIcon', { fills: [gradient(HORIZONTAL, [stop(0, 1, 0, 0), stop(1, 0, 0, 1)])], children: [fake('VECTOR', 'Mark')] }),
    fake('FRAME', 'Badge', { cornerRadius: 50, clipsContent: true, children: [fake('RECTANGLE', 'Pic', { fills: IMAGE_FILL })] }),
    fake('FRAME', 'Pair', { layoutMode: 'HORIZONTAL', itemSpacing: 8, children: [fake('VECTOR', 'A'), fake('VECTOR', 'B', { width: 101 })] }),
    fake('FRAME', 'Lone', { layoutMode: 'HORIZONTAL', paddingTop: 4, children: [fake('VECTOR', 'C')] }),
    fake('FRAME', 'Glow', { effects: [shadow], children: [fake('VECTOR', 'D')] }),
    fake('FRAME', 'Faded', { opacity: 0.4, children: [fake('VECTOR', 'E')] }),
  ],
});
const mediaBody = outlineSelection(toNodes([media])).split('\n').slice(2);
const mediaLine = (needle: string): string | undefined => mediaBody.find((line) => line.includes(needle));

const avatar = mediaLine('IMG "Avatar"') ?? '';
assert.ok(['r8', 'stroke:#000/2', 'op0.5', 'fx:shadow(0 4 8 0 #000@0.25)'].every((part) => avatar.includes(part)), 'an image placeholder keeps radius, stroke, opacity and shadow');
assert.ok(mediaLine('ELLIPSE "Orb"')?.includes('fill:linear-grad') && !mediaLine('IMG "Orb"'), 'a gradient ellipse is drawn, not stubbed');
assert.ok(mediaLine('IMG "Face"')?.includes(' ellipse'), 'an image ellipse placeholder says it is round');
assert.ok(!mediaLine('IMG "Glyph"')?.includes('stroke') && !mediaLine('IMG "Glyph"')?.includes(' r4'), 'a vector placeholder does not report its drawing stroke or radius');
assert.ok(mediaLine('FRAME "GradIcon"') && mediaLine('IMG "Mark"'), 'a gradient frame around an icon is kept');
assert.ok(mediaLine('FRAME "Badge"') && mediaLine('IMG "Pic"'), 'a rounded clipping frame around an image is kept');
assert.ok(mediaLine('FRAME "Pair"') && mediaLine('IMG "A"') && mediaLine('IMG "B"') && !mediaLine('IMG "Pair"'), 'an auto-layout row of several pieces is kept');
assert.ok(mediaLine('IMG "Lone"'), 'an auto-layout frame around one icon is still just the icon');
assert.ok(mediaLine('FRAME "Glow"') && mediaLine('IMG "D"'), 'a shadowed frame around an icon is kept');
assert.ok(mediaLine('IMG "Faded"')?.includes('op0.4'), 'a folded icon keeps its opacity');

// Per-side strokes, dashes and vertical text alignment.
const lines2 = fake('FRAME', 'Lines', {
  children: [
    fake('RECTANGLE', 'Underline', { strokes: [solid(0, 0, 0)], strokeWeight: Symbol('mixed'), strokeTopWeight: 0, strokeRightWeight: 0, strokeBottomWeight: 1, strokeLeftWeight: 0 }),
    fake('RECTANGLE', 'Dashed', { strokes: [solid(0, 0, 0)], strokeWeight: 1, dashPattern: [4, 2] }),
    fake('RECTANGLE', 'Solid', { strokes: [solid(0, 0, 0)], strokeWeight: 1, dashPattern: [] }),
    text('Centered', 'Mid', { textAutoResize: 'NONE', textAlignVertical: 'CENTER' }),
    text('Hugging', 'Low', { textAutoResize: 'WIDTH_AND_HEIGHT', textAlignVertical: 'CENTER' }),
    text('Top', 'Hi', { textAutoResize: 'NONE', textAlignVertical: 'TOP' }),
  ],
});
const lineBody = outlineSelection(toNodes([lines2])).split('\n').slice(2);
const lineAt = (needle: string): string | undefined => lineBody.find((line) => line.includes(needle));
assert.ok(lineAt('RECT "Underline"')?.includes('stroke:#000/0/0/1/0'), 'differing side weights are listed top/right/bottom/left');
assert.ok(lineAt('RECT "Dashed"')?.includes('stroke:#000/1 dash4,2'), 'a dash pattern is shown');
assert.ok(!lineAt('RECT "Solid"')?.includes('dash'), 'a solid stroke has no dash');
assert.ok(lineAt('"Mid"')?.includes('tv:CENTER'), 'vertical alignment shows in a fixed-height box');
assert.ok(!lineAt('"Low"')?.includes('tv:') && !lineAt('"Hi"')?.includes('tv:'), 'vertical alignment is left out when hugging or top');

// Blend modes, masks, flips and where several selected roots sit.
const matrix = (a: number, b: number, c: number, d: number, tx: number, ty: number): number[][] => [[a, c, tx], [b, d, ty]];
const compose = fake('FRAME', 'Compose', {
  children: [
    fake('RECTANGLE', 'Multiply', { blendMode: 'MULTIPLY' }),
    fake('RECTANGLE', 'Plain', { blendMode: 'NORMAL' }),
    fake('FRAME', 'Pass', { blendMode: 'PASS_THROUGH' }),
    fake('RECTANGLE', 'Cutout', { isMask: true, maskType: 'ALPHA' }),
    fake('RECTANGLE', 'LumMask', { isMask: true, maskType: 'LUMINANCE' }),
    fake('VECTOR', 'MaskShape', { isMask: true, maskType: 'ALPHA' }),
    text('Faint', 'faint', { opacity: 0.5, effects: [shadow] }),
    fake('RECTANGLE', 'Mirror', { width: 40, x: 100, y: 20, relativeTransform: matrix(-1, 0, 0, 1, 100, 20) }),
    fake('RECTANGLE', 'MirrorV', { x: 10, y: 50, relativeTransform: matrix(1, 0, 0, -1, 10, 50) }),
    fake('RECTANGLE', 'MirrorTurn', { rotation: -45, relativeTransform: matrix(0, 1, 1, 0, 5, 6) }),
    fake('RECTANGLE', 'Turned', { rotation: -90, x: 7, y: 8, relativeTransform: matrix(0, 1, -1, 0, 7, 8) }),
  ],
});
const composeBody = outlineSelection(toNodes([compose])).split('\n').slice(2);
const composeAt = (needle: string): string => composeBody.find((line) => line.includes(needle)) ?? '';
assert.ok(composeAt('RECT "Multiply"').includes('blend:multiply'), 'a blend mode is named');
assert.ok(!composeAt('RECT "Plain"').includes('blend') && !composeAt('FRAME "Pass"').includes('blend'), 'normal and pass-through are left out');
assert.ok(composeAt('RECT "Cutout"').endsWith(' mask') && composeAt('RECT "LumMask"').includes('mask:luminance'), 'masks are marked, luminance named');
assert.ok(composeAt('IMG "MaskShape"').includes(' mask'), 'a mask shape stays marked as a placeholder');
assert.ok(composeAt('"faint"').includes('op0.5') && composeAt('"faint"').includes('fx:shadow'), 'text keeps its opacity and shadow');
assert.ok(composeAt('RECT "Mirror"').includes('flipx') && composeAt('RECT "Mirror"').includes('xy60,20') && !composeAt('RECT "Mirror"').includes('rot'), 'a horizontal flip is shifted back to its visible left edge');
assert.ok(composeAt('RECT "MirrorV"').includes('flipy') && composeAt('RECT "MirrorV"').includes('xy10,10'), 'a vertical flip is shifted back to its visible top edge');
assert.ok(composeAt('RECT "MirrorTurn"').includes('matrix(0,1,1,0,5,6)') && !composeAt('RECT "MirrorTurn"').match(/ xy| rot/), 'a mirrored and turned node uses its matrix');
assert.ok(composeAt('RECT "Turned"').includes(' rot90') && !composeAt('RECT "Turned"').includes('flip'), 'a plain turn is not a flip');

const at = (x: number): Fake => fake('FRAME', `Box${x}`, { absoluteTransform: [[1, 0, x], [0, 1, 20]] });
const pair = outlineSelection(toNodes([at(10), at(300)]));
assert.ok(pair.includes('FRAME "Box10" @1:Box10 100x40 at10,20') && pair.includes('FRAME "Box300" @1:Box300 100x40 at300,20'), 'several selected roots give their page position');
assert.ok(!/ at\d/.test(outlineSelection(toNodes([at(10)]))),'a single root needs no page position');

// Token cuts: default names, ids on placeholders, sizes set by content.
const sized = fake('FRAME', 'Sized', {
  layoutMode: 'VERTICAL',
  children: [
    fake('FRAME', 'Frame 12', { layoutMode: 'HORIZONTAL', layoutSizingHorizontal: 'HUG', layoutSizingVertical: 'HUG', children: [text('Hug', 'hug')] }),
    fake('FRAME', 'Wide', { layoutMode: 'HORIZONTAL', height: 60, layoutSizingHorizontal: 'FILL', children: [text('Wraps', 'wraps', { textAutoResize: 'HEIGHT', layoutSizingHorizontal: 'FILL' })] }),
    fake('VECTOR', 'Vector 3'),
  ],
});
const sizedBody = outlineSelection(toNodes([sized])).split('\n').slice(2);
const sizedAt = (needle: string): string => sizedBody.find((line) => line.includes(needle)) ?? '';
assert.ok(sizedAt('@1:Frame 12').includes('FRAME @1:Frame 12 [1] hugx hugy row') && !sizedAt('@1:Frame 12').includes('"'), 'a default name is dropped and a hugging frame gives no size');
assert.ok(sizedAt('"Wide"').includes('[1] ~x60 fillx row'), 'a derived axis is shown as ~');
assert.ok(sizedAt('"hug"').includes('TEXT 14/20 w500') && !/\dx\d/.test(sizedAt('"hug"')), 'text that hugs has no size');
assert.ok(sizedAt('"wraps"').includes('TEXT fillx wrap 14/20'), 'text that fills its width says so and gives no size');
assert.ok(sizedAt('IMG 100x40') !== '' && !sizedAt('IMG 100x40').includes('@'), 'a placeholder keeps its size, drops its id, and a default name');
assert.ok(outlineSelection(toNodes([text('Solo', 'solo')])).includes('TEXT 100x40 14/20 w500'), 'a selected root keeps its size');

// The legend only explains markers that appear.
const legendOf = (nodes: SceneNode[]): string => outlineSelection(nodes).split('\n')[0];
const bareLegend = legendOf(toNodes([text('Solo', 'a label that says mask rot90 fx: blend: IMG')]));
assert.ok(bareLegend.includes('TEXT = size') && bareLegend.includes('get_node_info'), 'a plain text node gets the text entry and the last-resort note');
assert.ok(['IMG =', 'grad(', 'matrix(', 'fx =', 'mask =', 'rot =', 'stroke = color', 'row/col'].every((part) => !bareLegend.includes(part)), 'entries for markers that are absent, or only appear inside text, are left out');
const cardLegend = legendOf(toNodes([card]));
assert.ok(['IMG =', 'linear-grad', 'fx =', 'rot =', 'stroke = color', 'xy =', 'row/col', 'SPAN ='].every((part) => cardLegend.includes(part)), 'a busy frame gets the entries for what it uses');
assert.ok(!cardLegend.includes('matrix(') && !cardLegend.includes('mask ='), 'and none for what it does not');

const lastIcon = fake('FRAME', 'Tail', { layoutMode: 'VERTICAL', children: [...Array.from({ length: 6 }, (_, i) => text(`T${i}`, `filler line number ${i} with words`, { fontSize: 10 + i })), fake('VECTOR', 'Last')] });
const tailChunk = outlineSelection(toNodes([lastIcon]), 1, 300);
assert.ok(tailChunk.includes('# chunk 1/') && !tailChunk.includes('Last') && tailChunk.includes('IMG ='), 'chunk 1 explains markers that only appear in later chunks');

// Copies that differ only in their text are folded; anything else is left alone.
const tile = (name: string, title: string, price: string, extra: Fake = {}): Fake =>
  fake('FRAME', name, { layoutMode: 'VERTICAL', ...extra, children: [text('T', title), text('P', price, { fontWeight: 700 }), fake('VECTOR', 'V', { width: 24 })] });
const listOf = (tiles: Fake[], extra: Fake = {}): string[] => outlineSelection(toNodes([fake('FRAME', 'List', { layoutMode: 'VERTICAL', ...extra, children: tiles })])).split('\n');
const mention = (lines: string[], needle: string): number => lines.slice(2).filter((line) => line.includes(needle)).length;

const same = listOf([tile('Row 1', 'A', '1'), tile('Row 2', 'B', '2'), tile('Row 3', 'C', '3')]);
assert.ok(same.includes('  +2 copies ("B","2") ("C","3")'), 'copies fold into one line with each copy\'s texts, at the sibling level');
assert.ok(mention(same, '"Row 2"') === 0 && mention(same, '"Row 3"') === 0 && mention(same, '"A"') === 1 && mention(same, 'IMG ') === 1, 'only the first copy is written out');
assert.ok(same.some((line) => line.includes('FRAME "List"') && line.includes('[3]')), 'the parent still counts every child');
assert.ok(same[1].includes('3 placeholders'), 'placeholders inside folded copies are still counted');

const styled = listOf([tile('Row 1', 'A', '1'), tile('Row 2', 'B', '2', { fills: [solid(1, 1, 1)] }), tile('Row 3', 'C', '3')]);
assert.ok(mention(styled, 'copies') === 0 && mention(styled, '"Row 2"') === 1, 'a copy with a different fill is not folded');

const tail = listOf([tile('Row 1', 'A', '1'), tile('Row 2', 'B', '2'), tile('Row 3', 'C', '3', { width: 120 })]);
assert.ok(tail.includes('  +1 copies ("B","2")') && mention(tail, '"Row 3"') === 1, 'only the matching run folds');

const placed = listOf([tile('Row 1', 'A', '1', { x: 0 }), tile('Row 2', 'B', '2', { x: 100 })], { layoutMode: 'NONE' });
assert.ok(mention(placed, 'copies') === 0, 'copies at different positions are not folded');

const deepStyle = listOf([tile('Row 1', 'A', '1'), { ...tile('Row 2', 'B', '2'), children: [text('T', 'B', { fontSize: 20 }), text('P', '2', { fontWeight: 700 }), fake('VECTOR', 'V', { width: 24 })] }]);
assert.ok(mention(deepStyle, 'copies') === 0, 'a difference deep inside a copy keeps it apart');

const partly = listOf([tile('Row 1', 'A', '1'), tile('Row 2', 'B', '1'), tile('Row 3', 'A', '1')]);
assert.ok(partly.includes('  +2 copies ("B",=) (=,=)'), 'a text equal to the first copy is written as =');
const clones = listOf([tile('Row 1', 'A', '1'), tile('Row 2', 'A', '1'), tile('Row 3', 'A', '1')]);
assert.ok(clones.includes('  +2 copies') && mention(clones, '(=') === 0, 'identical copies need no list');
assert.ok(listOf([tile('Row 1', '=', '1'), tile('Row 2', 'x', '1')]).includes('  +1 copies ("x",=)'), 'a real "=" is quoted, so it cannot be confused with the marker');

const sayings = outlineSelection(toNodes([text('Solo', '+2 copies of mask')])).split('\n')[0];
assert.ok(!sayings.includes('+N copies') && same[0].includes('+N copies ='), 'the copies entry appears only when something was folded');

// Layer boxes for the pixel-diff report: relative to the exported node, scaled, hidden layers skipped.
const rect = (x: number, y: number, width: number, height: number): Fake => ({ absoluteBoundingBox: { x, y, width, height } });
const exportRoot = fake('FRAME', 'Root', {
  ...rect(100, 200, 40, 20),
  children: [
    fake('RECTANGLE', 'Kid', rect(105, 205, 10, 10)),
    fake('RECTANGLE', 'Gone', { ...rect(110, 210, 5, 5), visible: false }),
    fake('GROUP', 'Loose', { absoluteBoundingBox: null, children: [fake('TEXT', 'Deep', rect(120, 210, 8, 4))] }),
  ],
});
const boxes = boxesOf(toNodes([exportRoot])[0], 2);
assert.deepEqual(boxes.map((b) => b.name), ['Root', 'Kid', 'Deep'], 'visible layers with a box are listed, hidden ones are not');
assert.deepEqual(boxes[1], { id: '1:Kid', name: 'Kid', type: 'RECTANGLE', parent: '1:Root', x: 10, y: 10, w: 20, h: 20 }, 'a box is relative to the exported node and scaled');
assert.equal(boxes[2].parent, '1:Root', 'a layer under one with no box of its own attaches to the nearest ancestor that has one');

// Gradient geometry, wrapping, size limits, grid frames and shadows that follow content.
const paintOf = (type: string, transform: number[][]): Fake => ({ type, opacity: 1, gradientTransform: transform, gradientStops: [stop(0, 1, 0, 0), stop(1, 0, 0, 1)] });
const IDENTITY = [[1, 0, 0], [0, 1, 0]];
const wide = (name: string, fills: Fake[]): Fake => fake('RECTANGLE', name, { fills });
const shapes = fake('FRAME', 'Shapes', {
  children: [
    wide('Round', [paintOf('GRADIENT_RADIAL', IDENTITY)]),
    wide('Small', [paintOf('GRADIENT_RADIAL', [[2, 0, -0.5], [0, 2, -0.5]])]),
    wide('Turned', [paintOf('GRADIENT_RADIAL', [[0, 1, 0], [-1, 0, 1]])]),
    wide('Sweep', [paintOf('GRADIENT_ANGULAR', IDENTITY)]),
    wide('Diamond', [paintOf('GRADIENT_DIAMOND', IDENTITY)]),
    fake('RECTANGLE', 'Filled', { fills: [solid(1, 1, 1)], effects: [shadow] }),
    fake('GROUP', 'Cluster', { effects: [shadow], children: [fake('RECTANGLE', 'Inside')] }),
    fake('FRAME', 'Flow', { layoutMode: 'HORIZONTAL', layoutWrap: 'WRAP', itemSpacing: 8, counterAxisSpacing: 12, minWidth: 100, maxWidth: 300, minHeight: null, maxHeight: null, children: [fake('RECTANGLE', 'Chip')] }),
    fake('FRAME', 'Even', { layoutMode: 'HORIZONTAL', layoutWrap: 'WRAP', itemSpacing: 8, counterAxisSpacing: 8, children: [fake('RECTANGLE', 'Pill')] }),
    fake('FRAME', 'Cells', { layoutMode: 'GRID', children: [fake('RECTANGLE', 'Cell', { x: 30, y: 10 })] }),
  ],
});
const shapeBody = outlineSelection(toNodes([shapes])).split('\n').slice(2);
const shapeAt = (needle: string): string => shapeBody.find((line) => line.includes(needle)) ?? '';
assert.ok(shapeAt('"Round"').includes('fill:radial-grad(at50%,50% r50,20 #f00 0%,#00f 100%)'), 'a default radial gradient is centred and spans half the box each way');
assert.ok(shapeAt('"Small"').includes('radial-grad(at50%,50% r25,10 '), 'a scaled radial gradient has smaller radii');
assert.ok(shapeAt('"Turned"').includes('radial-grad(at50%,50% r20,50 rot90 '), 'a turned radial gradient reports its turn');
assert.ok(shapeAt('"Sweep"').includes('angular-grad(at50%,50% from90deg #f00 0%,#00f 100%)'), 'an angular gradient reports its centre and start');
assert.ok(shapeAt('"Diamond"').includes('diamond-grad(#f00 0%,#00f 100%)'), 'other gradient shapes still list their stops');
assert.ok(shapeAt('"Filled"').includes('fx:shadow(') && !shapeAt('"Filled"').includes('dropshadow'), 'a shadow on a filled layer is a box shadow');
assert.ok(shapeAt('"Cluster"').includes('fx:dropshadow('), 'a group has no fill, so its shadow follows its content');
assert.ok(['flexwrap', 'rowgap12', 'minw100', 'maxw300'].every((part) => shapeAt('"Flow"').includes(part)) && !shapeAt('"Flow"').includes('minh'), 'wrap, row gap and limits are shown, absent limits are not');
assert.ok(!shapeAt('"Even"').includes('rowgap') && shapeAt('"Even"').includes('flexwrap'), 'a row gap equal to the gap is left out');
assert.ok(!/ (row|col)\b/.test(shapeAt('"Cells"')) && shapeAt('"Cell"').includes('xy30,10'), 'a grid frame keeps its children at their own coordinates');

const listOfFrame = (names: string[]): Fake => fake('FRAME', 'Group of rows', { layoutMode: 'VERTICAL', children: names.map((name) => tile(`Row ${name}`, name, '1')) });

// The css format: the same tree, written as CSS declarations.
const cssOf = (nodes: Fake[], chunk?: number, budget?: number): string[] => outlineSelection(toNodes(nodes), chunk, budget, 'css').split('\n');
const cssLine = (lines: string[], needle: string): string => lines.slice(2).find((line) => line.includes(needle)) ?? '';
const inkStroke = [solid(0, 0, 0)];
const panel = fake('FRAME', 'Panel', {
  width: 300,
  height: 200,
  layoutMode: 'VERTICAL',
  itemSpacing: 8,
  paddingTop: 16,
  paddingRight: 16,
  paddingBottom: 16,
  paddingLeft: 16,
  primaryAxisAlignItems: 'MIN',
  counterAxisAlignItems: 'MIN',
  cornerRadius: 16,
  clipsContent: true,
  fills: [solid(1, 1, 1)],
  strokes: inkStroke,
  strokeWeight: 2,
  strokeAlign: 'INSIDE',
  children: [
    text('Hello', 'Hello'),
    fake('RECTANGLE', 'Stretch', { layoutSizingHorizontal: 'FILL', layoutSizingVertical: 'FILL' }),
    fake('RECTANGLE', 'Outside', { strokes: inkStroke, strokeWeight: 2, strokeAlign: 'OUTSIDE' }),
    fake('RECTANGLE', 'Centered', { strokes: inkStroke, strokeWeight: 2, strokeAlign: 'CENTER' }),
    fake('RECTANGLE', 'Underline', { strokes: inkStroke, strokeWeight: Symbol('mixed'), strokeTopWeight: 0, strokeRightWeight: 0, strokeBottomWeight: 1, strokeLeftWeight: 0 }),
    fake('RECTANGLE', 'Stack', { fills: [solid(1, 0, 0), solid(0, 0, 1)] }),
    fake('RECTANGLE', 'Faded', { opacity: 0.5, blendMode: 'MULTIPLY', isMask: true, maskType: 'ALPHA' }),
    fake('RECTANGLE', 'Lifted', { fills: [solid(1, 1, 1)], effects: [shadow, { type: 'INNER_SHADOW', visible: true, color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 1 }, radius: 2, spread: 0 }] }),
    fake('RECTANGLE', 'Cutout', { effects: [shadow, { type: 'LAYER_BLUR', visible: true, radius: 4 }, { type: 'BACKGROUND_BLUR', visible: true, radius: 10 }] }),
    fake('RECTANGLE', 'Turned', { rotation: -30, x: 4, y: 5 }),
    fake('RECTANGLE', 'Mirrored', { width: 40, relativeTransform: matrix(-1, 0, 0, 1, 100, 20) }),
    fake('RECTANGLE', 'Shaded', { fills: [gradient(VERTICAL, [stop(0, 1, 1, 1), stop(1, 0, 0, 0, 0.5)])] }),
    fake('ELLIPSE', 'Dot', { fills: [solid(0, 0, 0)] }),
  ],
});
const panelCss = cssOf([panel]);
assert.ok(panelCss[0].startsWith('# FrameLink css') && panelCss[0].includes('box-sizing:border-box'), 'the css format has its own legend');
assert.ok(cssLine(panelCss, 'FRAME "Panel"').endsWith('{width:300px;height:200px;display:flex;flex-direction:column;gap:8px;padding:16px;align-items:flex-start;background:#fff;border-radius:16px;box-shadow:inset 0 0 0 2px #000;overflow:hidden}'), 'a frame becomes flex, with its box, fill, radius, inside stroke and clipping');
assert.ok(cssLine(panelCss, '"Hello"').includes('TEXT {white-space:nowrap;font-size:14px;font-weight:500;line-height:20px;color:#30363d} "Hello"'), 'text that hugs does not wrap; its style and characters follow');
assert.ok(cssLine(panelCss, 'RECT "Stretch"').includes('{align-self:stretch;flex:1 1 0;min-height:0}'), 'fill is stretch across and flex growth along the parent');
const evenPadding = cssOf([fake('FRAME', 'Pad', { layoutMode: 'HORIZONTAL', paddingTop: 8, paddingRight: 16, paddingBottom: 8, paddingLeft: 16, primaryAxisAlignItems: 'CENTER', counterAxisAlignItems: 'BASELINE', children: [fake('RECTANGLE', 'Item')] })]);
assert.ok(cssLine(evenPadding, 'FRAME "Pad"').includes('padding:8px 16px;justify-content:center;align-items:baseline'), 'equal opposite paddings use the short form; alignment maps to flex');
assert.ok(!cssOf([fake('FRAME', 'Bare', { layoutMode: 'VERTICAL', children: [fake('RECTANGLE', 'Item')] })]).join('\n').includes('undefined'), 'a missing alignment never prints as undefined');
assert.ok(cssLine(panelCss, 'RECT "Outside"').includes('box-shadow:0 0 0 2px #000') && !cssLine(panelCss, 'RECT "Outside"').includes('inset'), 'an outside stroke is a spread shadow');
assert.ok(cssLine(panelCss, 'RECT "Centered"').includes('box-shadow:inset 0 0 0 1px #000,0 0 0 1px #000'), 'a centred stroke is half inside, half outside');
assert.ok(cssLine(panelCss, 'RECT "Underline"').includes('box-shadow:inset 0 -1px 0 0 #000'), 'a one-sided stroke is one inset band');
assert.ok(cssLine(panelCss, 'RECT "Stack"').includes('background:linear-gradient(#00f,#00f),#f00'), 'fills stack top first, with the bottom one a plain colour');
assert.ok(cssLine(panelCss, 'RECT "Faded"').includes('opacity:0.5;mix-blend-mode:multiply;--figma-mask:alpha'), 'opacity, blend mode and mask are carried');
assert.ok(cssLine(panelCss, 'RECT "Lifted"').includes('box-shadow:0px 4px 8px 0px rgba(0,0,0,0.25),inset 0px 1px 2px 0px rgba(0,0,0,0.1)'), 'shadows merge into one box-shadow');
assert.ok(cssLine(panelCss, 'RECT "Cutout"').includes('filter:drop-shadow(0px 4px 8px rgba(0,0,0,0.25)) blur(1.7px);backdrop-filter:blur(4.3px)'), 'a fill-less shadow is a drop-shadow filter; blurs are scaled by the measured 0.425');
assert.ok(cssLine(panelCss, 'RECT "Turned"').includes('position:absolute') === false && cssLine(panelCss, 'RECT "Turned"').includes('transform:rotate(30deg);transform-origin:0 0'), 'a turn rotates about the top-left');
assert.ok(cssLine(panelCss, 'RECT "Mirrored"').includes('transform:scaleX(-1)'), 'a flip is a scale');
assert.ok(cssLine(panelCss, 'RECT "Shaded"').includes('background:linear-gradient(180deg,#fff 0%,rgba(0,0,0,0.5) 100%)'), 'a gradient keeps its angle and stop alphas');
assert.ok(cssLine(panelCss, 'ELLIPSE "Dot"').includes('border-radius:50%'), 'an ellipse is round');

const stage = fake('FRAME', 'Stage', { width: 120, height: 80, children: [fake('RECTANGLE', 'Pin', { x: 10, y: 20, width: 30, height: 30 }), fake('GROUP', 'Bundle', { children: [fake('RECTANGLE', 'Member', { x: 3, y: 4 })] })] });
const stageCss = cssOf([stage]);
assert.ok(cssLine(stageCss, 'FRAME "Stage"').includes('position:relative'), 'a frame holding positioned children is the positioning context');
assert.ok(cssLine(stageCss, 'RECT "Pin"').includes('{position:absolute;left:10px;top:20px;width:30px;height:30px}'), 'a positioned child is absolute at its xy');
assert.ok(cssLine(stageCss, 'GROUP "Bundle"').endsWith('{display:contents}'), 'a group adds no box of its own');

const gradients = fake('FRAME', 'Gradients', {
  children: [
    wide('Round', [paintOf('GRADIENT_RADIAL', IDENTITY)]),
    wide('Sweep', [paintOf('GRADIENT_ANGULAR', IDENTITY)]),
    fake('RECTANGLE', 'Photo', { fills: IMAGE_FILL }),
  ],
});
const gradientCss = cssOf([gradients]);
assert.ok(cssLine(gradientCss, 'RECT "Round"').includes('background:radial-gradient(ellipse 50px 20px at 50% 50%,#f00 0%,#00f 100%)'), 'a radial gradient has its radii and centre');
assert.ok(cssLine(gradientCss, 'RECT "Sweep"').includes('background:conic-gradient(from 90deg at 50% 50%,#f00 0%,#00f 100%)'), 'an angular gradient is conic');
assert.ok(cssLine(gradientCss, 'IMG "Photo"').endsWith('width:100px;height:40px;background:#e6e6e6;outline:1px dashed #9a9a9a;outline-offset:-1px}'), 'an image is a sized, visible placeholder: light fill and a dashed outline that takes no room');

const words = fake('FRAME', 'Words', {
  layoutMode: 'VERTICAL',
  children: [
    text('Wraps', 'wraps here', { textAutoResize: 'HEIGHT' }),
    text('Boxed', 'boxed', { textAutoResize: 'NONE', textAlignVertical: 'CENTER', textAlignHorizontal: 'CENTER' }),
    text('Cut', 'cut', { textAutoResize: 'TRUNCATE', textAlignVertical: 'TOP' }),
    text('Lines', 'one\ntwo'),
    text('Styled', 'styled', { fontName: { family: 'Inter', style: 'Bold Italic' }, letterSpacing: { unit: 'PERCENT', value: 5 }, lineHeight: { unit: 'PERCENT', value: 150 }, textCase: 'UPPER', textDecoration: 'UNDERLINE' }),
    text('Auto', 'auto', { lineHeight: { unit: 'AUTO' }, letterSpacing: { unit: 'PIXELS', value: 1 } }),
    text('Glow', 'glow', { effects: [shadow] }),
  ],
});
const wordsCss = cssOf([words]);
assert.ok(cssLine(wordsCss, '"wraps here"').includes('TEXT {width:100px;font-size:14px'), 'wrapping text has a width and wraps');
assert.ok(cssLine(wordsCss, '"boxed"').includes('{width:100px;height:40px;display:flex;flex-direction:column;justify-content:center;text-align:center;'), 'a fixed box centres its text vertically with flex');
assert.ok(cssLine(wordsCss, '"cut"').includes('white-space:nowrap;overflow:hidden;text-overflow:ellipsis'), 'truncated text gets an ellipsis');
assert.ok(cssLine(wordsCss, '"one\\ntwo"').includes('white-space:pre;'), 'text with line breaks keeps them');
assert.ok(['letter-spacing:0.05em', 'line-height:150%', 'font-style:italic', 'text-decoration:underline', 'text-transform:uppercase'].every((part) => cssLine(wordsCss, '"styled"').includes(part)), 'type style carries spacing in em, line height in %, italic, decoration and case');
assert.ok(cssLine(wordsCss, '"auto"').includes('line-height:normal;letter-spacing:1px'), 'auto line height is normal; pixel spacing stays px');
assert.ok(cssLine(wordsCss, '"glow"').includes('text-shadow:0px 4px 8px rgba(0,0,0,0.25)'), 'a shadow on text is a text-shadow');

const rows = cssOf([listOfFrame(['a', 'b', 'c'])]);
assert.ok(rows.some((line) => line.trim().startsWith('+2 copies ("b",=) ("c",=)')), 'copies fold in the css format too');


// Placeholders are visible, gradient strokes survive in the css format, and the plugin knows which layers are stubs.
const boxed = fake('FRAME', 'Boxed', {
  layoutMode: 'VERTICAL',
  children: [
    fake('VECTOR', 'Chevron', { width: 24, height: 24 }),
    fake('RECTANGLE', 'Rounded', { fills: IMAGE_FILL, cornerRadius: 8 }),
    fake('RECTANGLE', 'Ringed', { strokes: [gradient(VERTICAL, [stop(0, 1, 0, 0), stop(1, 0, 0, 1)])], strokeWeight: 1, strokeAlign: 'INSIDE' }),
  ],
});
const boxedCss = cssOf([boxed]);
assert.ok(cssLine(boxedCss, 'IMG "Chevron"').endsWith('{width:24px;height:24px;background:#e6e6e6;outline:1px dashed #9a9a9a;outline-offset:-1px}'), 'an icon placeholder is visible');
assert.ok(cssLine(boxedCss, 'IMG "Rounded"').includes('border-radius:8px;background:#e6e6e6;outline:1px dashed #9a9a9a'), 'an image placeholder keeps its corners');
const ringed = cssLine(boxedCss, 'RECT "Ringed"');
assert.ok(ringed.includes('box-shadow:inset 0 0 0 1px #f00') && ringed.includes('--figma-stroke:1px linear-gradient(180deg,#f00 0%,#00f 100%)'), 'a gradient stroke shows its first colour and carries the gradient as a custom property');
assert.ok(!cssLine(cssOf([panel]), 'FRAME "Panel"').includes('--figma-stroke'), 'a solid stroke needs no custom property');
assert.ok(outlineSelection(toNodes([boxed])).split('\n')[0].includes('background #e6e6e6 with outline:1px dashed #9a9a9a'), 'the outline legend says how to draw a placeholder');
assert.ok(cssOf([boxed])[0].includes('--figma-stroke:W gradient'), 'the css legend explains the gradient stroke property');

const stubs = placeholderIds(toNodes([boxed])[0]);
assert.deepEqual([...stubs].sort(), ['1:Chevron', '1:Rounded'], 'the plugin finds the layers the outline stubs out');
const stubRoot = fake('FRAME', 'Stub root', { ...rect(0, 0, 40, 20), children: [fake('FRAME', 'Icon', { ...rect(2, 2, 10, 10), children: [fake('VECTOR', 'Path', rect(4, 4, 4, 4))] }), fake('RECTANGLE', 'Real', rect(20, 2, 10, 10))] });
const stubBoxes = boxesOf(toNodes([stubRoot])[0], 1, new Set(['1:Icon']));
assert.deepEqual(stubBoxes.map((b) => [b.name, b.placeholder === true]), [['Stub root', false], ['Icon', true], ['Path', true], ['Real', false]], 'a layer inside a placeholder is marked as part of the stub');

// The outline format shows Figma's raw blur radius, so its legend must give the conversion; the css format applies it.
const blurry = fake('FRAME', 'Blurry', { children: [fake('ELLIPSE', 'Glow', { fills: [solid(0, 1, 0)], effects: [{ type: 'LAYER_BLUR', visible: true, radius: 100 }] })] });
assert.ok(outlineSelection(toNodes([blurry])).split('\n')[0].includes('blur(0.425 x r px)'), 'the outline legend explains how to convert a blur radius');
assert.ok(!outlineSelection(toNodes([fake('FRAME', 'Plain', { children: [fake('ELLIPSE', 'Dot', { fills: [solid(0, 1, 0)] })] })])).split('\n')[0].includes('blur(0.425'), 'and only when a blur is present');
assert.ok(cssLine(cssOf([blurry]), 'ELLIPSE "Glow"').includes('filter:blur(42.5px)'), 'the css format applies the factor to the radius');

// Chunking: six sections of eight texts under one page frame.
const section = (n: number): Fake =>
  fake('FRAME', `Section ${n}`, {
    layoutMode: 'VERTICAL',
    children: Array.from({ length: 8 }, (_, i) => text(`T${n}${i}`, `section ${n} line ${i} with some filler words`, { fontSize: 10 + n * 8 + i })),
  });
const pageFrame = fake('FRAME', 'Page', {
  layoutMode: 'VERTICAL',
  absoluteTransform: [[1, 0, 10], [0, 1, 20]],
  children: [1, 2, 3, 4, 5, 6].map(section),
});
const pageNodes = toNodes([pageFrame]);

assert.ok(!outlineSelection(pageNodes).includes('# chunk'), 'a small enough selection comes back whole');
assert.ok(outlineSelection(pageNodes, 2).includes('fits in one response'), 'asking for chunk 2 of a whole selection is explained');

const checkChunks = (budget: number, deeper: boolean): void => {
  const manifest = outlineSelection(pageNodes, undefined, budget);
  const total = Number(/(\d+) chunks/.exec(manifest)?.[1]);
  assert.ok(total > 1 && manifest.includes('Call again with chunk=1..'), 'a big selection returns a manifest first');

  const chunks = Array.from({ length: total }, (_, i) => outlineSelection(pageNodes, i + 1, budget));
  assert.ok(!manifest.includes('TEXT = size') && chunks[0].includes('TEXT = size') && chunks.slice(1).every((chunk) => !chunk.includes('TEXT = size')), 'the legend is sent once, with chunk 1');
  assert.ok(chunks.slice(1).every((chunk) => chunk.includes('legend is in chunk 1; default font Inter')), 'later chunks point back and keep the default font');
  const all = chunks.join('\n');
  const sectionLines = (all.match(/^ *FRAME "Section \d"/gm) ?? []).length;
  assert.ok(deeper ? sectionLines >= 6 : sectionLines === 6, 'every section is listed; a split section repeats as context');
  assert.equal((all.match(/^ *TEXT /gm) ?? []).length, 48, 'every text appears exactly once across the chunks');
  assert.ok(chunks.every((chunk) => chunk.includes('# in: "Page" @1:Page')), 'each chunk says where it sits');
  const parent = deeper ? 'Section' : 'Page';
  assert.ok(chunks.every((chunk) => chunk.includes(`measured from "${parent}`)), 'each chunk says what its xy are measured from');
  assert.ok(chunks.every((chunk) => chunk.split('\n').some((line) => line.startsWith(`FRAME "${parent}`))), 'each chunk repeats its parent line');
  if (!deeper) assert.ok(chunks.every((chunk) => chunk.includes('which sits at page 10,20')), 'the parent origin is given in page coordinates');
  assert.ok(outlineSelection(pageNodes, total + 1, budget).includes(`has ${total} chunks`), 'a chunk past the end is explained');
};
checkChunks(1500, false);

const deep = outlineSelection(pageNodes, undefined, 400);
assert.ok(/\d+ chunks/.test(deep), 'a section larger than the budget is split further');
assert.ok(outlineSelection(pageNodes, 1, 400).includes('# in: "Page" @1:Page > "Section 1" @1:Section 1'), 'a split section shows its full path');
checkChunks(400, true);

const bigCss = cssOf([pageFrame], undefined, 1500);
assert.ok(bigCss[1].includes('chunks') || bigCss.some((line) => line.includes('chunk 1/')), 'the css format chunks like the outline');
assert.ok(cssOf([pageFrame], 1, 1500)[0].startsWith('# FrameLink css') && !cssOf([pageFrame], 2, 1500)[0].includes('box-sizing'), 'the css legend is sent once, with chunk 1');

console.log('outline check passed');
