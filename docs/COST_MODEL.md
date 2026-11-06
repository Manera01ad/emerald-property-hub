# Cost model — how this stays at zero

Companion to `docs/PLAN.md`. This answers one question: what does running
PropWise AI cost, and what switch turns cost on or off?

Honesty first: **free tiers are not unlimited.** "Zero cost" here means "stays
inside free tiers", and this document names the limits so you know which one you
will hit first. Free-tier figures change; the numbers below are the *shape* of
each limit, and you should confirm the current value in the provider's dashboard
before relying on it. Where a figure is a published price rather than a
provider-quoted limit, it is marked as an assumption.

---

## 1. The cost surface

Only four things can cost money:

1. **Hosting** — serving the site.
2. **Database / auth / storage** — Supabase.
3. **AI** — each assistant message.
4. **Domain** — the address (optional).

Everything else (the code, GitHub, CI) is free at this scale.

---

## 2. Hosting — Cloudflare Workers (free tier)

The build already emits a Cloudflare Worker (`.output/server/wrangler.json`,
preset `cloudflare-module`), so this is the natural target.

| Item | Free-tier shape | What to watch |
| --- | --- | --- |
| Worker requests | A large daily request allowance, then paid | A traffic spike |
| CPU time per request | A small per-request CPU budget | Heavy SSR pages |
| Static assets | Generous, effectively unmetered at this size | Large media in `public/` |

**First limit you would hit:** Worker requests, only under real traffic. For a
pre-launch product this is not a concern; revisit when you have daily users.
Confirm the current numbers in the Cloudflare dashboard.

**Alternative free hosts** (if you prefer): Netlify and Vercel both have free
tiers and the Nitro build can target them (`NITRO_PRESET`). Cloudflare is
recommended only because the build already produces its output.

---

## 3. Database / auth / storage — Supabase (free tier)

Supabase is already in use and already separate from Lovable. The free tier
covers a small project: a database size cap, a monthly bandwidth cap, a storage
cap, and a monthly active-user cap.

| Item | Free-tier shape | What to watch |
| --- | --- | --- |
| Database size | A few hundred MB | Listing text and images grow it |
| Egress bandwidth | A monthly cap | Image-heavy pages |
| Storage | ~1 GB | **Property photos** are the main consumer |
| Monthly active users | Tens of thousands | Not a concern yet |
| Project pause | Free projects pause after a week of inactivity | An uptime ping keeps it awake |

**First limit you would hit:** storage, if owners upload many photos, or the
project pause if the site gets no traffic for a week. Both are handled in
`docs/OPERATIONS.md` §4 (uptime ping) and by compressing photos on upload.

**Cost note:** a paid Supabase tier is ~$25/month. You do not need it until you
outgrow the free caps.

---

## 4. AI — the only per-message cost, and it is off by default

This is where the money would actually go, so it gets the most control.

### 4.1 The switches

| Variable | Effect |
| --- | --- |
| `AI_API_KEY` (unset) | **Assistant is off.** The route returns a clean "not configured" message. Cost: ₹0. |
| `AI_DAILY_BUDGET_INR=0` | Hard stop on all AI spend, even if a key is set. |
| `AI_DAILY_BUDGET_INR=500` | ~300 calls/day ceiling (assumption, see below). |
| `AI_BASE_URL` | Which provider. Point it at a free tier to keep cost at ₹0 while the assistant is on. |
| `AI_MODEL` | Which model. A cheaper model lowers cost per call. |

**Default posture:** the assistant is off until you set a key. That is the
zero-cost default, and it is deliberate.

### 4.2 How cost is bounded (already in the code)

Four independent guards, so no single mistake creates a bill:

1. **Per-user daily limit** — 15 messages/day (`src/lib/assistant/limits.ts`).
2. **Global daily budget** — a rupee cap checked *before* every paid call
   (`src/lib/assistant/budget.ts`, enforced server-side in `budget.server.ts`).
3. **Fail closed** — if the budget check cannot run, the call is refused, not
   allowed.
4. **Measured vs estimated** — every call is logged with whether its cost was
   measured from provider usage or estimated, and never conflated
   (`src/lib/assistant/cost.ts`).

The pricing assumption lives in one file (`src/lib/assistant/pricing.ts`): the
model rates and the INR/USD rate. Change the model, change the rate there, in
one reviewed diff.

### 4.3 Free-model options (assistant on, still ₹0)

If you want the assistant live without spending, point `AI_BASE_URL` at a
provider with a free tier and set a low `AI_DAILY_BUDGET_INR` as a backstop:

- **Google Gemini** — free tier with per-minute and per-day request limits.
- **Groq** — free tier, fast inference, per-day limits.
- **OpenRouter** — some models free, subject to rate limits.

All three are OpenAI-compatible, which is why `pricing.ts` uses that shape. A
free tier is a rate limit, not a budget: the daily budget still applies as the
hard stop.

### 4.4 Cost assumption (not a provider quote)

From `pricing.ts`: ₹88/USD, and the configured model at $0.25 / $2.00 per
million input/output tokens. A single assistant call with a full skill prompt is
on the order of a few thousand tokens, so a call is on the order of a rupee or
two. The default ₹500/day cap is a ceiling, not a target. These are **planning
assumptions**, and the admin AI-cost view reports actual measured spend so you
can correct them.

---

## 5. Domain — the only optional real cost

- `*.workers.dev` — free.
- Custom domain — roughly ₹800–1,000/year for a `.in`/`.com`, plus free
  Cloudflare DNS.

Decision D2 in `docs/PLAN.md`. Start free; add a domain when you want one.

---

## 6. Monthly cost at each stage

| Stage | Hosting | Database | AI | Domain | Total |
| --- | --- | --- | --- | --- | --- |
| Today (on Lovable) | Lovable sub | Supabase free | Lovable credits | Lovable sub | **paid** |
| After Phase 2, assistant off | ₹0 | ₹0 | ₹0 | ₹0 | **₹0** |
| After Phase 2, assistant on a free model | ₹0 | ₹0 | ₹0 | ₹0 | **₹0** |
| Assistant on a paid model | ₹0 | ₹0 | capped | ₹0 | **capped, you choose** |
| Growth (Phase 4: payments, memberships) | ₹0 | maybe paid | capped | maybe ₹800/yr | **scales with revenue** |

---

## 7. What would make it cost money (and what to do)

| Trigger | Cost | Response |
| --- | --- | --- |
| Real traffic beyond the free Worker allowance | Cloudflare paid (~$5/mo) | Fine — you have users; pay it |
| Supabase storage full of photos | Supabase Pro (~$25/mo) | Compress photos; or pay once you have revenue |
| Assistant pointed at a paid model with a high budget | Per-message | Lower `AI_DAILY_BUDGET_INR`; use a free model |
| Supabase project paused for inactivity | ₹0 but site down | Uptime ping (`docs/OPERATIONS.md` §4) |

None of these are urgent pre-launch. The point of this document is that each one
is a **known** trigger with a **known** response, not a surprise invoice.
