import { Link } from "@tanstack/react-router";
import { BedDouble, Ruler, MapPin, ImageOff, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";
import { typeLabel, AVAILABILITY } from "@/lib/constants";
import { pricePerSqft } from "@/lib/deal";
import { useCompare } from "@/lib/compare";
import { usePhotoUrls, usePropertyPhotoUrls, type Property } from "@/lib/data";
import { TRANSACTION_LABELS, priceUnit, transactionTypeOf } from "@/lib/transaction";
import { termsSummary } from "@/lib/transaction";
import { VerificationBadge } from "./Badges";

export function PropertyCard({ p }: { p: Property }) {
  const { has, toggle } = useCompare();
  const { data: urls, withheld } = usePropertyPhotoUrls({ ...p, photos: (p.photos ?? []).slice(0, 1) });
  const type = transactionTypeOf(p);
  const monthly = priceUnit(type) === "per_month";
  // A price per sq ft only means something for a sale.
  const ppsf = monthly ? null : pricePerSqft(p);
  const terms = termsSummary(p, type);
  const inCompare = has(p.id);
  return (
    <article className="group overflow-hidden rounded-xl border bg-card shadow-card transition-transform hover:-translate-y-0.5">
      <Link to="/properties/$id" params={{ id: p.id }} className="block">
        <div className="relative aspect-[4/3] bg-muted">
          {urls?.[0] ? (
            <img src={urls[0]} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-xs text-muted-foreground">
              <ImageOff className="size-8" />
              {withheld && <span className="px-4">Photos withheld until this listing is public</span>}
            </div>
          )}
          <div className="absolute left-3 top-3 flex gap-1.5">
            <span className="rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-medium">{typeLabel(p.property_type)}</span>
            <span className="rounded-full bg-background/90 px-2.5 py-0.5 text-xs font-medium">{TRANSACTION_LABELS[type]}</span>
            {p.is_demo && <span className="rounded-full bg-warning px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">DEMO</span>}
          </div>
        </div>
      </Link>
      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to="/properties/$id" params={{ id: p.id }} className="font-display text-lg leading-tight hover:text-primary">
            {p.title}
          </Link>
          <VerificationBadge status={p.verification_status} />
        </div>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5" /> {p.location} · {AVAILABILITY[p.availability]}
        </p>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {p.bedrooms != null && (
            <span className="flex items-center gap-1"><BedDouble className="size-4" /> {p.bedrooms} BHK</span>
          )}
          {(p.built_area_sqft || p.land_area_sqft) && (
            <span className="flex items-center gap-1"><Ruler className="size-4" /> {p.built_area_sqft ?? p.land_area_sqft} sq ft</span>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="font-display text-2xl text-primary">
              {formatINR(p.asking_price)}{monthly && <span className="text-base text-muted-foreground">/month</span>}
            </p>
            {ppsf && <p className="text-xs text-muted-foreground">{formatINR(ppsf)}/sq ft · asking</p>}
            {terms && <p className="mt-0.5 text-xs text-muted-foreground">{terms}</p>}
          </div>
          <Button
            size="sm"
            variant={inCompare ? "default" : "outline"}
            onClick={() => {
              if (!toggle(p.id)) toast.error("You can compare up to 4 properties.");
            }}
          >
            {inCompare ? <Check /> : <Plus />} Compare
          </Button>
        </div>
      </div>
    </article>
  );
}
