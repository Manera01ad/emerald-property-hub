import { cn } from "@/lib/utils";
import { TRANSACTION_LABELS, TRANSACTION_TYPES, type TransactionType } from "@/lib/transaction";

/**
 * The one selector that decides what the rest of a page means. Buy, rent and lease are the
 * same product with different terms, so this is a switch rather than three separate pages.
 */
export function TransactionSelector({
  value,
  onChange,
  className,
  size = "default",
}: {
  value: TransactionType;
  onChange: (type: TransactionType) => void;
  className?: string;
  size?: "default" | "sm";
}) {
  return (
    <div
      role="tablist"
      aria-label="Transaction type"
      className={cn("inline-flex rounded-lg border bg-muted p-1", className)}
    >
      {TRANSACTION_TYPES.map((t) => (
        <button
          key={t}
          role="tab"
          type="button"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          className={cn(
            "rounded-md font-medium transition-colors",
            size === "sm" ? "px-3 py-1 text-sm" : "px-4 py-1.5 text-sm",
            value === t
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {TRANSACTION_LABELS[t]}
        </button>
      ))}
    </div>
  );
}
