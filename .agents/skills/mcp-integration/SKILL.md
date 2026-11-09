---
name: mcp-integration
description: Use when changing MCP tools, the MCP server, OAuth sign-in for agents, or the generated MCP routes and manifest.
---

# MCP integration

## Structure

- `src/lib/mcp/index.ts` — `defineMcp` server definition and auth
- `src/lib/mcp/supabase.ts` — tool context bound to the caller's Supabase session
- `src/lib/mcp/tools/*.ts` — one tool per file: `search-listings`, `get-listing`,
  `my-research`

Tools act as the calling user under RLS. Listing tools must re-apply the
public-visibility filter so an admin caller cannot leak drafts.

## Generated files: do not hand-edit

- `src/routes/mcp.ts`
- `src/routes/[.well-known]/oauth-protected-resource.ts`
- `.lovable/mcp/manifest.json`

All three come from the `@lovable.dev/mcp-js` Vite plugin configured in
`vite.config.ts`. Edit the tool definitions, then regenerate; never patch the
output.

`src/routes/[.]lovable.oauth.consent.tsx` is the consent screen for that OAuth
flow. Its route path contains `lovable` because the SDK generates it, not because
the product depends on Lovable hosting.

## Auth

MCP requires OAuth sign-in. A tool must not fall back to an anonymous or service
role client. Tool failures go through `ToolError` so the agent receives a clean
message.

## Manifest caveat

`.lovable/mcp/manifest.json` is generated but currently records an **old issuer**
(`https://dashpanandamjickoytj.supabase.co/auth/v1`). Do not treat it as
configuration truth; the live project id is in `supabase/config.toml`.

## Tests

If you change a tool, add a focused test beside it. The public-visibility rule is
pinned by `src/lib/visibility.test.ts`.
