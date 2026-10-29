import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export type NodeBox = { id: string; name: string; type: string; parent: string | null; x: number; y: number; w: number; h: number; placeholder?: true };

export type ExportResult = { id: string; name: string; png: string; boxes: NodeBox[] };

export type CompareOptions = { threshold: number; top: number };

type Mismatch = { box: NodeBox; pixels: number };

export type Comparison = {
  reference: { width: number; height: number };
  screenshot: { width: number; height: number };
  width: number;
  height: number;
  mismatched: number;
  placeholderPixels: number;
  worst: Mismatch[];
  diff: PNG | null;
};

const DIR = join(tmpdir(), 'framelink');

export const DEFAULT_OPTIONS: CompareOptions = { threshold: 0.1, top: 5 };

// A PNG states its size at fixed offsets in the header, so there is no need to decode it.
const sizeOfPng = (bytes: Buffer): { width: number; height: number } => ({ width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) });

export const saveExport = async (result: ExportResult, scale: number): Promise<{ path: string; width: number; height: number }> => {
  await mkdir(DIR, { recursive: true });
  const bytes = Buffer.from(result.png, 'base64');
  const path = join(DIR, `${result.id.replace(/[^\w-]/g, '_')}@${scale}x.png`);
  await writeFile(path, bytes);
  await writeFile(`${path}.json`, JSON.stringify(result.boxes));
  return { path, ...sizeOfPng(bytes) };
};

export const describeExport = (saved: { path: string; width: number; height: number }, scale: number): string =>
  `Saved reference ${saved.path} (${saved.width}x${saved.height}px, scale ${scale}). ` +
  'Render your component, screenshot only that element at the same pixel size, then call verify_render with this path and the screenshot path.';

const crop = (image: PNG, width: number, height: number): Buffer => {
  if (image.width === width && image.height === height) return image.data;
  const out = Buffer.alloc(width * height * 4);
  for (let row = 0; row < height; row += 1) image.data.copy(out, row * width * 4, row * image.width * 4, row * image.width * 4 + width * 4);
  return out;
};

// pixelmatch paints a real difference pure red; faded greys are matches and yellow is anti-aliasing it chose to ignore.
const isMismatch = (diff: Buffer, index: number): boolean => diff[index] === 255 && diff[index + 1] === 0 && diff[index + 2] === 0;

// Each differing pixel is blamed on exactly one layer: the topmost box that holds it. Boxes arrive in paint order, so a later box
// covers an earlier one (a sibling drawn on top, or a child over its parent). Counting a pixel for every box around it would blame
// a layer for differences that belong to something drawn over it.
const attribute = (boxes: ReadonlyArray<NodeBox>, diff: Buffer, width: number, height: number): Mismatch[] => {
  const owner = new Int32Array(width * height).fill(-1);
  boxes.forEach((box, index) => {
    const left = Math.max(0, box.x);
    const right = Math.min(width, box.x + box.w);
    for (let y = Math.max(0, box.y); y < Math.min(height, box.y + box.h); y += 1) owner.fill(index, y * width + left, y * width + right);
  });
  const counts = new Uint32Array(boxes.length);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    if (owner[pixel] >= 0 && isMismatch(diff, pixel * 4)) counts[owner[pixel]] += 1;
  }
  return boxes
    .map((box, index) => ({ box, pixels: counts[index] }))
    .filter((entry) => entry.pixels > 0)
    .sort((a, b) => b.pixels - a.pixels);
};

export const compareImages = (reference: PNG, screenshot: PNG, boxes: ReadonlyArray<NodeBox>, options: CompareOptions): Comparison => {
  // Differently sized images are compared over the area they share, from the top-left, and the size gap is reported.
  const width = Math.min(reference.width, screenshot.width);
  const height = Math.min(reference.height, screenshot.height);
  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(crop(reference, width, height), crop(screenshot, width, height), diff.data, width, height, { threshold: options.threshold });
  const blame = mismatched > 0 ? attribute(boxes, diff.data, width, height) : [];
  // Images and icons are stubs on purpose, so their differences are counted apart and never listed as things to fix.
  const stubs = blame.filter((entry) => entry.box.placeholder);
  const real = blame.filter((entry) => !entry.box.placeholder);
  return {
    reference: { width: reference.width, height: reference.height },
    screenshot: { width: screenshot.width, height: screenshot.height },
    width,
    height,
    mismatched,
    placeholderPixels: stubs.reduce((sum, entry) => sum + entry.pixels, 0),
    worst: real.slice(0, options.top),
    diff: mismatched > 0 ? diff : null,
  };
};

const percent = (part: number, whole: number): string => `${Math.round((part / whole) * 1000) / 10}%`;

export const describeComparison = (result: Comparison, diffPath: string | null): string => {
  const total = result.width * result.height;
  const sameSize = result.reference.width === result.screenshot.width && result.reference.height === result.screenshot.height;
  const lines: string[] = [];
  if (!sameSize) {
    lines.push(
      `SIZE MISMATCH: reference ${result.reference.width}x${result.reference.height}, screenshot ${result.screenshot.width}x${result.screenshot.height}. ` +
        `Compared only the shared top-left ${result.width}x${result.height}. Screenshot just the component element at device scale 1 (or pass a scale to export_node).`
    );
  }
  const matched = total === 0 ? '0%' : percent(total - result.mismatched, total);
  lines.push(`match ${matched}: ${result.mismatched} of ${total} px differ${result.mismatched === 0 ? ' (identical within tolerance)' : ''}`);
  if (result.placeholderPixels > 0) {
    lines.push(
      `${result.placeholderPixels} of those px are in placeholder layers (images and icons stubbed on purpose); ignoring them the match is ${percent(total - (result.mismatched - result.placeholderPixels), total)}`
    );
  }
  result.worst.forEach(({ box, pixels }) => {
    lines.push(`- ${box.name} @${box.id} ${box.type} at ${box.x},${box.y} ${box.w}x${box.h}: ${pixels} px (${percent(pixels, Math.max(1, box.w * box.h))} of its box)`);
  });
  if (diffPath) lines.push(`diff image (differences in red): ${diffPath}`);
  return lines.join('\n');
};

const readPng = async (path: string): Promise<PNG> => {
  try {
    return PNG.sync.read(await readFile(path));
  } catch {
    throw new Error(`Could not read a PNG at ${path}`);
  }
};

const readBoxes = async (referencePath: string): Promise<NodeBox[]> => {
  try {
    return JSON.parse(await readFile(`${referencePath}.json`, 'utf8')) as NodeBox[];
  } catch {
    return [];
  }
};

export const verifyRender = async (referencePath: string, screenshotPath: string, options: CompareOptions = DEFAULT_OPTIONS): Promise<string> => {
  const [reference, screenshot, boxes] = await Promise.all([readPng(referencePath), readPng(screenshotPath), readBoxes(referencePath)]);
  const result = compareImages(reference, screenshot, boxes, options);
  let diffPath: string | null = null;
  if (result.diff) {
    await mkdir(DIR, { recursive: true });
    diffPath = join(DIR, `diff-${Date.now()}.png`);
    await writeFile(diffPath, PNG.sync.write(result.diff));
  }
  return describeComparison(result, diffPath);
};
