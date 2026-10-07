# BlinkedIn

**Live:** [https://blinkedln.netlify.app/](https://blinkedln.netlify.app/)

A job board that doesn't wait for companies to post to a third-party aggregator.
BlinkedIn runs AI agents against companies' own career pages, pulls new openings
as they go live, and routes candidates through employees who already work there -
so a referral isn't a cold favor, it's a tracked, paid transaction.

<img width="329" height="114" alt="image" src="https://github.com/user-attachments/assets/539d0255-2d4f-4f39-b506-cbefdf2eb486" />

---

## The problem this solves

Most job boards are stale by the time you see them, and most "ask your network
for a referral" advice goes nowhere because there's no system behind it - no
tracking, no accountability, no payout. BlinkedIn fixes both halves at once:
jobs stay current because agents watch the source directly, and referrals stay
honest because every submission, verification, and payout is logged.

---

## How a job actually gets onto the site

Each tracked company has one agent, running on its own 5-minute cycle:

```
   career page URL
         │
         ▼
   ┌─────────────┐     thin / JS-only page?       ┌──────────────────┐
   │ plain fetch │ ───────────────────────────▶  │ headless browser  │
   └─────────────┘                                │ (renders real JS, │
         │                                        │ optionally plays  │
         │ page has content                       │ back a recorded   │
         ▼                                        │ filter/sort       │
   ┌─────────────┐                                │ sequence first)   │
   │   Claude     │ ◀──────────────────────────── └──────────────────┘
   │  extracts    │
   │  structured  │
   │  job data    │
   └──────┬───────┘
          │ role, location, posted date, apply link
          ▼
   ┌─────────────────────┐
   │ filter by location,  │
   │ drop stale postings, │
   │ sort newest-first     │
   └──────┬────────────────┘
          │
          ▼
   ┌─────────────────────┐
   │ dedup against what's  │
   │ already live, insert   │
   │ what's genuinely new   │
   └──────┬────────────────┘
          │
          ▼
     shows up on the site

```

For companies running on a known ATS (Greenhouse, Lever), the agent skips the
browser and extraction step entirely and reads their public JSON API directly -
cleaner data, no LLM call needed, nothing to misread.

Agents aren't fire-and-forget: each one carries its own system prompt, so a
company whose listings need special handling (title formatting, a section to
ignore, an unusual date format) gets that taught to it directly, tested against
a live fetch before it goes live.

---

## The referral loop

```
employee registers  →  admin verifies  →  shares referral link
        │                                         │
        ▼                                         ▼
  appears on leaderboard                  candidate applies through it
  once verified                                   │
                                                    ▼
                                          referral tracked: submitted
                                          → interview → offer → payout
```

Leaderboard ranking isn't just referral count - it weights toward outcomes:
offers count far more than raw submissions, so it rewards people whose
referrals actually land, not people who spam links.

---

## System architecture

```
 React (CRA)                      FastAPI                    MongoDB
 ───────────                      ───────                    ───────
 Jobs / Admin /          HTTP      API routes          Motor   users, jobs,
 Profile / Referrals  ─────────▶  (auth, jobs,       ────────▶ agents,
 / Leaderboard                     referrals, admin)            referrals,
                                         │                       withdrawals...
                                         │
                            background asyncio loop
                            (the agent scheduler -
                             lives in the same process,
                             ticks every 30s)
                                         │
                      ┌──────────────────┼──────────────────┐
                      ▼                  ▼                  ▼
                 career pages      Anthropic API        Google OAuth /
                 (any company)    (job extraction)      Stripe / Resend
```

Everything - API and background scheduler - runs in one process. The scheduler
isn't a separate worker; it's an asyncio task started alongside the HTTP server,
which is why the backend needs to run somewhere that stays alive continuously
rather than a request-driven serverless function.

---

## Security

- Passwords hashed with bcrypt, never stored or logged in plain text
- Auth cookies are httpOnly, secure, and scoped - inaccessible to JS, never sent
  over plain HTTP
- Login, registration, password reset, and password changes are all rate-limited
  per IP, with account lockout after repeated failed login attempts
- Password reset and email verification links are single-use and expire in an
  hour; the forgot-password flow never reveals whether an email exists in the
  system
- Google Sign-In verifies the ID token server-side against Google's own public
  keys - no third-party auth proxy in the middle
- Standard response hardening: HSTS, clickjacking protection, MIME-sniffing
  protection, locked-down referrer policy

---

## Design language

Dark-first interface, a single accent purple (`#5B4FFF`) carried through buttons,
links, and the leaderboard's rank highlights. Typography and spacing lean on a
consistent component system (shadcn/Radix primitives) rather than one-off
styling per page, so new pages inherit the same feel without extra design work.
Email notifications share the same branding - same logo, same color, same voice
- so a password reset or verification email doesn't feel like it came from a
different product.

---

## Pages

`Home` · `Jobs` · `Job Detail` · `Login / Forgot Password / Reset Password /
Verify Email` · `Profile` · `Pricing` · `Payment` · `Contact` · `Refer a Talent`
· `Employee Dashboard` · `Admin` (job URL tracking, agent health and training,
users, referrals, withdrawals, payments, messages)

---

## What's real, not simulated

Jobs on the live site come from real agent fetches against real career pages -
there is no fabricated-data fallback in production. A mock-data mode exists
only for local development, off by default, so what you see on
[blinkedln.netlify.app](https://blinkedln.netlify.app/) is exactly what the
agents found.
