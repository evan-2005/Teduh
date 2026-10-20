import { WALK_SPEED_M_PER_MIN } from '../config';
import { dataset } from '../data/dataset';
import { headlineBreakdown } from '../lib/headline';
import type { PlanResult } from '../types';

const names = new Map(dataset.neighbourhood.destinations.map((d) => [d.id, d.name]));
const nameOf = (id: string): string => names.get(id) ?? id;
const SECONDS_PER_MINUTE = 60;
const fmt = (n: number, digits = 1): string => n.toLocaleString('en-MY', { maximumFractionDigits: digits, minimumFractionDigits: digits });

/** The headline's formula, then the same sum with this plan's numbers, walk by walk. */
export function HeadlineFormula({ plan }: { plan: PlanResult }) {
  const { rows, totalMinutes, totalHours } = headlineBreakdown(plan, dataset.journeys, nameOf);
  const helped = rows.filter((r) => r.minutesAvoided > 0.5);
  const unchanged = rows.length - helped.length;
  const walkSpeed = WALK_SPEED_M_PER_MIN / SECONDS_PER_MINUTE;

  return (
    <details className="formula">
      <summary>How is this number worked out?</summary>
      <p className="formula__eq">
        pedestrian-hours avoided per day = Σ <i>walks</i> [ trips per day × ( sun-minutes before − sun-minutes after ) ] ÷ 60
      </p>
      <p className="formula__eq">
        sun-minutes on a walk = Σ <i>path pieces</i> [ length ÷ {WALK_SPEED_M_PER_MIN} m per minute × ( 1 − shade ) ]
      </p>
      <p className="field__help">
        Walking speed {fmt(walkSpeed)} m/s. Shade is the modelled fraction of each piece in shade at the chosen time, raised
        where the plan adds trees or a walkway. Each walk takes its least-sun route within the detour limit, before and after.
        Priority weights are not applied here: this is the real total.
      </p>
      <table className="formula__table">
        <thead>
          <tr>
            <th>Walk</th>
            <th className="num">Trips/day</th>
            <th className="num">Sun min before → after</th>
            <th className="num">Min avoided</th>
          </tr>
        </thead>
        <tbody>
          {helped.map((r) => (
            <tr key={r.journeyId}>
              <td>{r.label}</td>
              <td className="num">{Math.round(r.trips)}</td>
              <td className="num">
                {fmt(r.sunBefore, 2)} → {fmt(r.sunAfter, 2)}
              </td>
              <td className="num">{Math.round(r.minutesAvoided)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>
              Total{unchanged > 0 ? ` (${unchanged} other walk${unchanged === 1 ? '' : 's'} unchanged)` : ''}
            </td>
            <td className="num">{Math.round(totalMinutes)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="formula__eq">
        {Math.round(totalMinutes)} min ÷ 60 = <b>{fmt(totalHours)} pedestrian-hours</b> per day
      </p>
    </details>
  );
}
