import { useMemo } from 'react';
import { Circle, CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import { treeGrowth } from '../config';
import { dataset } from '../data/dataset';
import { useInterventions } from '../hooks/useInterventions';
import type { LatLngPair } from '../lib/localPlane';
import { useScenarioStore } from '../store/scenario';
import type { AreaContext, Intervention } from '../types';
import {
  CROWN_CANDIDATE_STYLE,
  CROWN_CHOSEN_STYLE,
  TRUNK_RADIUS_PX,
  WALKWAY_CANDIDATE_STYLE,
  WALKWAY_CHOSEN_STYLE,
} from './mapStyle';
import { treePositions, walkwayLine } from './plantingGeometry';

/** A new street tree's crown is about 2 m across; it grows to the species' mature width. */
const SAPLING_CROWN_M = 2;
const NO_BUILDINGS: LatLngPair[][] = [];

interface Placed {
  intervention: Intervention;
  trees: LatLngPair[];
  walkway: LatLngPair[];
}

/** Lay out every candidate once per planner change (and when the buildings arrive). */
function usePlacements(context: AreaContext | null): Placed[] {
  const interventions = useInterventions();
  const planner = useScenarioStore((s) => s.planner);
  const buildings = context?.buildings ?? NO_BUILDINGS;
  return useMemo(
    () =>
      interventions.map((intervention) =>
        intervention.type === 'tree'
          ? { intervention, trees: treePositions(intervention, planner, buildings), walkway: [] }
          : { intervention, trees: [], walkway: walkwayLine(intervention, planner, buildings) },
      ),
    [interventions, planner, buildings],
  );
}

/** Crown radius in metres for the canopy setting: sapling now, growing towards maturity. */
function useCrownRadiusM(): number {
  const canopy = useScenarioStore((s) => s.scenario.canopy);
  const year = useScenarioStore((s) => s.scenario.canopyYear);
  const speciesIndex = useScenarioStore((s) => s.planner.speciesIndex);
  const species = dataset.unitCosts.speciesSuggestions[speciesIndex];
  const matureM = species?.matureCanopyM ?? SAPLING_CROWN_M;
  const growth = canopy === 'now' ? 0 : treeGrowth(year, species?.yearsToMature ?? 0);
  return (SAPLING_CROWN_M + (matureM - SAPLING_CROWN_M) * growth) / 2;
}

interface PlantingLayerProps {
  context: AreaContext | null;
  /** False in Before mode: nothing is planted yet, so every item is drawn as a candidate. */
  showChosen: boolean;
}

/** Every tree of every row, and each covered walkway, where they would stand on the ground. */
export function PlantingLayer({ context, showChosen }: PlantingLayerProps) {
  const placed = usePlacements(context);
  const crownM = useCrownRadiusM();
  const selectedIds = useScenarioStore((s) => s.scenario.selectedInterventionIds);
  const openIntervention = useScenarioStore((s) => s.openIntervention);

  return (
    <>
      {placed.map(({ intervention, trees, walkway }) => {
        const chosen = showChosen && selectedIds.includes(intervention.id);
        const open = { click: () => openIntervention(intervention.id) };
        if (intervention.type === 'shelter') {
          return (
            <Polyline
              key={`${intervention.id}-${chosen}`}
              positions={walkway}
              pathOptions={chosen ? WALKWAY_CHOSEN_STYLE : WALKWAY_CANDIDATE_STYLE}
              eventHandlers={open}
            >
              <Tooltip sticky>{intervention.name}</Tooltip>
            </Polyline>
          );
        }
        return trees.map((position, index) => (
          <TreeMark
            key={`${intervention.id}-${index}-${chosen}`}
            position={position}
            crownM={crownM}
            chosen={chosen}
            label={`Tree ${index + 1} of ${trees.length} · ${intervention.name}`}
            onClick={open.click}
          />
        ));
      })}
    </>
  );
}

interface TreeMarkProps {
  position: LatLngPair;
  crownM: number;
  chosen: boolean;
  label: string;
  onClick: () => void;
}

function TreeMark({ position, crownM, chosen, label, onClick }: TreeMarkProps) {
  const style = chosen ? CROWN_CHOSEN_STYLE : CROWN_CANDIDATE_STYLE;
  return (
    <>
      <Circle center={position} radius={crownM} pathOptions={style.crown} interactive={false} />
      <CircleMarker
        center={position}
        radius={TRUNK_RADIUS_PX}
        pathOptions={style.trunk}
        eventHandlers={{ click: onClick }}
        className="planted-tree"
      >
        <Tooltip>{label}</Tooltip>
      </CircleMarker>
    </>
  );
}
