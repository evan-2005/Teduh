import { createProjection } from '../../../data/osm/geometry';
import type { RawElement } from '../../../data/osm/parse';

/**
 * A tiny made-up town in the shape of an Overpass response: a street grid, 64 houses, a school,
 * a bus stop, a supermarket and a park. Used to test the area pipeline without the network.
 */
export const MINI_AREA = { name: 'Testville', lat: 3.1, lng: 101.6, radiusM: 550 };

const proj = createProjection(MINI_AREA.lat, MINI_AREA.lng);
const geo = (x: number, y: number) => {
  const [lat, lon] = proj.toLatLng(x, y);
  return { lat, lon };
};

const SPACING = 70;
const HALF = 4;
const EXTENT = SPACING * HALF;

let nextId = 1;
const id = (): number => nextId++;

function street(points: [number, number][], name: string): RawElement {
  return { type: 'way', id: id(), tags: { highway: 'residential', name }, geometry: points.map(([x, y]) => geo(x, y)) };
}

function house(cx: number, cy: number): RawElement {
  const r = 5;
  const ring = [[cx - r, cy - r], [cx + r, cy - r], [cx + r, cy + r], [cx - r, cy + r], [cx - r, cy - r]] as const;
  return { type: 'way', id: id(), tags: { building: 'house' }, geometry: ring.map(([x, y]) => geo(x, y)) };
}

export function miniAreaElements(options: { withHouses?: boolean } = {}): RawElement[] {
  nextId = 1;
  const elements: RawElement[] = [];
  for (let i = -HALF; i <= HALF; i++) {
    const line = Array.from({ length: 2 * HALF + 1 }, (_, k) => -EXTENT + k * SPACING);
    elements.push(street(line.map((x) => [x, i * SPACING] as [number, number]), `Jalan Test ${i + HALF}`));
    elements.push(street(line.map((y) => [i * SPACING, y] as [number, number]), `Lorong Uji ${i + HALF}`));
  }
  if (options.withHouses !== false) {
    for (let i = -HALF; i < HALF; i++) {
      for (let j = -HALF; j < HALF; j++) elements.push(house(i * SPACING + 35, j * SPACING + 35));
    }
  }
  const poi = (x: number, y: number, tags: Record<string, string>): RawElement => ({
    type: 'node',
    id: id(),
    ...geo(x, y),
    tags,
  });
  elements.push(
    poi(280, 280, { amenity: 'school', name: 'Sekolah Ujian' }),
    poi(-280, -280, { highway: 'bus_stop', name: 'Perhentian Ujian' }),
    poi(280, -280, { shop: 'supermarket', name: 'Pasaraya Ujian' }),
    poi(-280, 280, { amenity: 'clinic', name: 'Klinik Ujian' }),
  );
  return elements;
}
