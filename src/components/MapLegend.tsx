import { EXPOSED_COLOR, LEAST_SUN_COLOR, SHADED_COLOR, SHORTEST_COLOR } from './mapStyle';

interface LegendItem { label: string; color: string; dashed?: boolean; wide?: boolean; thin?: boolean }

const ITEMS: readonly LegendItem[] = [
  { label: 'Shaded (≥ 50%)', color: SHADED_COLOR },
  { label: 'Direct sun', color: EXPOSED_COLOR, dashed: true },
  { label: 'Shortest route', color: SHORTEST_COLOR, wide: true },
  { label: "Least-sun route", color: LEAST_SUN_COLOR, thin: true },
];

export function MapLegend() {
  return (
    <ul className="legend" aria-label="Map legend">
      {ITEMS.map((item) => (
        <li key={item.label}>
          <svg width="28" height="10" aria-hidden="true">
            <line
              x1="1"
              y1="5"
              x2="27"
              y2="5"
              stroke={item.color}
              strokeWidth={item.wide ? 8 : item.thin ? 2 : 4}
              strokeOpacity={item.wide ? 0.35 : 1}
              strokeDasharray={item.dashed ? '5 4' : undefined}
              strokeLinecap="round"
            />
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
