# TEDUH: demo script and run sheet (Steven presents, Thien Gen demos)

Two presenters, one laptop. Written for someone who has **never opened the app**. Follow it top to bottom.

- **Steven (Chang Juan Jue), presenter.** Runs every slide and tells the story, from the opening to the ask. Hands over to Thien Gen at 1:30 and takes back at 3:45.
- **Thien Gen (Hong Thien Gen), demo.** Drives the app and does all the talking during the live demo (1:30–3:45). Takes the technical questions.

**Handover.** One laptop. Steven sits at the keyboard and advances the slides (arrow keys or a clicker). At 1:30 Thien Gen takes the mouse and keyboard and Alt+Tabs to the app. At 3:40 Thien Gen Alt+Tabs back to the deck and hands back. Steven stays silent during the demo; Thien Gen stays silent during the slides.

Slides: the TEDUH Pitch Deck artifact (10 main slides + appendix). Speaker notes in each slide hold the same lines as below.
Numbers marked ◆ come from the current data. If anyone changes the data or the area, run the demo once and update every ◆.

| Deadline | What | Format |
|---|---|---|
| **23 Oct 2026, 11:59 pm** | Pitch deck (max 10 main slides), 5-minute video or demo link, code/GitHub link | Part A below is the 5-minute video |
| 14 Nov 2026 (if Top 10) | Live pitch to judges at SDP office | 10 min + 5 min Q&A, Part C |

---

## Part 0: Set up the laptop (do this once, the day before)

You need: the project folder, Node 20 or newer, Ollama with the `qwen2.5vl:7b` model, and internet (for the background map).

1. Open **two** terminals in the project folder (`SDP Hackathon`). In VS Code: Terminal → New Terminal, twice.
2. First time only, install the packages:
   ```bash
   npm install
   ```
3. Check `.env` in the project folder contains these lines (never put an API key in a slide or video):
   ```
   VITE_ENABLE_AI=true
   AI_PROVIDER=ollama
   OLLAMA_MODEL=qwen2.5vl:7b
   ```
4. Check the model is downloaded. If it is not listed, run `ollama pull qwen2.5vl:7b` (about 6 GB):
   ```bash
   ollama list
   ```
5. Run the automated checks. All must pass:
   ```bash
   npm test
   ```
6. Have a **real photo of a footpath** on the laptop (take one on your phone near campus at around 2 pm, half in shade if you can). A fallback test image is in `pitch/assets/sample-path-synthetic.jpg`; it is a drawing, so say so if you use it.
7. Record a backup video (Part A, full run, no cuts) and save it as `pitch/backup-demo.mp4`. Keep a copy on a phone.

## Part 1: Start the app (T-minus 30 minutes before presenting or recording)

| When | Who | Do | You should see |
|---|---|---|---|
| T-30 | Thien Gen | Plug in the charger. Windows: Settings → System → Power → **Best performance**. Close games, OBS previews and video tabs (they steal the GPU). | |
| T-28 | Thien Gen | Terminal 1: `npm run dev:server` | `Teduh API listening on http://localhost:8787 in local mode: a local model (qwen2.5vl:7b)` |
| T-27 | Thien Gen | Terminal 2: `npm run build`, then `npm run preview` | A line with `http://localhost:4173/` |
| T-26 | Thien Gen | Open **http://localhost:4173** in Chrome or Edge. Zoom 100% (Ctrl+0). Window at least 1280 px wide (maximise it). | The TEDUH map of **SS 15, Subang Jaya** with amber dashed paths |
| T-25 | Thien Gen | **Warm up the AI** (the first call loads the model, 30–60 s): click **4 AI scan** → **Choose File** → your photo → **Estimate shade**. Wait for "AI estimate: …%". Then click **Undo all** if you confirmed anything. | "Estimated by a local model (qwen2.5vl:7b)" |
| T-20 | Both | Do one full dry run of Part A with a stopwatch. | Finishes by 5:00 |
| T-5 | Thien Gen | Reload the page (F5). Click **1 Map & routes**. Leave it there. | Fresh SS 15 map, **1 Map & routes** highlighted |
| T-5 | Steven | Open the deck in **Present** mode on the cover. Check you can Alt+Tab between the deck and the app. | |
| T-2 | Both | Phones on silent. Notifications off (Windows: Focus assist / Do not disturb). | |

