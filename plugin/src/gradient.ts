export type GradientBox = { width: number; height: number };

// Figma stores the gradient line as a transform; the inverse of its x axis, scaled by the box, is the CSS direction.
export const gradientAngle = (transform: Transform, box: GradientBox): number => {
  const [[a, b], [c, d]] = transform;
  const det = a * d - b * c;
  if (!det) return 180;
  const degrees = (Math.atan2((d / det) * box.width, -((-c / det) * box.height)) * 180) / Math.PI;
  return Math.round((degrees + 360) % 360);
};

// Where a gradient-space point sits in the box, as 0..1 fractions.
const backThrough = (transform: Transform, x: number, y: number): [number, number] | null => {
  const [[m00, m01, m02], [m10, m11, m12]] = transform;
  const det = m00 * m11 - m01 * m10;
  if (!det) return null;
  const dx = x - m02;
  const dy = y - m12;
  return [(m11 * dx - m01 * dy) / det, (-m10 * dx + m00 * dy) / det];
};

export type GradientHandles = { cx: number; cy: number; rx: number; ry: number; turn: number };

// A radial or angular gradient is a unit circle centred at (0.5, 0.5) in gradient space. Mapping the centre and the
// two edge points back gives its centre (fractions of the box), its radii in px, and how far its x axis is turned
// clockwise, in degrees, which is also where an angular gradient starts (0 = pointing right).
export const gradientHandles = (transform: Transform, box: GradientBox): GradientHandles | null => {
  const centre = backThrough(transform, 0.5, 0.5);
  const right = backThrough(transform, 1, 0.5);
  const down = backThrough(transform, 0.5, 1);
  if (!centre || !right || !down) return null;
  const across = [(right[0] - centre[0]) * box.width, (right[1] - centre[1]) * box.height];
  const below = [(down[0] - centre[0]) * box.width, (down[1] - centre[1]) * box.height];
  return {
    cx: centre[0],
    cy: centre[1],
    rx: Math.hypot(across[0], across[1]),
    ry: Math.hypot(below[0], below[1]),
    turn: (Math.atan2(across[1], across[0]) * 180) / Math.PI,
  };
};
