# Teduh — bug and usability fix list

Audit date: 15 Oct 2026 (demo freeze Mon 19 Oct). Baseline: `npm run build` passes and all 278 tests pass. Findings come from reading the code and testing the running app (SS 4, Petaling Jaya, the default area).

**Instructions for Claude:** work top to bottom. Follow the house rules in `README.md` §0: functions < 50 lines, files < 400 lines, immutable updates, no `console.log`, named constants, no claims about temperature, health or safety. `src/types.ts` is a shared contract, so list any change to it. Add a test for every bug fix. Run `npm run test && npm run build` after each item. Do not commit.

Tags: **[Confirmed]** = reproduced in the running app. **[Code]** = clear from reading the code. **[Verify]** = likely, but check it before fixing.

---

## P0 — Bugs the demo audience will see

> **Status (15 Oct): items 1–7 are fixed.** Unit tests cover each fix, and `scripts/screenshots.mjs` now checks markers in all map modes, the plan trade-offs, the demo label, the first-load plan and the 1024 px / 390 px layouts. Fixing #3 rebuilt `data/areas/*` (offline, from the saved `raw.json`). This changed the SS 4 demo (it now walks to the supermarket), so `pitch/demo-script.md` was updated. The README screenshots have not been regenerated.

### 1. Demo button text is wrong for most areas [Confirmed]
`src/components/ControlsPanel.tsx:35-37` always says "Demo: 2 pm walk to the shops". The demo journey comes from the data (`meta.demoJourneyId`). In the **default area (SS 4)** it goes to the *Bus stop*. It also goes to the bus stop in Section 7 and Kepong Baru, and to the *School* in Bandar Baru Bangi.
- **Fix:** build the button text from the demo journey's destination name, e.g. "Demo: 2 pm walk to the bus stop".
- **Done when:** a test covers the label for the seed dataset and for one area whose demo journey is not to the shops.

### 2. Some intervention markers can't be clicked, so the Fabrication pack can't be opened [Confirmed]
`src/components/MapView.tsx:97-104` puts `<InterventionMarkers/>` inside `AFTER_PANE`, which is clipped in Swipe mode. Swipe is the default mode.
- In the default SS 4 view, **2 of the 8 markers** are left of the divider. They are invisible and can't be clicked.
- In **Before** mode, no markers are shown at all.
- Clicking a marker is the only way to open the Fabrication pack.
- **Fix:** render the markers in their own pane above both network panes, without clipping. Show selected and unselected markers differently. Also add a "Details" button to each row in `CandidateList` that calls `selectIntervention(id)`.
- **Done when:** every candidate can open its Fabrication pack in all three map modes.

### 3. The "alternative" plans are near-duplicates or clearly worse [Confirmed]
In SS 4 at 14:00, Best, Option 2 and Option 3 all cost **RM 108,100** and save **9.0 pedestrian-hours/day**. They differ only in "Shelter … (77 m) – A" vs "– B". At 09:00, Options 2 and 3 cost 3× more than Best (RM 108k vs RM 34k) and save *less* (16.0 vs 16.6 h).
- **Cause (data):** `data/osm/candidates.ts` `growWindow` limits each shelter to `MAX_SHELTER_M = 100`. A 77 m seed can't grow, so the next shelter seed is the next segment of the same corridor. Shelters A and B serve the same trips and are interchangeable.
- **Cause (optimizer):** `recommend()` in `src/lib/optimizer.ts:144-161` sorts by score and returns the top 3. It does not filter out dominated plans.
- **Fix (optimizer):** drop any plan that costs at least as much as a better-scoring plan (a Pareto filter). Also skip an alternative whose score is within ~1% of a plan already chosen at the same cost. The alternatives should then be useful trade-offs, such as "cheaper, slightly less benefit".
- **Fix (data):** in `generateCandidates`, after placing a shelter, exclude segments next to it, or segments that carry mostly the same journeys. Then regenerate with `npm run data:areas`.
- **Done when:** no two recommended plans have the same cost and the same score, and no alternative is dominated. Add unit tests in `optimizer.test.ts`.

