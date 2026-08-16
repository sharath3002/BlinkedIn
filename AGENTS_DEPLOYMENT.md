# Running the AI job-tracking agents — locally and on AWS

## How the agent system actually works (recap)

For each career URL you register, the backend keeps one **agent** record. A background
loop inside the FastAPI process (`_agent_scheduler`) wakes up every 30s, finds agents
that are due, and re-runs them:

1. **Fetch** the page — `_fetch_career_page_html()` tries a plain HTTP GET first; if the
   page looks like an empty JS shell (common for React/Angular/Workday career sites,
   e.g. Google Careers), it falls back to a headless Chromium render via Playwright, so
   it works on **any** URL, static or JS-rendered.
2. **Extract** — the raw HTML is sent to Claude with a structured prompt asking for
   role, location, experience, description, apply_url, and posted_date.
3. **Filter + sort** — `_filter_and_sort_jobs()` applies your per-agent location filter
   and recency setting, then sorts newest-first.
4. **Dedup + insert** — new roles get written to `db.jobs`; your frontend reads from
   there, so new postings just appear.
5. Repeats every `AGENT_INTERVAL_SECONDS` (default 300s = 5 min) per agent.

This means the "sensing" is really **frequent polling + diffing**, dressed up as an
agent — there's no way to get true push notifications unless the career site itself
offers a webhook or RSS feed (most don't). 5 minutes is a reasonable, polite interval;
going much faster risks IP rate-limiting or ToS issues with the target site.

**Important architectural point:** the scheduler is a background `asyncio` task living
inside the same long-running process as the API. This is why it must run somewhere
that keeps a process alive continuously — **not** AWS Lambda (which is
request-driven/ephemeral and won't run background loops between invocations).
ECS Fargate, EC2, or App Runner all work fine because they run your container 24/7.

---

## Running locally

Nothing changes from your existing setup, with two additions:

```bash
cd backend
pip install -r requirements.txt
playwright install --with-deps chromium   # one-time, downloads headless Chromium
```

Make sure `backend/.env` has:
```
ANTHROPIC_API_KEY=sk-ant-...
AGENT_INTERVAL_SECONDS=300
AGENT_SCHEDULER_TICK_SECONDS=30
```

Then same as before:
```bash
docker-compose up -d        # spins up Mongo
uvicorn server:app --reload --port 8000
```

Add a career URL via the Admin → "Job URL tracker" panel — you can now also set a
**location filter** (e.g. "Bangalore" or leave blank for any) and toggle **recent
postings only**. The agent auto-created for it starts polling within 30s.

---

## Deploying to AWS

The simplest path that keeps the background scheduler alive and needs no code
changes beyond what's above:

### Option A — ECS Fargate (recommended)

1. **Container registry**: push the existing `backend/Dockerfile` image to **ECR**.
   ```bash
   aws ecr create-repository --repository-name blinkedin-backend
   docker build -t blinkedin-backend backend/
   docker tag blinkedin-backend:latest <account>.dkr.ecr.<region>.amazonaws.com/blinkedin-backend:latest
   aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
   docker push <account>.dkr.ecr.<region>.amazonaws.com/blinkedin-backend:latest
   ```
2. **Database**: use **MongoDB Atlas** (free/shared tier works fine, and it's the same
   connection string locally and in AWS — no code changes) rather than standing up
   DocumentDB, unless you specifically need DocumentDB's VPC-only setup.
3. **Secrets**: store `ANTHROPIC_API_KEY`, `MONGO_URL`, `JWT_SECRET`, etc. in **AWS
   Secrets Manager** or **SSM Parameter Store**, and reference them as `secrets` in
   the ECS task definition (not plain environment variables).
4. **Task definition**: one container, the image above. Playwright's Chromium needs
   real CPU/memory headroom when rendering JS-heavy pages — give the task at least
   **1 vCPU / 2GB memory** (Fargate size class `1024/2048` or higher) so renders
   don't get OOM-killed.
5. **Service**: run it as an ECS **Service** (not a one-off Task) with `desiredCount: 1`
   (or more, but see the note on duplicate agent runs below) — this is what keeps the
   scheduler loop alive continuously, restarting it if the container crashes.
6. **Networking**: put it behind an **Application Load Balancer** if you want a stable
   HTTPS endpoint for your frontend to call.

### Option B — Single EC2 instance (cheapest / simplest)
Just `docker-compose up -d` on an EC2 box (t3.medium or larger, since Chromium
rendering needs some memory), same as local. Good for a first deploy or low traffic;
less resilient than Fargate (no auto-restart across AZs).

### Avoid AWS Lambda for this specific component
Lambda would work fine for stateless request/response endpoints, but **not** for the
background scheduler loop — Lambda functions don't keep running between invocations,
so `_agent_scheduler`'s `while True: ... sleep(30)` loop would simply stop. If you
want a serverless-only setup, you'd need to replace the in-process scheduler with
**EventBridge Scheduler → Lambda** (one Lambda invocation per agent run, triggered on
a cron), which is a bigger refactor than what's needed right now — the ECS/EC2 path
matches your existing code as-is.

### Running more than one instance
If you scale the ECS service to >1 task, each instance will spin its own copy of the
scheduler loop and could double-run the same due agents. For now keep `desiredCount: 1`;
if you need horizontal scaling later, add a simple Mongo-based lock (e.g. a
`locked_until` field checked/set atomically via `find_one_and_update`) so only one
instance claims a given agent per tick.

---

## Frontend (Netlify config already present)
No changes needed — it already builds via `netlify.toml`. Point its API base URL env
var at your ECS/EC2 backend's public URL (or ALB DNS name) instead of localhost.
