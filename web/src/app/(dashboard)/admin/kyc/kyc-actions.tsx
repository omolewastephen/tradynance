"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { setKycStatus } from "../users/actions";

export function KycActions({ userId }: { userId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function run(status: "VERIFIED" | "REJECTED") {
    startTransition(async () => {
      await setKycStatus(userId, status);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <button
        disabled={isPending}
        onClick={() => run("VERIFIED")}
        className="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        disabled={isPending}
        onClick={() => run("REJECTED")}
        className="rounded-sm border border-border px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:text-danger disabled:opacity-50"
      >
        Reject
      </button>
    </div>
  );
}
