# TEDUH — Updated Brief (v2)

> **Small changes. Cooler journeys.**
> Track: Planet · Focus: Climate resilience · Supporting: green transport, biodiversity
> v2 adds **Map Restoration (before/after simulation)** and **AI Reconstruction & Fabrication Data**, and ranks every feature by feasibility.
> **Build window: Thu 15 Oct → deadline Tue 20 Oct 2026** (5 days; demo freeze Mon 19 noon).

---

## 1. The idea in one line

A digital map that helps township managers decide **where to put trees or shelters** so everyday walks have more shade, within a fixed budget.

*Teduh* is Malay for shaded or sheltered. It's a name, not an acronym.

## 2. The decision we support

> "With our budget, which shade improvements would help the most everyday journeys?"

A township can already have trees and footpaths and still have uncomfortable exposed gaps between them. Our hypothesis, which the prototype tests rather than assumes, is that **connecting existing shaded sections can beat spreading new shade evenly**.

## 3. Who uses it

| User | What they do in TEDUH |
|---|---|
| Township managers | Set budget and priorities, compare plans, pick what to build |
| Landscape / maintenance teams | Check feasibility, get **fabrication data** for what was picked, update the map |
| Residents (later) | Compare walking routes, report missing shade or blocked paths |

## 4. What the product does (6 steps)

1. **Map the neighbourhood.** Paths, shade at selected times, crossings, destinations, access restrictions.
2. **Add the choices.** 6–10 candidate trees or shelters, each with cost, maintenance and feasibility.
3. **Set priorities.** Budget, time of day, important destinations (school, bus stop).
4. **Compare improvements.** Recalculate routes and direct-sun exposure for every combination within budget.
5. **Recommend and explain.** Suggested plan, alternatives, assumptions, and the journeys that benefit.
   - **NEW: Map Restoration.** Before/after simulation drawn on the map.
   - **NEW: Fabrication Data.** A buildable spec pack for each chosen intervention.
6. **Check what happened** (post-hackathon pilot). Observed shade, pedestrian counts, resident feedback.

## 5. New features

### 5a. Map Restoration (before/after simulation)

This shows the neighbourhood's shade network being restored, so the gap closes visually.

- **Before / After / Swipe** map modes. Segments are coloured green (shaded) or amber (direct sun). Swipe drags a divider across the map so the judge can see the gap close.
- **Now / Future canopy** toggle. A young tree gives little shade today and a lot in 5–8 years, while a shelter gives full shade on day one. A growth slider animates years 0 → 10.
- **Time of day** (09:00 / 12:00 / 14:00 / 17:00, using survey snapshots). The same plan can look different at 2 pm and at 5 pm.
- Intervention markers (tree or shelter icons) appear on the "after" side only.

### 5b. AI Reconstruction & Fabrication Data

This turns field photos into map data, and turns chosen plans into something a contractor could quote on.

- **AI shade reconstruction.** Upload a survey photo of a path segment. A vision model (Claude in the cloud, or a small open model running on the laptop) estimates shade fraction, shade sources (tree, awning, building) and obstacles, with a confidence level. **A human confirms or adjusts** before it touches the map, and the data is labelled `ai-confirmed`.
- **Fabrication data (rule-based, no AI needed).** For each selected shelter: modules, posts, footings, roof area, bill of materials, cost, and a simple dimensioned SVG elevation. For each tree: pit size, planting spec, suggested species list (flagged *to verify with landscape team*). Exports to CSV and JSON.
- **AI plan explainer** (optional). An LLM writes the manager-facing summary **from numbers the calculator already produced**. It never invents figures.
- **Stretch:** photo "after" mockup, 3D canopy view, sun-position shadow simulation, CAD/DXF export.

## 6. Feature ranking, sorted by feasibility

Effort: **S** < 3 h · **M** 3–6 h · **L** > 6 h or external-dependency risk. "Demo value" = how much it helps the live story.