If you are recording, use **Snipping Tool → Record** (Win+Shift+R) or OBS, at 1280×800 or larger, with a microphone you have tested.

---

## Part A: 5-minute script (video for 23 Oct, also the core of the live pitch)

`Say` is what to say, close to word for word. `Do` is the exact click. `Check` is what the screen should show; if it doesn't, see Part D.

| Time | Who | Say | Do | Check |
|---|---|---|---|---|
| **0:00** | Steven | "Hi, we are Team One. I'm Steven, this is Thien Gen. *Teduh* is Malay for shaded or sheltered. Our track is Planet, focus climate resilience." | Deck on the **cover** slide. | |
| **0:15** | Steven | "Picture SS 15 in Subang Jaya at 2 pm. About 5,000 people leave the LRT station on a weekday; that is real Prasarana ticket-gate data. Our model sends about 590 of them a day to the mall next door, and on that walk there's a 218-metre stretch with no shade at all. The township has trees and footpaths. The problem is the gaps between them, and a manager with a small budget can't see which gap matters most." | Next slide: **Problem**. | ◆592, ◆218 m on the slide |
| **0:50** | Steven | "Our user is the person who holds the budget: the township manager. The landscape team builds it, and residents on foot benefit." | Next slide: **Target user**. | |
| **1:10** | Steven | "Teduh answers one question: with this budget, which shade helps the most walks? It recommends trees and covered walkways, shows before and after, and hands off a build pack. Thien Gen will show you on a real township." | Next slide: **Solution**, then the **Demo** slide. Move aside; Thien Gen takes the keyboard. | |
| **1:30** | Thien Gen | "Thanks, Steven. This is the real SS 15. Streets and buildings are from OpenStreetMap. Here is the 2 pm walk from the LRT station to the mall." | Alt+Tab to the app. In the left panel, click **Demo: 2 pm walk from the LRT station to the shopping mall**. | Headline **12.7** ◆ pedestrian-hours. Under **Journeys**, top row: **LRT station → Shopping mall**, "sun 3.0 → 1.9 min · exposed 218 → 149 m" ◆ |
| **1:45** | Thien Gen | "With RM 100,000, Teduh tried every affordable combination and recommends one covered walkway and two tree rows, for RM 94,100. The walkway from the station on Jengka Avenue does most of the work." | Click **2 Plan builder** (top bar). Point the mouse at the **Best** card, then scroll down to **What each one adds**. | Best: **1 covered walkway + 2 tree rows**, RM ◆94,100 · ◆12.7 pedestrian-hours/day. Walkway ◆539 min/day |
| **2:05** | Thien Gen | "Before on the left, after on the right." | On the map, drag the round **⇄** handle from the middle **to the left**, slowly, past the **LRT station** marker. | Amber dashed paths near the station turn solid green |
| **2:20** | Thien Gen | "That's the key idea: one walkway on a shared stretch helps the mall, the college and the clinic walks at once." | Keep the mouse still on the walkway. | |
| **2:30** | Thien Gen | "Trees take years; a walkway works on day one. Let's grow them ten years." | Click **Future** (top of map), then **Grow**. Wait about 5 s until it says **Year 10**. | Best plan flips to **5 tree rows**, RM ◆51,700 · ◆26.5 pedestrian-hours/day |
| **2:50** | Thien Gen | "Twice the benefit for about half the money, if you can wait, and if the trees grow as modelled." | | |
| **2:55** | Thien Gen | "Every item comes with a spec pack a contractor can quote from." | Click **Now**. Then in the left panel under **Candidates**, click **Details** next to **Covered walkway from the LRT station on Jengka Avenue (69 m)**. | Page **3 Spec pack** opens: length ◆69 m, cost RM ◆79,000, elevation drawing, bill of materials, **Download CSV** |
| **3:15** | Thien Gen | "OpenStreetMap has almost no trees mapped here, so our shade is a model. A survey photo fills that gap. A vision model running on this laptop estimates the shade, and nothing reaches the map until a person confirms it." | Click **4 AI scan**. Path segment already says **Jengka Avenue (Main road) · seg-116**. **Choose File** → your photo → **Estimate shade**. | "Estimating…" for about 10 s |
| **3:25** | Thien Gen | (Talk over the wait.) "Photos stay on this laptop, and there is no cloud cost per photo." | | "AI estimate: N% shaded", "Estimated by a local model (qwen2.5vl:7b)" |
| **3:35** | Thien Gen | "I'll check it against the photo, adjust, and confirm. Back to Steven." | Drag **Your value** if needed, then click **Confirm and apply to map**. Alt+Tab back to the deck and hand the keyboard back. | "Applied to seg-116 at 14:00 as **AI-CONFIRMED**". The headline may drop: that's correct, see note ★ |
| **3:45** | Steven | "Under the hood: open map data, the real sun position, real station counts, and a score anyone can inspect: hours walked in direct sun, avoided." | Next slide: **How it works**. | |
| **4:05** | Steven | "In this scenario, RM 94,000 takes 12.7 pedestrian-hours a day out of direct sun. These are model estimates; a pilot measures the real effect." | Next slide: **Impact**. | |
| **4:20** | Steven | "Routing apps like Singapore's Undercover help a walker. Teduh helps a township decide what to build." | Next slide: **Innovation**. | |
| **4:30** | Steven | "It already runs on 15 Klang Valley areas and any other place in about 40 seconds: this is SDP's own Ara Damansara." | Next slide: **Feasibility**. | |
| **4:45** | Steven | "Our ask: one SDP township to pilot, a landscape contact and a small budget line. Survey, build, measure in six months. Thank you." | Next slide: **Implementation**. Stop at 5:00. | |

