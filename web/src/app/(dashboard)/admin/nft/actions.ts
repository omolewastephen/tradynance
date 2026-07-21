"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireRole } from "@/lib/auth-session";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { CONTENT_ROLES } from "@/lib/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

const collectionSchema = z.object({
  name: z.string().trim().min(2, "Give the collection a name").max(80),
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Symbol must be at least 2 characters")
    .max(12)
    .regex(/^[A-Z0-9]+$/, "Symbol must be letters and numbers only"),
  description: z.string().trim().min(10, "Add a short description").max(1000),
});

export async function createCollection(formData: FormData): Promise<ActionResult> {
  const session = await requireRole([...CONTENT_ROLES]);
  const parsed = collectionSchema.safeParse({
    name: formData.get("name"),
    symbol: formData.get("symbol"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const clash = await prisma.nftCollection.findUnique({ where: { symbol: d.symbol } });
  if (clash) return { ok: false, error: `A collection with symbol ${d.symbol} already exists` };

  const collection = await prisma.nftCollection.create({ data: d });

  await recordAudit({
    actorId: session.user.id,
    action: "nft.collection_create",
    entityType: "NftCollection",
    entityId: collection.id,
    metadata: { name: d.name, symbol: d.symbol },
  });

  revalidatePath("/admin/nft");
  revalidatePath("/nft");
  return { ok: true };
}

export async function updateCollection(formData: FormData): Promise<ActionResult> {
  const session = await requireRole([...CONTENT_ROLES]);
  const id = String(formData.get("id") ?? "");
  const parsed = collectionSchema.safeParse({
    name: formData.get("name"),
    symbol: formData.get("symbol"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const clash = await prisma.nftCollection.findUnique({ where: { symbol: d.symbol } });
  if (clash && clash.id !== id) return { ok: false, error: `Symbol ${d.symbol} is already in use` };

  await prisma.nftCollection.update({ where: { id }, data: d });

  await recordAudit({
    actorId: session.user.id,
    action: "nft.collection_update",
    entityType: "NftCollection",
    entityId: id,
    metadata: { name: d.name, symbol: d.symbol },
  });

  revalidatePath("/admin/nft");
  revalidatePath("/nft");
  return { ok: true };
}

/** A collection holding NFTs is never deleted — those are owned assets. */
export async function deleteCollection(formData: FormData): Promise<ActionResult> {
  const session = await requireRole([...CONTENT_ROLES]);
  const id = String(formData.get("id") ?? "");

  const nfts = await prisma.nft.count({ where: { collectionId: id } });
  if (nfts > 0) {
    return { ok: false, error: `Collection holds ${nfts} NFT(s) and can't be deleted.` };
  }

  await prisma.nftCollection.delete({ where: { id } });
  await recordAudit({
    actorId: session.user.id,
    action: "nft.collection_delete",
    entityType: "NftCollection",
    entityId: id,
  });

  revalidatePath("/admin/nft");
  revalidatePath("/nft");
  return { ok: true };
}

const mintSchema = z.object({
  collectionId: z.string().min(1, "Pick a collection"),
  name: z.string().trim().min(1, "Give the NFT a name").max(80),
  ownerEmail: z.string().trim().toLowerCase().email("Enter the owner's email"),
  imageSeed: z.string().trim().max(80).optional().or(z.literal("")),
});

/** Mints one NFT into a collection. Art is generated deterministically from the seed. */
export async function mintNft(formData: FormData): Promise<ActionResult> {
  const session = await requireRole([...CONTENT_ROLES]);
  const parsed = mintSchema.safeParse({
    collectionId: formData.get("collectionId"),
    name: formData.get("name"),
    ownerEmail: formData.get("ownerEmail"),
    imageSeed: formData.get("imageSeed") || undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;

  const owner = await prisma.user.findUnique({ where: { email: d.ownerEmail } });
  if (!owner) return { ok: false, error: `No user with email ${d.ownerEmail}` };

  const collection = await prisma.nftCollection.findUnique({ where: { id: d.collectionId } });
  if (!collection) return { ok: false, error: "Collection not found" };

  // tokenId is unique per collection — continue from the highest minted so far.
  const last = await prisma.nft.findFirst({
    where: { collectionId: d.collectionId },
    orderBy: { tokenId: "desc" },
    select: { tokenId: true },
  });
  const tokenId = (last?.tokenId ?? 0) + 1;

  const nft = await prisma.nft.create({
    data: {
      collectionId: d.collectionId,
      tokenId,
      name: d.name,
      imageSeed: d.imageSeed || `${collection.symbol.toLowerCase()}-${tokenId}-${randomUUID().slice(0, 8)}`,
      ownerId: owner.id,
    },
  });

  await recordAudit({
    actorId: session.user.id,
    action: "nft.mint",
    entityType: "Nft",
    entityId: nft.id,
    metadata: { collection: collection.symbol, tokenId, name: d.name, owner: d.ownerEmail },
  });

  revalidatePath("/admin/nft");
  revalidatePath("/nft");
  return { ok: true };
}