### 4. AI shade scan can apply the estimate to the wrong path [Code]
`src/features/ai-scan/ShadeScanPanel.tsx:60-63`: `confirm()` uses the *current* `segmentId` and `time` from the dropdowns, not the ones that were scanned. If the user scans seg-10 and then changes the dropdown, "Confirm" writes the estimate onto the other path.
- **Fix:** store `segmentId` and `time` together with the result, and confirm using those. Reset the result (`status → idle`) when the segment or time changes.
- **Done when:** a test proves that confirm writes to the segment that was scanned.

### 5. Plan explainer can show a summary for the wrong plan [Code]
`src/features/ai-scan/PlanExplainer.tsx:22-37`: the effect resets the status when the plan changes. But a request that is still in flight will later set `done` with the *old* plan's text.
- **Fix:** keep a request id or `planKey` in a ref and ignore stale responses, or use an `AbortController`. Do the same in `PlaceSearch` (search results that arrive out of order).

### 6. Layout breaks below about 1100 px wide [Confirmed]
`src/styles/global.css` has only one media query, which narrows the side columns to 240 px and 280 px. The map column measured **380 px** at a 900 px window and **0 px** (the map disappeared) at 280 px. Projectors and laptops with zoom turned up will hit this.
- **Fix:** below about 900 px, stack the layout: header, then the map (around 60vh), then Controls and Results as tabs or collapsible sections. Keep the map toolbar on one scrollable row.
- **Done when:** the map stays usable at 1280×720, 1024×768 and 390×844, with no horizontal page scroll.

### 7. The first screen looks broken: Swipe shows two identical sides [Confirmed]
On first load nothing is selected, so Before and After are the same, while the Swipe divider invites the user to compare them. The Results panel only says "Tick candidates…".
- **Fix (pick one):** apply the best recommended plan on first load (the same as the demo preset), or start in **Before** mode and switch to Swipe once a plan is applied. Also show a hint on the map: "Choose a plan to compare".

---

## P1 — Performance

### 8. The "Grow" animation freezes the page [Confirmed]
Each 120 ms tick changes `canopyYear`. `useOptimizer` (`src/hooks/useOptimizer.ts:21-46`) then rebuilds the evaluator and re-runs `recommend()` over every candidate subset. Measured on SS 4 (dev build): **41 long tasks in 6 s, 3.9 s of blocking in total, worst 203 ms**. A time-of-day click blocks the page for about 240 ms. Bigger areas (TTDI has 743 segments, Cyberjaya 721) will be worse.
- **Fix:** while the animation plays, recompute only `selectedPlan` and the map shade, and recompute recommendations when it pauses or ends (or `useDeferredValue(canopyYear)` for the plans). Better: move `createEvaluator().recommend` into a Web Worker.
- **Also:** `effectiveShade` (`src/lib/shade.ts:36-46`) calls `overrides.find` and `segmentIds.includes` for every segment. Build a `segmentId → interventions` map once per evaluation.
- **Done when:** the Grow animation runs with no long task over 50 ms on SS 4 in a production build.

### 9. The map view resets whenever its container resizes [Code]
`FitToNetwork` (`src/components/MapView.tsx:38-50`) calls `fitBounds` from a `ResizeObserver`. Any window resize, layout change or browser-pane resize throws away the user's pan and zoom.
- **Fix:** call `invalidateSize()` on resize, but `fitBounds` only on mount. Add a "Reset view" button.

---

## P1 — Usability

### 10. Internal IDs are shown to users
- The segment popup title is `seg-157` (`src/components/SegmentPopup.tsx:21`).
- The AI scan "Path segment" dropdown lists **227 to 743** raw `seg-N` options (`ShadeScanPanel.tsx:74-80`), so it is unusable on real areas.
- **Fix:** show the street name, type and length. `HIGHWAY_LABELS` and the street names already exist in the pipeline, so carry a `name` or `label` into `PathSegment` (a contract change in `types.ts`). Replace the dropdown with picking on the map: add a "Scan this path" button to the segment popup that preselects the segment in the scan panel.

### 11. The segment popup gives misleading numbers
- Its time-of-day table shows raw survey values. It ignores confirmed AI overrides and the plan's interventions.
- It says "Shade now" even when the map shows Future canopy at year 10.
- **Fix:** show the effective shade for each time slot under the current scenario, and label it with "Year N" when Future is selected.

### 12. Destination labels overlap [Confirmed]
The permanent tooltips collide. In SS 4, "Park" sits on top of "Homes (north-west)". Fix this with a small collision offset, by shortening labels, or by showing labels only from zoom ≥ 17 and on hover below that.

