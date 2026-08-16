# BlinkedIn

This is your original BlinkedIn codebase (FastAPI + MongoDB backend, React/CRA frontend, AI-agent job crawler) with every dependency on Emergent's hosted infrastructure removed and replaced with the direct equivalent. Same architecture, same features — it just talks to real services under your own accounts now instead of through Emergent's proxies.

## What changed, and why

| Was | Now |
|---|---|
| AI job extraction via `emergentintegrations` + `EMERGENT_LLM_KEY` (Emergent's LLM proxy) | Direct `anthropic` Python SDK call using your own `ANTHROPIC_API_KEY` |
| Google sign-in via redirect to `auth.emergentagent.com` (Emergent's managed OAuth) | Direct Google Identity Services — a real Google Client ID, ID token verified server-side against Google's own public keys |
| ~500 randomly-generated fake jobs seeded on startup, and silent fake-job fallback whenever a real scrape came back empty (including one endpoint, `/admin/job-urls/{id}/fetch`, that was **pure mock with no real fetch at all**) | All of that is now gated behind `ALLOW_MOCK_JOBS=false` (default off). A real deployment shows real jobs or nothing — never a fabricated posting. The `/fetch` endpoint now does a real fetch + AI-extract, same as `/ai-scrape`. |
| Frontend pointed at `job-crawler-hub.preview.emergentagent.com` | Configurable via `REACT_APP_BACKEND_URL` |
| `@emergentbase/visual-edits` dev dependency (Emergent's in-browser visual editor) | Removed — the build already degraded gracefully without it |

Nothing about the actual product logic changed: the same AI-agent system (one agent per company career-page URL, re-scraped on a schedule, each with its own editable system prompt — that's the "training" in the admin UI), the same referral/reward/withdrawal logic, the same admin panel, the same Stripe/Resend integrations.

I verified this: `python -m py_compile` on every backend file, a full `pip install` + module import against the patched `server.py` (67 routes registered, no import errors), and a real `yarn install && yarn build` on the frontend (succeeds, only pre-existing lint warnings unrelated to these changes).

## Architecture, unchanged

```
React (CRA/craco) ──HTTP──▶ FastAPI ──▶ MongoDB
                                │
                                ├──▶ Anthropic API (job extraction)
                                ├──▶ Google OAuth (sign-in)
                                ├──▶ Stripe (payments)
                                └──▶ Resend (email)

Background: an asyncio loop inside the FastAPI process wakes up every
~30s, finds "due" agents (one per company URL), fetches the real career
page, sends the HTML to Claude for extraction, and inserts any genuinely
new postings — deduped by company+role — into MongoDB. Each agent re-runs
every 5 minutes by default. This loop is what makes agents "stay active."
```

## Run it locally

**1. Start MongoDB:**
```bash
docker compose up -d mongo
```

**2. Backend:**
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env: set ANTHROPIC_API_KEY at minimum. GOOGLE_CLIENT_ID/Stripe/Resend
# are optional — the app boots and runs without them, those features just
# no-op with a clear error until you add real keys.
uvicorn server:app --reload --port 8000
```

**3. Frontend** (new terminal — this project uses **yarn**, not npm; there's a `resolutions` field in `package.json` that only yarn honors, and the committed `yarn.lock` pins working versions):
```bash
cd frontend
yarn install
cp .env.example .env
# edit .env: REACT_APP_BACKEND_URL=http://localhost:8000
yarn start
```

Open `http://localhost:3000`. Log in as `admin@blinkedinjobs.co` with whatever `ADMIN_PASSWORD` you set in `backend/.env`.

## Bringing in real jobs — how "training" the agents works

1. Sign in as admin → **Admin** page → **Job URLs** (or wherever your build's `AgentTrainer.jsx`/`Admin.jsx` UI exposes this — same as before, untouched).
2. Add a company + its real careers page URL (e.g. `https://stripe.com/jobs`, or better, a company that runs a public ATS API like Greenhouse/Lever — those return clean structured data instead of a full rendered page, so Claude has an easier time extracting from them).
3. This auto-creates an **agent** for that URL, which starts running immediately on the 5-minute schedule.
4. To "train" it: open the agent, edit its **system prompt** / **training notes** (the `/admin/agents/{id}/instructions` endpoint) — e.g. "This company's job titles all start with a level prefix like L4/L5, strip that when extracting `role`" or "ignore anything under the 'Internships' section." Hit **Test** to dry-run the current instructions against a live fetch before saving.
5. Watch the **Admin → Agents** view for `health`, `run_count`, `last_added`, `last_error` per agent — that's your visibility into whether a given company's page is actually yielding jobs.

Realistic expectations: Claude extracting jobs from raw HTML works well for pages with visible job listings in the initial HTML. Pages that render job lists client-side via JavaScript (common on modern React/Vue career sites) will return an HTML shell with no jobs in it — `httpx` doesn't execute JavaScript. If you hit that a lot, the fix is swapping the plain `httpx.get()` in `_run_agent_once`/`_ai_extract_jobs`'s caller for a headless-browser fetch (Playwright), which is a real code change beyond what's here — flag it if you want me to build that next.

## Deploying: Netlify + a real backend host

**Important constraint, stated plainly:** Netlify can only host the **frontend**. This backend has a persistent `asyncio` loop that must keep running to poll agents on schedule, plus a live MongoDB connection — that needs an always-on process. Netlify's serverless functions are short-lived and stateless by design; they architecturally cannot run a background scheduler. So:

- **Frontend → Netlify.** `netlify.toml` is already set up (`yarn build`, publishes `build/`, SPA redirect included). Connect your repo, or drag-and-drop the `frontend/build` folder. Set `REACT_APP_BACKEND_URL` and `REACT_APP_GOOGLE_CLIENT_ID` as Netlify environment variables (Site settings → Environment variables) before building.
- **Backend → Railway, Render, Fly.io, or a small VPS.** All of these run a persistent process. `backend/Dockerfile` is ready for any of them:
  - **Railway/Render:** connect the repo, point it at `backend/`, they'll build the Dockerfile and inject `$PORT` automatically. Add a MongoDB instance (Railway has a one-click Mongo plugin; otherwise use MongoDB Atlas's free tier) and set `MONGO_URL` to it. Add the rest of `.env`'s variables in their dashboard.
  - **VPS:** `docker build -t blinkedin-backend backend/ && docker run -d -p 8000:8000 --env-file backend/.env blinkedin-backend`, put Caddy/nginx in front for HTTPS.
- Once the backend has a real public URL, update the frontend's `REACT_APP_BACKEND_URL` to point at it (and `FRONTEND_URL`/`PUBLIC_APP_URL` in the backend's env to point at your real Netlify domain — CORS and email links depend on that being correct).
- Update your Google OAuth Client ID's **Authorized JavaScript origins** to include your real Netlify domain, or Google will reject the sign-in.

## Environment variables that need real values

| Variable | Where to get it | Required for |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com/settings/keys | AI agents to extract real jobs at all |
| `GOOGLE_CLIENT_ID` (backend + `REACT_APP_GOOGLE_CLIENT_ID` frontend) | console.cloud.google.com/apis/credentials | Google sign-in |
| `MONGO_URL` | Your Mongo instance (local docker, Atlas, or your host's plugin) | Everything — it's the database |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | dashboard.stripe.com/test/apikeys | Payments/subscriptions |
| `RESEND_API_KEY` | resend.com/api-keys | Verification/notification emails |
| `JWT_SECRET` | `openssl rand -hex 32` | Session auth |

Everything else in `.env.example` has a working default or is optional.

## What I did not change

Payments (Stripe), email (Resend), the referral/reward math, the admin panel, and the whole React UI are untouched — they were never coupled to Emergent. The only things that had a hard dependency on Emergent's infrastructure were the LLM calls and Google auth, both now direct.
