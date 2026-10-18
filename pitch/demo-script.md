# TEDUH: 3-minute demo script

Follows BRIEF §7 on the real SS 15, Subang Jaya map (the app's default area). The story is the busiest walk in the area: from the **SS15 LRT station** to the **SS15 Courtyard** mall. Numbers marked ◆ come from the current data (`data/osm`). If you refresh the data or change the area, run the demo once and update every ◆.

**Setup before you go on:** `npm run build && npm run preview` (and `npm run dev:server` if showing the AI scan). Browser at 100% zoom, window at least 1280 px wide, internet on for the background map. Click **Demo: 2 pm walk from the LRT station to the shopping mall**, check it loads, then reload.

| Time | Say | Do | Show |
|---|---|---|---|
| 0:00 | "This is a real township, SS 15 in Subang Jaya. Streets, buildings and places are from OpenStreetMap. Where should a small budget go first?" | Reload. Open **Map layers**, click **Satellite**, then back to **Streets**. | The real shop rows and roads, with the LRT station, the mall, the college and the bus stops marked. |
| 0:25 | "The busiest walk here is from the LRT station to the mall: about ◆590 trips a day, at 2 pm, in the sun." | Click **Demo: 2 pm walk from the LRT station to the shopping mall**. Point at the top row of **Journeys**. | ◆592 trips a day, scaled to the station's real ticket-gate count (◆5,165 exits on a typical weekday; open in **How this was built**). A ◆3.6 min, ◆258 m walk with ◆3.0 min in direct sun before the plan, and ◆218 m exposed in one stretch. |
| 0:50 | "TEDUH models walks from the stations and bus stops to the places people go. With about RM 100,000 it recommends a plan." | Open **2 Plan builder**. Point at the **Best** plan card, then **What each one adds**. | ◆1 covered walkway + 2 tree rows (◆17 trees), RM ◆94,100, ◆12.7 pedestrian-hours of direct sun avoided per day, ◆5 of 10 journeys improved. The walkway on Jengka Avenue does most of it (◆539 min/day). The other options are cheaper trade-offs. |
| 1:10 | "Drag the divider: before on the left, after on the right." | Drag the swipe handle across the covered walkway on Jengka Avenue. | Amber dashed → green on the walkway. On the station-to-mall walk, direct sun ◆3.0 → ◆1.9 min and the longest exposed stretch ◆218 m → ◆149 m. |
| 1:35 | "Trees take years; shelters work on day one." | Click **Future**, then **Grow**. | By year 10 the best plan flips to **5 tree rows (◆58 trees) for RM ◆51,700, ◆26.5 pedestrian-hours**: about twice what today's plan gives, for just over half the cost, if the trees mature as modelled. |
| 2:00 | "Every chosen item has a build pack a contractor can quote from." | Click **Now**, then the filled walkway marker on Jengka Avenue (or **Details** next to it under **Candidates**). It opens **3 Spec pack**. | Length, cost and where it starts (the LRT station), then the elevation drawing, bill of materials, Download CSV. Point at "Indicative only" and the cost note. On the map, each tree row draws every tree it promises along the kerb. |
| 2:20 | "OpenStreetMap has no trees mapped here, so our shade is a model. A survey photo fills the gap: a vision model (Claude in the cloud, or a small open model running on this laptop) estimates the shade, but it only counts after a person confirms it." *(if the AI panel is on)* | Open **4 AI scan**. Upload a path photo → **Estimate shade** → adjust → **Confirm**. | The "Estimated by …" line naming the model, and the AI-CONFIRMED badge; mention MOCK if no model is set up. A small local model is less accurate than Claude, which is why a person checks every estimate. Open **How this was built** to show the honest limits. |
| 2:45 | "Judges: change the budget or the tree spacing, tick a candidate, prioritise the college, change the time." | Hand over the mouse. | Everything recalculates instantly. |
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
- Station exits are real: ticket-gate counts published by Prasarana on data.gov.my (about 5,200 people leave SS15 station on a weekday). How they split between the mall, the college and the shops is still a model (bigger places and shorter walks draw more), and bus stop trips are estimates. A count at the station exit and at the mall entrance is the first thing a pilot would add.
- Because no trees are mapped, midday shade is understated. That is exactly why a survey and the AI scan are in the pilot plan.
- Costs are bottom-up estimates from unit costs, not quotes.

## Words to avoid
Never say shade lowers temperature, makes a route "safe" or "healthy", or that the figures are measurements.
