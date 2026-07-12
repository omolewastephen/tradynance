"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveSiteContent } from "./actions";

// Group keys by their first segment (home / about / contact / footer) for a tidy editor.
function groupOf(key: string) {
  return key.split(".")[0];
}
function labelOf(key: string) {
  return key.split(".").slice(1).join(" · ");
}

export function ContentEditor({ values }: { values: Record<string, string> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const groups: Record<string, string[]> = {};
  for (const key of Object.keys(values)) (groups[groupOf(key)] ??= []).push(key);

  function onSubmit(formData: FormData) {
    setSaved(false);
    start(async () => {
      await saveSiteContent(formData);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-6">
      {Object.entries(groups).map(([group, keys]) => (
        <div key={group} className="rounded-md border border-border bg-surface">
          <div className="border-b border-border-subtle px-4 py-2.5 text-sm font-medium capitalize">{group}</div>
          <div className="flex flex-col gap-3 p-4">
            {keys.map((key) => {
              const long = values[key].length > 60;
              return (
                <label key={key} className="flex flex-col gap-1 text-xs text-foreground-muted">
                  {labelOf(key)}
                  {long ? (
                    <textarea
                      name={key}
                      defaultValue={values[key]}
                      rows={3}
                      className="rounded-sm border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                    />
                  ) : (
                    <input
                      name={key}
                      defaultValue={values[key]}
                      className="rounded-sm border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                    />
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-sm bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save content"}
        </button>
        {saved && <span className="text-sm text-primary">Saved</span>}
      </div>
    </form>
  );
}
