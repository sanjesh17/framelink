// Run with: npm run check. Small synthetic images stand in for a Figma export and a browser screenshot.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { compareImages, DEFAULT_OPTIONS, describeComparison, saveExport, type NodeBox } from './verify';

const image = (width: number, height: number, paint: (x: number, y: number) => number[] = () => [255, 255, 255]): PNG => {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, y);
      png.data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return png;
};

const box = (id: string, name: string, parent: string | null, x: number, y: number, w: number, h: number): NodeBox => ({ id, name, type: 'FRAME', parent, x, y, w, h });

const BOXES = [box('r', 'Root', null, 0, 0, 40, 20), box('c', 'Child', 'r', 5, 5, 10, 10), box('d', 'Other', 'r', 25, 5, 10, 10)];
const inChild = (x: number, y: number): boolean => x >= 5 && x < 15 && y >= 5 && y < 15;

const reference = image(40, 20);
const patched = image(40, 20, (x, y) => (inChild(x, y) ? [255, 0, 0] : [255, 255, 255]));

const same = compareImages(reference, image(40, 20), BOXES, DEFAULT_OPTIONS);
assert.equal(same.mismatched, 0);
assert.equal(same.worst.length, 0);
assert.ok(describeComparison(same, null).includes('match 100%') && describeComparison(same, null).includes('identical'), 'identical images report a full match');

const near = compareImages(reference, image(40, 20, () => [250, 250, 250]), BOXES, DEFAULT_OPTIONS);
assert.equal(near.mismatched, 0, 'a tiny colour shift is within tolerance');

const diff = compareImages(reference, patched, BOXES, DEFAULT_OPTIONS);
assert.equal(diff.mismatched, 100, 'the 10x10 patch is the only difference');
assert.equal(diff.worst.length, 1, 'only the layer that holds the difference is blamed');
assert.equal(diff.worst[0].box.name, 'Child');
assert.equal(diff.worst[0].pixels, 100);
assert.ok(diff.diff !== null, 'a diff image is produced when something differs');
const report = describeComparison(diff, '/tmp/diff.png');
assert.ok(report.includes('match 87.5%: 100 of 800 px differ'), 'the match percentage is of the whole image');
assert.ok(report.includes('- Child @c FRAME at 5,5 10x10: 100 px (100% of its box)'), 'the worst layers are listed with their box');
assert.ok(report.includes('diff image (differences in red): /tmp/diff.png'), 'the diff path is given');

const stray = compareImages(reference, image(40, 20, (x, y) => (x >= 20 && x < 22 && y >= 16 ? [0, 0, 0] : [255, 255, 255])), BOXES, DEFAULT_OPTIONS);
assert.equal(stray.worst[0].box.name, 'Root', 'a difference outside every child falls to the root');

const top1 = compareImages(reference, image(40, 20, (x, y) => (x < 4 || inChild(x, y) ? [255, 0, 0] : [255, 255, 255])), BOXES, { threshold: 0.1, top: 1 });
assert.equal(top1.worst.length, 1, 'only the requested number of layers is listed');

const wider = compareImages(reference, image(44, 22, (x, y) => (inChild(x, y) ? [255, 0, 0] : [255, 255, 255])), BOXES, DEFAULT_OPTIONS);
assert.equal(wider.mismatched, 100, 'differently sized images are compared over the shared area');
const sizeReport = describeComparison(wider, null);
assert.ok(sizeReport.startsWith('SIZE MISMATCH: reference 40x20, screenshot 44x22') && sizeReport.includes('shared top-left 40x20'), 'a size gap is called out first');

// Differences inside placeholder layers are counted apart and not listed as things to fix.
const stubBoxes = [box('r', 'Root', null, 0, 0, 40, 20), { ...box('c', 'Chevron', 'r', 5, 5, 10, 10), placeholder: true as const }, box('d', 'Other', 'r', 25, 5, 10, 10)];
const stubbed = compareImages(reference, patched, stubBoxes, DEFAULT_OPTIONS);
assert.equal(stubbed.mismatched, 100);
assert.equal(stubbed.placeholderPixels, 100, 'the difference inside the placeholder is counted as a placeholder difference');
assert.equal(stubbed.worst.length, 0, 'and not listed as a layer to fix');
const stubReport = describeComparison(stubbed, null);
assert.ok(stubReport.includes('match 87.5%: 100 of 800 px differ') && stubReport.includes('100 of those px are in placeholder layers') && stubReport.includes('ignoring them the match is 100%'), 'the report says what is left once placeholders are ignored');
const mixed = compareImages(reference, image(40, 20, (x, y) => (inChild(x, y) || (x >= 25 && x < 30 && y >= 5 && y < 10) ? [255, 0, 0] : [255, 255, 255])), stubBoxes, DEFAULT_OPTIONS);
assert.deepEqual([mixed.placeholderPixels, mixed.worst.map((entry) => entry.box.name)], [100, ['Other']], 'real differences still get listed beside placeholder ones');

// A layer drawn over another takes the blame for the pixels they share; the one beneath is not counted twice.
const layered = [box('r', 'Root', null, 0, 0, 40, 20), box('u', 'Under', 'r', 5, 5, 10, 10), box('o', 'Over', 'r', 5, 5, 10, 10)];
const overlap = compareImages(reference, patched, layered, DEFAULT_OPTIONS);
assert.deepEqual(overlap.worst.map((entry) => [entry.box.name, entry.pixels]), [['Over', 100]], 'overlapping siblings: only the topmost layer is blamed');
const sibling = compareImages(reference, patched, [box('r', 'Root', null, 0, 0, 40, 20), box('w', 'Wide', 'r', 0, 0, 30, 20), box('i', 'Inset', 'r', 5, 5, 10, 10)], DEFAULT_OPTIONS);
assert.deepEqual(sibling.worst.map((entry) => entry.box.name), ['Inset'], 'a sibling drawn over a larger layer takes the pixels it covers');

const skewed = compareImages(reference, patched, [], DEFAULT_OPTIONS);
assert.equal(skewed.worst.length, 0, 'without layer boxes the percentage is still reported');

// Saving an export writes the PNG and its layer boxes, and reads the size from the header.
const exported = { id: '454:23001', name: 'Card', png: PNG.sync.write(image(30, 12)).toString('base64'), boxes: BOXES };
const saved = await saveExport(exported, 2);
assert.deepEqual([saved.width, saved.height], [30, 12], 'the size comes from the PNG header');
assert.ok(saved.path.endsWith('454_23001@2x.png') && existsSync(saved.path), 'the reference is saved under a safe name');
assert.equal((JSON.parse(readFileSync(`${saved.path}.json`, 'utf8')) as NodeBox[]).length, 3, 'the layer boxes are saved beside it');

console.log('verify check passed');
