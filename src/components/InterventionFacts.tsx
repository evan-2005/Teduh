import { dataset, graph } from '../data/dataset';
import { anchorReach, walkwayStart } from '../lib/anchors';
import { formatMyr } from '../lib/format';
import { coveredLengthM, shelterBuiltLengthM, treesInRow } from '../lib/planner';
import { useScenarioStore } from '../store/scenario';
import type { Feasibility, Intervention } from '../types';
import { segmentsById } from './mapGeometry';
import { SourceBadge } from './SourceBadge';

const PERCENT = 100;
const SPACING_DECIMALS = 1;

const FEASIBILITY: Readonly<Record<Feasibility, string>> = {
  approved: 'Approved',
  likely: 'Likely: quiet street or footpath',
  'needs-check': 'Needs a site check: on or beside a busy road',
};

const percent = (fraction: number): string => `${Math.round(fraction * PERCENT)}%`;

const anchors = anchorReach(
  dataset.neighbourhood.segments,
  dataset.neighbourhood.destinations,
  (id) => graph.lengthBySegment.get(id) ?? 0,
);

/** The stop, station or entrance a walkway starts from (directly, or past its existing cover). */
function placeServed(intervention: Intervention): string | null {
  const first = segmentsById.get(intervention.segmentIds[0] ?? '');
  const start = first && walkwayStart(first, anchors);
  return (start && anchors.get(start)?.name) ?? null;
}

type Row = readonly [label: string, value: string];

function treeRows(intervention: Intervention, rowM: number, spacingM: number, speciesIndex: number): Row[] {
  const count = treesInRow(intervention, rowM, spacingM);
  const species = dataset.unitCosts.speciesSuggestions[speciesIndex];
  return [
    ['Trees', `${count}`],
    ['Row length', `${Math.round(rowM)} m`],
    ['Spacing on the ground', `about ${(rowM / count).toFixed(SPACING_DECIMALS)} m`],
    ['Species (to verify)', species?.name ?? 'Not chosen'],
    ['Shade on the path, year 1', percent(intervention.shadeNow)],
    [`Shade at maturity (~${intervention.yearsToMature} years)`, percent(intervention.shadeFuture)],
  ];
}

function shelterRows(intervention: Intervention, stretchM: number, builtM: number): Row[] {
  const from = placeServed(intervention);
  return [
    ['Covered length', `${Math.round(builtM)} m`],
    ['Exposed stretch', `${Math.round(stretchM)} m`],
    ['Starts at', from ?? 'The busiest end of the stretch'],
    ['Shade on the stretch', percent(intervention.shadeNow)],
  ];
}

/** Key planning facts for one candidate, using the same figures as the plan and spec pack. */
export function InterventionFacts({ intervention }: { intervention: Intervention }) {
  const planner = useScenarioStore((s) => s.planner);
  const lengthM = coveredLengthM(intervention, graph.lengthBySegment);
  const rows =
    intervention.type === 'tree'
      ? treeRows(intervention, lengthM, planner.treeSpacingM, planner.speciesIndex)
      : shelterRows(intervention, lengthM, shelterBuiltLengthM(lengthM, planner));
  return (
    <table className="compare facts">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{value}</td>
          </tr>
        ))}
        <tr>
          <th scope="row">Install cost</th>
          <td className="num">
            {formatMyr(intervention.installCost)} <SourceBadge source={intervention.costSource} />
          </td>
        </tr>
        <tr>
          <th scope="row">Upkeep</th>
          <td className="num">{formatMyr(intervention.annualMaintenance)} / year</td>
        </tr>
        <tr>
          <th scope="row">Feasibility</th>
          <td>{FEASIBILITY[intervention.feasibility]}</td>
        </tr>
      </tbody>
    </table>
  );
}
