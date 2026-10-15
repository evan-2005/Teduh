import L from 'leaflet';
import { useEffect } from 'react';
import { Marker, Tooltip, useMap } from 'react-leaflet';
import type { ContextLayers as LayerToggles } from '../store/scenario';
import type { AreaContext, Landmark, LandmarkKind, LatLngPair } from '../types';
import { BUILDING_STYLE, GREEN_STYLE, TREE_STYLE } from './mapStyle';

export const CONTEXT_PANE = 'contextPane';

const KIND_LABELS: Readonly<Record<LandmarkKind, string>> = {
  school: 'Education',
  'bus-stop': 'Bus stop',
  shops: 'Shops',
  food: 'Food',
  worship: 'Place of worship',
  health: 'Health',
  park: 'Park',
  other: 'Public facility',
};

const GLYPHS: Readonly<Record<LandmarkKind, string>> = {
  school: '<path d="M2 8 9 3l7 5v1H2z"/><rect x="4" y="9" width="10" height="6"/>',
  'bus-stop': '<rect x="3" y="3" width="12" height="10" rx="2"/><circle cx="6" cy="14.5" r="1.4"/><circle cx="12" cy="14.5" r="1.4"/>',
  shops: '<path d="M3 6h12l-1 9H4z"/>',
  food: '<path d="M5 3h8l-1 7a3 3 0 0 1-6 0z"/><rect x="8" y="12" width="2" height="3"/>',
  worship: '<path d="M3 15V9a6 6 0 0 1 12 0v6z"/>',
  health: '<path d="M7 3h4v4h4v4h-4v4H7v-4H3V7h4z"/>',
  park: '<circle cx="9" cy="7" r="5"/><rect x="8" y="11" width="2" height="5"/>',
  other: '<circle cx="9" cy="9" r="4"/>',
};

const ICON_SIZE = 22;

const landmarkIcon = (kind: LandmarkKind): L.DivIcon =>
  L.divIcon({
    className: `landmark landmark--${kind}`,
    html: `<span class="landmark__chip"><svg viewBox="0 0 18 18" width="14" height="14" aria-hidden="true">${GLYPHS[kind]}</svg></span>`,
    iconSize: [ICON_SIZE, ICON_SIZE],
    iconAnchor: [ICON_SIZE / 2, ICON_SIZE / 2],
  });

interface PolygonsProps {
  rings: readonly (readonly LatLngPair[])[];
  style: L.PathOptions;
}

/** Many static polygons on one canvas: far cheaper than one React component per building. */
function Polygons({ rings, style }: PolygonsProps) {
  const map = useMap();
  useEffect(() => {
    const renderer = L.canvas({ pane: CONTEXT_PANE });
    const group = L.layerGroup(
      rings.map((ring) =>
        L.polygon(ring as LatLngPair[], { ...style, renderer, pane: CONTEXT_PANE, interactive: false }),
      ),
    ).addTo(map);
    return () => {
      group.remove();
    };
  }, [map, rings, style]);
  return null;
}

function TreeDots({ trees }: { trees: readonly LatLngPair[] }) {
  const map = useMap();
  useEffect(() => {
    const renderer = L.canvas({ pane: CONTEXT_PANE });
    const group = L.layerGroup(
      trees.map((t) => L.circleMarker(t, { ...TREE_STYLE, renderer, pane: CONTEXT_PANE, interactive: false })),
    ).addTo(map);
    return () => {
      group.remove();
    };
  }, [map, trees]);
  return null;
}

interface ContextLayersProps {
  context: AreaContext;
  toggles: LayerToggles;
}

/** Read-only surroundings: buildings, parks and fields, mapped trees, and named places. */
export function ContextLayers({ context, toggles }: ContextLayersProps) {
  return (
    <>
      {toggles.greens && <Polygons rings={greenRings(context)} style={GREEN_STYLE} />}
      {toggles.buildings && <Polygons rings={context.buildings} style={BUILDING_STYLE} />}
      {toggles.trees && context.trees.length > 0 && <TreeDots trees={context.trees} />}
      {visibleLandmarks(context, toggles).map((landmark) => (
        <Marker
          key={landmark.id}
          position={[landmark.lat, landmark.lng]}
          icon={landmarkIcon(landmark.kind)}
          title={landmark.name}
          keyboard={false}
        >
          <Tooltip direction="top" offset={[0, -10]}>
            <strong>{landmark.name}</strong>
            <br />
            {KIND_LABELS[landmark.kind]}
            {landmark.localName && (
              <>
                <br />
                <small>Local name: {landmark.localName}</small>
              </>
            )}
          </Tooltip>
        </Marker>
      ))}
    </>
  );
}

function visibleLandmarks(context: AreaContext, toggles: LayerToggles): Landmark[] {
  return context.landmarks.filter((l) => (l.kind === 'food' ? toggles.food : toggles.landmarks));
}

const greenCache = new WeakMap<AreaContext, LatLngPair[][]>();
function greenRings(context: AreaContext): LatLngPair[][] {
  let rings = greenCache.get(context);
  if (!rings) {
    rings = context.greens.map((g) => g.ring);
    greenCache.set(context, rings);
  }
  return rings;
}
