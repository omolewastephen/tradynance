import type { Metadata } from "next";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { CONTENT_ROLES } from "@/lib/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NewCollectionButton,
  CollectionRowItem,
  MintForm,
  type CollectionRow,
} from "./nft-admin";

export const metadata: Metadata = { title: "NFTs — Admin — Tradynance" };

export default async function AdminNftPage() {
  await requireRole([...CONTENT_ROLES]);

  const collections = await prisma.nftCollection.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { nfts: true } } },
  });

  const rows: CollectionRow[] = collections.map((c) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol,
    description: c.description,
    nfts: c._count.nfts,
  }));

  return (
    <div className="flex animate-fade-rise flex-col gap-6">
      <h1 className="font-display text-h1">NFT collections</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <span>Collections</span>
            <NewCollectionButton />
          </CardTitle>
          <CardDescription>
            Collections shown on the NFT marketplace. A collection holding minted NFTs can&apos;t be
            deleted — those are assets someone owns.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              No collections yet — create one, then mint NFTs into it below.
            </p>
          ) : (
            <div className="flex flex-col">
              {rows.map((c) => (
                <CollectionRowItem key={c.id} collection={c} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mint an NFT</CardTitle>
          <CardDescription>
            Mints into a collection and assigns it to a user by email. Token numbers are allocated
            automatically. Artwork is generated deterministically from the seed — leave it blank and
            one is created for you. The owner can then list it for sale on the marketplace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MintForm collections={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
