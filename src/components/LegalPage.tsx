export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <h1 className="text-4xl">{title}</h1>
      <p className="mt-2 text-xs text-muted-foreground">Draft — review with a qualified lawyer before public launch.</p>
      <div className="gold-rule my-6" />
      <div className="space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:text-xl [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </div>
  );
}