★ **If the headline drops after Confirm** (for example 12.7 → 7.9): the photo says the walkway's path already has some shade, so the walkway is worth less. If you have time, say: *"See, one photo changed the decision. That's why the survey matters."* Before the next run, click **Undo all** in **4 AI scan** (or the **Demo** button again).

---

## Part B: what each screen is (for a first-time user)

| Where | What it is |
|---|---|
| Top bar **1 Map & routes** | The start page. The **Demo** button, the headline number, the walks and the time-of-day slider |
| Top bar **2 Plan builder** | Budget, **Recommend a plan**, the plan cards (Best, Option 2, Option 3), site planning, unit costs, **Place your own**, candidates, priorities |
| Top bar **3 Spec pack** | The build details for one tree row or walkway: drawing, bill of materials, CSV/JSON download |
| Top bar **4 AI scan** | Upload a path photo → AI shade estimate → adjust → confirm. Also **Plan explainer** (a written summary of the plan) |
| **Area** dropdown | Switch between the 15 built-in Klang Valley neighbourhoods (plus one invented test area). Keep it on **SS 15, Subang Jaya** for the demo |
| **Look up a place** | Builds any place from OpenStreetMap in about 40 s. Needs internet |
| **Before / After / Swipe** (top of map) | Which version of the map you see. **Swipe** shows both with a draggable divider |
| **Now / Future**, **Year**, **Grow** | Today's shade or the shade once the trees grow. **Grow** animates years 0→10 |
| Badges like `ESTIMATED`, `AI-CONFIRMED`, `MOCK`, `TEMPLATE` | Where a number came from. Point at them: honesty is part of the pitch |

---

## Part C: 10-minute live pitch (14 Nov, if Top 10)

Same split: Steven presents, Thien Gen demos. Same opening as Part A; Thien Gen's demo runs longer, adding these after the AI scan step (at 3:35 Thien Gen carries on instead of handing back), and Steven takes back at 7:30:

| Time | Who | Add | Do |
|---|---|---|---|
| 3:45 | Thien Gen | "Time of day matters." | **1 Map & routes**, drag **Time of day** from 2 pm to 5 pm and back. Exposed paths change. |
| 4:15 | Thien Gen | "Managers know their site. They can place their own." | **2 Plan builder** → **Place your own** → **Plant a tree row** → click 2–3 connected paths on the map → **Add**. It is priced and scored with the others. |
| 5:00 | Thien Gen | "A written summary for the manager, built only from the numbers on screen." | **4 AI scan** → **Explain this plan** (about 20 s; talk over it). A `TEMPLATE` badge means the model's text was rejected for inventing a figure: say so, it's a feature. |
| 5:30 | Thien Gen | "And it works on SDP's own township." | **Look up a place** → type `Ara Damansara` → **Search** → pick the result that says **Petaling Jaya, Petaling, Selangor**. About 40 s; talk over it ("it is downloading streets, buildings and bus stops from OpenStreetMap and running the same model"). Then **Demo: 2 pm walk…** for Ara Damansara. |
| 6:30 | Thien Gen | Hand the mouse to a judge: "Change the budget, untick a candidate, prioritise the college." | Everything recalculates instantly. At 7:25 say "Back to Steven", Alt+Tab to the deck and hand back. |
| 7:30 | Steven | How it works, Impact, Innovation, Feasibility and Implementation slides (about 30 s each). | Advance the slides. |
| 10:00 | Steven | "Thank you. We're happy to take questions." Thien Gen takes the technical ones. | |

