# BlinkedIn

website link 
https://blinkedln.netlify.app/

This is your original BlinkedIn codebase (FastAPI + MongoDB backend, React/CRA frontend, AI-agent job crawler).


 `python -m py_compile` on every backend file, a full `pip install` + module import against the patched `server.py` (67 routes registered, no import errors), and a real `yarn install && yarn build` on the frontend (succeeds, only pre-existing lint warnings unrelated to these changes).

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


| Variable | Where to get it | Required for |
|---|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com/settings/keys | AI agents to extract real jobs at all |
| `GOOGLE_CLIENT_ID` (backend + `REACT_APP_GOOGLE_CLIENT_ID` frontend) | console.cloud.google.com/apis/credentials | Google sign-in |
| `MONGO_URL` | Your Mongo instance (local docker, Atlas, or your host's plugin) | Everything — it's the database |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | dashboard.stripe.com/test/apikeys | Payments/subscriptions |
| `RESEND_API_KEY` | resend.com/api-keys | Verification/notification emails |
| `JWT_SECRET` | `openssl rand -hex 32` | Session auth |



