"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitContact } from "./actions";

export function ContactForm() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    start(async () => {
      const res = await submitContact(formData);
      if (res.ok) setDone(true);
      else setError(res.error);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border-subtle bg-surface p-10 text-center">
        <CheckCircle2 className="size-9 text-primary" />
        <div className="font-display text-lg font-semibold">Message sent</div>
        <p className="text-sm text-foreground-muted">Thanks — the team will get back to you by email.</p>
      </div>
    );
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-surface p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          className="rounded-sm border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-foreground-subtle focus:border-primary/50"
        />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={cn(
          "self-start rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50",
        )}
      >
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
