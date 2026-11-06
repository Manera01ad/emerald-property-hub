# Emerald Property Hub (PropWise AI)

Chennai property and location intelligence: search, compare and analyse
properties, see full purchase cost and locality risk, and ask an AI consultant.

**Current project decision (2026-11-06):** the owner confirms PropWise AI has already moved off Lovable.dev and Lovable Cloud. The priority is finishing and maintaining the independent platform, not restarting the exit.

- **Current product architecture and completion plan:** [`docs/INDEPENDENCE_PLAN.md`](docs/INDEPENDENCE_PLAN.md)
- **Historical plan (not the active work order):** [`docs/PLAN.md`](docs/PLAN.md)
- **Historical exit runbook:** [`docs/LOVABLE_EXIT.md`](docs/LOVABLE_EXIT.md)
- **Cost model:** [`docs/COST_MODEL.md`](docs/COST_MODEL.md)
- **Architecture:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- **Operations:** [`docs/OPERATIONS.md`](docs/OPERATIONS.md)

## CTO development control

- **Team responsibilities, approvals and nightly operating rules:** [`docs/CTO_TEAM.md`](docs/CTO_TEAM.md)
- **Live engineering backlog:** [CTO Control Center #50](https://github.com/Manera01ad/emerald-property-hub/issues/50)

## Development

Prefer working locally? You need [Bun](https://bun.sh) (or Node.js and npm).

```sh
git clone <this-repository-url>
cd emerald-property-hub
bun install
cp .env.example .env      # fill in the public Supabase values
bun run dev               # http://localhost:8080
```

Checks:

```sh
bun run test         # unit and component tests (blocking)
bun run build        # production build (blocking)
bun run type-check   # reported
bun run lint         # reported
bun run test:e2e     # browser tests (optional)
```

## Hosting

The build produces a Cloudflare Worker (`.output/server/wrangler.json`).
Deploy with `npx wrangler deploy --config .output/server/wrangler.json`.
See `docs/OPERATIONS.md` for environment variables and health checks.