Do the Ara Damansara lookup **once the evening before** in the same browser. It is saved there, and the area dropdown then lists it, so on the day you can pick it instantly if the venue Wi-Fi is slow.

---

## Part D: if something breaks

| Symptom | Fix (say it calmly, keep talking) |
|---|---|
| Map background is blank or grey | No internet. Click **Map layers** → **None**. Buildings, paths and landmarks still draw. |
| AI scan says **MOCK** | Ollama isn't running or the model isn't loaded. Say: "No model is running, so it shows a labelled mock; a person still sets the value." Continue. Afterwards: start Ollama from the Start menu. |
| AI scan takes over 30 s | The first call loads the model. Keep talking; it times out at 60 s and falls back to MOCK. Next time do the warm-up (Part 1, T-25). |
| Wrong area shows | **Area** dropdown → **SS 15, Subang Jaya**, or open `http://localhost:4173/?area=ss15-subang-jaya` |
| Numbers differ from the ◆ values | Someone changed a setting or confirmed an AI edit. Click **1 Map & routes** → **Demo: 2 pm walk…** again: it resets the budget, settings and AI edits. |
| Map stuck in "pick paths" mode | Click **Cancel** in **Place your own** (Plan builder), or switch to another page. |
| App won't load at all | Check both terminals are still running (Part 1). If not: play `pitch/backup-demo.mp4`, or show the appendix screen slides. |

---

## Part E: likely questions (who answers)

| Question | Who | Short answer |
|---|---|---|
| How accurate is the shade? | Thien Gen | Modelled from mapped buildings and the real sun at four times of day. OpenStreetMap has few trees here, so midday shade is understated. The pilot and the AI scan replace estimates with surveyed values, and every number shows its source. |
| Where do the walking numbers come from? | Steven | Station exits are real Prasarana ticket-gate counts on data.gov.my. How they split between places, and bus stop trips, are estimates. A count at the station and the mall is the first thing the pilot adds. |
| Does shade make it cooler or safer? | Steven | We don't claim that. Shade is not comfort or safety. We measure time walked in direct sun. |
| How much would SDP pay? | Steven | The tool runs on open data and a laptop, so its cost is small. The money is the trees and walkways, and Teduh makes sure that money goes where most people walk. Costs are bottom-up estimates; the pilot swaps in real quotes. |
| Why not just plant trees everywhere? | Thien Gen | Budgets are limited. In SS 15, one 69 m walkway does more than several tree rows because it sits on the busiest shared stretch. |
| Can it work on Elmina / Bukit Raja / another township? | Thien Gen | Yes: **Look up a place** builds any area in about 40 seconds. We showed Ara Damansara. |
| What does the AI actually do? | Thien Gen | Two things: it estimates shade from a survey photo, which a person must confirm, and it writes a plain summary of the plan from the numbers on screen. A check rejects any summary that invents a number. It runs locally, or on Claude in the cloud. |
| What's the next step after the hackathon? | Steven | A six-month pilot in one SDP township: survey, build one walkway and some tree rows, measure predicted against observed shade and walker counts. |

## Words to avoid

Never say shade **lowers temperature**, makes a route **safe** or **healthy**, or that the figures are **measurements**. Say "modelled", "estimated", "direct sun avoided".

## Before you submit (23 Oct)

- [ ] Check the names on the cover slide and in the opening line.
- [ ] Add 3–5 **real** resident quotes to `pitch/resident-interviews.md` (and a slide if you have them). Do not invent quotes. Evidence is 10% of the score.
- [ ] Export the deck (PDF or PPTX) from the deck's share/download menu.
- [ ] Upload the 5-minute video (Part A) and the GitHub link.
- [ ] Re-check every ◆ number against the app after any data change.
