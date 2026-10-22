import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth";
import mark from "@/assets/assistant-mark.png";

const URL = "https://emerald-property-hub.lovable.app/advisor";
const TITLE = "AI property advisor — PropWise AI";
const DESC = "Ask PropWise's AI assistant how to use its property tools, save your research, or book a consultation with an expert.";

export const Route = createFileRoute("/advisor")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: URL }],
  }),
  component: AdvisorPage,
});

function AdvisorPage() {
  const { session } = useSession();
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-3">
        <img src={mark} alt="" width={48} height={48} className="size-12" />
        <h1 className="text-3xl">AI property advisor</h1>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">Get quick answers from our AI assistant, keep your own research, or talk to a person. Answers are general guidance, not legal advice.</p>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card title="Ask PropWise" text="Chat with the AI assistant about costs, values, areas and how the tools work.">
          <Button asChild variant="gold" size="sm"><Link to={session ? "/assistant" : "/auth"}>{session ? "Open the assistant" : "Sign in to ask"}</Link></Button>
        </Card>
        <Card title="My research" text="Save what you're looking for, run buy and rent sums, and download reports.">
          <Button asChild variant="outline" size="sm"><Link to={session ? "/my" : "/auth"}>{session ? "Open my research" : "Sign in"}</Link></Button>
        </Card>
        <Card title="Talk to an expert" text="Book a consultation for help with a specific property or area.">
          <Button asChild variant="outline" size="sm"><Link to="/consult">Book a consultation</Link></Button>
        </Card>
      </div>
    </div>
  );
}

function Card({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-5 shadow-card">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{text}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}
