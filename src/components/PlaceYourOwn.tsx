import { MAX_CANDIDATES } from '../config';
import { dataset, graph } from '../data/dataset';
import { useInterventions } from '../hooks/useInterventions';
import { formatMyr } from '../lib/format';
import { adjustInterventions, coveredLengthM } from '../lib/planner';
import { createUserIntervention, USER_ID_PREFIX } from '../lib/userPlacement';
import { useScenarioStore, type Placing } from '../store/scenario';
import type { Intervention, InterventionType } from '../types';
import { segmentsById } from './mapGeometry';

const PLACEMENT = { segmentsById, lengthBySegment: graph.lengthBySegment, unitCosts: dataset.unitCosts };
const PLANNER_CONTEXT = { segments: dataset.neighbourhood.segments, lengthBySegment: graph.lengthBySegment, unitCosts: dataset.unitCosts };

const LABELS: Readonly<Record<InterventionType, string>> = { tree: 'tree row', shelter: 'covered walkway' };

/** The next free number for a person's own item, e.g. user-tree-3. */
const nextIndex = (items: readonly Intervention[]): number =>
  Math.max(0, ...items.map((i) => Number(i.id.slice(USER_ID_PREFIX.length).split('-')[1]) || 0)) + 1;

/** The item as it would be added, priced with the planner's current settings. */
function usePreview(placing: Placing | null): Intervention | null {
  const planner = useScenarioStore((s) => s.planner);
  const userItems = useScenarioStore((s) => s.userItems);
  if (!placing || placing.segmentIds.length === 0) return null;
  const draft = createUserIntervention(placing.type, placing.segmentIds, nextIndex(userItems), PLACEMENT);
  return adjustInterventions([draft], planner, PLANNER_CONTEXT)[0] ?? draft;
}

function Picking({ placing }: { placing: Placing }) {
  const setPlacing = useScenarioStore((s) => s.setPlacing);
  const addUserItem = useScenarioStore((s) => s.addUserItem);
  const userItems = useScenarioStore((s) => s.userItems);
  const preview = usePreview(placing);
  const add = () =>
    addUserItem(createUserIntervention(placing.type, placing.segmentIds, nextIndex(userItems), PLACEMENT));
  return (
    <div className="placing" role="status">
      <p className="placing__title">Placing a {LABELS[placing.type]}</p>
      {preview ? (
        <p className="placing__preview">
          <strong>{preview.name}</strong>
          <br />
          <span className="num">
            {placing.segmentIds.length} path{placing.segmentIds.length === 1 ? '' : 's'} ·{' '}
            {Math.round(coveredLengthM(preview, graph.lengthBySegment))} m · {formatMyr(preview.installCost)}
          </span>
        </p>
      ) : (
        <p className="field__help">Click the paths on the map, one after another along the street.</p>
      )}
      <div className="placing__actions">
        <button type="button" className="button button--primary" disabled={!preview} onClick={add}>
          Add to the plan
        </button>
        <button type="button" className="button" onClick={() => setPlacing(null)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Let the person choose where trees and walkways go, alongside the suggested candidates. */
export function PlaceYourOwn() {
  const placing = useScenarioStore((s) => s.placing);
  const setPlacing = useScenarioStore((s) => s.setPlacing);
  const setScenario = useScenarioStore((s) => s.setScenario);
  const spare = MAX_CANDIDATES - useInterventions().length;
  const start = (type: InterventionType) => {
    setScenario({ mapMode: 'after' });
    setPlacing({ type, segmentIds: [] });
  };

  if (placing) return <Picking placing={placing} />;
  return (
    <div className="field place-own">
      <span className="field__label">Place your own</span>
      {spare > 0 ? (
        <>
          <div className="place-own__buttons">
            <button type="button" className="button" onClick={() => start('tree')}>
              Plant a tree row
            </button>
            <button type="button" className="button" onClick={() => start('shelter')}>
              Add a covered walkway
            </button>
          </div>
          <p className="field__help">
            Pick the paths on the map. It is priced and scored like the suggestions. Room for {spare} more.
          </p>
        </>
      ) : (
        <p className="field__help">
          The plan can weigh up to {MAX_CANDIDATES} items. Remove one of yours (in the list below) to add another.
        </p>
      )}
    </div>
  );
}

