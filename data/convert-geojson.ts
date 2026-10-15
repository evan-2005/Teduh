/**
 * Convert a traced GeoJSON file (from geojson.io) into data/neighbourhood.json.
 *
 *   npx tsx data/convert-geojson.ts traced.geojson data/neighbourhood.json
 *
 * LineString features become path segments (split at every vertex). Properties:
 *   id?, widthM?, shade09? shade12? shade14? shade17? (0..1), accessible?, notes?
 * Point features become destinations. Properties: name, kind, id?
 * Segments missing any shade value are marked shadeSource "missing" so the UI shows it.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { haversineM } from '../src/lib/geo';
import type { Destination, DestinationKind, Neighbourhood, PathNode, PathSegment } from '../src/types';

const COORD_DECIMALS = 6;
const SNAP_RADIUS_M = 15;
const DEFAULT_WIDTH_M = 2;
const MISSING_SHADE = 0.5;
const SHADE_KEYS = [
  ['09:00', 'shade09'],
  ['12:00', 'shade12'],
  ['14:00', 'shade14'],
  ['17:00', 'shade17'],
] as const;

interface Feature {
  geometry: { type: string; coordinates: unknown };
  properties?: Record<string, unknown> | null;
}

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

export function convertGeoJson(collection: { features: Feature[] }): Neighbourhood {
  const nodes: PathNode[] = [];
  const nodeIdByKey = new Map<string, string>();

  const nodeFor = (lng: number, lat: number): string => {
    const key = `${lat.toFixed(COORD_DECIMALS)},${lng.toFixed(COORD_DECIMALS)}`;
    const existing = nodeIdByKey.get(key);
    if (existing) return existing;
    const id = `n-${nodes.length + 1}`;
    nodes.push({ id, lat: Number(lat.toFixed(COORD_DECIMALS)), lng: Number(lng.toFixed(COORD_DECIMALS)) });
    nodeIdByKey.set(key, id);
    return id;
  };

  const segments: PathSegment[] = [];
  collection.features
    .filter((f) => f.geometry.type === 'LineString')
    .forEach((feature, index) => {
      const props = feature.properties ?? {};
      const coords = feature.geometry.coordinates as [number, number][];
      const prefix = typeof props['id'] === 'string' ? props['id'] : `seg-${index + 1}`;
      const shades = SHADE_KEYS.map(([slot, key]) => [slot, num(props[key])] as const);
      const complete = shades.every(([, v]) => v !== undefined);
      for (let i = 0; i + 1 < coords.length; i++) {
        const [lng1, lat1] = coords[i]!;
        const [lng2, lat2] = coords[i + 1]!;
        segments.push({
          id: coords.length > 2 ? `${prefix}-${i + 1}` : prefix,
          from: nodeFor(lng1, lat1),
          to: nodeFor(lng2, lat2),
          widthM: num(props['widthM']) ?? DEFAULT_WIDTH_M,
          shade: Object.fromEntries(shades.map(([slot, v]) => [slot, v ?? MISSING_SHADE])) as PathSegment['shade'],
          shadeSource: complete ? 'surveyed' : 'missing',
          accessible: props['accessible'] !== false,
          ...(typeof props['notes'] === 'string' ? { notes: props['notes'] } : {}),
        });
      }
    });

  const destinations: Destination[] = collection.features
    .filter((f) => f.geometry.type === 'Point')
    .map((feature, index) => {
      const props = feature.properties ?? {};
      const [lng, lat] = feature.geometry.coordinates as [number, number];
      const nearest = nodes
        .map((n) => ({ n, d: haversineM(n, { lat, lng }) }))
        .sort((a, b) => a.d - b.d)[0];
      const name = String(props['name'] ?? `Destination ${index + 1}`);
      if (!nearest || nearest.d > SNAP_RADIUS_M) {
        throw new Error(`Destination "${name}" is not within ${SNAP_RADIUS_M} m of a traced path`);
      }
      return {
        id: typeof props['id'] === 'string' ? props['id'] : `dest-${index + 1}`,
        nodeId: nearest.n.id,
        name,
        kind: String(props['kind'] ?? 'shops') as DestinationKind,
      };
    });

  return { nodes, segments, destinations };
}

// CLI entry point (skipped when imported by tests).
const [input, output] = process.argv.slice(2);
if (input && output && process.argv[1]?.endsWith('convert-geojson.ts')) {
  const result = convertGeoJson(JSON.parse(readFileSync(input, 'utf8')));
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  process.stderr.write(
    `Wrote ${result.segments.length} segments, ${result.nodes.length} nodes, ${result.destinations.length} destinations to ${output}\n`,
  );
}
