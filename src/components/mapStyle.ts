// Leaflet path options cannot read CSS variables, so map colours live here.
// Keep in sync with src/styles/tokens.css.
export const SHADED_COLOR = '#1f5d4c';
export const EXPOSED_COLOR = '#efb34a';
export const SHORTEST_COLOR = '#1b2a26';
export const LEAST_SUN_COLOR = '#2f5d9e';
export const DESTINATION_COLOR = '#f6f3ea';

export const SEGMENT_WEIGHT = 4;
/** A path the plan takes from direct sun into shade: brighter and wider, over a white casing. */
export const NEWLY_SHADED_COLOR = '#22a45d';
export const NEWLY_SHADED_WEIGHT = 7;
export const CASING_COLOR = '#ffffff';
export const CASING_EXTRA_PX = 4;
export const EXPOSED_DASH = '5 5';
export const ROUTE_UNDERLAY_WEIGHT = 9;
export const ROUTE_OVERLAY_WEIGHT = 2;
export const MAP_PADDING_PX = 40;

// Area context (read-only surroundings).
export const BUILDING_STYLE = {
  stroke: false,
  fillColor: '#c9c2ae',
  fillOpacity: 0.55,
} as const;
export const GREEN_STYLE = {
  stroke: false,
  fillColor: '#8fbf98',
  fillOpacity: 0.45,
} as const;
export const TREE_STYLE = {
  radius: 2.5,
  stroke: false,
  fillColor: '#4f8f62',
  fillOpacity: 0.8,
} as const;

// Planted street trees (one mark per tree) and covered walkways.
export const TRUNK_RADIUS_PX = 4;
export const CROWN_CHOSEN_STYLE = {
  crown: { color: '#1f7a45', weight: 1, fillColor: '#22a45d', fillOpacity: 0.4 },
  trunk: { color: '#ffffff', weight: 1.5, fillColor: '#1f7a45', fillOpacity: 1 },
} as const;
/** A candidate previewed from its spec pack: hollow and dashed, not yet in the plan. */
export const CROWN_CANDIDATE_STYLE = {
  crown: { color: '#1f7a45', weight: 1, dashArray: '2 2', fillColor: '#22a45d', fillOpacity: 0.1 },
  trunk: { color: '#1f7a45', weight: 2, dashArray: '2 1', fillColor: '#ffffff', fillOpacity: 1 },
} as const;
export const WALKWAY_CHOSEN_STYLE = { color: '#6b4f3a', weight: 7, opacity: 0.85, lineCap: 'butt' } as const;
export const WALKWAY_CANDIDATE_STYLE = {
  color: '#6b4f3a',
  weight: 6,
  opacity: 0.5,
  dashArray: '6 4',
  lineCap: 'butt',
} as const;

// Placing your own tree row or walkway: wide, nearly invisible click targets on every path,
// and a strong purple for the paths picked so far (a colour the map uses for nothing else).
export const PICK_TARGET_STYLE = { color: '#6d28d9', weight: 10, opacity: 0.06, lineCap: 'butt' } as const;
export const PICKED_STYLE = { color: '#6d28d9', weight: 9, opacity: 0.85, lineCap: 'round' } as const;
