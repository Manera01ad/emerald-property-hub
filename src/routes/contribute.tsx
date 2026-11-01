import { createFileRoute, Link } from "@tanstack/react-router";
import { CHALLENGES, CONTRIBUTE_NOTICES, CONTRIBUTE_STEPS } from "@/lib/contribute";

export const Route = createFileRoute("/contribute")({
  staticData: { sitemap: true },
  head: () => ({
    links: [{ rel: "canonical", href: "https://emerald-property-hub.lovable.app/contribute" }],
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://emerald-property-hub.lovable.app/contribute" },
      { title: "Contribute — PropWise AI" },
      {
        name: "description",
        content: "Proposed research and software challenges. None are open yet.",
      },
      { property: "og:title", content: "Contribute — PropWise AI" },
      { property: "og:description", content: "Proposed research and software challenges." },
    ],
  }),
  component: ContributePage,
});

function ContributePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-4xl">Contribute</h1>
      <div className="gold-rule my-6" />

      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-5">
        <p className="font-medium">These challenges are not open yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          The challenges below are proposals. Nothing can be started, submitted or paid until the
          owner approves a challenge and confirms the funding for it. There is no approved or funded
          challenge at present.
        </p>
      </div>

      <section className="mt-10">
        <h2 className="text-xl">How it works</h2>
        <ol className="mt-3 space-y-2">
          {CONTRIBUTE_STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm">
              <span
                aria-hidden
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium"
              >
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl">What we need help with</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Each proposed challenge lists what a finished piece of work would need to include. A
          reward is agreed in writing before work starts, and is based on the actual work and the
          available funding.
        </p>
        <div className="mt-4 space-y-4">
          {CHALLENGES.map((challenge) => (
            <div key={challenge.id} className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg">{challenge.title}</h3>
                <span className="rounded-full border border-muted-foreground/30 px-2 py-0.5 text-xs text-muted-foreground">
                  Not open
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{challenge.summary}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                A finished task would include
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {challenge.done.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Reward: to be agreed before work starts.
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl">Before you take part</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {CONTRIBUTE_NOTICES.map((notice) => (
            <li key={notice}>{notice}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-xl">Interested?</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Send your name, what you would like to work on, and a short description of how you would
          approach it. A person will look at what you send and reply if there is a fit.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/contact"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Get in touch
          </Link>
          <Link to="/community" className="rounded-md border px-4 py-2 text-sm font-medium">
            Community
          </Link>
        </div>
      </section>
    </div>
  );
}
