import type { Metadata } from "next";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { FINANCE_ROLES } from "@/lib/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewProjectButton, ProjectRowItem, type ProjectRow } from "./project-form";

export const metadata: Metadata = { title: "Launchpad — Admin — Tradynance" };

/** `datetime-local` needs `yyyy-MM-ddTHH:mm` with no timezone suffix. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function AdminLaunchpadPage() {
  await requireRole([...FINANCE_ROLES]);

  const [projects, assets] = await Promise.all([
    prisma.launchpadProject.findMany({
      orderBy: { startAt: "desc" },
      include: {
        tokenAsset: { select: { symbol: true } },
        saleAsset: { select: { symbol: true } },
        _count: { select: { commitments: true } },
      },
    }),
    prisma.asset.findMany({ orderBy: { symbol: "asc" }, select: { symbol: true } }),
  ]);

  const rows: ProjectRow[] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    tokenSymbol: p.tokenAsset.symbol,
    saleSymbol: p.saleAsset.symbol,
    tokenPrice: p.tokenPrice.toString(),
    totalAllocation: p.totalAllocation.toString(),
    soldAllocation: p.soldAllocation.toString(),
    minCommit: p.minCommit.toString(),
    maxCommit: p.maxCommit.toString(),
    startAt: toLocalInput(p.startAt),
    endAt: toLocalInput(p.endAt),
    status: p.status,
    description: p.description,
    commitments: p._count.commitments,
  }));

  const assetSymbols = assets.map((a) => a.symbol);

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <h1 className="font-display text-h1">Launchpad projects</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>Projects</span>
            <NewProjectButton assets={assetSymbols} />
          </CardTitle>
          <CardDescription>
            Token sales shown on the Launchpad page. Users commit in the sale asset and claim
            tokens once you mark the sale <span className="font-mono">DISTRIBUTED</span>. Projects
            with commitments can&apos;t be deleted — set them to <span className="font-mono">ENDED</span> instead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              No launchpad projects yet — create one to make the Launchpad page live for users.
            </p>
          ) : (
            <div className="flex flex-col">
              {rows.map((p) => (
                <ProjectRowItem key={p.id} project={p} assets={assetSymbols} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
