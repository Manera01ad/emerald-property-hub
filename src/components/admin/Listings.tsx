import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VerificationBadge } from "@/components/Badges";
import { APPROVALS, AVAILABILITY, DOCS, MARKETS, PLACE_CATEGORIES, PROPERTY_TYPES, VERIFICATION, typeLabel } from "@/lib/constants";
import { formatINR } from "@/lib/format";
import { usePhotoUrls, type Property } from "@/lib/data";
import { Panel, selectCls, useAdminTable, useInvalidateAdmin } from "./shared";

export function Listings() {
  const { data = [] } = useAdminTable("properties");
  const inv = useInvalidateAdmin();
  const [editing, setEditing] = useState<Property | "new" | null>(null);
  const [filter, setFilter] = useState("");

  async function setStatus(p: Property, status: string) {
    if (status === "published" && !p.listing_permission) return void toast.error("Record the owner/developer listing permission before publishing.");
    const { error } = await supabase.from("properties").update({ status }).eq("id", p.id);
    if (error) return void toast.error(error.message);
    inv("properties");
    toast.success(`Listing ${status}`);
  }

  const rows = data.filter((p) => !filter || p.status === filter || (filter === "demo" && p.is_demo));
  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <select className={selectCls + " max-w-48"} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All listings</option><option value="draft">Drafts</option><option value="published">Published</option><option value="archived">Archived</option><option value="demo">Demo records</option>
        </select>
        <Button onClick={() => setEditing("new")}><Plus /> New listing</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Title</th><th>Price</th><th>Status</th><th>Verification</th><th>Permission</th><th /></tr></thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="py-2">
                  <Link to="/properties/$id" params={{ id: p.id }} className="font-medium hover:text-primary">{p.title}</Link>
                  {p.is_demo && <span className="ml-2 rounded bg-warning px-1.5 text-xs text-primary-foreground">DEMO</span>}
                  <div className="text-xs text-muted-foreground">{typeLabel(p.property_type)} · {p.location}</div>
                </td>
                <td>{formatINR(p.asking_price)}</td>
                <td>
                  <select className={selectCls + " h-8 w-32"} value={p.status} onChange={(e) => setStatus(p, e.target.value)}>
                    <option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
                  </select>
                </td>
                <td><VerificationBadge status={p.verification_status} /></td>
                <td>{p.listing_permission ? "Yes" : <span className="text-destructive">Missing</span>}</td>
                <td className="text-right"><Button size="icon" variant="ghost" onClick={() => setEditing(p)}><Pencil /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">The public only sees listings that are published, have permission recorded, and are not demo records.</p>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing === "new" ? "New listing" : "Edit listing"}</DialogTitle></DialogHeader>
          {editing && <ListingForm initial={editing === "new" ? null : editing} onDone={(p) => { inv("properties"); setEditing(p ?? null); }} />}
        </DialogContent>
      </Dialog>
    </Panel>
  );
}

