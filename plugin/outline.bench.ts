// Run with: npm run bench. Prints the size of each fixture as raw JSON and as the outline, so token changes can be judged before and after.
// Tokens are chars/4, a proxy that is good for comparing runs, not for absolute counts.
import { outlineSelection } from './src/outline';
import { serializeNode } from './src/serializer';
import { fake, solid, text, toNodes, type Fake } from './fixtures';

const WHOLE = Number.MAX_SAFE_INTEGER;

let nextId = 23000;
const node = (type: string, name: string, extra: Fake = {}): Fake => fake(type, name, { id: `454:${nextId++}`, ...extra });
const label = (name: string, characters: string, extra: Fake = {}): Fake => text(name, characters, { id: `454:${nextId++}`, ...extra });

const GREEN = solid(0.05, 0.6, 0.4);
const WHITE = solid(1, 1, 1);
const GREY = solid(0.9, 0.9, 0.9);

const productCard = (n: number): Fake =>
  node('FRAME', 'Product Card', {
    width: 220,
    height: 320,
    layoutMode: 'VERTICAL',
    itemSpacing: 8,
    paddingTop: 12,
    paddingRight: 12,
    paddingBottom: 12,
    paddingLeft: 12,
    cornerRadius: 12,
    clipsContent: true,
    fills: [WHITE],
    strokes: [GREY],
    strokeWeight: 1,
    children: [
      node('RECTANGLE', 'Product Image', { width: 196, height: 160, cornerRadius: 8, fills: [{ type: 'IMAGE' }] }),
      label('Title', `Product ${n} with a fairly long name`, { textAutoResize: 'HEIGHT', fontWeight: 600 }),
      node('FRAME', 'Frame 1204', {
        layoutMode: 'HORIZONTAL',
        itemSpacing: 8,
        layoutSizingHorizontal: 'FILL',
        children: [
          label('Price', `₹${100 + n}`, { fontWeight: 700 }),
          label('MRP', `₹${150 + n}`, { textDecoration: 'STRIKETHROUGH' }),
          label('Discount', '20% off', { fills: [GREEN] }),
        ],
      }),
      node('FRAME', 'Button', {
        layoutMode: 'HORIZONTAL',
        primaryAxisAlignItems: 'CENTER',
        counterAxisAlignItems: 'CENTER',
        paddingTop: 8,
        paddingRight: 16,
        paddingBottom: 8,
        paddingLeft: 16,
        cornerRadius: 8,
        fills: [GREEN],
        children: [label('Label', 'Add to cart', { fills: [WHITE] })],
      }),
    ],
  });

const productGrid = (count: number): Fake =>
  node('FRAME', 'Product Grid', {
    layoutMode: 'HORIZONTAL',
    itemSpacing: 16,
    children: Array.from({ length: count }, (_, n) => productCard(n)),
  });

const cell = (characters: string): Fake =>
  node('FRAME', 'Frame 88', { width: 120, layoutMode: 'HORIZONTAL', paddingLeft: 12, paddingRight: 12, children: [label('Cell', characters)] });

const row = (n: number): Fake =>
  node('FRAME', 'Row', {
    layoutMode: 'HORIZONTAL',
    strokes: [GREY],
    strokeWeight: 1,
    children: [cell(`Order #${1000 + n}`), cell('Delivered'), cell('12 Mar 2025'), cell(`₹${n * 10}`), cell('View')],
  });

const dataTable = (rows: number): Fake =>
  node('FRAME', 'Orders Table', { layoutMode: 'VERTICAL', children: Array.from({ length: rows }, (_, n) => row(n)) });

const header = (): Fake =>
  node('FRAME', 'Header', {
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'SPACE_BETWEEN',
    counterAxisAlignItems: 'CENTER',
    paddingLeft: 24,
    paddingRight: 24,
    fills: [WHITE],
    children: [
      node('VECTOR', 'Logo'),
      node('FRAME', 'Nav', { layoutMode: 'HORIZONTAL', itemSpacing: 24, children: ['Home', 'Shop', 'Offers', 'Help', 'Account'].map((item) => label('Nav Item', item)) }),
      node('FRAME', 'Cart', { layoutMode: 'HORIZONTAL', fills: [GREEN], cornerRadius: 8, children: [node('VECTOR', 'Cart Icon'), label('Cart Label', 'Cart', { fills: [WHITE] })] }),
    ],
  });

const footer = (): Fake =>
  node('FRAME', 'Footer', {
    layoutMode: 'HORIZONTAL',
    itemSpacing: 48,
    children: Array.from({ length: 4 }, (_, c) =>
      node('FRAME', 'Column', {
        layoutMode: 'VERTICAL',
        itemSpacing: 8,
        children: [label('Heading', `Section ${c}`, { fontWeight: 700 }), ...Array.from({ length: 5 }, (_, i) => label('Link', `Link ${c}.${i}`))],
      })
    ),
  });

const page = (): Fake =>
  node('FRAME', 'Home Page', {
    layoutMode: 'VERTICAL',
    itemSpacing: 32,
    children: [header(), node('RECTANGLE', 'Hero', { width: 1200, height: 360, fills: [{ type: 'IMAGE' }] }), productGrid(6), footer()],
  });

const FIXTURES: Record<string, Fake[]> = {
  'small card': [productCard(0)],
  'product grid x12': [productGrid(12)],
  'orders table x20': [dataTable(20)],
  'full page': [page()],
};

const tokens = (chars: number): number => Math.round(chars / 4);

const report = Object.entries(FIXTURES).map(([name, fakes]) => {
  const nodes = toNodes(fakes);
  const json = JSON.stringify(fakes.map(serializeNode)).length;
  const whole = outlineSelection(nodes, undefined, WHOLE);
  const legend = whole.split('\n')[0].length;
  const chunked = /(\d+) chunks/.exec(outlineSelection(nodes));
  return {
    fixture: name,
    jsonTokens: tokens(json),
    outlineTokens: tokens(whole.length),
    cssTokens: tokens(outlineSelection(nodes, undefined, WHOLE, 'css').length),
    legendTokens: tokens(legend),
    outlinePct: `${Math.round((whole.length / json) * 100)}%`,
    chunksAtDefault: chunked ? Number(chunked[1]) : 1,
  };
});

console.table(report);

// SHOW="product grid x12" npm run bench prints that fixture's outline (add FORMAT=css for the css format), to read what the model would see.
const shown = process.env.SHOW ? FIXTURES[process.env.SHOW] : undefined;
if (shown) console.log(outlineSelection(toNodes(shown), undefined, WHOLE, process.env.FORMAT === 'css' ? 'css' : 'outline'));
