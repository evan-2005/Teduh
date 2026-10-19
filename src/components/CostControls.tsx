import { useState } from 'react';
import { dataset } from '../data/dataset';
import { formatMyr } from '../lib/format';
import { useScenarioStore } from '../store/scenario';
import type { Intervention } from '../types';

/** Unit-cost items by what they build, in the order a quantity surveyor would list them. */
const GROUPS: readonly { title: string; keys: readonly string[] }[] = [
  { title: 'Street trees', keys: ['sapling', 'soilMix', 'rootBarrier', 'treeGuard', 'stake', 'maintenanceVisit'] },
  { title: 'Covered walkways', keys: ['steelPost', 'rafterPurlin', 'roofSheet', 'gutter', 'concrete', 'fixings', 'labourDay'] },
];
const MAX_PRICE = 1_000_000;

/** A typed price in ringgit, or null if it is not a sensible one. */
export function parsePrice(text: string): number | null {
  const value = Number(text.replace(/[,\s]/g, ''));
  if (text.trim() === '' || !Number.isFinite(value) || value < 0 || value > MAX_PRICE) return null;
  return Math.round(value * 100) / 100;
}

interface PriceInputProps {
  label: string;
  value: number;
  edited: boolean;
  onChange: (value: number) => void;
}

function PriceInput({ label, value, edited, onChange }: PriceInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label className={`cost-input${edited ? ' cost-input--edited' : ''}`}>
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={draft ?? String(value)}
        onChange={(e) => {
          setDraft(e.target.value);
          const price = parsePrice(e.target.value);
          if (price !== null) onChange(price);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}

/** Unit prices behind every candidate's bill of materials; changing one re-prices them all. */
export function UnitCostEditor() {
  const prices = useScenarioStore((s) => s.planner.unitCosts);
  const setPlanner = useScenarioStore((s) => s.setPlanner);
  const { items } = dataset.unitCosts;
  const edited = Object.keys(prices).length > 0;
  return (
    <details className="field planner costs-editor">
      <summary className="field__label">Unit costs (MYR){edited ? ' · edited' : ''}</summary>
      <p className="field__help">Enter your own prices. Every candidate is re-priced from its bill of materials.</p>
      {GROUPS.map((group) => (
        <fieldset key={group.title} className="field field--tight">
          <legend className="field__row">{group.title}</legend>
          {group.keys.flatMap((key) => {
            const item = items[key];
            if (!item) return [];
            return [
              <PriceInput
                key={key}
                label={`${item.label} (per ${item.unit})`}
                value={prices[key] ?? item.unitCost}
                edited={prices[key] !== undefined}
                onChange={(price) => setPlanner({ unitCosts: { ...prices, [key]: price } })}
              />,
            ];
          })}
        </fieldset>
      ))}
      <button type="button" className="link-button" disabled={!edited} onClick={() => setPlanner({ unitCosts: {} })}>
        Back to the estimated prices
      </button>
    </details>
  );
}

/** A contractor quote for one item, replacing its estimated install cost in every total. */
export function QuoteInput({ intervention }: { intervention: Intervention }) {
  const quotes = useScenarioStore((s) => s.planner.quotes);
  const setPlanner = useScenarioStore((s) => s.setPlanner);
  const quote = quotes[intervention.id];
  const clear = () => {
    const { [intervention.id]: _removed, ...rest } = quotes;
    setPlanner({ quotes: rest });
  };
  return (
    <div className="quote">
      <PriceInput
        label="Your quote for the install (RM)"
        value={quote ?? intervention.installCost}
        edited={quote !== undefined}
        onChange={(price) => setPlanner({ quotes: { ...quotes, [intervention.id]: price } })}
      />
      {quote !== undefined && (
        <p className="field__help">
          Using your quote of {formatMyr(quote)} in place of the estimate.{' '}
          <button type="button" className="link-button" onClick={clear}>
            Use the estimate
          </button>
        </p>
      )}
    </div>
  );
}
