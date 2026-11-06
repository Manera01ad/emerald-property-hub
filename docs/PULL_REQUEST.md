# Pull Request: Add Lease Preference to My Property Research with Migration Guard

- **Branch:** `feat/seeker-lease-preference`
- **Base:** `main`
- **Scope:** Buyer-facing UI (`src/routes/_authenticated/my.tsx`)
- **Review Tier:** Tier 2 (Pages, components, public content)
- **Status:** Machine verified (Unit tests passing, type-check exit 0, browser test suite green with 0px mobile overflow)

---

## 1. What problem this solves

In `docs/CURRENT_STATE.md` (§7, Priority 1, Item 4), the seeker profile in **My Property Research** (`src/routes/_authenticated/my.tsx`) lacked the ability to express or evaluate a **Lease** intent, even though the rest of the buyer-facing product (Browse `/properties`, Detail `/properties/:id`, and Compare `/compare`) has first-class support for `buy`, `rent`, and `lease`.

Crucially, an audit of the database schema revealed that the live database table `public.buyer_profiles` enforces `CHECK (intent IN ('buy','rent'))` (from migration `0006_buyer_intelligence.sql`). The extended fields (`lease_months`, `permitted_use`) and the expanded constraint `intent IN ('buy','rent','lease')` are defined in **pending migration `0019_buy_rent_lease.sql`**, which has not yet been applied to the live production database.

This pull request bridges the buyer-facing UI by:
1. Enabling seekers to select **Lease** in the "I want to" intent dropdown.
2. Labeling their monthly commitment accurately as **Monthly lease budget (₹)** (reusing `monthly_rent_budget` in alignment with migration `0019`).
3. Displaying an informative preview status callout explaining that persistent lease duration and permitted-use preferences require pending migration 0019, while providing a direct link to explore active Chennai lease listings.
4. Adding an intelligent, graceful guard in `saveProfile()` that catches unmigrated Postgres check constraint errors and informs the user rather than crashing or showing raw database errors.
5. Correcting property matching in `Matches` so that rentals and leases score against `monthly_rent_budget` (previously, passing `budget` meant monthly properties always showed "No budget set").
6. Adding explicit `htmlFor` / `id` associations to all inputs on the preferences form to ensure screen-reader accessibility.

---

## 2. What exactly changed

### Buyer-Facing UI (`src/routes/_authenticated/my.tsx`)
* **Intent Selector**: Added `<option value="lease">Lease</option>` to `#intent-select`.
* **Dynamic Budget Label**: When `intent === "lease"`, the budget field is labeled **Monthly lease budget (₹)**.
* **Preview Notice**: Added a callout banner linking to `/properties?transaction=lease` and clarifying database status.
* **Resilient `saveProfile`**: Catches `buyer_profiles_intent_check` violations on unmigrated backends with a clear message: `"Saving lease intent requires pending database migration 0019 to be applied by the administrator."`
* **Explainable Matching**: Evaluates `effectivePref.budget = type === "buy" ? f.budget : (f.monthly_rent_budget ?? f.budget)` so monthly rental and lease fit is properly scored.
* **Listing Identifiers**: Displays the transaction badge (`Buy`, `Rent`, `Lease`) alongside property titles in `Matches`.
* **Form Accessibility**: Associated all visible `<Label>` tags with corresponding `<Input>` element IDs.

### Tests (`src/routes/my-lease-preference.test.ts`)
* Added 9 automated regression unit tests covering:
  - Presence of the "Lease" option in the intent select.
  - Correct label switching between total purchase budget and monthly lease budget.
  - Notice display linking to `/properties?transaction=lease`.
  - Full `htmlFor` and `id` accessibility pairing and ID uniqueness.
  - Graceful constraint handling on `saveProfile`.
  - Transaction-aware matching for lease listings and incomplete lease term detection.

### Browser Test & Evidence Suite (`scripts/verify-journeys.mjs`)
* Automated Playwright script exercising the Buy, Rent, and Lease journeys on desktop (1440px) and mobile (375px), measuring horizontal overflow.

---

## 3. How it was tested

### 3.1 Unit & Regression Suite
Executed via Vitest:
```
✓ src/routes/my-lease-preference.test.ts (9 tests) 12ms
✓ src/lib/buyer.test.ts (13 tests) 21ms
✓ src/lib/lease.test.ts (11 tests) 6ms
✓ src/lib/transaction.test.ts (12 tests) 5ms
Test Files: 4 passed (4)
Tests: 45 passed (45)
```

