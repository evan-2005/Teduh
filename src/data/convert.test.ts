import { describe, expect, test } from 'vitest';
import { convertGeoJson } from '../../data/convert-geojson';
import { neighbourhoodSchema } from './load';

const line = (coordinates: number[][], properties: Record<string, unknown> = {}) => ({
  geometry: { type: 'LineString', coordinates },
  properties,
});
const point = (coordinates: number[], properties: Record<string, unknown>) => ({
  geometry: { type: 'Point', coordinates },
  properties,
});

const SHADES = { shade09: 1, shade12: 0.75, shade14: 0.5, shade17: 0.25 };

describe('convertGeoJson', () => {
  const collection = {
    features: [
      line([[101.6, 3.1], [101.6, 3.1009], [101.601, 3.1009]], { id: 'lane', widthM: 3, ...SHADES }),
      line([[101.601, 3.1009], [101.601, 3.1018]], { id: 'road', ...SHADES }),
      point([101.6, 3.1], { name: 'Home', kind: 'home', id: 'dest-home' }),
      point([101.601, 3.1018], { name: 'Shops', kind: 'shops' }),
    ],
  };

  test('splits lines at vertices and shares nodes where lines meet', () => {
    const result = convertGeoJson(collection);
    expect(result.segments.map((s) => s.id)).toEqual(['lane-1', 'lane-2', 'road']);
    expect(result.nodes).toHaveLength(4);
    expect(result.segments[1]!.to).toBe(result.segments[2]!.from);
  });

  test('reads shade, width and marks complete surveys as surveyed', () => {
    const [first] = convertGeoJson(collection).segments;
    expect(first!.shade).toEqual({ '09:00': 1, '12:00': 0.75, '14:00': 0.5, '17:00': 0.25 });
    expect(first!.widthM).toBe(3);
    expect(first!.shadeSource).toBe('surveyed');
  });

  test('snaps destinations to the nearest traced node', () => {
    const { destinations, nodes } = convertGeoJson(collection);
    expect(destinations.map((d) => d.name)).toEqual(['Home', 'Shops']);
    expect(nodes.some((n) => n.id === destinations[0]!.nodeId)).toBe(true);
  });

  test('flags segments with missing shade values', () => {
    const result = convertGeoJson({ features: [line([[101.6, 3.1], [101.6, 3.1009]], { shade14: 0.2 })] });
    expect(result.segments[0]!.shadeSource).toBe('missing');
  });

  test('rejects a destination far from any path', () => {
    const far = { features: [...collection.features, point([101.7, 3.2], { name: 'Far', kind: 'park' })] };
    expect(() => convertGeoJson(far)).toThrow(/not within 15 m/);
  });

  test('produces data the app schema accepts', () => {
    expect(neighbourhoodSchema.safeParse(convertGeoJson(collection)).success).toBe(true);
  });
});
