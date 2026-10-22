import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AREA_LIST, listingKey, parseListingCsv, templateCsv } from "@/lib/listing-import";
import type { Property } from "@/lib/data";

/** Admin: bulk-create DRAFT listings from a broker/owner CSV. Nothing is published; the owner's consent note is stored on every row. */
export function ListingImport({ existing, onDone }: { existing: Property[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);

  const existingKeys = useMemo(() => new Set(existing.map((p) => listingKey({ title: p.title, location: p.location, asking_price: Number(p.asking_price) }))), [existing]);
  const result = useMemo(() => (text ? parseListingCsv(text, existingKeys) : null), [text, existingKeys]);

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([templateCsv()], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "propwise-listings-template.csv" });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function readFile(file: File) {
    if (file.size > 1_000_000) return void toast.error("File is too large (limit 1 MB).");
    setFileName(file.name);
    setText(await file.text());
  }

  async function save() {
    if (!result?.drafts.length) return;
    setBusy(true);
    const { error } = await supabase.from("properties").insert(result.drafts);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(`${result.drafts.length} draft listing${result.drafts.length === 1 ? "" : "s"} created. Review each one, then publish.`);
    setOpen(false); setText(""); setFileName("");
    onDone();
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}><Upload /> Import CSV</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Import listings from a CSV</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">Send the template to a partner broker or owner. Each row needs the owner's consent, a source and a map location. Rows become <b>drafts</b>: nothing is public until you review and publish it.</p>
            <Button variant="outline" size="sm" onClick={downloadTemplate}><Download /> Download template</Button>
            <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">Accepted area names</summary><p className="mt-1">{AREA_LIST.join(", ")}</p></details>
            <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
            {result && (
              <div className="space-y-3">
                <p><b>{result.drafts.length}</b> ready to import · <b className={result.errors.length ? "text-destructive" : ""}>{result.errors.length}</b> with problems{result.skippedExamples ? ` · ${result.skippedExamples} example row skipped` : ""} <span className="text-muted-foreground">({fileName})</span></p>
                {result.errors.length > 0 && (
                  <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    {result.errors.map((e) => (
                      <li key={e.row}><b>Row {e.row}: {e.title}</b><ul className="list-disc pl-5 text-muted-foreground">{e.problems.map((p) => <li key={p}>{p}</li>)}</ul></li>
                    ))}
                  </ul>
                )}
                <Button disabled={busy || !result.drafts.length} onClick={save}>{busy ? "Importing…" : `Create ${result.drafts.length} draft${result.drafts.length === 1 ? "" : "s"}`}</Button>
                {result.errors.length > 0 && <p className="text-xs text-muted-foreground">Rows with problems are skipped. Fix them in the file and import again; rows already imported are detected as duplicates.</p>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
