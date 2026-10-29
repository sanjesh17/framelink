// Run with: npm run check.
import assert from 'node:assert/strict';
import { serializeNode } from './src/serializer';
import { fake, solid, text, toNodes, type Fake } from './fixtures';

const stop = (position: number, a: number): Fake => ({ position, color: { r: 1, g: 0, b: 0, a } });

const root = fake('FRAME', 'Root', {
  layoutMode: 'NONE',
  cornerRadius: Symbol('mixed'),
  fills: [solid(1, 0, 0, 0.5), { ...solid(0, 1, 0), visible: false }, { type: 'GRADIENT_LINEAR', opacity: 1, gradientTransform: [[1, 0, 0], [0, 1, 0]], gradientStops: [stop(0, 0), stop(1, 1)] }],
  effects: [{ type: 'DROP_SHADOW', visible: false, radius: 4 }, { type: 'LAYER_BLUR', visible: true, radius: 2 }],
  children: [
    text('Label', 'Hi', { fontName: { family: 'Roboto', style: 'Bold Italic' }, lineHeight: { unit: 'AUTO' }, textDecoration: 'NONE' }),
    { ...fake('RECTANGLE', 'Broken'), get width(): number { throw new Error('removed node'); } },
    fake('RECTANGLE', 'After'),
  ],
});

const data = serializeNode(toNodes([root])[0]);
assert.equal(data.layoutMode, undefined, 'no layout is left out');
assert.equal(data.cornerRadius, undefined, 'a mixed value is skipped, not stringified');
assert.equal(data.fills?.length, 2, 'a hidden paint is dropped');
assert.deepEqual(data.fills?.[0], { type: 'SOLID', opacity: 0.5, color: { r: 1, g: 0, b: 0, a: 1 } }, 'a solid paint keeps its opacity and has no invented alpha');
assert.equal(data.fills?.[1].gradientStops?.[0].color.a, 0, 'a fully transparent gradient stop stays transparent');
assert.deepEqual(data.fills?.[1].gradientTransform, [[1, 0, 0], [0, 1, 0]], 'a gradient keeps its transform');
assert.deepEqual(data.effects?.map((effect) => effect.type), ['LAYER_BLUR'], 'a hidden effect is dropped');

const label = data.children?.[0];
assert.deepEqual([label?.fontFamily, label?.italic, label?.characters, label?.lineHeight], ['Roboto', true, 'Hi', { unit: 'AUTO' }], 'font family and italic come from the font name');
assert.equal(data.children?.[1].type, 'RECTANGLE', 'a node that cannot be read becomes a stub');
assert.equal(data.children?.[2].name, 'After', 'and does not take its siblings with it');

console.log('serializer check passed');
