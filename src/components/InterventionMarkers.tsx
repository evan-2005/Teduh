import L from 'leaflet';
import { useMemo, useState } from 'react';
import { Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { useInterventions } from '../hooks/useInterventions';
import { formatMyr } from '../lib/format';
import { spreadOverlapping, type Offset } from '../lib/spread';
import { useScenarioStore } from '../store/scenario';
import type { InterventionType } from '../types';
import { interventionPosition, type LatLngTuple } from './mapGeometry';

const ICON_SIZE = 30;

const GLYPHS: Record<InterventionType, string> = {
  tree: '<circle cx="15" cy="12" r="8" class="glyph__fill"/><rect x="13.5" y="19" width="3" height="7" class="glyph__trunk"/>',
  shelter:
    '<polygon points="3,13 15,5 27,13" class="glyph__fill"/><rect x="6" y="13" width="2.5" height="12" class="glyph__trunk"/><rect x="21.5" y="13" width="2.5" height="12" class="glyph__trunk"/>',
};

const iconFor = (type: InterventionType, selected: boolean, offset: Offset): L.DivIcon =>
  L.divIcon({
    className: `marker ${selected ? 'marker--selected' : 'marker--candidate'}`,
    html: `<svg viewBox="0 0 30 30" width="${ICON_SIZE}" height="${ICON_SIZE}" aria-hidden="true">${GLYPHS[type]}</svg>`,
    iconSize: [ICON_SIZE, ICON_SIZE],
    iconAnchor: [ICON_SIZE / 2 - offset.dx, ICON_SIZE / 2 - offset.dy],
  });

const NO_OFFSET: Offset = { dx: 0, dy: 0 };

/**
 * Markers that would overlap at the current zoom are laid out side by side, so each one stays
 * visible and clickable. Recomputed when the zoom changes, since overlap depends on it.
 */
function useSpreadOffsets(positions: ReadonlyMap<string, LatLngTuple>): Map<string, Offset> {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return useMemo(() => {
    const points = [...positions].map(([id, latLng]) => {
      const { x, y } = map.project(latLng, zoom);
      return { id, x, y };
    });
    return spreadOverlapping(points, ICON_SIZE);
  }, [map, zoom, positions]);
}

interface InterventionMarkersProps {
  /** False in Before mode: the map shows no plan, so every marker is drawn as a candidate. */
  showChosen: boolean;
}

/** Candidate markers: hollow when not chosen, filled when part of the current selection. */
export function InterventionMarkers({ showChosen }: InterventionMarkersProps) {
  const selectedIds = useScenarioStore((s) => s.scenario.selectedInterventionIds);
  const openIntervention = useScenarioStore((s) => s.openIntervention);
  const interventions = useInterventions();
  // Positions depend only on the paths, so they change only when items are added or removed.
  const segmentKey = interventions.map((i) => `${i.id}:${i.segmentIds.join(',')}`).join('|');
  const positions = useMemo(
    () => new Map(interventions.map((i) => [i.id, interventionPosition(i)] as const)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segmentKey],
  );
  const offsets = useSpreadOffsets(positions);

  return (
    <>
      {interventions.map((intervention) => {
        const selected = showChosen && selectedIds.includes(intervention.id);
        return (
          <Marker
            key={`${intervention.id}-${selected}-${intervention.name}`}
            position={positions.get(intervention.id)!}
            icon={iconFor(intervention.type, selected, offsets.get(intervention.id) ?? NO_OFFSET)}
            title={intervention.name}
            eventHandlers={{ click: () => openIntervention(intervention.id) }}
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