function ListingForm({ initial, onDone }: { initial: Property | null; onDone: (p?: Property) => void }) {
  const [approvals, setApprovals] = useState<string[]>(initial?.approvals ?? []);
  const [photos, setPhotos] = useState<string[]>(initial?.photos ?? []);
  const [docs, setDocs] = useState<Record<string, boolean>>(() => Object.fromEntries(DOCS.map((d) => [d.key, !!initial?.[d.key as keyof Property]])));
  const [permission, setPermission] = useState(initial?.listing_permission ?? false);
  const [busy, setBusy] = useState(false);
  const { data: partners = [] } = useAdminTable("partners");
  const { data: previews = [] } = usePhotoUrls(photos);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    if (!permission) return void toast.error("Confirm owner permission before uploading photos.");
    setBusy(true);
    const added: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("property-photos").upload(path, file);
      if (error) toast.error(error.message); else added.push(path);
    }
    setPhotos((p) => [...p, ...added]);
    setBusy(false);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) || "").trim() || null;
    const n = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
    const payload = {
      title: String(f.get("title")).trim(),
      property_type: String(f.get("property_type")),
      location: String(f.get("location")),
      address: s("address"),
      asking_price: Number(f.get("asking_price")),
      guideline_value: n("guideline_value"),
      bedrooms: n("bedrooms"),
      built_area_sqft: n("built_area_sqft"),
      land_area_sqft: n("land_area_sqft"),
      availability: String(f.get("availability")),
      verification_status: String(f.get("verification_status")),
      verification_evidence: s("verification_evidence"),
      listing_permission: permission,
      permission_evidence: s("permission_evidence"),
      source: s("source"),
      rera_number: s("rera_number"),
      description: s("description"),
      amenities: String(f.get("amenities") || "").split(",").map((x) => x.trim()).filter(Boolean),
      latitude: n("latitude"),
      longitude: n("longitude"),
      partner_id: s("partner_id"),
      is_demo: f.get("is_demo") === "on",
      approvals,
      photos,
      ...docs,
    };
    if (!payload.title || !(payload.asking_price >= 0)) return void toast.error("Title and price are required.");
    setBusy(true);
    const q = initial
      ? supabase.from("properties").update(payload).eq("id", initial.id).select().single()
      : supabase.from("properties").insert({ ...payload, status: "draft" }).select().single();
    const { data, error } = await q;
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(initial ? "Listing updated" : "Draft created — add nearby places, then publish");
    onDone(data as Property);
  }

  async function del() {
    if (!initial || !confirm("Delete this listing permanently? Consider archiving instead.")) return;
    await supabase.from("properties").delete().eq("id", initial.id);
    onDone();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field initial={initial} name="title" label="Title *" required /></div>
          <div className="space-y-1"><Label>Type</Label><select name="property_type" className={selectCls} defaultValue={initial?.property_type ?? "villa"}>{PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
          <div className="space-y-1"><Label>Location</Label><select name="location" className={selectCls} defaultValue={initial?.location ?? MARKETS[0]}>{MARKETS.map((m) => <option key={m}>{m}</option>)}</select></div>
          <div className="sm:col-span-2"><Field initial={initial} name="address" label="Address / landmark" /></div>
          <Field initial={initial} name="asking_price" label="Asking price (₹) *" type="number" required min={0} />
          <Field initial={initial} name="guideline_value" label="Guideline value (₹)" type="number" min={0} />
          <Field initial={initial} name="bedrooms" label="Bedrooms" type="number" min={0} />
          <div className="space-y-1"><Label>Availability</Label><select name="availability" className={selectCls} defaultValue={initial?.availability ?? "ready"}>{Object.entries(AVAILABILITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <Field initial={initial} name="built_area_sqft" label="Built-up area (sq ft)" type="number" min={0} />
          <Field initial={initial} name="land_area_sqft" label="Land area (sq ft)" type="number" min={0} />
          <Field initial={initial} name="rera_number" label="RERA number" />
          <Field initial={initial} name="source" label="Source (who supplied it)" />
          <Field initial={initial} name="latitude" label="Latitude" type="number" step="any" />
          <Field initial={initial} name="longitude" label="Longitude" type="number" step="any" />
          <div className="space-y-1"><Label>Partner</Label><select name="partner_id" className={selectCls} defaultValue={initial?.partner_id ?? ""}><option value="">None</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
          <div className="space-y-1"><Label>Amenities (comma separated)</Label><Input name="amenities" defaultValue={initial?.amenities.join(", ")} /></div>
        </div>
        <div className="space-y-1"><Label>Description</Label><Textarea name="description" rows={3} defaultValue={initial?.description ?? ""} /></div>
        <div className="space-y-2"><Label>Approvals</Label>
          <div className="flex flex-wrap gap-3">{APPROVALS.map((a) => (
            <label key={a} className="flex items-center gap-1.5 text-sm"><Checkbox checked={approvals.includes(a)} onCheckedChange={(v) => setApprovals(v ? [...approvals, a] : approvals.filter((x) => x !== a))} />{a}</label>
          ))}</div>
        </div>
        <div className="space-y-2"><Label>Documents recorded</Label>
          <div className="grid gap-2 sm:grid-cols-2">{DOCS.map((d) => (
            <label key={d.key} className="flex items-center gap-1.5 text-sm"><Checkbox checked={docs[d.key]} onCheckedChange={(v) => setDocs({ ...docs, [d.key]: v === true })} />{d.label}</label>
          ))}</div>
        </div>
        <div className="grid gap-3 rounded-lg bg-muted p-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><Checkbox checked={permission} onCheckedChange={(v) => setPermission(v === true)} />Owner / developer has given permission to list and use photos</label>
          <div className="space-y-1"><Label>Permission evidence</Label><Input name="permission_evidence" placeholder="e.g. signed letter dated…, WhatsApp consent" defaultValue={initial?.permission_evidence ?? ""} /></div>
          <div className="space-y-1"><Label>Verification</Label><select name="verification_status" className={selectCls} defaultValue={initial?.verification_status ?? "unverified"}>{Object.entries(VERIFICATION).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="space-y-1 sm:col-span-2"><Label>Verification evidence</Label><Input name="verification_evidence" placeholder="What was checked, by whom, when" defaultValue={initial?.verification_evidence ?? ""} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_demo" defaultChecked={initial?.is_demo ?? false} /> Demo record (never shown publicly)</label>
        </div>
        <div className="space-y-2">
          <Label>Photos</Label>
          <div className="flex flex-wrap gap-2">
            {previews.map((u, i) => (
              <div key={u} className="relative size-20 overflow-hidden rounded-md">
                <img src={u} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded bg-background/90 p-0.5"><Trash2 className="size-3" /></button>
              </div>
            ))}
            <label className="flex size-20 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
              <Upload className="size-4" /> Upload
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
            </label>
          </div>
        </div>
        <div className="flex justify-between">
          {initial ? <Button type="button" variant="ghost" onClick={del}><Trash2 /> Delete</Button> : <span />}
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : initial ? "Save changes" : "Create draft"}</Button>
        </div>
      </form>
      {initial && <NearbyEditor propertyId={initial.id} />}
    </div>
  );
}

function NearbyEditor({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const key = ["places", propertyId];
  const { data = [] } = useQuery({ queryKey: key, queryFn: async () => (await supabase.from("nearby_places").select("*").eq("property_id", propertyId).order("category")).data ?? [] });

  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const { error } = await supabase.from("nearby_places").insert({
      property_id: propertyId,
      category: String(f.get("category")),
      name: String(f.get("name")),
      distance_km: f.get("distance") ? Number(f.get("distance")) : null,
      source: String(f.get("source") || "") || null,
      verified: f.get("verified") === "on",
    });
    if (error) return void toast.error(error.message);
    form.reset();
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="border-t pt-4">
      <p className="font-medium">Nearby places</p>
      <p className="text-xs text-muted-foreground">Enter distances only from a reliable source (e.g. measured on Google Maps) and note it.</p>
      <form onSubmit={add} className="mt-3 grid gap-2 sm:grid-cols-6">
        <select name="category" className={selectCls + " sm:col-span-2"}>{Object.entries(PLACE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <Input name="name" placeholder="Name *" required className="sm:col-span-2" />
        <Input name="distance" type="number" step="0.1" placeholder="km" />
        <Input name="source" placeholder="Source" />
        <label className="flex items-center gap-2 text-sm sm:col-span-5"><input type="checkbox" name="verified" /> Verified</label>
        <Button type="submit" size="sm">Add</Button>
      </form>
      <ul className="mt-3 space-y-1 text-sm">
        {data.map((x) => (
          <li key={x.id} className="flex items-center justify-between">
            <span>{PLACE_CATEGORIES[x.category]}: {x.name} {x.distance_km != null && `· ${x.distance_km} km`} {x.verified ? "✓" : "(unverified)"}</span>
            <Button size="icon" variant="ghost" onClick={async () => { await supabase.from("nearby_places").delete().eq("id", x.id); qc.invalidateQueries({ queryKey: key }); }}><Trash2 /></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({ name, label, initial, ...rest }: { name: string; label: string; initial: Property | null } & React.InputHTMLAttributes<HTMLInputElement>) {
  return <div className="space-y-1"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} defaultValue={(initial?.[name as keyof Property] as string | number | null) ?? ""} {...rest} /></div>;
}
