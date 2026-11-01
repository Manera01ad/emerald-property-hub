import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useIsAdmin, useSession } from "@/lib/auth";
import { Overview } from "@/components/admin/Overview";
import { Listings } from "@/components/admin/Listings";
import { Enquiries } from "@/components/admin/Enquiries";
import { Partners } from "@/components/admin/Partners";
import { Commissions } from "@/components/admin/Commissions";
import { SiteVisits } from "@/components/admin/SiteVisits";
import { Infrastructure } from "@/components/admin/Infrastructure";
import { SettingsPanel } from "@/components/admin/SettingsPanel";
import { ResearchAgents } from "@/components/admin/ResearchAgents";
import { Buyers } from "@/components/admin/Buyers";
import { AreaIntel } from "@/components/admin/AreaIntel";
import { Localities } from "@/components/admin/Localities";
import { Submissions } from "@/components/admin/Submissions";
import { Ranking } from "@/components/admin/Ranking";
import { CommunityQueue } from "@/components/admin/CommunityQueue";
import { AiCosts } from "@/components/admin/AiCosts";
import { IntelligenceGaps } from "@/components/admin/IntelligenceGaps";

/**
 * Admin navigation in five groups. Every entry is an existing panel, preserved
 * from the flat list this replaces; only the presentation is grouped. Tab values
 * are unchanged, so a panel keeps working wherever it is linked from.
 */
const ADMIN_GROUPS = [
  {
    label: "Properties",
    tabs: [{ value: "listings", label: "Listings" }],
  },
  {
    label: "People",
    tabs: [
      { value: "enquiries", label: "Enquiries" },
      { value: "buyers", label: "Buyers & renters" },
      { value: "visits", label: "Site visits" },
      { value: "partners", label: "Partners" },
    ],
  },
  {
    label: "Intelligence",
    tabs: [
      { value: "research", label: "AI Research Agents" },
      { value: "areas", label: "Area intelligence" },
      { value: "localities", label: "Localities" },
      { value: "infra", label: "Infrastructure" },
      { value: "ranking", label: "Ranking" },
      { value: "ai-costs", label: "AI costs" },
      { value: "gaps", label: "Knowledge gaps" },
    ],
  },
  {
    label: "Community & Work",
    tabs: [
      { value: "submissions", label: "Submissions" },
      { value: "community", label: "Community" },
    ],
  },
  {
    label: "Operations",
    tabs: [
      { value: "overview", label: "Overview" },
      { value: "commissions", label: "Commissions" },
      { value: "settings", label: "Settings" },
    ],
  },
] as const;

export const Route = createFileRoute("/_authenticated/admin")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Admin Dashboard — PropWise AI" },
      { name: "description", content: "Manage listings, enquiries, partners and commissions." },
      { property: "og:title", content: "Admin Dashboard — PropWise AI" },
      { property: "og:description", content: "PropWise administration." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { session } = useSession();
  const { data: isAdmin, isLoading } = useIsAdmin(session?.user.id);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!session || isLoading)
    return <div className="mx-auto max-w-7xl px-4 py-20 text-muted-foreground">Loading…</div>;
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl">No admin access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as {session.user.email}. Ask the account owner to grant you administrator
          access.
        </p>
        <Button variant="outline" className="mt-6" onClick={signOut}>
          Sign out
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl">Dashboard</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {session.user.email}
          <Button size="sm" variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
      <Tabs defaultValue="overview" className="mt-6">
        {/*
          The five groups are the admin navigation. Every tab below is an existing
          panel; grouping is presentation only and changes no tab value, so deep
          links and the rendered panels are unaffected.
        */}
        <TabsList className="flex h-auto flex-wrap justify-start gap-y-2">
          {ADMIN_GROUPS.map((group, i) => (
            <Fragment key={group.label}>
              {i > 0 && (
                <span
                  aria-hidden
                  className="mx-1 self-center text-xs font-medium uppercase tracking-wide text-muted-foreground/60"
                >
                  {group.label}
                </span>
              )}
              {group.tabs.map((t) => (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                </TabsTrigger>
              ))}
            </Fragment>
          ))}
        </TabsList>
        <TabsContent value="overview">
          <Overview />
        </TabsContent>
        <TabsContent value="listings">
          <Listings />
        </TabsContent>
        <TabsContent value="enquiries">
          <Enquiries />
        </TabsContent>
        <TabsContent value="buyers">
          <Buyers />
        </TabsContent>
        <TabsContent value="visits">
          <SiteVisits />
        </TabsContent>
        <TabsContent value="partners">
          <Partners />
        </TabsContent>
        <TabsContent value="commissions">
          <Commissions />
        </TabsContent>
        <TabsContent value="infra">
          <Infrastructure />
        </TabsContent>
        <TabsContent value="areas">
          <AreaIntel />
        </TabsContent>
        <TabsContent value="localities">
          <Localities />
        </TabsContent>
        <TabsContent value="submissions">
          <Submissions />
        </TabsContent>
        <TabsContent value="ranking">
          <Ranking />
        </TabsContent>
        <TabsContent value="community">
          <CommunityQueue />
        </TabsContent>
        <TabsContent value="research">
          <ResearchAgents />
        </TabsContent>
        <TabsContent value="ai-costs">
          <AiCosts />
        <TabsContent value="gaps">
          <IntelligenceGaps />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
