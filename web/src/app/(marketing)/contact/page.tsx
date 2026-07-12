import type { Metadata } from "next";
import { Mail, MessageSquare, ShieldCheck } from "lucide-react";

import { getSiteContent } from "@/lib/site-content";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = { title: "Contact — Tradynance" };

export default async function ContactPage() {
  const sc = await getSiteContent();

  return (
    <div className="mx-auto max-w-5xl px-5 py-20">
      <div className="grid gap-12 md:grid-cols-[1fr_1.2fr]">
        <div>
          <span className="text-micro font-medium uppercase tracking-wide text-primary">Contact</span>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight">{sc("contact.title")}</h1>
          <p className="mt-4 text-foreground-muted">{sc("contact.subtitle")}</p>

          <ul className="mt-8 flex flex-col gap-4">
            {[
              { icon: MessageSquare, title: "Product & support", body: "Platform questions, account help, feedback." },
              { icon: Mail, title: "Partnerships", body: "Listings, integrations, and business enquiries." },
              { icon: ShieldCheck, title: "Security", body: "Report a vulnerability responsibly." },
            ].map((r) => (
              <li key={r.title} className="flex gap-3">
                <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary-muted text-primary">
                  <r.icon className="size-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-sm text-foreground-muted">{r.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <ContactForm />
      </div>
    </div>
  );
}
