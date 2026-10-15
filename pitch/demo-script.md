# TEDUH: 3-minute demo script

Follows BRIEF §7 on the real SS 15, Subang Jaya map (the app's default area). The story is the busiest walk in the area: from the **SS15 LRT station** to the **SS15 Courtyard** mall. Numbers marked ◆ come from the current data (`data/osm`). If you refresh the data or change the area, run the demo once and update every ◆.

**Setup before you go on:** `npm run build && npm run preview` (and `npm run dev:server` if showing the AI scan). Browser at 100% zoom, window at least 1280 px wide, internet on for the background map. Click **Demo: 2 pm walk from the LRT station to the shopping mall**, check it loads, then reload.

| Time | Say | Do | Show |
|---|---|---|---|
| 0:00 | "This is a real township, SS 15 in Subang Jaya. Streets, buildings and places are from OpenStreetMap. Where should a small budget go first?" | Reload. Open **Map layers**, click **Satellite**, then back to **Streets**. | The real shop rows and roads, with the LRT station, the mall, the college and the bus stops marked. |
| 0:25 | "The busiest walk here is from the LRT station to the mall: about ◆570 trips a day, at 2 pm, in the sun." | Click **Demo: 2 pm walk from the LRT station to the shopping mall**. Point at the top row of **Journeys**. | ◆573 trips a day. A ◆3.6 min, ◆258 m walk with ◆3.0 min in direct sun before the plan, and ◆218 m exposed in one stretch. |
| 0:50 | "TEDUH models walks from the stations and bus stops to the places people go. With about RM 90,000 it recommends a plan." | Point at the **Best** plan card, then **What each one adds**. | ◆1 covered walkway + 2 tree rows, RM ◆89,400, ◆10.9 pedestrian-hours of direct sun avoided per day, ◆4 of 10 journeys improved. The walkway on Jengka Avenue does most of it (◆521 min/day). The other options are cheaper trade-offs. |
| 1:10 | "Drag the divider: before on the left, after on the right." | Drag the swipe handle across the covered walkway on Jengka Avenue. | Amber dashed → green on the walkway. On the station-to-mall walk, direct sun ◆3.0 → ◆1.9 min and the longest exposed stretch ◆218 m → ◆149 m. |
| 1:35 | "Trees take years; shelters work on day one." | Click **Future**, then **Grow**. | By year 10 the same plan avoids ◆17.2 pedestrian-hours a day. A trees-only option appears: **5 tree rows for RM ◆24,900, ◆15.2 pedestrian-hours**, nearly as much for under a third of the cost, if the trees mature as modelled. |
| 2:00 | "Every chosen item has a build pack a contractor can quote from." | Click **Now**, then the filled shelter marker on Jengka Avenue (or **Details** next to it under **Candidates**). | Elevation drawing, bill of materials, Download CSV. Point at "Indicative only" and the cost note. |
| 2:20 | "OpenStreetMap has no trees mapped here, so our shade is a model. A survey photo fills the gap, but only after a person confirms it." *(if the AI panel is on)* | Upload a path photo → **Estimate shade** → adjust → **Confirm**. | The AI-CONFIRMED badge; mention MOCK if no key. Open **How this was built** to show the honest limits. |
| 2:45 | "Judges: change the budget, tick a candidate, prioritise the college, change the time." | Hand over the mouse. | Everything recalculates instantly. |
| 3:00 | "Illustrative prototype. Shade and trips are modelled, not measured, and shade is not comfort or safety." | | Footer disclaimer and OpenStreetMap credit. |

## If something breaks
- Background map blank (no internet): **Map layers → None**. The buildings, parks and landmarks still draw.
- AI panel fails: the mock result is labelled MOCK. Say so and continue, or skip the 2:20 step.
- Wrong area showing: pick **SS 15, Subang Jaya** in the header, or open `/?area=ss15-subang-jaya`.
- Anything else: play the backup video (record it after the Monday noon freeze).

## Backup video checklist
- [ ] Record at 1280×800, the full script above, no cuts.
- [ ] Save as `pitch/backup-demo.mp4` and keep a copy on a phone.
- [ ] Re-record if any ◆ number changes.

## Honest talking points (use them, do not hide them)
- Nothing here is measured. Shade is modelled from mapped buildings and the real sun position.
- Trips are a model too: a rail station and a mall draw more walks than a bus stop and a corner shop, and longer walks fewer. They are not footfall counts; a real count at the station exit is the first thing a pilot would add.
- Because no trees are mapped, midday shade is understated. That is exactly why a survey and the AI scan are in the pilot plan.
- Costs are bottom-up estimates from unit costs, not quotes.

## Words to avoid
Never say shade lowers temperature, makes a route "safe" or "healthy", or that the figures are measurements.
