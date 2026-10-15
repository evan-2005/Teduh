# TEDUH: 3-minute demo script

Follows BRIEF §7 on the real SS 4, Petaling Jaya map. Numbers marked ◆ come from the current data (`data/osm`). If you refresh the data or change the area, run the demo once and update every ◆.

**Setup before you go on:** `npm run build && npm run preview` (and `npm run dev:server` if showing the AI scan). Browser at 100% zoom, window at least 1280 px wide, internet on for the background map. Click **Demo: 2 pm walk to the shops**, check it loads, then reload.

| Time | Say | Do | Show |
|---|---|---|---|
| 0:00 | "This is a real township, SS 4 in Petaling Jaya. Streets, buildings and places are from OpenStreetMap. Where should a small budget go first?" | Reload. Open **Map layers**, click **Satellite**, then back to **Streets**. | The real houses and roads, with school, bus stops and supermarket marked. |
| 0:25 | "A resident walks from the eastern homes to the bus stop at 2 pm." | Click **Demo: 2 pm walk to the shops**. | Route table: ◆7.4 min walk, all of it in direct sun, ◆536 m exposed. |
| 0:50 | "With about RM 110,000 TEDUH recommends a plan." | Point at the **Best** plan card. | ◆1 covered walkway + 3 tree rows, RM ◆108,100, ◆9.0 pedestrian-hours of direct sun avoided per day, ◆7 of 8 journeys improved. |
| 1:10 | "Drag the divider: before on the left, after on the right." | Drag the swipe handle across the covered walkway on Majlis Road. | Amber dashed → green on the shelter, and the new tree markers. Exposed stretch ◆536 m → ◆460 m. |
| 1:35 | "Trees take years; shelters work on day one." | Click **Future**, then **Grow**. | The best plan flips to **5 tree rows for RM ◆34,200, ◆17.9 pedestrian-hours**, about twice the benefit for under a third of the cost, if the trees mature as modelled. |
| 2:00 | "Every chosen item has a build pack a contractor can quote from." | Click a shelter marker. | Elevation drawing, bill of materials, Download CSV. Point at "Indicative only" and the cost note. |
| 2:20 | "OpenStreetMap has no trees mapped here, so our shade is a model. A survey photo fills the gap, but only after a person confirms it." *(if the AI panel is on)* | Upload a path photo → **Estimate shade** → adjust → **Confirm**. | The AI-CONFIRMED badge; mention MOCK if no key. Open **How this was built** to show the honest limits. |
| 2:45 | "Judges: change the budget, tick a candidate, prioritise the school, change the time." | Hand over the mouse. | Everything recalculates instantly. |
| 3:00 | "Illustrative prototype. Shade is modelled, not measured, and shade is not comfort or safety." | | Footer disclaimer and OpenStreetMap credit. |

## If something breaks
- Background map blank (no internet): **Map layers → None**. The buildings, parks and landmarks still draw.
- AI panel fails: the mock result is labelled MOCK. Say so and continue, or skip the 2:20 step.
- Anything else: play the backup video (record it after the Monday noon freeze).

## Backup video checklist
- [ ] Record at 1280×800, the full script above, no cuts.
- [ ] Save as `pitch/backup-demo.mp4` and keep a copy on a phone.
- [ ] Re-record if any ◆ number changes.

## Honest talking points (use them, do not hide them)
- Nothing here is measured. Shade is modelled from mapped buildings and the real sun position; trips are rough estimates.
- Because no trees are mapped, midday shade is understated. That is exactly why a survey and the AI scan are in the pilot plan.
- Costs are bottom-up estimates from unit costs, not quotes.

## Words to avoid
Never say shade lowers temperature, makes a route "safe" or "healthy", or that the figures are measurements.
