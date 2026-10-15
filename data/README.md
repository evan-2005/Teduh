# Data guide

`neighbourhood.json`, `journeys.json`, `interventions.json` and `unit-costs.json` currently hold **synthetic seed data**. Replace them with a real survey whenever you have one. The app validates them on load (`src/data/load.ts`) and shows an error screen naming the problem if something is wrong.

## 1. Survey (on foot, one neighbourhood)
- Trace every walkable path and each place people walk to (homes, school, bus stop, shops).
- At **09:00, 12:00, 14:00 and 17:00** record each path section's shaded fraction: `0`, `0.25`, `0.5`, `0.75` or `1`.
- Note path width in metres, and mark anything blocked.
- Photograph sections as you go (useful for the AI shade scan).

## 2. Trace and convert
1. Draw the paths in [geojson.io](https://geojson.io): one **LineString** per path, one **Point** per destination.
2. Give each LineString these properties: `id`, `widthM`, `shade09`, `shade12`, `shade14`, `shade17` (and optionally `accessible: false`, `notes`).
3. Give each Point `name` and `kind` (`home`, `school`, `bus-stop`, `shops`, `clinic`, `park`).
4. Put a vertex wherever paths meet; vertices on the same coordinate become one junction. Every vertex splits a segment, so avoid extra vertices.
5. Run:
   ```bash
   npx tsx data/convert-geojson.ts traced.geojson data/neighbourhood.json
   ```
   Segments missing any shade value are written with `shadeSource: "missing"`. A destination more than 15 m from a path stops the script.
6. Tell Evan the new map centre. `MAP_CENTER` lives in `src/config.ts`.

## 3. The other files (edit by hand)
- **`journeys.json`**: `originId` must be a `home` destination. `dailyTrips` from counts or estimates. Set `tripsSource` honestly.
- **`interventions.json`**: only places a tree or shelter could physically go. `segmentIds` must exist. Keep at most 12 candidates. Costs are `estimated` until you have quotes.
- **`unit-costs.json`**: unit costs for the fabrication bill of materials, plus `speciesSuggestions`.

## 4. Known issue to resolve with real quotes
The simulator's planning cost for each candidate (`interventions.json`) is a placeholder and is **much lower** than the bottom-up bill of materials the Fabrication panel builds from `unit-costs.json` (for example the 240 m connector shelter: RM 18,000 planning vs. a six-figure BOM). The panel shows both and says they can differ. Replace both with contractor quotes before anyone relies on either number.

## 5. Check
```bash
npm run test && npm run build
```
Valid data keeps every test green except the seed-specific ones in `src/lib/routing.test.ts`, `src/lib/compare.test.ts`, `src/lib/optimizer.test.ts` and `src/data/load.test.ts`. Update those expectations (IDs, counts, winning plan) to match your data, or delete the ones that assert on the synthetic design.
