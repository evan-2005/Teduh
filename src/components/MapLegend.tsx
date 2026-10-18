import {
  CROWN_CHOSEN_STYLE,
  EXPOSED_COLOR,
  LEAST_SUN_COLOR,
  NEWLY_SHADED_COLOR,
  SHADED_COLOR,
  SHORTEST_COLOR,
  WALKWAY_CHOSEN_STYLE,
} from './mapStyle';

interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
  width?: number;
  opacity?: number;
  /** Draw a white casing under the line, as the map does for paths the plan shades. */
  cased?: boolean;
  /** A dot (a planted tree) instead of a line. */
  dot?: boolean;
}

const LINE_WIDTH = 4;
const ITEMS: readonly LegendItem[] = [
  { label: 'Shaded (≥ 50%)', color: SHADED_COLOR },
  { label: 'Direct sun', color: EXPOSED_COLOR, dashed: true },
  { label: 'Shaded by the plan', color: NEWLY_SHADED_COLOR, width: 6, cased: true },
  { label: 'New street tree', color: CROWN_CHOSEN_STYLE.trunk.fillColor, dot: true },
  { label: 'New covered walkway', color: WALKWAY_CHOSEN_STYLE.color, width: 6 },
  { label: 'Shortest route', color: SHORTEST_COLOR, width: 8, opacity: 0.35 },
  { label: 'Least-sun route', color: LEAST_SUN_COLOR, width: 2 },
];

function Swatch({ item }: { item: LegendItem }) {
  if (item.dot) {
    return <circle cx="14" cy="5" r="4" fill={item.color} stroke="#ffffff" strokeWidth="1.5" />;
  }
  const width = item.width ?? LINE_WIDTH;
  return (
    <>
      {item.cased && <line x1="1" y1="5" x2="27" y2="5" stroke="#ffffff" strokeWidth={width + 3} />}
      <line
        x1="1"
        y1="5"
        x2="27"
        y2="5"
        stroke={item.color}
        strokeWidth={width}
        strokeOpacity={item.opacity ?? 1}
        strokeDasharray={item.dashed ? '5 4' : undefined}
        strokeLinecap="round"
      />
    </>
  );
}

export function MapLegend() {
  return (
    <ul className="legend" aria-label="Map legend">
      {ITEMS.map((item) => (
        <li key={item.label}>
          <svg width="28" height="10" aria-hidden="true">
            <Swatch item={item} />
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
