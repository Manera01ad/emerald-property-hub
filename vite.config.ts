// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
    // No Supabase fallback here on purpose.
    //
    // This used to default to the Lovable-managed project, so a build with no
    // .env silently talked to that database instead of failing. There is now no
    // fallback: `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` must be
    // set wherever the build runs, or the app refuses to start with a clear
    // error instead of reading someone else's data.
    //
    // Vite injects any `VITE_*` variable that is present at build time, so
    // setting these in the build environment is enough.
  },
});
