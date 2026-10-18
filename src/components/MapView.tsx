import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Pane,
  Popup,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import { MAP_ZOOM } from '../config';
import { dataset, meta } from '../data/dataset';
import type { NetworkView } from '../hooks/useNetworkView';
import { useAreaContext } from '../hooks/useAreaContext';
import { useScenarioStore } from '../store/scenario';
import { TILE_SOURCES } from './basemaps';
import { CONTEXT_PANE, ContextLayers } from './ContextLayers';
import { InterventionMarkers } from './InterventionMarkers';
import { LayersControl } from './LayersControl';
import { MapLegend } from './MapLegend';
import { MapToolbar } from './MapToolbar';
import { networkBounds, nodeCoords, type LatLngTuple } from './mapGeometry';
import { DESTINATION_COLOR, MAP_PADDING_PX, SHORTEST_COLOR } from './mapStyle';
import { NetworkLayers } from './NetworkLayers';
import { PlantingLayer } from './PlantingLayer';
import { AFTER_PANE, BEFORE_PANE, DESTINATION_PANE, SwipeClip } from './SwipeClip';
import { SwipeDivider } from './SwipeDivider';

const INITIAL_DIVIDER = 0.5;

// Above Leaflet's overlay pane (400) and below its marker pane (600).
const PANE_Z = {
  context: 405,
  before: 410,
  after: 420,
  planting: 425,
  destinations: 430,
  interventions: 440,
} as const;
const INTERVENTION_PANE = 'interventionPane';
const PLANTING_PANE = 'plantingPane';

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
  const layers = useScenarioStore((s) => s.contextLayers);
  const hasPlan = useScenarioStore((s) => s.scenario.selectedInterventionIds.length > 0);
  const context = useAreaContext();
  const [divider, setDivider] = useState(INITIAL_DIVIDER);

  const showBefore = mapMode !== 'after';
  const showAfter = mapMode !== 'before';
  const swiping = mapMode === 'swipe';
  const tiles = basemap.style === 'none' ? null : TILE_SOURCES[basemap.style];

  return (
    <div className="map-wrap">
      <MapToolbar />
      <div className="map-stage">
        <MapContainer
          center={meta.center as LatLngTuple}
          zoom={MAP_ZOOM}
          className="map"
          zoomSnap={0.25}
          zoomControl={false}
        >
          <ZoomControl position="bottomright" />
          <FitToNetwork />
          {tiles && (
            <TileLayer
              key={basemap.style}
              url={tiles.url}
              attribution={tiles.attribution}
              opacity={basemap.opacity}
              subdomains={tiles.subdomains ?? 'abc'}
              maxNativeZoom={tiles.maxNativeZoom}
              className={tiles.className}
            />
          )}

          <Pane name={CONTEXT_PANE} style={{ zIndex: PANE_Z.context }}>
            {context && <ContextLayers context={context} toggles={layers} />}
          </Pane>

          <Pane name={BEFORE_PANE} style={{ zIndex: PANE_Z.before }}>
            {showBefore && <NetworkLayers {...before} caption="before plan" />}
          </Pane>

          <Pane name={AFTER_PANE} style={{ zIndex: PANE_Z.after }}>
            {showAfter && <NetworkLayers {...after} caption="with plan" baseline={before.shade} />}
            {/* What the plan builds belongs to the After side only, so Swipe compares like with like. */}
            {showAfter && <PlantingLayer context={context} show="chosen" />}
          </Pane>
          <SwipeClip active={swiping} fraction={divider} />

          {/* A candidate whose spec pack is open, previewed on both sides even if not in the plan. */}
          <Pane name={PLANTING_PANE} style={{ zIndex: PANE_Z.planting }}>
            <PlantingLayer context={context} show={showAfter ? 'preview' : 'preview-all'} />
          </Pane>

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
                {d.localName && (
                  <Popup>
                    <strong>{d.name}</strong>
                    <br />
                    Local name: {d.localName}
                  </Popup>
                )}
              </CircleMarker>
            ))}
          </Pane>

          {/* Never clipped by the swipe, so every candidate can always open its fabrication pack. */}
          <Pane name={INTERVENTION_PANE} style={{ zIndex: PANE_Z.interventions }}>
            <InterventionMarkers showChosen={showAfter} />
          </Pane>
        </MapContainer>

        {swiping && <SwipeDivider fraction={divider} onChange={setDivider} />}
        {!hasPlan && showAfter && (
          <p className="map-hint" role="status">
            No plan chosen yet, so Before and After look the same. Choose a plan to compare.
          </p>
        )}
        <LayersControl context={context} />
        <MapLegend />
      </div>
    </div>
  );
}
