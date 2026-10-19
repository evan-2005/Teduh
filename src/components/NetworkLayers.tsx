import { Polyline, Popup } from 'react-leaflet';
import { useScenarioStore } from '../store/scenario';
import { EXPOSED_THRESHOLD } from '../config';
import { dataset, graph } from '../data/dataset';
import type { LayerView } from '../hooks/useNetworkView';
import { nearestSlot } from '../lib/clock';
import type { ShadeLookup } from '../lib/shade';
import type { PathSegment } from '../types';
import { segmentPath, segmentsById } from './mapGeometry';
import {
  CASING_COLOR,
  CASING_EXTRA_PX,
  EXPOSED_COLOR,
  EXPOSED_DASH,
  LEAST_SUN_COLOR,
  NEWLY_SHADED_COLOR,
  NEWLY_SHADED_WEIGHT,
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
  /** Shade without the plan: paths the plan moves out of direct sun are highlighted. */
  baseline?: ShadeLookup;
}

type SegmentState = 'exposed' | 'shaded' | 'newly-shaded';

function segmentState(id: string, shade: ShadeLookup, baseline?: ShadeLookup): SegmentState {
  if ((shade.get(id) ?? 0) < EXPOSED_THRESHOLD) return 'exposed';
  return baseline && (baseline.get(id) ?? 0) < EXPOSED_THRESHOLD ? 'newly-shaded' : 'shaded';
}

function segmentStyle(state: SegmentState, segment: PathSegment) {
  const opacity = segment.accessible ? 1 : 0.35;
  if (state === 'exposed') return { color: EXPOSED_COLOR, weight: SEGMENT_WEIGHT, dashArray: EXPOSED_DASH, opacity };
  if (state === 'shaded') return { color: SHADED_COLOR, weight: SEGMENT_WEIGHT, opacity };
  return { color: NEWLY_SHADED_COLOR, weight: NEWLY_SHADED_WEIGHT, opacity, lineCap: 'round' as const };
}

/** White casings under newly shaded paths, so the change reads at a glance on any background. */
function Casings({ ids }: { ids: readonly string[] }) {
  return (
    <>
      {ids.map((id) => (
        <Polyline
          key={id}
          positions={segmentPath(segmentsById.get(id)!)}
          pathOptions={{ color: CASING_COLOR, weight: NEWLY_SHADED_WEIGHT + CASING_EXTRA_PX, opacity: 0.9 }}
          interactive={false}
        />
      ))}
    </>
  );
}

interface SegmentLineProps {
  segment: PathSegment;
  state: SegmentState;
  effectiveShade: number;
  caption: string;
  /** True when a person confirmed an AI shade estimate for this path at this time. */
  confirmed: boolean;
}

function SegmentLine({ segment, state, effectiveShade, caption, confirmed }: SegmentLineProps) {
  return (
    <Polyline positions={segmentPath(segment)} pathOptions={segmentStyle(state, segment)}>
      <Popup>
        <SegmentPopup
          segment={segment}
          lengthM={graph.lengthBySegment.get(segment.id) ?? 0}
          effectiveShade={effectiveShade}
          caption={caption}
          sourceOverride={confirmed ? 'ai-confirmed' : undefined}
        />
      </Popup>
    </Polyline>
  );
}

/** One complete rendering of the network (segments + both routes). Render inside a <Pane>. */
export function NetworkLayers({ shade, comparison, caption, baseline }: NetworkLayersProps) {
  const time = useScenarioStore((s) => s.scenario.time);
  const overrides = useScenarioStore((s) => s.shadeOverrides);
  const confirmed = new Set(overrides.filter((o) => o.time === nearestSlot(time)).map((o) => o.segmentId));
  const states = new Map(segments.map((s) => [s.id, segmentState(s.id, shade, baseline)]));
  const changed = segments.filter((s) => states.get(s.id) === 'newly-shaded').map((s) => s.id);
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

      <Casings ids={changed} />
      {segments.map((segment) => (
        <SegmentLine
          key={`${segment.id}-${states.get(segment.id)}`}
          segment={segment}
          state={states.get(segment.id)!}
          effectiveShade={shade.get(segment.id) ?? 0}
          caption={caption}
          confirmed={confirmed.has(segment.id)}
        />
      ))}

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
