import * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-10 w-full min-w-0 rounded-sm border border-border bg-surface px-3 py-2 text-base font-sans text-foreground outline-none transition-colors placeholder:text-foreground-muted focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "aria-invalid:border-danger aria-invalid:ring-danger/40",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
