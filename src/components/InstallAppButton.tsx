import { Smartphone, Share, MoreVertical, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const STEPS = [
  {
    title: "iPhone (Safari)",
    steps: [
      "Open this site in Safari.",
      "Tap the Share button (square with an arrow pointing up).",
      "Scroll down and tap “Add to Home Screen”.",
      "Tap “Add” — the PropWise icon appears on your home screen.",
    ],
    icons: [Share, PlusSquare],
  },
  {
    title: "Android (Chrome)",
    steps: [
      "Open this site in Chrome.",
      "Tap the three-dot menu at the top right.",
      "Tap “Add to Home screen” or “Install app”.",
      "Tap “Add” — the PropWise icon appears on your home screen.",
    ],
    icons: [MoreVertical, PlusSquare],
  },
];

export function InstallAppButton({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className={className}>
          <Smartphone /> Install app
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add PropWise to your phone</DialogTitle>
          <DialogDescription>
            No app store needed — the site installs straight from your browser and opens like an app.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {STEPS.map((s) => (
            <div key={s.title}>
              <h3 className="flex items-center gap-2 font-semibold">
                {s.icons.map((Icon, i) => (
                  <Icon key={i} className="size-4 text-gold" />
                ))}
                {s.title}
              </h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                {s.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Tip: installing works on the published site. Your sign-in and saved research carry over.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
