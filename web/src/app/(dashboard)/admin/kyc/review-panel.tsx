"use client";

import { useState, useTransition } from "react";
import { Check, ExternalLink, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reviewKycSubmission } from "./actions";

export type SubmissionRow = {
  id: string;
  email: string;
  username: string | null;
  legalName: string;
  dateOfBirth: string;
  address: string;
  documentType: string;
  documentNumber: string;
  submittedAt: string;
  /** Short-lived signed URLs — generated per page render, expire in minutes. */
  docs: { label: string; url: string | null }[];
};

export function ReviewPanel({ submission }: { submission: SubmissionRow }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  return (
    <div className="flex flex-col gap-4 border-b border-border-subtle py-5 last:border-0">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-medium">{submission.legalName}</span>
        <span className="text-sm text-foreground-muted">{submission.email}</span>
        {submission.username && (
          <span className="text-xs text-foreground-subtle">@{submission.username}</span>
        )}
        <span className="text-xs text-foreground-subtle">submitted {submission.submittedAt}</span>
      </div>

      <div className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Date of birth" value={submission.dateOfBirth} />
        <Field label="Document" value={submission.documentType.replace(/_/g, " ")} />
        <Field label="Document no." value={submission.documentNumber} mono />
        <Field label="Address" value={submission.address} className="sm:col-span-2 lg:col-span-3" />
      </div>

      <div className="flex flex-wrap gap-2">
        {submission.docs.map((d) =>
          d.url ? (
            <a
              key={d.label}
              href={d.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-raised"
            >
              {d.label} <ExternalLink className="size-3" />
            </a>
          ) : (
            <span
              key={d.label}
              className="rounded-sm border border-border-subtle px-3 py-1.5 text-xs text-foreground-subtle"
            >
              {d.label} unavailable
            </span>
          ),
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {rejecting ? (
        <form
          action={(fd) => {
            setError(null);
            startTransition(async () => {
              const r = await reviewKycSubmission(fd);
              if (!r.ok) setError(r.error);
              else setRejecting(false);
            });
          }}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input type="hidden" name="submissionId" value={submission.id} />
          <input type="hidden" name="decision" value="REJECTED" />
          <Input
            name="rejectionReason"
            placeholder="Reason the applicant will see (e.g. document is blurred)"
            className="sm:max-w-md"
            required
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" variant="outline" disabled={isPending}>
              Confirm rejection
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex gap-2">
          <form
            action={(fd) => {
              setError(null);
              startTransition(async () => {
                const r = await reviewKycSubmission(fd);
                if (!r.ok) setError(r.error);
              });
            }}
          >
            <input type="hidden" name="submissionId" value={submission.id} />
            <input type="hidden" name="decision" value="VERIFIED" />
            <Button type="submit" size="sm" disabled={isPending}>
              <Check className="size-4" />
              Approve
            </Button>
          </form>
          <Button size="sm" variant="outline" onClick={() => setRejecting(true)} disabled={isPending}>
            <X className="size-4" />
            Reject
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="text-xs uppercase tracking-wide text-foreground-subtle">{label}</span>
      <div className={mono ? "font-mono text-sm" : "text-sm"}>{value}</div>
    </div>
  );
}
