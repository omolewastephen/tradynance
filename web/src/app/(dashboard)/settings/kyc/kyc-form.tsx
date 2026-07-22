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

/**
 * Downscale + recompress an image in the browser before upload. Phone photos of documents are
 * 3–6MB each; three of them exceed the serverless payload ceiling (~6MB on Netlify), where the
 * request doesn't even fail cleanly — it hangs. A 1600px JPEG keeps document text perfectly
 * legible at roughly a tenth of the size. PDFs can't be recompressed here; they pass through and
 * are caught by the total-size check instead. Falls back to the original file on any decode
 * failure — the server still enforces its own limits.
 */
async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 800 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob.slice()], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

/** Keep the multipart body comfortably under the ~6MB serverless payload cap. */
const MAX_TOTAL_BYTES = 4_500_000;

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
          // Compress images client-side and drop empty optional file fields before upload.
          let total = 0;
          for (const key of ["front", "back", "selfie"]) {
            const f = fd.get(key);
            if (!(f instanceof File) || f.size === 0) {
              fd.delete(key);
              continue;
            }
            const compressed = await compressImage(f);
            fd.set(key, compressed);
            total += compressed.size;
          }
          if (total > MAX_TOTAL_BYTES) {
            setError(
              "Attachments are too large — the upload must stay under 4.5MB in total. Photos are compressed automatically, so this usually means a large PDF: reduce its size or upload a photo of the document instead.",
            );
            return;
          }
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
        JPG, PNG, WEBP or PDF. Large photos are compressed automatically before upload. Your
        documents are stored privately and are only accessible to our compliance team.
      </p>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending} className="h-11 w-fit">
        <Upload className="size-4" />
        {isPending ? "Uploading documents…" : "Submit for verification"}
      </Button>
    </form>
  );
}
