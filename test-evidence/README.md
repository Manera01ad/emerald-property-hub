# Test evidence

Committed screenshots that back pull-request claims. They are generated output,
not documentation, so they live here rather than in `docs/`.

The screenshots record the browser-journey verification of the lease-preference
change: every journey returned **0 px horizontal overflow** at desktop
(1440×900) and mobile (375×812).

| File | Shows |
| --- | --- |
| `buy-journey-desktop.png`, `buy-journey-mobile.png` | `/properties?transaction=buy` listing |
| `rent-journey-desktop.png`, `rent-journey-mobile.png` | `/properties?transaction=rent` listing |
| `lease-journey-desktop.png`, `lease-journey-mobile.png` | `/properties?transaction=lease` listing |
| `compare-desktop.png`, `compare-mobile.png` | `/compare` side-by-side comparison |
| `my-research-lease-preference-desktop.png`, `-mobile.png` | My Property Research with the Lease intent selected |
| `my-research-matches-desktop.png`, `-mobile.png` | My Property Research, Matches tab |

## Regenerating

Captured on 2026-11-08 (commit `33f4c9d`). Regenerate before relying on them:

```sh
bun install
bun run dev                        # terminal 1: serves http://localhost:8080
node scripts/verify-journeys.mjs   # terminal 2: overwrites the PNGs here
```

Requirements: Google Chrome installed (the script launches the `chrome` channel),
Playwright available through `bun install`, and the dev server on
`http://localhost:8080`. The script mocks authentication and database responses
with Playwright route interception, so it needs no real credentials and touches no
production data.

The script also prints a per-journey overflow summary; commit the images only when
that summary is clean.
