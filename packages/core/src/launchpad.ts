// Launchpad — token sales. Committing debits the sale asset (e.g. USDT) from the user's SPOT
// wallet and allocates project tokens at the sale price; claiming (once the sale is DISTRIBUTED)
// credits those tokens to the SPOT wallet. Both movements are LAUNCHPAD ledger entries in the
// usual append-only style; balance is the cache. Sale proceeds go to the platform and the
// distributed tokens come from the platform — both unmodeled sinks/sources (like fees), so a
// user's commit is a clean debit and a claim a clean credit.

import { Prisma, type PrismaClient } from "../generated/prisma/index.js";
import { getSpotWallet } from "./trading-engine.js";
import { notify } from "./notifications.js";

const D = Prisma.Decimal;

export type CommitResult =
  | { ok: true; committed: string; tokenAmount: string; totalCommitted: string }
  | { ok: false; error: string };

/** Commit sale-asset into a LIVE project; allocates tokens = amount / price. Additive per user. */
export async function commitToLaunchpad(
  prisma: PrismaClient,
  input: { userId: string; projectId: string; amount: string | number },
): Promise<CommitResult> {
  const amount = new D(input.amount);
  if (amount.lessThanOrEqualTo(0)) return { ok: false, error: "Amount must be positive" };

  try {
    return await prisma.$transaction(async (tx) => {
      const project = await tx.launchpadProject.findUnique({
        where: { id: input.projectId },
        include: { saleAsset: { select: { symbol: true } } },
      });
      if (!project) return { ok: false as const, error: "Project not found" };
      if (project.status !== "LIVE") return { ok: false as const, error: "Sale is not live" };

      const existing = await tx.launchpadCommitment.findUnique({
        where: { userId_projectId: { userId: input.userId, projectId: project.id } },
      });
      const priorCommitted = existing ? new D(existing.committedAmount) : new D(0);
      const newTotal = priorCommitted.plus(amount);

      if (amount.lessThan(project.minCommit)) {
        return { ok: false as const, error: `Minimum commit is ${project.minCommit.toString()} ${project.saleAsset.symbol}` };
      }
      if (newTotal.greaterThan(project.maxCommit)) {
        return { ok: false as const, error: `Max commit is ${project.maxCommit.toString()} ${project.saleAsset.symbol} per user` };
      }

      const tokenAmount = amount.dividedBy(project.tokenPrice);
      const remaining = new D(project.totalAllocation).minus(project.soldAllocation);
      if (tokenAmount.greaterThan(remaining)) {
        return { ok: false as const, error: "Not enough allocation remaining" };
      }

      const wallet = await getSpotWallet(tx, input.userId, project.saleAssetId);
      const available = new D(wallet.balance).minus(wallet.lockedBalance);
      if (available.lessThan(amount)) {
        return { ok: false as const, error: `Insufficient ${project.saleAsset.symbol} balance` };
      }

      // Debit the sale asset.
      const newBal = new D(wallet.balance).minus(amount);
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id, userId: input.userId, assetId: project.saleAssetId,
          type: "LAUNCHPAD", status: "CONFIRMED", amount: amount.negated(), balanceAfter: newBal,
          referenceType: "LaunchpadProject", referenceId: project.id, note: `commit to ${project.name}`,
        },
      });
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });

      // Allocate tokens + record the commitment (additive).
      await tx.launchpadProject.update({
        where: { id: project.id },
        data: { soldAllocation: new D(project.soldAllocation).plus(tokenAmount) },
      });
      const commitment = await tx.launchpadCommitment.upsert({
        where: { userId_projectId: { userId: input.userId, projectId: project.id } },
        create: {
          userId: input.userId, projectId: project.id,
          committedAmount: amount, tokenAmount,
        },
        update: {
          committedAmount: newTotal,
          tokenAmount: new D(existing?.tokenAmount ?? 0).plus(tokenAmount),
        },
      });

      await notify(tx, {
        userId: input.userId, type: "LAUNCHPAD", title: "Commitment confirmed",
        body: `You committed ${amount.toString()} ${project.saleAsset.symbol} to ${project.name} for ${tokenAmount.toFixed(4)} ${project.tokenSymbol}.`,
        referenceType: "LaunchpadProject", referenceId: project.id,
      });

      return {
        ok: true as const,
        committed: amount.toString(),
        tokenAmount: tokenAmount.toString(),
        totalCommitted: new D(commitment.committedAmount).toString(),
      };
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export type ClaimResult =
  | { ok: true; tokenAmount: string; symbol: string }
  | { ok: false; error: string };

/** Claim allocated tokens once a project is DISTRIBUTED; credits the token asset to SPOT. */
export async function claimLaunchpad(
  prisma: PrismaClient,
  input: { userId: string; projectId: string },
): Promise<ClaimResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const project = await tx.launchpadProject.findUnique({
        where: { id: input.projectId },
        include: { tokenAsset: { select: { symbol: true } } },
      });
      if (!project) return { ok: false as const, error: "Project not found" };
      if (project.status !== "DISTRIBUTED") return { ok: false as const, error: "Tokens are not yet claimable" };

      const commitment = await tx.launchpadCommitment.findUnique({
        where: { userId_projectId: { userId: input.userId, projectId: project.id } },
      });
      if (!commitment) return { ok: false as const, error: "Nothing to claim" };
      if (commitment.claimed) return { ok: false as const, error: "Already claimed" };

      const tokenAmount = new D(commitment.tokenAmount);
      const wallet = await getSpotWallet(tx, input.userId, project.tokenAssetId);
      const newBal = new D(wallet.balance).plus(tokenAmount);
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id, userId: input.userId, assetId: project.tokenAssetId,
          type: "LAUNCHPAD", status: "CONFIRMED", amount: tokenAmount, balanceAfter: newBal,
          referenceType: "LaunchpadProject", referenceId: project.id, note: `claim ${project.name}`,
        },
      });
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });

      await tx.launchpadCommitment.update({
        where: { id: commitment.id },
        data: { claimed: true, claimedAt: new Date() },
      });

      await notify(tx, {
        userId: input.userId, type: "LAUNCHPAD", title: "Tokens claimed",
        body: `You claimed ${tokenAmount.toFixed(4)} ${project.tokenAsset.symbol} from ${project.name}.`,
        referenceType: "LaunchpadProject", referenceId: project.id,
      });

      return { ok: true as const, tokenAmount: tokenAmount.toString(), symbol: project.tokenAsset.symbol };
    });
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
