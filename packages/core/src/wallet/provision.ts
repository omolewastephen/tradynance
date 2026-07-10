// Provision (get-or-create) a user's wallet for an asset+network, assigning a unique HD
// derivation index and deriving its deposit address. The index is drawn from
// DerivationCounter inside the same transaction as the Wallet insert, so two concurrent
// provisions can never receive the same index (and therefore never share an address).

import type { PrismaClient } from "../../generated/prisma/index.js";
import { deriveDepositAddress, isDerivableNetwork } from "./derivation.js";

export interface ProvisionWalletInput {
  userId: string;
  assetId: string;
  /** AssetNetwork.network, e.g. "BTC_TESTNET". */
  network: string;
}

export interface ProvisionedWallet {
  id: string;
  depositAddress: string | null;
  network: string;
  derivationIndex: number | null;
}

export async function provisionWallet(
  prisma: PrismaClient,
  mnemonic: string,
  input: ProvisionWalletInput,
): Promise<ProvisionedWallet> {
  const existing = await prisma.wallet.findFirst({
    where: { userId: input.userId, assetId: input.assetId, network: input.network },
  });
  if (existing && existing.depositAddress) {
    return {
      id: existing.id,
      depositAddress: existing.depositAddress,
      network: existing.network ?? input.network,
      derivationIndex: existing.derivationIndex,
    };
  }

  // Networks we don't derive live addresses for yet: create the wallet with no address.
  if (!isDerivableNetwork(input.network)) {
    const wallet =
      existing ??
      (await prisma.wallet.create({
        data: {
          userId: input.userId,
          assetId: input.assetId,
          network: input.network,
        },
      }));
    return {
      id: wallet.id,
      depositAddress: null,
      network: input.network,
      derivationIndex: null,
    };
  }

  return prisma.$transaction(async (tx) => {
    // Atomically claim the next derivation index for this network.
    const counter = await tx.derivationCounter.upsert({
      where: { network: input.network },
      create: { network: input.network, nextIndex: 1 },
      update: { nextIndex: { increment: 1 } },
    });
    // After create the claimed index is 0; after an increment-to-N the claimed index is N-1.
    const derivationIndex = counter.nextIndex - 1;

    const { address } = deriveDepositAddress(mnemonic, input.network, derivationIndex);

    if (existing) {
      const updated = await tx.wallet.update({
        where: { id: existing.id },
        data: { depositAddress: address, derivationIndex },
      });
      return {
        id: updated.id,
        depositAddress: address,
        network: input.network,
        derivationIndex,
      };
    }

    const wallet = await tx.wallet.create({
      data: {
        userId: input.userId,
        assetId: input.assetId,
        network: input.network,
        depositAddress: address,
        derivationIndex,
      },
    });
    return {
      id: wallet.id,
      depositAddress: address,
      network: input.network,
      derivationIndex,
    };
  });
}
