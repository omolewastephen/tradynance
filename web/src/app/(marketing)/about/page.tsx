import type { Metadata } from "next";

import { getSiteContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "About — Tradynance" };

export default async function AboutPage() {
  const sc = await getSiteContent();
  const stats = [
    { value: sc("about.stat1.value"), label: sc("about.stat1.label") },
    { value: sc("about.stat2.value"), label: sc("about.stat2.label") },
    { value: sc("about.stat3.value"), label: sc("about.stat3.label") },
  ];

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-brand-glow" />
      <div className="relative mx-auto max-w-3xl px-5 py-20">
        <span className="text-micro font-medium uppercase tracking-wide text-primary">About</span>
        <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          {sc("about.title")}
        </h1>
        <p className="mt-6 text-lg text-foreground-muted">{sc("about.lead")}</p>

        <div className="my-12 grid grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border-subtle bg-surface p-5 text-center">
              <div className="font-display text-3xl font-bold text-primary">{s.value}</div>
              <div className="mt-1 text-xs text-foreground-muted">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 text-foreground-muted">
          {sc("about.body")
            .split("\n\n")
            .map((para, i) => (
              <p key={i} className="leading-relaxed">
                {para}
              </p>
            ))}
        </div>
      </div>
    </div>
  );
}
