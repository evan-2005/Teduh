# Data guide

The app can show **any area in the Klang Valley**, and any other place a person looks up. There are three ways an area gets into the app:

| How | Where it lives | Needs the internet? |
|---|---|---|
| **Shipped areas** (the area picker) | `data/areas/<slug>/` | No |
| **Looked-up places** ("Look up a place" in the header) | The browser's local storage (last 4 kept) | Yes, once per place |
| **Invented demo** (`?area=seed`) | `data/seed/` | No |

Pick an area from the header, or open `http://localhost:5173/?area=<slug>`. An unknown area falls back to the default (SS 15, Subang Jaya).

## Shipped areas: `npm run data:areas`

`data/areas/areas.json` lists the areas (slug, name, group, centre, radius). The batch tool downloads real streets, buildings and places from OpenStreetMap for each, builds the dataset, and writes `data/areas/<slug>/{neighbourhood,journeys,interventions,context}.json` plus `data/areas/index.json` (the list the picker shows).

```bash
npm run data:areas                          # every area; downloads anything missing (slow: the public servers are busy)
npm run data:areas -- bangsar taman-desa    # only these areas
npm run data:areas -- --build-only          # never touch the network (uses saved raw.json files)
npm run data:areas -- --refresh             # download again even if raw.json exists
```

- Raw downloads (`raw.json`) are git-ignored. Without them you can still run the app, but rebuilding needs the internet.
- An area that is too sparse (too few mapped paths, or too few bus stops, stations or homes near the places people walk to) is **skipped with a reason** instead of producing a poor result.
- To add an area, add an entry to `areas.json` and run the tool for its slug. To use a different place, change the coordinates.

## Looking up a place (in the app)

Click **Look up a place**, type a town or neighbourhood, and pick a result. The browser downloads about 1 MB of map data (retrying while the free servers are busy), runs the same pipeline as the batch tool, saves the result in local storage, and reloads onto it. It works best for built-up residential areas, and tells you in plain English when an area is too sparse.

## What the pipeline does (`data/osm/`)
1. **Paths:** keeps walkable ways (footways, paths, pedestrian streets, residential and service lanes, roads), removes driveways and tiny dead ends, keeps the largest connected network, and simplifies it into segments of at most 80 m.
2. **Shade (modelled, labelled `estimated`):** for each segment and each of 09:00, 12:00, 14:00 and 17:00 it samples points along the path and asks whether the real sun position (15 October, this latitude, the right clock offset) is blocked by a mapped building (7 m high when the height is not mapped) or by a mapped tree's shadow. Covered walkways count as 95% shaded.
3. **Where people walk (`trips.ts`, `destinations.ts`):** walks start at **public transport** (rail stations, then bus stops) and end at the places people walk to from it: shopping malls, markets, supermarkets, schools and universities, hospitals and clinics, places of worship and parks. A station mapped as several points counts once, bus stops on opposite sides of a road count as one stop, and a school or mall mapped twice is one place. Only walks of 150–1000 m on the real path network are kept.
4. **Trips per day:** a gravity estimate anchored to real counts where they exist. Bigger places draw more walks (a mall 8, a school 5, a supermarket 3, a park 1.5; a bus stop 1), and longer walks draw fewer.
   - **Rail stations use real ticket-gate counts.** `npm run data:ridership` downloads Prasarana's Rapid Rail origin-destination ridership from data.gov.my (CC BY 4.0) and saves each station's median weekday exits over the last 8 weeks to `data/rail-ridership.json` (only the first few MB of the yearly file are read). A station's weight is its exits ÷ 500 (SS 15: 5,165 exits → 10.3), matched by the station code in OpenStreetMap ("KJ29"). The walks modelled from a station never add up to more than half of its exits. Stations the data does not cover (KTM, ERL) keep the default weight of 10. Then rebuild with `npm run data:areas -- --build-only`. Up to 10 walks are kept: first the busiest walk to each kind of place, then the busiest of the rest, with at most 2 walks per destination, 4 per stop and 9 places in all, so the map stays readable.
   - **Fallback:** where fewer than 4 transit walks exist (for example no bus stops are mapped), home clusters are added as starting points. If that is still not enough (common where shops are not tagged), clusters of 5 or more retail, commercial or office buildings become "Shop row" destinations, so most built-up places anywhere can be analysed. Shipped areas never need this step.
   - **Names:** plain English ("LRT station", "Shopping mall"). Repeated kinds are told apart by their street ("Bus stop on Majlis Road"), or else by side of the area. The official name is kept as a secondary "Local name".
5. **Candidates:** up to 3 covered walkways (at most 100 m each, never touching each other) and 5 street-tree rows where exposed paths carry the most trips. A walkway starts where people wait or arrive: a bus stop, a station, or the entrance of a place people walk to, or where shade already reaching out from one ends (within 60 m, such as a station's own canopy). It runs away from that place along the busiest exposed path. A tree row follows its street along connected exposed paths for 40–160 m, so it plants 5 to 20 trees at about 8 m spacing. Costs come from the same bill of materials the Spec pack shows, so the two always agree.
   - **On the map** every tree of a row is drawn: on the footpath edge beside its path (past the carriageway on roads), evenly spaced, kept 6 m back from junctions, and moved off buildings and other paths (to the other side, or a kerb build-out) where it can. The planner can change tree spacing (6–10 m), species and the longest walkway; counts, costs and shade follow.
6. **Budget range and demo journey:** derived from the candidate costs.

### Known limits (also shown in the app under "How this was built")
- **OpenStreetMap has few or no mapped trees in most of the Klang Valley.** Tree canopy is then missing and shade is understated, especially at midday. This is the gap a field survey fills.
- Buildings have no mapped heights, so a typical two-storey height is assumed.
- Trips, candidate locations and costs are estimates, not measurements or quotes. Trips use a gravity model, not footfall counts; residents' own walks are only modelled where little transit is mapped.
- Background map labels (third-party tiles) show local street names. Everything the app itself draws is in English.
- Looked-up places depend on public servers that are sometimes busy; the app retries for up to a few minutes.

### Adding surveyed trees
Put field-surveyed tree locations in `data/areas/<slug>/surveyed-trees.geojson` (a GeoJSON file of **Point** features) and run `npm run data:areas -- <slug> --build-only`. They are merged into the shade model and drawn as "Mapped trees".

## The invented dataset (`data/seed/`)
A small made-up neighbourhood with a hand-designed "memorable moment". It always works offline and is the stable fixture for tests. Edit it only together with the seed-specific expectations in `src/lib/routing.test.ts`, `compare.test.ts`, `optimizer.test.ts` and `src/data/load.test.ts`.

## Using your own survey instead
1. Survey on foot: trace every walkable path and each destination; at **09:00, 12:00, 14:00 and 17:00** record each section's shaded fraction (`0`, `0.25`, `0.5`, `0.75`, `1`); note widths and blocked sections.
2. Trace in [geojson.io](https://geojson.io): one **LineString** per path with properties `id`, `widthM`, `shade09`, `shade12`, `shade14`, `shade17` (optionally `accessible: false`, `notes`); one **Point** per destination with `name` and `kind` (`rail-station`, `bus-stop`, `mall`, `shops`, `school`, `clinic`, `worship`, `park`, or `home`).
3. Convert: `npx tsx data/convert-geojson.ts traced.geojson data/areas/<your-slug>/neighbourhood.json`. Segments missing a shade value are written as `shadeSource: "missing"`.
4. Write `journeys.json`, `interventions.json` and a `meta` block by hand (copy the shape from `data/seed/`), and add the slug to `data/areas/index.json`.

## Check
```bash
npm run test && npm run build
```
