import L from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';
import { dataset } from '../data/dataset';
import { formatMyr } from '../lib/format';
import { useScenarioStore } from '../store/scenario';
import type { InterventionType } from '../types';
import { interventionPosition } from './mapGeometry';

const ICON_SIZE = 30;

const GLYPHS: Record<InterventionType, string> = {
  tree: '<circle cx="15" cy="12" r="8" class="glyph__fill"/><rect x="13.5" y="19" width="3" height="7" class="glyph__trunk"/>',
  shelter:
    '<polygon points="3,13 15,5 27,13" class="glyph__fill"/><rect x="6" y="13" width="2.5" height="12" class="glyph__trunk"/><rect x="21.5" y="13" width="2.5" height="12" class="glyph__trunk"/>',
};

const iconFor = (type: InterventionType, selected: boolean, offsetX: number): L.DivIcon =>
  L.divIcon({
    className: `marker ${selected ? 'marker--selected' : 'marker--candidate'}`,
    html: `<svg viewBox="0 0 30 30" width="${ICON_SIZE}" height="${ICON_SIZE}" aria-hidden="true">${GLYPHS[type]}</svg>`,
    iconSize: [ICON_SIZE, ICON_SIZE],
    iconAnchor: [ICON_SIZE / 2 - offsetX, ICON_SIZE / 2],
  });

const positions = new Map(
  dataset.interventions.map((i) => [i.id, interventionPosition(i)] as const),
);

const SAME_SPOT_DECIMALS = 5;
const SPREAD_PX = ICON_SIZE + 2;

/** Markers that share a spot are spread sideways so each one stays clickable. */
const offsets = (() => {
  const groups = new Map<string, string[]>();
  for (const [id, [lat, lng]] of positions) {
    const key = `${lat.toFixed(SAME_SPOT_DECIMALS)},${lng.toFixed(SAME_SPOT_DECIMALS)}`;
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }
  const result = new Map<string, number>();
  for (const ids of groups.values()) {
    ids.forEach((id, index) => result.set(id, (index - (ids.length - 1) / 2) * SPREAD_PX));
  }
  return result;
})();

/** Candidate markers: hollow when not chosen, filled when part of the current selection. */
export function InterventionMarkers() {
  const selectedIds = useScenarioStore((s) => s.scenario.selectedInterventionIds);
  const selectIntervention = useScenarioStore((s) => s.selectIntervention);

  return (
    <>
      {dataset.interventions.map((intervention) => {
        const selected = selectedIds.includes(intervention.id);
        return (
          <Marker
            key={`${intervention.id}-${selected}`}
            position={positions.get(intervention.id)!}
            icon={iconFor(intervention.type, selected, offsets.get(intervention.id) ?? 0)}
            title={intervention.name}
            eventHandlers={{ click: () => selectIntervention(intervention.id) }}
          >
            <Tooltip direction="bottom" offset={[0, 12]}>
              {intervention.name} · {formatMyr(intervention.installCost)}
              {selected ? ' · chosen' : ''}
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
