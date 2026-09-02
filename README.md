# Smart Inspect — AI Legal Metrology Compliance Scanner

> **SIH 2026 · Problem Statement 26034 · Ministry of Consumer Affairs, Food & Public Distribution**
> **Department of Consumer Affairs (DoCA) · Category: Software · Theme: Agriculture, FoodTech & Rural Development**

A fully built, production-ready React web + Android mobile application that scans
photos of packaged commodities, extracts printed declarations with AI, visualizes
text/region boundaries on the image, converts the raw OCR text into **structured
JSON**, and grades the product against the **Legal Metrology (Packaged Commodities)
Rules, 2011** — producing a full, clause-cited compliance report with a
**PASS/FAIL grade**.

AI calls are direct browser requests to free-tier cloud APIs (zero backend
required). User accounts and scan history are handled by **Supabase**
(authentication + Postgres + Row-Level Security), so each inspector's reports
sync privately to their profile across devices.

## Quick start

```bash
npm install
npm run dev      # opens http://localhost:5173
npm run build    # production build in /dist
```

> The dev machine only runs Vite + React. No model weights are downloaded locally.

### Android build

```bash
npm run android:sync   # builds + syncs to Capacitor
npm run android        # opens in Android Studio
npm run android:apk    # builds debug APK directly
```

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
2. The default pipeline is **Google Cloud Vision (OCR) → Gemini Flash (structuring)**. Paste:
   - a **Google Vision** API key (enable the Vision API in Google Cloud, then create a
     key — free tier is 1,000 units/month), and
   - a free **Gemini** key from [aistudio.google.com](https://aistudio.google.com/app/apikey),
     or a **Groq** key from [console.groq.com](https://console.groq.com/keys).
3. No keys yet? It still runs: OCR falls back to **OCR.space** (built-in demo key
   `helloworld`, no signup) and structuring falls back to a built-in heuristic parser,
   so you can try the full flow immediately.
4. Go to **New Scan**, upload a label photo (up to 3 panels), hit **Extract & Analyze**,
   review the fields, then **Run compliance check & grade**.

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

- **Multi-panel scan** — upload up to 3 label images (front + back + side) with
  automatic commodity mismatch detection across panels.
- **OCR + boundary overlay** — real OCR with word-level bounding boxes, colour-coded
  key declarations (MRP, net qty, manufacturer, date, consumer care) visualized
  directly on the image.
- **Rule engine** — applicability exclusions (Rule 3), exemptions (Rule 26), all Rule 6
  mandatory declarations, unit/banned-word checks (Rule 13), and Rule 7 font-size
  tables (I & II).
- **Grading** — weighted 0–100 score, A–F letter, PASS/FAIL verdict.
- **Dashboard** — status distribution, grade distribution, top violations, recent scans.
- **History** — searchable/filterable list of every scan, synced to your Supabase account.
- **Report** — full clause-by-clause report, font-size analysis, photographic evidence,
  Print-to-PDF and JSON export.
- **AI Assistant** — context-aware compliance chatbot for Legal Metrology queries.
- **Onboarding** — guided intro flow for first-time users with interactive walkthrough.
- **Auth** — email sign-up/login, forgot password, OTP verification via Supabase.
- **Fully responsive** — collapsible sidebar, mobile-first layouts throughout.
- **Android APK** — native Android build via Capacitor (single codebase).

## AI pipeline (multi-stage, multi-fallback)

The app ships with a **triple-fallback pipeline** at every stage — it never fails:

### Stage 1 — OCR (Text + Word-Level Bounding Boxes)

| Priority | Tool | Notes |
|---|---|---|
| **Primary** | **Google Cloud Vision** (`DOCUMENT_TEXT_DETECTION`) | Best accuracy; returns block/paragraph/word polygons for boundary overlay. Free tier 1,000 units/month. |
| **Fallback** | **OCR.space API** (Engine 2) | Automatic fallback when no Vision key is set. Demo key `helloworld` included — zero signup. |

### Stage 2 — LLM Structuring (Raw Text → Structured JSON)

| Priority | Tool | Notes |
|---|---|---|
| **Primary** | **Google Gemini 3.6 Flash** | Free tier, strict JSON mode via [aistudio.google.com](https://aistudio.google.com/app/apikey). |
| **Fallback 1** | **Groq** (`groq/compound` / `llama-3.3-70b`) | Free, extremely fast. Via [console.groq.com](https://console.groq.com/keys). |
| **Fallback 2** | Built-in **heuristic parser** | Regex-based; works offline with zero API keys. |

### Deterministic Rule Engine (Zero AI)

Everything after extraction (the compliance verdict and grade) is **deterministic** —
no AI. The engine in `src/lib/ruleEngine.js` encodes the complete PCR 2011:

- **Rule 3** — applicability exclusions (bulk > 25 kg/L, industrial/institutional)
- **Rule 6** — all 8 mandatory declarations (manufacturer, generic name, net quantity, MRP, mfg date, consumer care, country of origin, dimensions)
- **Rule 7** — font size Tables I & II (by weight/volume and by PDP area)
- **Rule 13** — SI unit enforcement, banned count words (dozen/score/gross)
- **Rule 18** — MRP format ("inclusive of all taxes")
- **Rule 26** — exemptions (ultra-small ≤ 10 g/ml, partial 10–20 g/ml)

### Infrastructure

| Purpose | Tool | Notes |
|---|---|---|
| **Auth + DB** | **Supabase** free tier (Postgres + Auth + RLS) | Powers login and per-user scan history via `src/lib/db.js`. |
| **Mobile** | **Capacitor** | Wraps the web app as a native Android APK. |
| **Hosting** | **Vercel / Netlify / GitHub Pages** free tier | Static SPA, one-click deploy. |

## Project structure

```
src/
  lib/
    aiService.js       # Vision / OCR.space / Gemini / Groq adapters + orchestrator
    chatService.js     # AI Assistant chat pipeline
    ruleEngine.js      # deterministic PCR-2011 validator (the legal brain)
    grading.js         # score / letter grade / PASS-FAIL
    db.js              # Supabase-backed scan persistence (per-user, RLS)
    supabase.js        # Supabase client initialization
    platform.js        # web vs native platform detection
    native.js          # Capacitor native bridge (splash screen, keyboard, etc.)
    onboarding.js      # first-launch routing logic
    replyShape.js      # chat response formatting utilities
  context/
    AuthContext.jsx    # auth provider (Supabase session management)
    SettingsContext.jsx # API keys + pipeline settings (localStorage)
  components/
    ChatWidget.jsx     # floating AI assistant chat widget
    ChatMessage.jsx    # chat message rendering with markdown
    ImageAnnotator.jsx # boundary overlay on scanned images
    Skeleton.jsx       # loading skeletons for all pages
    OtpInput.jsx       # OTP verification input component
    ProtectedRoute.jsx # auth guard for protected routes
    ui.jsx             # shared badges, stats, status indicators
  pages/
    Landing.jsx        # marketing landing page (web)
    Onboarding.jsx     # first-launch intro walkthrough (mobile)
    Login.jsx          # email + password login
    Signup.jsx         # registration with email verification
    ForgotPassword.jsx # password reset request
    ResetPassword.jsx  # password reset form
    Dashboard.jsx      # compliance analytics dashboard
    Scan.jsx           # multi-panel image upload + OCR + review
    HistoryPage.jsx    # searchable scan history list
    Report.jsx         # full compliance report viewer
    Assistant.jsx      # full-page AI compliance assistant
    Settings.jsx       # API key configuration + pipeline settings
  data/
    rulesEngine.json   # complete PCR 2011 rules config (351 lines)
```

## Future enhancements

The core compliance pipeline is fully functional. The following planned
enhancements extend the system's capabilities:

### 📏 OpenCV Auto Font-Size Measurement (Rule 7)

The rule engine already validates font sizes against Rule 7 Tables I & II when
a measured height is provided. The next step is **automating the measurement**:

- **OpenCV contour analysis** to detect numeral characters on the label image
  and measure their pixel height automatically.
- **Pixel-to-mm conversion** using known-dimension reference markers (e.g.
  a coin or ruler placed beside the product in the photo).
- This will fully automate Rule 7 compliance checking without any manual input,
  completing the readability/font-size requirement from the problem statement.

### 🎯 YOLOv8-Nano Label Panel Auto-Crop

- Train a lightweight YOLOv8-nano model on Google Colab (free GPU) to detect
  and crop specific label regions: MRP panel, net quantity block, manufacturer
  address block.
- Host on HuggingFace Spaces or Roboflow (free tier) for inference.
- Feeds cropped regions into OCR for targeted, high-accuracy extraction of
  critical declarations.

### 🌐 Regional Language OCR

- Extend OCR support to **Hindi (Devanagari)**, Tamil, Telugu, Bengali, and
  other regional scripts commonly found on Indian product labels.
- Leverage Google Vision's multilingual capabilities and Gemini's multilingual
  understanding for structured extraction from non-English labels.
- Rule 8 requires declarations in Hindi or English — this enhancement enables
  validation of Hindi-language declarations.

### 🔗 IoT & Barcode Integration

- **GTIN/barcode scanning** to cross-reference scanned products against
  centralised product databases for auto-populated field validation.
- Integration with weighing scales and IoT sensors for physical net-quantity
  verification against the Maximum Permissible Error tables (Rule 22,
  First Schedule).

### 📱 iOS Deployment

- Capacitor-based iOS build from the same React codebase — zero additional
  development needed, just platform configuration and App Store submission.

## Notes

- API keys are stored **only** in your browser's localStorage and sent **directly** to
  the chosen provider — nothing passes through any server of ours.
- The rule engine is an **engineering aid, not a legal opinion** — always cross-check
  against the current Gazette notification.
- Problem Statement dataset: https://consumeraffairs.gov.in/pages/legal-metrology-act
