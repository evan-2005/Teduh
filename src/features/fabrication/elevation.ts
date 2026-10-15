import type { FabricationSpec } from '../../types';

const WIDTH = 640;
const HEIGHT = 250;
const MARGIN_X = 48;
const GROUND_Y = 180;
const POST_HEIGHT_PX = 96;
const POST_WIDTH_PX = 4;
const ROOF_THICKNESS_PX = 7;
const ROOF_RISE_PX = 10;
const DIM_OFFSET_PX = 34;

const fmt = (n: number): string => n.toFixed(1);

/**
 * Side elevation of a shelter: posts, sloped roof line and dimension labels.
 * Horizontal scale follows the length; height is drawn at a fixed size, so it is not to scale.
 * Output is a pure string (numbers and fixed labels only).
 */
export function shelterElevationSvg(spec: FabricationSpec): string {
  const lengthM = spec.dimensions.lengthM ?? 0;
  const heightM = spec.dimensions.heightM ?? 0;
  const modules = Math.max(1, spec.dimensions.modules ?? 1);
  const span = WIDTH - 2 * MARGIN_X;
  const spacing = span / modules;
  const roofY = GROUND_Y - POST_HEIGHT_PX;
  const dimY = GROUND_Y + DIM_OFFSET_PX;

  const posts = Array.from({ length: modules + 1 }, (_, i) => {
    const x = MARGIN_X + i * spacing - POST_WIDTH_PX / 2;
    return `<rect class="post" x="${fmt(x)}" y="${roofY}" width="${POST_WIDTH_PX}" height="${POST_HEIGHT_PX}"/>`;
  }).join('');

  const roof =
    `<polygon class="roof" points="${MARGIN_X - 8},${roofY} ${WIDTH - MARGIN_X + 8},${roofY - ROOF_RISE_PX} ` +
    `${WIDTH - MARGIN_X + 8},${roofY - ROOF_RISE_PX + ROOF_THICKNESS_PX} ${MARGIN_X - 8},${roofY + ROOF_THICKNESS_PX}"/>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="Shelter side elevation, ${fmt(lengthM)} m long">`,
    '<g stroke="currentColor" fill="currentColor" stroke-width="1">',
    `<line class="ground" x1="${MARGIN_X - 20}" y1="${GROUND_Y}" x2="${WIDTH - MARGIN_X + 20}" y2="${GROUND_Y}"/>`,
    posts,
    roof,
    `<line class="dim" x1="${MARGIN_X}" y1="${dimY}" x2="${WIDTH - MARGIN_X}" y2="${dimY}"/>`,
    `<text class="dim-label" x="${WIDTH / 2}" y="${dimY + 16}" text-anchor="middle" stroke="none" font-size="13">${fmt(lengthM)} m (${modules} modules)</text>`,
    `<line class="dim" x1="${MARGIN_X - 22}" y1="${roofY}" x2="${MARGIN_X - 22}" y2="${GROUND_Y}"/>`,
    `<text class="dim-label" x="${MARGIN_X - 28}" y="${(roofY + GROUND_Y) / 2}" text-anchor="end" stroke="none" font-size="13">${fmt(heightM)} m</text>`,
    `<text class="dim-label" x="${MARGIN_X}" y="${roofY - ROOF_RISE_PX - 8}" stroke="none" font-size="12">Module spacing ${fmt(lengthM / modules)} m</text>`,
    `<text class="note" x="${WIDTH - MARGIN_X}" y="${HEIGHT - 6}" text-anchor="end" stroke="none" font-size="10">Not to scale vertically. Indicative only.</text>`,
    '</g>',
    '</svg>',
  ].join('');
}
