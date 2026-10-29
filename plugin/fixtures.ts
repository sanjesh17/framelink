// Plain fakes stand in for Figma nodes, so the casts to SceneNode are test-only.
export type Fake = Record<string, unknown>;

export const solid = (r: number, g: number, b: number, opacity = 1): Fake => ({ type: 'SOLID', color: { r, g, b }, opacity });

export const fake = (type: string, name: string, extra: Fake = {}): Fake => ({
  id: `1:${name}`,
  type,
  name,
  visible: true,
  x: 0,
  y: 0,
  width: 100,
  height: 40,
  opacity: 1,
  layoutSizingHorizontal: 'FIXED',
  layoutSizingVertical: 'FIXED',
  fills: [],
  strokes: [],
  effects: [],
  ...extra,
});

export const text = (name: string, characters: string, extra: Fake = {}): Fake =>
  fake('TEXT', name, {
    characters,
    fontSize: 14,
    fontWeight: 500,
    fontName: { family: 'Inter', style: 'Regular' },
    lineHeight: { unit: 'PIXELS', value: 20 },
    letterSpacing: { unit: 'PERCENT', value: 0 },
    textAlignHorizontal: 'LEFT',
    textDecoration: 'NONE',
    textCase: 'ORIGINAL',
    textAutoResize: 'WIDTH_AND_HEIGHT',
    fills: [solid(0.19, 0.21, 0.24)],
    ...extra,
  });

export const toNodes = (nodes: Fake[]): SceneNode[] => nodes as unknown as SceneNode[];
