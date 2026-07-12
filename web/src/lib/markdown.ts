// Minimal, dependency-free markdown → HTML for admin-authored blog posts. Escapes HTML first,
// then applies a small, fixed set of transforms (headings, bold/italic/code, links, lists), so the
// output is safe to render. Not a full CommonMark implementation — enough for blog content.

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="rounded bg-surface-raised px-1 py-0.5 text-[0.85em]">$1</code>')
    .replace(
      /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" rel="noopener noreferrer" class="text-accent hover:underline">$1</a>',
    );
}

export function renderMarkdown(md: string): string {
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  for (const raw of esc(md).split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/^### /.test(line)) {
      closeList();
      out.push(`<h3 class="mt-8 font-display text-xl font-semibold text-foreground">${inline(line.slice(4))}</h3>`);
    } else if (/^## /.test(line)) {
      closeList();
      out.push(`<h2 class="mt-10 font-display text-2xl font-bold text-foreground">${inline(line.slice(3))}</h2>`);
    } else if (/^# /.test(line)) {
      closeList();
      out.push(`<h1 class="mt-10 font-display text-3xl font-bold text-foreground">${inline(line.slice(2))}</h1>`);
    } else if (/^[-*] /.test(line)) {
      if (!inList) {
        out.push('<ul class="ml-5 list-disc space-y-1.5">');
        inList = true;
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
    } else if (line === "") {
      closeList();
    } else {
      closeList();
      out.push(`<p class="leading-relaxed">${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join("\n");
}
