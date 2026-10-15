/** A marker's position on screen, in pixels at the current zoom. */
export interface ScreenPoint {
  id: string;
  x: number;
  y: number;
}

export interface Offset {
  dx: number;
  dy: number;
}

const GAP_PX = 2;

const touches = (a: ScreenPoint, b: ScreenPoint, sizePx: number): boolean =>
  Math.abs(a.x - b.x) < sizePx && Math.abs(a.y - b.y) < sizePx;

/** Groups of markers that overlap, directly or through a chain of neighbours. */
function overlapGroups(points: readonly ScreenPoint[], sizePx: number): ScreenPoint[][] {
  const groups: ScreenPoint[][] = [];
  for (const point of points) {
    const joined = groups.filter((g) => g.some((other) => touches(point, other, sizePx)));
    const merged = [point, ...joined.flat()];
    const rest = groups.filter((g) => !joined.includes(g));
    groups.splice(0, groups.length, ...rest, merged);
  }
  return groups;
}

/**
 * Pixel offsets that lay overlapping markers out side by side in a row, centred on where they
 * were, so each one stays visible and clickable. Markers that touch nothing stay put.
 */
export function spreadOverlapping(points: readonly ScreenPoint[], sizePx: number): Map<string, Offset> {
  const offsets = new Map<string, Offset>();
  for (const group of overlapGroups(points, sizePx)) {
    if (group.length === 1) {
      offsets.set(group[0]!.id, { dx: 0, dy: 0 });
      continue;
    }
    const ordered = [...group].sort((a, b) => a.x - b.x || a.id.localeCompare(b.id));
    const centreX = ordered.reduce((sum, p) => sum + p.x, 0) / ordered.length;
    const centreY = ordered.reduce((sum, p) => sum + p.y, 0) / ordered.length;
    ordered.forEach((p, index) => {
      const targetX = centreX + (index - (ordered.length - 1) / 2) * (sizePx + GAP_PX);
      offsets.set(p.id, { dx: targetX - p.x, dy: centreY - p.y });
    });
  }
  return offsets;
}