| # | Feature | Effort | Demo value | Tier | Owner |
|---|---|---|---|---|---|
| 1 | Neighbourhood map + seed data (20–40 segments, 5 destinations) | S | ★★★ | **0 · Core** | Evan |
| 2 | Results panel (walk time, sun minutes, longest exposed stretch, cost, confidence) | S | ★★★ | **0 · Core** | Evan |
| 3 | Route comparison: shortest vs least-sun, with detour limit | S–M | ★★★ | **0 · Core** | Evan |
| 4 | Investment simulator (budget, priorities, all combos of ≤10 candidates) | M | ★★★ | **0 · Core** | Evan |
| 5 | **Map Restoration:** Before / After / Swipe | S | ★★★ | **1 · Must** | Evan |
| 6 | **Map Restoration:** Now / Future canopy + growth slider | S | ★★★ | **1 · Must** | Evan |
| 7 | **Map Restoration:** time-of-day selector | S | ★★ | **1 · Must** | Evan |
| 8 | **Fabrication:** shelter + tree spec sheet, BOM, CSV/JSON export | S–M | ★★ | **1 · Must** | Teammate A |
| 9 | **Fabrication:** dimensioned SVG elevation of shelter | M | ★★ | **1 · Must** | Teammate A |
| 10 | Real surveyed data for one neighbourhood + pitch + demo script | M | ★★★ | **1 · Must** | Teammate C |
| 11 | **AI Reconstruction:** photo → shade estimate, human confirms | M | ★★★ | **2 · Should** | Teammate B |
| 12 | **AI:** plan explainer (summarises computed results) | S–M | ★★ | **2 · Should** | Teammate B |
| 13 | **AI Reconstruction:** photo "after" mockup (drag/scale tree or shelter cutout over the survey photo) | M | ★★ | **2 · Should** | Teammate A or B |
| 14 | Resident report / QR feedback page | M | ★ | 3 · Extra time | anyone |
| 15 | Sun-position shadow simulation (suncalc + building/tree heights) | L | ★★ | 3 · Extra time | Evan |
| 16 | 3D canopy view (deck.gl / three.js extrusions) | L | ★★ | 3 · Extra time | anyone |
| 17 | Generative photoreal "after" render (external image model) | L | ★★ | 3 · Extra time | Teammate B |
| 18 | Parametric CAD / DXF export for fabricators | L | ★ | 3 · Extra time | Teammate A |

**Rule:** Tier 0 → Tier 1 → Tier 2. With 5 days, Tiers 0–2 are all scheduled (see PLAN §4). Tier 3 starts **only** after the demo freeze build (`demo-v1`, Mon 19 Oct noon) is tagged and rehearsed once, and at most one Tier 3 item is attempted.

## 7. Demo story (unchanged core, new moments)

1. A resident walks to the shops at **2 pm**. Show the current route: 6 sun-minutes, with a 240 m exposed stretch.
2. A judge picks a **budget**. TEDUH recommends a plan.
3. **Swipe** the map. The amber gap turns green. *(Map Restoration)*
4. One shelter on a shared connector improves **school, bus-stop and shop** journeys at once. This is the memorable moment.
5. Flip **Now → Future**. Trees grow, and the plan's value changes over time.
6. Click the shelter and choose **Fabrication pack**. The judge sees the BOM, cost and elevation drawing. *(Fabrication Data)*
7. *(If Tier 2 shipped)* Upload a photo of a path. AI estimates its shade, a teammate confirms it, and the map updates live. *(AI Reconstruction)*
8. Let the judge remove an intervention, prioritise school access, or change the time. Everything recalculates.

*Illustrative prototype data only. Figures are a demo scenario, not measurements.*

## 8. Honesty rules (keep these in the pitch and UI)

- Shade ≠ comfort or safety. Never claim a temperature drop or "medically safe route".
- AI estimates are **labelled** and **human-confirmed**. Route and budget maths stay inspectable, with no black box.
- Fabrication output is **indicative**. Structural sign-off by a qualified engineer is required.
- Tree species list is a suggestion to verify with the landscape team.
- Every value shows its source: `surveyed` · `estimated` · `ai-confirmed` · `missing`.
- Shade-aware routing already exists (e.g. Singapore's Undercover). Our differentiation is **township-scale budgeted planning + timing + maintenance + fabrication handoff + before/after verification**.

## 9. Sources

1. Open Government Products. *Undercover*, Hack for Public Good (2026). https://www.hack.gov.sg/2026/undercover/
2. Schrodi et al. *Climate-sensitive Urban Planning through Optimization of Tree Placements* (2023). https://arxiv.org/abs/2310.05691
3. *CoolWalks for active mobility in urban street networks.* Scientific Reports (2025). https://www.nature.com/articles/s41598-025-97200-2
