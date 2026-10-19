# TEDUH — Team Plan & Workflow

Built around one idea: **Evan owns `main` and the core. Teammates each own one folder on their own branch, so nobody edits the same files.**

---

## 1. Roles

| Person | Branch | Owns (only edits these) | Delivers |
|---|---|---|---|
| **Evan (lead)** | `main` | everything not listed below, **especially `src/types.ts`** | Core engine, map, simulator, Map Restoration, all merges |
| **Teammate A** | `feat/fabrication` | `src/features/fabrication/**` | Shelter/tree spec sheets, BOM, CSV/JSON export, SVG elevation |
| **Teammate B** | `feat/ai-scan` | `src/features/ai-scan/**`, `server/**` | Photo → shade estimate (Claude vision), plan explainer |
| **Teammate C** | `feat/data-pitch` | `data/**`, `pitch/**` | Real surveyed neighbourhood data, resident quotes, slides, demo script |

**Only 3 people?** Teammate B takes C's pitch work, and Evan does the data.
**Only 2 people?** Teammate A takes fabrication + data + pitch, and AI (Tier 2) is dropped unless there's time.

## 2. Why this doesn't cause merge conflicts

1. Evan's first push (**Phase 0**) creates **every folder, the shared types, and stub components** for teammate features.
2. `App.tsx` already imports `<FabricationPanel />` and `<ShadeScanPanel />`. On their branches, teammates **replace the stub's insides**. They never touch `App.tsx`.
3. `src/types.ts` is the **contract**. Teammates don't edit it. If you need a new field, message Evan; he adds it on `main` and you run `git pull origin main`.
4. Data is plain JSON in `data/`, validated by a schema, so Teammate C can swap the demo data for real data without touching code.

## 3. Branch workflow (copy-paste)

**Evan, once at the start:**
```bash
git clone https://github.com/evan-2005/Teduh.git
cd Teduh
# give README.md to Claude, let it finish Phase 0, then:
git add -A
git commit -m "chore: scaffold project, types, stubs and seed data"
git push -u origin main
```

**Teammates, once Evan says "Phase 0 pushed":**
```bash
git clone https://github.com/evan-2005/Teduh.git
cd Teduh
git checkout -b feat/fabrication        # or feat/ai-scan / feat/data-pitch
npm install
npm run dev
```

**Teammates, every 1–2 hours:**
```bash
git add -A
git commit -m "feat(fabrication): add BOM generator"
git pull origin main          # pick up Evan's latest
git push -u origin feat/fabrication
```
Then open a PR into `main` on GitHub (or tell Evan "ready to merge").

**Evan, merging a teammate:**
```bash
git checkout main
git pull
git merge --no-ff origin/feat/fabrication
npm run test && npm run build
git push
```

Commit format: `type(scope): description`, where type ∈ feat, fix, refactor, docs, test, chore.

## 4. Timeline: **Thu 15 Oct → deadline Tue 20 Oct 2026**

Five working days. Tiers 0–2 are all scheduled, and one Tier 3 item fits only if the freeze lands on time.

| Day | Evan (`main`) | Teammate A | Teammate B | Teammate C |
|---|---|---|---|---|
| **Thu 15** | **P0** Scaffold, types, stubs, seed data → **push tonight** | Read brief, sketch shelter module design, gather unit costs | Get API key into `.env`, read Claude vision docs | Pick the area, walk & photograph paths, note shade at 09/12/14/17 |
| **Fri 16** | **P1** Graph, routing, metrics + tests · **P2** Map + route comparison UI | Spec generator (pure functions + tests) | `server/` endpoint: mock JSON → real Claude vision call + zod | Trace paths into `data/neighbourhood.json` |
| **Sat 17** | **P3** Interventions, optimizer, budget, results panel | Fabrication panel UI + CSV/JSON export + SVG elevation | Upload UI + confirm/adjust flow | Interventions, costs, journeys, `unit-costs.json` |
| Sat 17 eve | 🔁 **Merge checkpoint 1**: merge A, B, C whatever works | | | |
| **Sun 18** | **P4** Map Restoration: swipe, now/future, time-of-day · **P5** Integration | Photo "after" mockup (Tier 2) | Plan explainer (Tier 2) | Resident interviews, slides draft, demo script |
| Sun 18 eve | 🔁 **Merge checkpoint 2**: everything in | | | |
| **Mon 19** AM | **P6** Polish, demo preset, offline check | Bug bash | Bug bash | Rehearse with real build |
| **Mon 19** noon | 🧊 **Demo freeze**: `git tag demo-v1` | | | Full rehearsal ×2 |
| **Mon 19** PM | *Optional* one Tier 3 item on a `stretch/*` branch (suggest: sun-position shadow sim). Merge **only** if solid by Tue morning | | | Record backup demo video |
| **Tue 20** | 🚩 **Deadline.** Bug fixes only, submit early, start nothing new | | | Submit pitch materials |

## 5. Rules that keep us on time

- **Tier order is law:** Tier 0 → 1 → 2. Tier 3 only after `demo-v1` is tagged (Mon 19 noon).
- **Daily 10-minute sync** (evening): what merged, what's blocked, any `types.ts` change requests.
- **Behind schedule?** If P3 isn't done by Sat 17 night, drop Tier 2 immediately and use the cut list below.
- **Unfinished work is behind a flag.** If a feature isn't working at merge checkpoint 2, it stays off (`VITE_ENABLE_AI=false`) and its stub shows "Coming soon".
- **Every PR passes `npm run test && npm run build`** before Evan merges.
- **No live-internet dependency in the demo path.** The AI scan has a labelled mock fallback, and seed data is local JSON.
- **After the freeze, `main` only gets bug fixes.**

## 6. Cut list (if behind schedule, cut in this order)

1. Tier 3 (all)
2. Plan explainer (#12)
3. Photo "after" mockup (#13)
4. AI shade scan → keep the UI, use mock response
5. SVG elevation → keep BOM table only
6. Time-of-day → lock to 14:00

**Never cut:** map, route comparison, budget simulator, results panel, Before/After swipe.

## 7. Definition of done (demo-ready)

- [ ] Demo preset "2 pm walk to shops" loads in one click
- [ ] Judge can change budget, toggle interventions, change time, prioritise school, and results update in < 1 s
- [ ] Swipe shows the gap closing; Now/Future changes tree shade
- [ ] Clicking a shelter shows its fabrication pack, and export works
- [ ] Every number shows its data source label
- [ ] Works offline after `npm run build && npm run preview`
- [ ] Pitch rehearsed twice, under time limit
- [ ] Backup demo video recorded (in case the live demo fails)
- [ ] Submitted before the Tue 20 Oct deadline
