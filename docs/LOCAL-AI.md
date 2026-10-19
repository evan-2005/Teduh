# Running the AI features on a local model

Goal: run the **AI shade scan** (photo → shade estimate) and the **plan explainer** (plan numbers → short summary) on Evan's laptop, without a cloud API key. The current server only talks to Claude (`server/claude.ts`); without `ANTHROPIC_API_KEY` it returns labelled MOCK results.

Hardware: **RTX 4050 Laptop GPU (6 GB VRAM)**, Intel i7, Windows 11.

- Part 1 is for Evan: install and test a local model (about 20 minutes, mostly downloading).
- Part 2 is the brief to give another Claude session to change the code.

---

## Part 1 — Set up the local model (Evan)

### 1. Pick a model that fits 6 GB
The shade scan needs a **vision** model (it reads a photo), and the explainer only needs text. One small vision model can do both.

| Model (Ollama name) | Download | Fits 6 GB? | Notes |
|---|---|---|---|
| `gemma3:4b` | ~3.3 GB | Yes, comfortably | **Recommended start.** Vision + text, good at following JSON instructions. |
| `qwen2.5vl:3b` | ~3.2 GB | Yes | Strong at reading images; try it if gemma's shade estimates look poor. |
| `qwen2.5vl:7b` | ~6 GB | Barely | Better quality, but will partly spill to the CPU and slow down. |
| `llama3.2-vision` (11B) | ~8 GB | No | Too big for 6 GB; very slow. Skip. |

Model names change often. Check https://ollama.com/library (filter by "vision") for the current small vision models before pulling.

### 2. Install
1. Update the NVIDIA driver (GeForce Experience or nvidia.com). Ollama needs a recent driver to use the GPU.
2. Install **Ollama for Windows** from https://ollama.com/download and run it. It runs in the system tray and serves an API on `http://localhost:11434`.
3. Plug the laptop into power and set Windows to "Best performance". On battery, laptop GPUs throttle hard.

### 3. Download and test
Run these in a terminal:

```bash
ollama pull gemma3:4b
```
```bash
ollama run gemma3:4b "In one sentence, what is a covered walkway?"
```

Then test vision with any street photo (use the real path to your photo):

```bash
ollama run gemma3:4b "How much of the walking surface in this photo is in shade, as a fraction from 0 to 1? Reply with JSON only. ./street.jpg"
```

While it answers, check it is on the GPU:

```bash
ollama ps
```

The `PROCESSOR` column should say `100% GPU`. If it says CPU or a split, close other GPU apps (games, Chrome video, OBS) or use a smaller model.

Rough speed to expect on an RTX 4050 with a 4B model: the first request takes 10–30 s while the model loads, then about 3–10 s per photo. Text summaries take a few seconds.

### 4. Settings the code change will use
After Part 2 is done, add these to `.env` (never with a `VITE_` prefix):

```
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma3:4b
```

`AI_PROVIDER=anthropic` (or leaving `AI_PROVIDER` unset with an `ANTHROPIC_API_KEY`) keeps today's Claude behaviour. With neither, the server stays in mock mode.

### 5. Before a live demo
- Warm the model up 5 minutes before going on stage (run one scan), so the first request is not slow. Ollama unloads idle models after 5 minutes; set the environment variable `OLLAMA_KEEP_ALIVE=1h` (Windows: System → Environment Variables, then restart Ollama) to keep it loaded.
- Keep mock mode as the fallback: if Ollama is not running, the app still works and labels results MOCK.

---

## Part 2 — Brief for Claude: add a local-model provider

> Copy everything below this line into a new Claude Code session opened in this repository.

**Task:** let the AI server use a local model through **Ollama** as well as Claude, chosen by environment variables, without changing what the browser sees except an honest label.

**Read first:** `README.md` §0 (house rules: functions < 50 lines, files < 400 lines, immutable updates, no `console.log`, named constants, never claim temperature/health/safety benefits, do not commit), `server/app.ts`, `server/claude.ts`, `server/app.test.ts`, `server/index.ts`, `src/features/ai-scan/schemas.ts`, `src/features/ai-scan/ShadeScanPanel.tsx`, `src/features/ai-scan/PlanExplainer.tsx`, `.env.example`.

**Constraints**
- **No new npm dependencies.** Call Ollama's REST API with `fetch` (Node 20+ has it). Ask before adding anything.
- Keep every current safety net. Validate model output with the existing zod schemas (`shadeScanBodySchema`). Fall back to the labelled mock result on a missing server, a timeout, an HTTP error or invalid JSON. Never crash, and keep the key and model settings server-side only.
- Keep the human-confirm step for scans unchanged.

