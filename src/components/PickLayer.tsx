import { Polyline, Tooltip } from 'react-leaflet';
import { dataset } from '../data/dataset';
import { togglePath } from '../lib/userPlacement';
import { useScenarioStore } from '../store/scenario';
import { segmentPath, segmentsById } from './mapGeometry';
import { PICKED_STYLE, PICK_TARGET_STYLE } from './mapStyle';

const { segments } = dataset.neighbourhood;

/**
 * While the person places a tree row or walkway: every path becomes a wide click target, and
 * the paths picked so far are highlighted. Render inside a pane above the network.
 */
export function PickLayer() {
  const placing = useScenarioStore((s) => s.placing);
  const setPlacing = useScenarioStore((s) => s.setPlacing);
  if (!placing) return null;
  const picked = new Set(placing.segmentIds);
  const toggle = (id: string) =>
    setPlacing({ ...placing, segmentIds: togglePath(placing.segmentIds, id, segmentsById) });

  return (
    <>
      {segments
        .filter((s) => s.accessible)
        .map((segment) => (
          <Polyline
            key={`${segment.id}-${picked.has(segment.id)}`}
            positions={segmentPath(segment)}
            pathOptions={picked.has(segment.id) ? PICKED_STYLE : PICK_TARGET_STYLE}
            eventHandlers={{ click: () => toggle(segment.id) }}
          >
            <Tooltip sticky>{picked.has(segment.id) ? 'Click to take this path out' : 'Click to add this path'}</Tooltip>
          </Polyline>
        ))}
    </>
  );
}
