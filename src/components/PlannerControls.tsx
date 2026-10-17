import { dataset } from '../data/dataset';
import { DEFAULT_PLANNER, isDefaultPlanner } from '../lib/planner';
import { SHELTER_LENGTH, TREE_SPACING } from '../lib/planting';
import { useScenarioStore } from '../store/scenario';

const { speciesSuggestions } = dataset.unitCosts;

interface RangeProps {
  label: string;
  value: number;
  bounds: { min: number; max: number; step: number };
  help: string;
  onChange: (value: number) => void;
}

function RangeInMetres({ label, value, bounds, help, onChange }: RangeProps) {
  return (
    <label className="field field--tight">
      <span className="field__row">
        <span>{label}</span>
        <span className="num">{value} m</span>
      </span>
      <input
        type="range"
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="field__help">{help}</span>
    </label>
  );
}

function SpeciesSelect() {
  const speciesIndex = useScenarioStore((s) => s.planner.speciesIndex);
  const setPlanner = useScenarioStore((s) => s.setPlanner);
  const species = speciesSuggestions[speciesIndex];
  if (speciesSuggestions.length === 0) return null;
  return (
    <label className="field field--tight">
      <span className="field__row">
        <span>Tree species</span>
      </span>
      <select value={speciesIndex} onChange={(e) => setPlanner({ speciesIndex: Number(e.target.value) })}>
        {speciesSuggestions.map((s, index) => (
          <option key={s.name} value={index}>
            {s.name}
          </option>
        ))}
      </select>
      {species && (
        <span className="field__help num">
          Crown ~{species.matureCanopyM} m · ~{species.yearsToMature} years to mature · verify with the
          landscape team
        </span>
      )}
    </label>
  );
}

/**
 * Site-planning choices that change what each candidate is: how far apart street trees go,
 * which species, and the longest covered walkway to build. Costs, counts and shade follow.
 */
export function PlannerControls() {
  const planner = useScenarioStore((s) => s.planner);
  const setPlanner = useScenarioStore((s) => s.setPlanner);
  return (
    <fieldset className="field planner">
      <legend className="field__label">Site planning</legend>
      <RangeInMetres
        label="Street-tree spacing"
        value={planner.treeSpacingM}
        bounds={TREE_SPACING}
        help="Closer spacing plants more trees per row and costs more."
        onChange={(treeSpacingM) => setPlanner({ treeSpacingM })}
      />
      <SpeciesSelect />
      <RangeInMetres
        label="Longest covered walkway"
        value={planner.maxShelterM}
        bounds={SHELTER_LENGTH}
        help="Longer stretches are covered from the stop or entrance end."
        onChange={(maxShelterM) => setPlanner({ maxShelterM })}
      />
      <button
        type="button"
        className="link-button"
        disabled={isDefaultPlanner(planner)}
        onClick={() => setPlanner(DEFAULT_PLANNER)}
      >
        Reset site planning
      </button>
    </fieldset>
  );
}