**Design**
1. Add a provider interface in `server/ai.ts`:
   ```ts
   export interface AiProvider {
     name: string; // e.g. "Claude" or "Local model (gemma3:4b)", shown in the UI
     scanShade(image: { base64: string; mediaType: ImageMediaType }, segmentId: string, time: TimeSlot): Promise<ShadeScanResult>;
     explainPlan(plan: ExplainRequest): Promise<ExplainResponse>;
   }
   ```
   Wrap the existing Claude code (`server/claude.ts`) as one implementation, unchanged in behaviour. Reuse `mockShadeResult`, `templateSummary`, `planFacts`, `extractJson` and the prompts. Move shared prompts into a small `server/prompts.ts` if that keeps files short.
2. Add `server/ollama.ts`, implementing `AiProvider` against `POST {OLLAMA_URL}/api/chat`:
   - **Scan:** `{ model, stream: false, messages: [{ role: 'user', content: SHADE_PROMPT, images: [base64] }], format: <JSON schema for shadeScanBodySchema>, options: { temperature: 0 } }`. Ollama's `format` field accepts a JSON schema and constrains the output to it; still validate with zod afterwards. Generate the schema with zod's `z.toJSONSchema(shadeScanBodySchema)` (zod v4 is installed), or write it by hand if that output does not suit Ollama.
   - **Explainer:** same endpoint, no images, with `EXPLAIN_SYSTEM` as a system message and `planFacts(plan)` as the user message.
   - **Timeout:** use `AbortSignal.timeout(...)` with a named constant of about 60 s, since the first call loads the model.
   - Pass the photo's time slot into the prompt (the Claude path ignores it today, which is item 23 in `docs/IMPROVEMENTS.md`).
3. Pick the provider in `server/index.ts` from env: `AI_PROVIDER=ollama` uses Ollama (`OLLAMA_URL` defaults to `http://localhost:11434`, `OLLAMA_MODEL` defaults to `gemma3:4b`). Otherwise use Claude when `ANTHROPIC_API_KEY` is set, else mock. Log the chosen mode once at startup, like today.
   - `createApp` should take `getProvider: () => AiProvider | null` instead of `getClient`, and keep the existing tests working by adapting them.
4. **Guard against banned claims.** Small local models drift more than Claude. If an explanation mentions temperature, cooler or cooling, health, healthy, safe or safety, fall back to `templateSummary`. Put the word list in one named constant and test it.
5. **Honest label in the UI.** Add an optional `source?: string` (provider name) to the scan and explain responses: extend the zod response schemas in `schemas.ts`, and add the field to `ShadeScanResult` in `src/types.ts` (a shared contract change; mention it in the summary). Show it in small text next to the estimate, e.g. "Estimated by a local model (gemma3:4b)". MOCK and template badges stay as they are.
6. **Optional speed-up, no dependency:** in `ShadeScanPanel`, downscale the photo in the browser to about 1024 px on the long side with a `<canvas>` before upload. Small models run faster on smaller images.

**Tests (Vitest, write them first)**
- `server/ollama.test.ts` with a fake `fetch`:
  - valid JSON → parsed result with `isMock: false` and `source` set;
  - invalid JSON or out-of-range `shadeFraction` → mock;
  - HTTP 500 → mock;
  - network error (Ollama not running) → mock with a reason that says Ollama is not reachable;
  - timeout → mock;
  - the request body includes the image, the model name and a `format` schema.
- Explainer: valid text → summary; a reply containing "cooler" → template fallback; Ollama down → template.
- Provider selection from env: `ollama`, Claude key, neither.
- Existing `server/app.test.ts` still passes after the `getProvider` change.

**Docs**
- `.env.example`: add `AI_PROVIDER`, `OLLAMA_URL`, `OLLAMA_MODEL` with comments.
- `README.md` quick start: one paragraph pointing to `docs/LOCAL-AI.md`.
- `pitch/demo-script.md` 2:20 step and `BRIEF.md`: say "a vision model (Claude in the cloud, or a small open model running on the laptop)" instead of only "Claude vision". Do not change any ◆ numbers.

**Done when**
- `npm run test && npm run build` pass.
- With Ollama running and `AI_PROVIDER=ollama`, `npm run dev:server` logs the local model. A scan in the app returns a non-mock estimate labelled with the local model, and Confirm applies it to the map.
- With Ollama stopped, the scan returns a MOCK result with a clear reason, and nothing crashes.
- `npm run screenshots` (both dev servers running) still passes every check.
- Finish with a summary: what changed, anything skipped, the `src/types.ts` change, and a suggested conventional-commit message. Do not commit.

**Expectations to state honestly in the pitch:** a 4B local model is less accurate at judging shade than Claude. That is acceptable here because every estimate is reviewed and adjusted by a person before it reaches the map. The benefits are no per-call cost and no photos leaving the laptop.
