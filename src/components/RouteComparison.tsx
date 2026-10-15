import type { RouteComparison as RouteComparisonData } from '../lib/compare';
import { dataset } from '../data/dataset';
import type { DataSource, Journey, RouteResult } from '../types';
import { SourceBadge } from './SourceBadge';

const ROWS: readonly { label: string; value: (r: RouteResult) => string }[] = [
  { label: 'Distance', value: (r) => `${Math.round(r.lengthM)} m` },
  { label: 'Walk time', value: (r) => `${r.walkMin.toFixed(1)} min` },
  { label: 'Direct sun', value: (r) => `${r.sunMin.toFixed(1)} min` },
  { label: 'Longest exposed', value: (r) => `${Math.round(r.longestExposedM)} m` },
];

/** Distinct shade-data sources along a route. */
function routeSources(route: RouteResult): DataSource[] {
  const byId = new Map(dataset.neighbourhood.segments.map((s) => [s.id, s.shadeSource]));
  return [...new Set(route.segmentIds.map((id) => byId.get(id) ?? 'missing'))];
}

interface RouteComparisonProps {
  journey: Journey | null;
  comparison: RouteComparisonData | null;
}

export function RouteComparison({ journey, comparison }: RouteComparisonProps) {
  if (!journey) {
    return <p className="panel__hint">Pick a journey to compare routes.</p>;
  }
  if (!comparison) {
    return <p className="panel__hint">No walkable route between these places.</p>;
  }
  const { shortest, leastSun } = comparison;
  const sunSaved = shortest.sunMin - leastSun.sunMin;
  const detour = leastSun.lengthM - shortest.lengthM;

  return (
    <section className="card" aria-label="Route comparison">
      <h3 className="card__title">Shortest vs least-sun</h3>
      <table className="compare">
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Shortest</th>
            <th scope="col">Least-sun</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td className="num">{row.value(shortest)}</td>
              <td className="num">{row.value(leastSun)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="card__hint">
        {sunSaved > 0.05
          ? `Least-sun saves ${sunSaved.toFixed(1)} min in direct sun for ${Math.round(detour)} m extra.`
          : 'Both routes have about the same sun exposure.'}
      </p>
      <p className="card__hint">
        Shade data:{' '}
        {routeSources(leastSun).map((source) => (
          <SourceBadge key={source} source={source} />
        ))}
      </p>
    </section>
  );
}
