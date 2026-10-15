# TEDUH: 3-minute demo script

Follows BRIEF §7. Numbers below are from the **seed data** (illustrative). If the real survey data replaces it, re-run the demo once and update every figure marked ◆.

**Setup before you go on:** `npm run build && npm run preview` (and `npm run dev:server` if showing the AI scan). Browser at 100% zoom, window at least 1280 px wide. Click **Demo: 2 pm walk to the shops** once to check it loads, then reload.

| Time | Say | Do | Show |
|---|---|---|---|
| 0:00 | "A township can have trees and footpaths and still have exposed gaps between them. Where do you spend a small budget first?" | Reload the page. | Map, Swipe mode, nothing chosen. |
| 0:20 | "A resident walks from Home A to the shops at 2 pm." | Click **Demo: 2 pm walk to the shops**. Point at the Before side. | Amber dashed connector. Route table: ~◆10 min walk, ◆5.4 min in direct sun, longest exposed stretch ◆240 m. |
| 0:45 | "With RM 25,000 TEDUH recommends a plan." | Point at the **Best** plan card. | Connector shelter + school gate shelter, RM ◆24,000. Headline ◆50 pedestrian-hours in direct sun avoided per day. |
| 1:00 | "Drag the divider and the amber gap closes." | Drag the swipe handle across the connector. | Amber → green. Exposed stretch ◆240 m → ◆60 m. |
| 1:20 | "One shelter on a shared connector helps school, bus stop and shop journeys at once." | Scroll the Journeys list. | "Journeys improved: 6 of 6." Each journey's before → after. |
| 1:45 | "Trees take years. Shelters work on day one." | Click **Future**, then **Grow**. | Trees fill in; shelters unchanged. The recommended plan changes. |
| 2:05 | "Every chosen item has a build pack a contractor can quote from." | Click the connector shelter marker. | Fabrication pack: elevation drawing, bill of materials, Download CSV. Point at the "indicative only" line. |
| 2:25 | "A survey photo becomes map data, but only after a person confirms it." *(if the AI panel is on)* | Upload a path photo → **Estimate shade** → adjust slider → **Confirm**. | The segment popup now shows the AI-CONFIRMED badge. Mention the MOCK badge if no key. |
| 2:45 | "Judges: change the budget, tick or untick a candidate, prioritise the school, change the time." | Hand over the mouse. | Everything recalculates instantly. |
| 3:00 | "Illustrative prototype data. Shade is not comfort or safety." | | Footer disclaimer. |

## If something breaks
- AI panel fails: the mock result is labelled MOCK. Say so and continue, or skip step 2:25.
- Basemap tiles missing (no internet): untick **Show basemap**. The paths still render.
- Anything else: play the backup video (record it after the Mon 19 noon freeze; see the checklist below).

## Backup video checklist
- [ ] Record at 1280×800, the full script above, no cuts.
- [ ] Save as `pitch/backup-demo.mp4` and keep a copy on a phone.
- [ ] Re-record if any ◆ number changes.

## Words to avoid
Never say shade lowers temperature, makes a route "safe" or "healthy", or that the figures are measurements.
