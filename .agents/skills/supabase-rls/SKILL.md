---
name: supabase-rls
description: Use when changing data access, queries, row-level security, the public-visibility rule, photo links, admin roles, or anything that reads or writes Supabase.
---

# Supabase and row-level security

## The boundary

The database policies are the security boundary. UI filters are convenience only.
A listing is publicly visible only when the policy agrees:
**published + permission + not demo**. `src/lib/visibility.ts` encodes that rule and
`visibility.test.ts` pins it.

## Clients

| File | Client | Use for |
| --- | --- | --- |
| `src/integrations/supabase/client.ts` | browser, publishable key | signed-in user reads and writes under RLS |
| `src/integrations/supabase/client.server.ts` | service role | admin-only server code; bypasses RLS |
| `src/lib/public-client.server.ts` | session-free publishable | public metadata and sitemap; always add explicit public filters |

Never import `client.server.ts` or `public-client.server.ts` from a component.

## Rules that are easy to break

- Photos live in a private bucket and are shown through short-lived signed links
  (`src/lib/photo-access.ts`, `src/lib/photo-signing.functions.ts`). Never make the
  bucket public.
- Purchase-cost rates and contact/WhatsApp numbers come from the `app_settings`
  table, never hardcoded.
- The first signup becomes admin through a database trigger; further admins are
  granted in `user_roles`. Do not invent an admin check in the browser.
- Buyer and renter rows are owner-only with admin read (see `buyer-maths`).
- Auth middleware lives in `src/integrations/supabase/auth-*.ts`.

## Tests and guards

`visibility.test.ts`, `photo-access.test.ts`, and `src/test/build-config.test.ts`,
which asserts a build cannot silently point at the old Lovable project.

## What not to do

- Do not write migrations or apply them; the owner runs SQL.
- Do not request `SUPABASE_SERVICE_ROLE_KEY` or put any key in client code.
- Do not edit `src/integrations/supabase/**`, `src/lib/visibility.ts` or the
  sitemap server module without owner review: they are `CODEOWNERS` Tier 3 paths.