### 3.2 TypeScript Type-Check
```
node ./node_modules/typescript/bin/tsc --noEmit
Exit code: 0 (No type errors)
```

### 3.3 Browser Journey Verification & Mobile Layout Check
All journeys were executed against Chrome at desktop (1440x900) and mobile (375x812, iPhone viewport):

| Journey | Viewport | Horizontal Overflow | Result |
| --- | --- |:---:|:---:|
| Buy (`/properties?transaction=buy`) | Desktop (1440px) | **0px** | Pass |
| Buy (`/properties?transaction=buy`) | Mobile (375px) | **0px** | Pass |
| Rent (`/properties?transaction=rent`) | Desktop (1440px) | **0px** | Pass |
| Rent (`/properties?transaction=rent`) | Mobile (375px) | **0px** | Pass |
| Lease (`/properties?transaction=lease`) | Desktop (1440px) | **0px** | Pass |
| Lease (`/properties?transaction=lease`) | Mobile (375px) | **0px** | Pass |
| Compare (`/compare`) | Desktop (1440px) | **0px** | Pass |
| Compare (`/compare`) | Mobile (375px) | **0px** | Pass |
| My Research — Lease Preference Selected | Desktop (1440px) | **0px** | Pass |
| My Research — Lease Preference Selected | Mobile (375px) | **0px** | Pass |
| My Research — Matches Tab | Desktop (1440px) | **0px** | Pass |
| My Research — Matches Tab | Mobile (375px) | **0px** | Pass |

---

## 4. Visual Evidence (Screenshots)

````carousel
![My Property Research - Lease Preference (Desktop)](/C:/Users/faiyaz/.gemini/antigravity/brain/a6d0bbb5-25ab-4883-91bd-aec994b9ce48/my-research-lease-preference-desktop.png)
<!-- slide -->
![My Property Research - Lease Preference (Mobile 375px)](/C:/Users/faiyaz/.gemini/antigravity/brain/a6d0bbb5-25ab-4883-91bd-aec994b9ce48/my-research-lease-preference-mobile.png)
<!-- slide -->
![Lease Journey - Properties Listing (Desktop)](/C:/Users/faiyaz/.gemini/antigravity/brain/a6d0bbb5-25ab-4883-91bd-aec994b9ce48/lease-journey-desktop.png)
<!-- slide -->
![Lease Journey - Properties Listing (Mobile 375px)](/C:/Users/faiyaz/.gemini/antigravity/brain/a6d0bbb5-25ab-4883-91bd-aec994b9ce48/lease-journey-mobile.png)
<!-- slide -->
![Buy Journey - Properties Listing (Desktop)](/C:/Users/faiyaz/.gemini/antigravity/brain/a6d0bbb5-25ab-4883-91bd-aec994b9ce48/buy-journey-desktop.png)
<!-- slide -->
![Rent Journey - Properties Listing (Desktop)](/C:/Users/faiyaz/.gemini/antigravity/brain/a6d0bbb5-25ab-4883-91bd-aec994b9ce48/rent-journey-desktop.png)
<!-- slide -->
![Compare Journey - Side-by-Side (Desktop)](/C:/Users/faiyaz/.gemini/antigravity/brain/a6d0bbb5-25ab-4883-91bd-aec994b9ce48/compare-desktop.png)
````

---

## 5. What was not tested, and what remains uncertain

> [!IMPORTANT]
> - **Live Database Persistence**: Because agents must never touch production data or apply database migrations (AGENTS.md), actual persistence of `intent = 'lease'` against the live remote Supabase instance was not executed. The code is deliberately defensive and handles the unmigrated check constraint cleanly.
> - **Assistant Chat**: AI assistant internals (`src/lib/assistant/*`) were intentionally not modified or called.
> - **Owner Submissions**: Listing submission forms were not altered.

---

## 6. Safety & Site Impact

* **Security**: No security policies, keys, or auth boundaries touched.
* **Production Data**: None modified or accessed.
* **Main Branch**: Preserved untouched.
* **Existing Functionality**: 100% intact. Existing Buy and Rent preference saving, calculators, and reports continue to function without alteration.
