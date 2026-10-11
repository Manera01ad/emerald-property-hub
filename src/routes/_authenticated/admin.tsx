import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
import { Infrastructure } from "@/components/admin/Infrastructure";
import { SettingsPanel } from "@/components/admin/SettingsPanel";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
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

  if (!session || isLoading) return <div className="mx-auto max-w-7xl px-4 py-20 text-muted-foreground">Loading…</div>;
  if (!isAdmin)
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl">No admin access</h1>
        <p className="mt-2 text-sm text-muted-foreground">Signed in as {session.user.email}. Ask the account owner to grant you administrator access.</p>
        <Button variant="outline" className="mt-6" onClick={signOut}>Sign out</Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl">Dashboard</h1>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">{session.user.email}<Button size="sm" variant="outline" onClick={signOut}>Sign out</Button></div>
      </div>
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="enquiries">Enquiries</TabsTrigger>
          <TabsTrigger value="partners">Partners</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="infra">Infrastructure</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview"><Overview /></TabsContent>
        <TabsContent value="listings"><Listings /></TabsContent>
        <TabsContent value="enquiries"><Enquiries /></TabsContent>
        <TabsContent value="partners"><Partners /></TabsContent>
        <TabsContent value="commissions"><Commissions /></TabsContent>
        <TabsContent value="infra"><Infrastructure /></TabsContent>
        <TabsContent value="settings"><SettingsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