### 13. Failures are silent
- `src/data/dataset.ts:15-23`: if `?area=` fails (an old bookmark, or a saved area dropped from storage because only 4 are kept), the app quietly loads SS 4.
- `src/hooks/useAreaContext.ts:13` swallows context load errors.
- **Fix:** show a dismissible banner, e.g. "Couldn't load 'X', so SS 4 is shown instead." Show a small "Area layers unavailable" note in Map layers.

### 14. Places you looked up can't be managed
No saved area can be deleted, and saved areas are dropped without warning beyond `MAX_SAVED_AREAS = 4` (`src/data/customAreas.ts:20`). Add "Remove" for saved places, and warn before the oldest one is dropped.

### 15. Hints and buttons say the wrong thing
- "Nothing affordable helps at this budget and time." (`ControlsPanel.tsx:61`) also appears when every priority is ×0 or the detour limit makes no difference. Give the real reason.
- "Recommend a plan" does the same as clicking the **Best** plan card. Rename it "Apply best plan" and show which plan is applied.

### 16. The candidate list is hard to read
- "(9)" means 9 trees but doesn't say so.
- `needs-check` and `shelter` are raw codes. Use "9 trees" and "Needs site check".
- Mark the candidates that are in the current best plan.
- Hovering a row should highlight its marker and segments on the map.

### 17. Place search details
- No Escape key or click-outside to close the panel.
- A running analysis can't be cancelled. If the panel is closed during analysis, the page later navigates away without warning.
- Add a Cancel button (an `AbortController` passed to `fetchOverpass`), and keep the progress message visible when the panel is closed.

### 18. Accessibility
- There is only one `:focus-visible` rule (`global.css:22`). Check that buttons, segmented options, plan cards and the swipe handle all show focus clearly.
- Path segments and intervention markers can't be reached with the keyboard (landmarks set `keyboard={false}`). The fix in #2 (a "Details" button in the list) covers the markers.
- Respect `prefers-reduced-motion` in the Grow animation.
- Check the contrast of the amber dashed "direct sun" lines on the Light and Satellite basemaps.

### 19. Swipe: the Before layer may show through on the After side [Verify]
Only `AFTER_PANE` is clipped (`SwipeClip.tsx`). The Before pane is drawn across the whole map, so on the right of the divider it can show through the gaps in the dashed exposed segments (for example, the blue least-sun route from before the plan). Clip `BEFORE_PANE` to the left of the divider as well.

---

## P2 — Model correctness and robustness

20. **The score can include journeys that got worse** (`src/lib/optimizer.ts:93-102`). Adding shade can change which lambda passes the detour limit, so a journey's "after" route can get more sun. The score sums those negatives without saying so. Add a test. Then show "worse" journeys in `JourneyList`, or clamp them.
21. **Budget ignores upkeep.** Only `installCost` is checked against the budget. Consider showing 5- or 10-year cost (install + upkeep × years) on the plan cards.
22. **Candidates are generated from 14:00 shade only** (`data/osm/candidates.ts` `shade14`, `usageBySegment`). At 09:00 and 17:00 the candidates may be poor choices. Generate them from all time slots, or say in "How this was built" that they are picked for 2 pm.
23. **Server hardening** before any deploy (not needed for the local demo):
    - The rate-limit key uses `x-forwarded-for`, which a client can fake.
    - The model id is hard-coded in `server/claude.ts:9`. Read it from env and keep this value as the default.
    - The photo's time slot is never sent to the model.
    - The explainer text is not checked for banned claims (temperature, health, safety). Add a simple word check that falls back to `templateSummary`.
24. **CSV/JSON downloads may fail** in some browsers. `downloadFile` (`src/features/fabrication/export.ts:20-26`) revokes the object URL straight after `click()`. Revoke it in a `setTimeout` instead.

---

## Tests to add
- Demo label comes from the dataset (#1).
- Each candidate's Fabrication pack opens in Before, After and Swipe modes. Extend `scripts/screenshots.mjs`, which already drives Playwright (#2).
- Pareto and duplicate filtering in `recommend()` (#3).
- Shade-scan confirm targets the scanned segment and time (#4).
- A stale explainer response is ignored (#5).
- Viewports at 1280×720, 1024×768 and 390×844: the map is visible and there is no horizontal scroll (#6).
