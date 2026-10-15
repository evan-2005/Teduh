import { Polyline, Popup } from 'react-leaflet';
import { EXPOSED_THRESHOLD } from '../config';
import { dataset, graph } from '../data/dataset';
import type { LayerView } from '../hooks/useNetworkView';
import { segmentPath, segmentsById } from './mapGeometry';
import {
  EXPOSED_COLOR,
  EXPOSED_DASH,
  LEAST_SUN_COLOR,
  ROUTE_OVERLAY_WEIGHT,
  ROUTE_UNDERLAY_WEIGHT,
  SEGMENT_WEIGHT,
  SHADED_COLOR,
  SHORTEST_COLOR,
} from './mapStyle';
import { SegmentPopup } from './SegmentPopup';

const { segments } = dataset.neighbourhood;

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

interface NetworkLayersProps extends LayerView {
  /** Shown in segment popups so people know which side they clicked. */
  caption: string;
}

/** One complete rendering of the network (segments + both routes). Render inside a <Pane>. */
export function NetworkLayers({ shade, comparison, caption }: NetworkLayersProps) {
  return (
    <>
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
                caption={caption}
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
    </>
  );
}
