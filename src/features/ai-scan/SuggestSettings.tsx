import { useState } from 'react';
import { ENABLE_AI } from '../../config';
import { meta } from '../../data/dataset';
import { walkStarts, walkTargets } from '../../data/walkPlaces';
import { formatMultiplier } from '../../lib/format';
import { DEFAULT_WEIGHT } from '../../lib/priority';
import { ruleSuggestion } from '../../lib/suggestSettings';
import { useScenarioStore } from '../../store/scenario';
import { requestSuggestion } from './client';
import type { SettingsSuggestion, SuggestRequest } from './schemas';

const MAX_DESCRIPTION = 400;
const PERCENT = 100;
const pct = (d: number): string => `${Math.round(d * PERCENT)}%`;
const place = (p: { id: string; name: string; kind: string; tripsPerDay: number }) => ({
  id: p.id,
  name: p.name,
  kind: p.kind,
  tripsPerDay: Math.round(p.tripsPerDay),
});

/** Ask the AI server; without one, use the labelled rules in the browser. */
async function suggest(req: SuggestRequest): Promise<SettingsSuggestion> {
  if (!ENABLE_AI) return ruleSuggestion(req);
  try {
    return await requestSuggestion(req);
  } catch {
    const rules = ruleSuggestion(req);
    return { ...rules, summary: `The AI server is not running (start it with npm run dev:server), so these come from simple rules. ${rules.summary}` };
  }
}

interface Previous {
  detourLimit: number;
  priorityWeights: Readonly<Record<string, number>>;
}

/** Suggest a detour limit and destination weights from a description of who lives and walks here. */
export function SuggestSettings() {
  const scenario = useScenarioStore((s) => s.scenario);
  const setScenario = useScenarioStore((s) => s.setScenario);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState<SettingsSuggestion | null>(null);
  const [previous, setPrevious] = useState<Previous | null>(null);

  const run = async () => {
    setBusy(true);
    setPrevious(null);
    setSuggestion(
      await suggest({
        area: meta.name,
        description: description.trim(),
        currentDetourLimit: scenario.detourLimit,
        destinations: walkTargets.map(place),
        startPoints: walkStarts.map(place),
      }),
    );
    setBusy(false);
  };

  const apply = (s: SettingsSuggestion) => {
    setPrevious({ detourLimit: scenario.detourLimit, priorityWeights: scenario.priorityWeights });
    setScenario({ detourLimit: s.detourLimit, priorityWeights: Object.fromEntries(s.weights.map((w) => [w.id, w.weight])) });
  };

  return (
    <div className="field suggest">
      <label className="field__label" htmlFor="area-description">
        Who lives and walks here?
      </label>
      <textarea
        id="area-description"
        rows={3}
        maxLength={MAX_DESCRIPTION}
        placeholder="e.g. many older residents, a university nearby, families with young children"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <p className="field__help">
        Suggests a detour limit and priority weights from your description and the walks modelled here. Nothing changes until
        you apply it.
      </p>
      <button type="button" className="button" onClick={run} disabled={busy}>
        {busy ? 'Thinking…' : 'Suggest settings'}
      </button>
      {suggestion && (
        <SuggestionReview
          suggestion={suggestion}
          detourNow={scenario.detourLimit}
          weightsNow={scenario.priorityWeights}
          applied={previous !== null}
          onApply={() => apply(suggestion)}
          onUndo={() => {
            if (previous) setScenario(previous);
            setPrevious(null);
          }}
        />
      )}
    </div>
  );
}

interface ReviewProps {
  suggestion: SettingsSuggestion;
  detourNow: number;
  weightsNow: Readonly<Record<string, number>>;
  applied: boolean;
  onApply: () => void;
  onUndo: () => void;
}

/** Each suggested change next to the current value, with its reason, then Apply or Undo. */
function SuggestionReview({ suggestion: s, detourNow, weightsNow, applied, onApply, onUndo }: ReviewProps) {
  const names = new Map(walkTargets.map((t) => [t.id, t.name]));
  return (
    <div className="suggest__result" role="status">
      <p className="card__hint">
        <span className={`badge ${s.isMock ? 'badge--estimated' : 'badge--ai-confirmed'}`}>{s.isMock ? 'Rules' : 'AI suggestion'}</span>
        {s.isMock ? 'Rule-based suggestion (no AI model).' : `Suggested by ${s.source ?? 'the AI'}.`}
      </p>
      <p className="suggest__summary">{s.summary}</p>
      <table className="formula__table">
        <thead>
          <tr>
            <th>Setting</th>
            <th className="num">Now → suggested</th>
            <th>Why</th>
          </tr>
        </thead>
        <tbody>
          <tr className={s.detourLimit !== detourNow ? 'suggest__changed' : ''}>
            <td>Detour limit</td>
            <td className="num">
              {pct(detourNow)} → {pct(s.detourLimit)}
            </td>
            <td>{s.detourReason}</td>
          </tr>
          {s.weights.map((w) => {
            const now = weightsNow[w.id] ?? DEFAULT_WEIGHT;
            return (
              <tr key={w.id} className={w.weight !== now ? 'suggest__changed' : ''}>
                <td>{names.get(w.id) ?? w.id}</td>
                <td className="num">
                  {formatMultiplier(now)} → {formatMultiplier(w.weight)}
                </td>
                <td>{w.reason}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {applied ? (
        <p className="card__hint">
          Applied. The plans above have re-ranked.{' '}
          <button type="button" className="link-button" onClick={onUndo}>
            Undo
          </button>
        </p>
      ) : (
        <button type="button" className="button button--primary" onClick={onApply}>
          Apply suggestions
        </button>
      )}
    </div>
  );
}
