import * as React from "react";

import { cn } from "@/lib/utils";

function SelectNative({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select-native"
      className={cn(
        "flex h-10 w-full min-w-0 appearance-none rounded-sm border border-border bg-surface px-3 py-2 text-sm font-sans text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export { SelectNative };
