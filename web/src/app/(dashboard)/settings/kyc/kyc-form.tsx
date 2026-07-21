"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitKyc } from "./actions";

const DOC_TYPES = [
  { value: "PASSPORT", label: "Passport" },
  { value: "NATIONAL_ID", label: "National ID card" },
  { value: "DRIVERS_LICENSE", label: "Driver's licence" },
  { value: "RESIDENCE_PERMIT", label: "Residence permit" },
];

const fieldClass =
  "h-9 rounded-sm border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary/50";

export function KycForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary-muted px-4 py-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="font-medium text-foreground">Verification submitted</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Our compliance team will review your documents. You&apos;ll be notified once a decision
            is made — this usually takes 1–2 business days.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          const r = await submitKyc(fd);
          if (r.ok) setDone(true);
          else setError(r.error);
        });
      }}
      className="flex flex-col gap-5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="legalName">Full legal name</Label>
          <Input id="legalName" name="legalName" placeholder="As shown on your document" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dateOfBirth">Date of birth</Label>
          <Input id="dateOfBirth" name="dateOfBirth" type="date" required />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="addressLine">Residential address</Label>
          <Input id="addressLine" name="addressLine" placeholder="Street and number" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input id="postalCode" name="postalCode" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="country">Country</Label>
          <Input id="country" name="country" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="documentType">Document type</Label>
          <select id="documentType" name="documentType" className={fieldClass} defaultValue="PASSPORT">
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="documentNumber">Document number</Label>
          <Input id="documentNumber" name="documentNumber" required />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="front">Document front</Label>
          <input
            id="front"
            name="front"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            required
            className="text-sm text-foreground-muted file:mr-3 file:rounded-sm file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="back">
            Document back <span className="text-foreground-subtle">(if applicable)</span>
          </Label>
          <input
            id="back"
            name="back"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="text-sm text-foreground-muted file:mr-3 file:rounded-sm file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="selfie">
            Selfie holding it <span className="text-foreground-subtle">(recommended)</span>
          </Label>
          <input
            id="selfie"
            name="selfie"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-sm text-foreground-muted file:mr-3 file:rounded-sm file:border-0 file:bg-surface-raised file:px-3 file:py-1.5 file:text-sm file:text-foreground"
          />
        </div>
      </div>

      <p className="text-xs text-foreground-muted">
        Files must be under 6MB each (JPG, PNG, WEBP or PDF). Your documents are stored privately
        and are only accessible to our compliance team.
      </p>

      {error && <p className="text-sm text-danger">{error}</p>}

      <Button type="submit" disabled={isPending} className="w-fit">
        <Upload className="size-4" />
        {isPending ? "Submitting…" : "Submit for verification"}
      </Button>
    </form>
  );
}
