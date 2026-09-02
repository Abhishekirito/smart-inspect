# Smart Inspect — AI Legal Metrology Compliance Scanner

A responsive React web app that scans photos of packaged commodities, extracts the
printed declarations with AI, visualizes text/region boundaries on the image,
converts the raw OCR text into **structured JSON**, and grades the product against
the **Legal Metrology (Packaged Commodities) Rules, 2011** — producing a full,
clause-cited compliance report with a **PASS/FAIL grade**.

Built for SIH 2026 "Smart Inspect". AI calls are direct browser requests to
free-tier cloud APIs; user accounts and scan history are handled by **Supabase**
(authentication + Postgres), so each inspector's reports sync privately to their
profile across devices.

## Quick start

```bash
npm install
npm run dev      # opens http://localhost:5173
npm run build    # production build in /dist
```

> The dev machine only runs Vite + React. No model weights are downloaded locally.

## Supabase setup (auth + database) — required for login

The app requires a logged-in user. Auth and scan storage run on Supabase.

**1. Create a project** at [supabase.com](https://supabase.com) → *New project*. Pick a
name, a strong database password, and a region close to you. Wait for it to provision.

**2. Copy your API credentials** — *Project Settings → API*:
- **Project URL** → `VITE_SUPABASE_URL`
- **anon / public key** → `VITE_SUPABASE_ANON_KEY` (safe to ship in a browser app;
  the `service_role` key must stay secret — never put it in this frontend)

Add them to `.env` (copy `.env.example` if you haven't):

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key
```

**3. Create the `scans` table + security policies.** Open *SQL Editor* in the
Supabase dashboard, paste the following, and run it:

```sql
-- Compliance scans, one row per report, owned by the user who created it.
create table if not exists public.scans (
  id             text primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  product_name   text,
  overall_status text,
  grade          text,
  data           jsonb not null
);

create index if not exists scans_user_created_idx
  on public.scans (user_id, created_at desc);

-- Row-level security: each user can only see and modify their own scans.
alter table public.scans enable row level security;

create policy "own scans - select" on public.scans
  for select using (auth.uid() = user_id);
create policy "own scans - insert" on public.scans
  for insert with check (auth.uid() = user_id);
create policy "own scans - update" on public.scans
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own scans - delete" on public.scans
  for delete using (auth.uid() = user_id);
```

**4. Configure auth** — *Authentication → Providers → Email*: enable it (on by
default). For quick local testing you can turn **"Confirm email" off** so sign-up
logs you straight in; leave it **on** for production and the app will show a
"check your inbox" screen after sign-up. Under *Authentication → URL Configuration*,
add your dev/prod origins (e.g. `http://localhost:5173`) to the redirect allow-list.

**5. Restart the dev server** so Vite picks up the new `.env`, then open the app,
sign up, and run a scan — it will be stored in the `scans` table under your user.

> Scan images are embedded in the `data` JSON as data URLs. For heavy usage, move
> them to Supabase **Storage** and keep only the object path in the row.


## First-run setup

1. Open **Settings**.
2. The default pipeline is **Google Cloud Vision (OCR) → Groq (structuring)**. Paste:
   - a **Google Vision** API key (enable the Vision API in Google Cloud, then create a
     key — free tier is 1,000 units/month), and
   - a free **Groq** key from [console.groq.com](https://console.groq.com/keys).
3. No keys yet? It still runs: OCR falls back to **OCR.space** (built-in demo key
   `helloworld`, no signup) and structuring falls back to a built-in heuristic parser,
   so you can try the full flow immediately.
4. Go to **New Scan**, upload a label photo, hit **Extract & Analyze**, review the
   fields, then **Run compliance check & grade**.

> Keys live in the browser. Restrict the Vision key to the Vision API + your site's
> referrer in the Google Cloud console; proxy both keys through a backend for production.

## How it works (pipeline)

```
Image ─▶ OCR (raw text + word bounding boxes)
      ─▶ LLM structuring (raw text ─▶ strict JSON of declared fields)
      ─▶ Human-in-the-loop review/correction
      ─▶ Deterministic Rule Engine (PCR 2011) ─▶ pass/fail per field + clause ref
      ─▶ Grade (0–100, A–F, PASS/FAIL) + Report + Dashboard/History
```

The **AI only extracts text**; it never makes the legal decision. Every verdict comes
from the deterministic engine in `src/lib/ruleEngine.js` and cites the exact rule
(e.g. *Rule 6(1)(e)* for MRP), so each report line is auditable and defensible.

## Features

- **Scan** — upload, real OCR, image boundary overlay (word boxes + colour-coded key
  declarations: MRP, net qty, manufacturer, date, consumer care), raw text panel,
  editable structured JSON.
- **Rule engine** — applicability exclusions (Rule 3), exemptions (Rule 26), all Rule 6
  mandatory declarations, unit/banned-word checks (Rule 13), and Rule 7 font-size
  tables (I & II).
- **Grading** — weighted 0–100 score, A–F letter, PASS/FAIL verdict.
- **Dashboard** — status distribution, grade distribution, top violations, recent scans.
- **History** — searchable/filterable list of every scan, synced to your Supabase account.
- **Report** — full clause-by-clause report, font-size analysis, photographic evidence,
  Print-to-PDF and JSON export.
- **Fully responsive** — collapsible sidebar, mobile-first layouts throughout.

## Suggested FREE AI tools for this project

The app ships with a **two-AI pipeline** — that's all you need:

| Purpose | Tool | Why / notes |
|---|---|---|
| **OCR + word bounding boxes** *(primary)* | **Google Cloud Vision** (`DOCUMENT_TEXT_DETECTION`) | Best-accuracy OCR; returns block/paragraph/word polygons that feed the boundary overlay. Free tier 1,000 units/month (billing must be enabled), then ~$1.50/1,000. Wired in `aiService.js`. |
| **Raw text → structured JSON** *(primary)* | **Groq** (`llama-3.3-70b-versatile`) | Free, extremely fast JSON mode via [console.groq.com](https://console.groq.com/keys). Turns Vision's text into the field schema. Wired in. |
| **OCR fallback (no signup)** | **OCR.space API** (Engine 2) | Automatic fallback when no Vision key is set. Demo key `helloworld` included. |
| **Structuring fallback (no key)** | Built-in **heuristic parser** | Regex-based; keeps the demo working offline of any LLM. |

Everything after extraction (the compliance verdict and grade) is **deterministic** —
no AI. Optional, non-LLM add-ons if you want them later:

| Purpose | Tool | Why / notes |
|---|---|---|
| **Font-size measurement (Rule 7)** | **OpenCV** (CPU, open-source) | Measure numeral pixel height, convert to mm via a known-size reference marker. Not an AI model. The app already accepts a measured height manually. |
| **Auto-crop label panels (optional)** | **YOLOv8-nano** trained on **Google Colab** free GPU, hosted on **HF Spaces** / **Roboflow** free tier | Only needed if you want automatic MRP/net-qty region cropping — Vision's word polygons already suffice for the prototype. |
| **Auth + DB (in use)** | **Supabase** free tier (Postgres + Auth, optional Storage) | Powers login and per-user scan history via `src/lib/db.js` + RLS. See *Supabase setup* above. |
| **Hosting** | **Vercel / Netlify / GitHub Pages** free tier | Static SPA, one-click deploy. |

Paid options (AWS Textract, GPT-4o, Azure Form Recognizer) are only for high-volume
production accuracy — not for the prototype or demo.

## Project structure

```
src/
  lib/
    aiService.js    # OCR.space / Gemini / Groq adapters + orchestrator + heuristic fallback
    ruleEngine.js   # deterministic PCR-2011 validator (the legal brain)
    grading.js      # score / letter grade / PASS-FAIL
    db.js           # Supabase-backed scan persistence (per-user, RLS)
  context/SettingsContext.jsx   # provider + API keys (localStorage)
  components/       # ui.jsx (badges/stats), ImageAnnotator.jsx (boundary overlay)
  pages/            # Dashboard, Scan, HistoryPage, Report, Settings
  data/rulesEngine.json         # the rules config that drives the engine
```

## Notes

- API keys are stored **only** in your browser's localStorage and sent **directly** to
  the chosen provider — nothing passes through any server of ours.
- The rule engine is an **engineering aid, not a legal opinion** — always cross-check
  against the current Gazette notification.
