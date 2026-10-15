import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Pane,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import { MAP_CENTER, MAP_ZOOM } from '../config';
import { dataset } from '../data/dataset';
import type { NetworkView } from '../hooks/useNetworkView';
import { useScenarioStore } from '../store/scenario';
import { InterventionMarkers } from './InterventionMarkers';
import { MapLegend } from './MapLegend';
import { MapToolbar } from './MapToolbar';
import { networkBounds, nodeCoords, type LatLngTuple } from './mapGeometry';
import { DESTINATION_COLOR, MAP_PADDING_PX, SHORTEST_COLOR } from './mapStyle';
import { NetworkLayers } from './NetworkLayers';
import { AFTER_PANE, BEFORE_PANE, DESTINATION_PANE, SwipeClip } from './SwipeClip';
import { SwipeDivider } from './SwipeDivider';

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; OpenStreetMap contributors';
const INITIAL_DIVIDER = 0.5;

// Above Leaflet's overlay pane (400) and below its marker pane (600).
const PANE_Z = { before: 410, after: 420, destinations: 430 } as const;

const { destinations } = dataset.neighbourhood;

/** Fit the network on mount and whenever the map container is resized. */
function FitToNetwork() {
  const map = useMap();
  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      map.fitBounds(networkBounds, { padding: [MAP_PADDING_PX, MAP_PADDING_PX], animate: false });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export function MapView({ before, after }: Pick<NetworkView, 'before' | 'after'>) {
  const basemap = useScenarioStore((s) => s.basemap);
  const mapMode = useScenarioStore((s) => s.scenario.mapMode);
  const [divider, setDivider] = useState(INITIAL_DIVIDER);

  const showBefore = mapMode !== 'after';
  const showAfter = mapMode !== 'before';
  const swiping = mapMode === 'swipe';

  return (
    <div className="map-wrap">
      <MapContainer
        center={MAP_CENTER as LatLngTuple}
        zoom={MAP_ZOOM}
        className="map"
        zoomSnap={0.25}
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <FitToNetwork />
        {basemap.visible && (
          <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} opacity={basemap.opacity} />
        )}

        <Pane name={BEFORE_PANE} style={{ zIndex: PANE_Z.before }}>
          {showBefore && <NetworkLayers {...before} caption="before plan" />}
        </Pane>

        {/* Intervention markers live in the after pane, so they only appear on the after side. */}
        <Pane name={AFTER_PANE} style={{ zIndex: PANE_Z.after }}>
          {showAfter && (
            <>
              <NetworkLayers {...after} caption="with plan" />
              <InterventionMarkers />
            </>
          )}
        </Pane>
        <SwipeClip active={swiping} fraction={divider} />

        <Pane name={DESTINATION_PANE} style={{ zIndex: PANE_Z.destinations }}>
          {destinations.map((d) => (
            <CircleMarker
              key={d.id}
              center={nodeCoords.get(d.nodeId)!}
              radius={8}
              pathOptions={{
                color: SHORTEST_COLOR,
                weight: 2,
                fillColor: DESTINATION_COLOR,
                fillOpacity: 1,
              }}
            >
              <Tooltip permanent direction="top" offset={[0, -8]}>
                {d.name}
              </Tooltip>
            </CircleMarker>
          ))}
        </Pane>
      </MapContainer>

      {swiping && <SwipeDivider fraction={divider} onChange={setDivider} />}
      <MapToolbar />
      <MapLegend />
    </div>
  );
}
