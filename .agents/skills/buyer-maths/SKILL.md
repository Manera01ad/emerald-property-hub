---
name: buyer-maths
description: Use when changing buyer or renter preferences, buy/rent/lease calculations, property matching, valuation, commission, or the buyer research pages.
---

# Buyer maths and research

## Structure

Pure and testable by design: no I/O, no React.

- `src/lib/buyer.ts` — buy/rent/lease preference maths and matching input
- `src/lib/lease.ts`, `transaction.ts`, `rental.ts` — transaction semantics
- `src/lib/deal.ts`, `valuation.ts`, `commission.ts`, `price-context.ts` — cost maths
- `src/lib/ranking.ts`, `compare.ts` — ordering and comparison

Server reads and writes go through `*.functions.ts` files and the browser client
under RLS. Do not add fetch calls inside these pure modules.

## Data

- `buyer_profiles` — one row per user, owner-only via RLS with admin read.
- `buyer_reports` — saved reports, same rules.
- UI routes: `src/routes/_authenticated/my.tsx` and related; the route-level test
  `src/routes/my-lease-preference.test.ts` pins the lease preference behaviour.

## Invariants

- Rates, commission and fees come from `app_settings`, not constants.
- Buy uses a total budget; rent and lease use a monthly budget. Keep the
  transaction type explicit instead of inferring it from the amount.
- New maths belongs in a pure `.ts` module with a colocated test.

## Tests

`buyer.test.ts`, `lease.test.ts`, `transaction.test.ts`, `rental.test.ts`,
`deal.test.ts`, `valuation.test.ts`, `commission.test.ts`, `ranking.test.ts`,
`compare.test.ts`, plus the route-level lease preference test.
