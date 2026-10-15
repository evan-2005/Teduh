import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import { EXPOSED_THRESHOLD, MAP_CENTER, MAP_ZOOM } from '../config';
import { dataset, graph } from '../data/dataset';
import type { NetworkView } from '../hooks/useNetworkView';
import { useScenarioStore } from '../store/scenario';
import { InterventionMarkers } from './InterventionMarkers';
import { MapLegend } from './MapLegend';
import {
  nodeCoords,
  networkBounds,
  segmentPath,
  segmentsById,
  type LatLngTuple,
} from './mapGeometry';
import {
  DESTINATION_COLOR,
  EXPOSED_COLOR,
  EXPOSED_DASH,
  LEAST_SUN_COLOR,
  MAP_PADDING_PX,
  ROUTE_OVERLAY_WEIGHT,
  ROUTE_UNDERLAY_WEIGHT,
  SEGMENT_WEIGHT,
  SHADED_COLOR,
  SHORTEST_COLOR,
} from './mapStyle';
import { SegmentPopup } from './SegmentPopup';

const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; OpenStreetMap contributors';

const { segments, destinations } = dataset.neighbourhood;

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

interface RouteLayerProps {
  segmentIds: readonly string[];
  color: string;
  weight: number;
  opacity: number;
}

function RouteLayer({ segmentIds, color, weight, opacity }: RouteLayerProps) {
  return (
    <>
      {segmentIds.map((id) => (
        <Polyline
          key={id}
          positions={segmentPath(segmentsById.get(id)!)}
          pathOptions={{ color, weight, opacity, lineCap: 'round' }}
          interactive={false}
        />
      ))}
    </>
  );
}

export function MapView({ shade, comparison }: Pick<NetworkView, 'shade' | 'comparison'>) {
  const basemap = useScenarioStore((s) => s.basemap);

  return (
    <div className="map-wrap">
      <MapContainer
        center={MAP_CENTER as LatLngTuple}
        zoom={MAP_ZOOM}
        className="map"
        zoomSnap={0.25}
      >
        <FitToNetwork />
        {basemap.visible && (
          <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} opacity={basemap.opacity} />
        )}

        {comparison && (
          <RouteLayer
            segmentIds={comparison.shortest.segmentIds}
            color={SHORTEST_COLOR}
            weight={ROUTE_UNDERLAY_WEIGHT}
            opacity={0.3}
          />
        )}

        {segments.map((segment) => {
          const effective = shade.get(segment.id) ?? 0;
          const exposed = effective < EXPOSED_THRESHOLD;
          return (
            <Polyline
              key={segment.id}
              positions={segmentPath(segment)}
              pathOptions={{
                color: exposed ? EXPOSED_COLOR : SHADED_COLOR,
                weight: SEGMENT_WEIGHT,
                dashArray: exposed ? EXPOSED_DASH : undefined,
                opacity: segment.accessible ? 1 : 0.35,
              }}
            >
              <Popup>
                <SegmentPopup
                  segment={segment}
                  lengthM={graph.lengthBySegment.get(segment.id) ?? 0}
                  effectiveShade={effective}
                />
              </Popup>
            </Polyline>
          );
        })}

        {comparison && (
          <RouteLayer
            segmentIds={comparison.leastSun.segmentIds}
            color={LEAST_SUN_COLOR}
            weight={ROUTE_OVERLAY_WEIGHT}
            opacity={0.95}
          />
        )}

        {destinations.map((d) => (
          <CircleMarker
            key={d.id}
            center={nodeCoords.get(d.nodeId)!}
            radius={8}
            pathOptions={{ color: SHORTEST_COLOR, weight: 2, fillColor: DESTINATION_COLOR, fillOpacity: 1 }}
          >
            <Tooltip permanent direction="top" offset={[0, -8]}>
              {d.name}
            </Tooltip>
          </CircleMarker>
        ))}

        <InterventionMarkers />
      </MapContainer>
      <MapLegend />
    </div>
  );
}
