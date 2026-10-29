import { createFileRoute, redirect } from "@tanstack/react-router";

// The advisor page was replaced by the primary navigation. The old address still resolves.
export const Route = createFileRoute("/advisor")({
  staticData: { sitemap: false },
  beforeLoad: () => {
    throw redirect({ to: "/properties", replace: true });
  },
});
