"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { requestWithdrawal, confirmWithdrawal } from "./actions";

export type WithdrawAsset = {
  id: string;
  symbol: string;
  name: string;
  networks: { network: string; withdrawalFee: string; requiresMemo: boolean }[];
};

type WhitelistEntry = { network: string; address: string; label: string };

export function WithdrawForm({
  assets,
  available,
  whitelist,
}: {
  assets: WithdrawAsset[];
  available: Record<string, number>;
  whitelist: WhitelistEntry[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // form state
  const [symbol, setSymbol] = useState(assets[0]?.symbol ?? "");
  const asset = assets.find((a) => a.symbol === symbol) ?? assets[0];
  const [network, setNetwork] = useState(asset?.networks[0]?.network ?? "");
  const net = asset?.networks.find((n) => n.network === network) ?? asset?.networks[0];
  const [address, setAddress] = useState("");
  const [memo, setMemo] = useState("");
  const [amount, setAmount] = useState("");

  // confirm state
  const [step, setStep] = useState<"request" | "confirm" | "done">("request");
  const [withdrawalId, setWithdrawalId] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [otp, setOtp] = useState("");
  const [secondFactor, setSecondFactor] = useState("");

  const avail = asset && net ? (available[`${asset.id}:${net.network}`] ?? 0) : 0;
  const fee = net ? Number(net.withdrawalFee) : 0;

  const networkWhitelist = useMemo(
    () => whitelist.filter((w) => w.network === network),
    [whitelist, network],
  );

  function resetForm() {
    setStep("request");
    setAddress("");
    setMemo("");
    setAmount("");
    setOtp("");
    setSecondFactor("");
    setWithdrawalId("");
    setError(null);
  }

  function onRequest() {
    setError(null);
    if (!asset || !net) return;
    const fd = new FormData();
    fd.set("assetSymbol", asset.symbol);
    fd.set("network", net.network);
    fd.set("destinationAddress", address);
    fd.set("destinationMemo", memo);
    fd.set("amount", amount);
    startTransition(async () => {
      const res = await requestWithdrawal(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setWithdrawalId(res.withdrawalId);
      setRequiresTwoFactor(res.requiresTwoFactor);
      setStep("confirm");
    });
  }

  function onConfirm() {
    setError(null);
    const fd = new FormData();
    fd.set("withdrawalId", withdrawalId);
    fd.set("otp", otp);
    if (requiresTwoFactor) fd.set("totp", secondFactor);
    else fd.set("password", secondFactor);
    startTransition(async () => {
      const res = await confirmWithdrawal(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setStep("done");
      router.refresh();
    });
  }

  if (step === "done") {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-sm border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          Withdrawal submitted and funds reserved. It now awaits admin approval before being
          sent on-chain.
        </p>
        <Button variant="secondary" className="w-fit" onClick={resetForm}>
          New withdrawal
        </Button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-foreground-muted">
          We emailed a 6-digit code to confirm this withdrawal. Enter it plus{" "}
          {requiresTwoFactor ? "your authenticator (2FA) code" : "your account password"}.
        </p>
        {error && (
          <p className="rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="otp">Email code</Label>
          <Input
            id="otp"
            inputMode="numeric"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="font-mono tracking-[0.3em]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sf">
            {requiresTwoFactor ? "Authenticator code" : "Account password"}
          </Label>
          <Input
            id="sf"
            type={requiresTwoFactor ? "text" : "password"}
            inputMode={requiresTwoFactor ? "numeric" : undefined}
            value={secondFactor}
            onChange={(e) => setSecondFactor(e.target.value)}
            className={requiresTwoFactor ? "font-mono tracking-[0.3em]" : undefined}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={onConfirm} disabled={isPending}>
            {isPending ? "Confirming…" : "Confirm withdrawal"}
          </Button>
          <Button variant="ghost" onClick={resetForm} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // step === "request"
  const total = (Number(amount) || 0) + fee;
  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-sm border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="asset">Asset</Label>
          <SelectNative
            id="asset"
            value={symbol}
            onChange={(e) => {
              const s = e.target.value;
              setSymbol(s);
              const a = assets.find((x) => x.symbol === s);
              setNetwork(a?.networks[0]?.network ?? "");
            }}
          >
            {assets.map((a) => (
              <option key={a.symbol} value={a.symbol}>
                {a.symbol}
              </option>
            ))}
          </SelectNative>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="network">Network</Label>
          <SelectNative
            id="network"
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
          >
            {asset?.networks.map((n) => (
              <option key={n.network} value={n.network}>
                {n.network}
              </option>
            ))}
          </SelectNative>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="address">Destination address</Label>
        <Input
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="font-mono text-sm"
          placeholder="External wallet address"
        />
        {networkWhitelist.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {networkWhitelist.map((w) => (
              <button
                key={w.address}
                type="button"
                onClick={() => setAddress(w.address)}
                className="rounded-sm border border-border px-2 py-1 text-xs text-foreground-muted transition-colors hover:border-primary/40 hover:text-primary"
              >
                {w.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {net?.requiresMemo && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="memo">Memo / tag (required for this network)</Label>
          <Input id="memo" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="amount">Amount</Label>
          <button
            type="button"
            onClick={() => setAmount(String(Math.max(0, avail - fee)))}
            className="text-xs text-accent hover:underline"
          >
            Max
          </button>
        </div>
        <Input
          id="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <span className="text-foreground-muted">Available</span>
        <span className="text-right font-mono tabular-nums">
          {avail.toLocaleString(undefined, { maximumFractionDigits: 8 })} {asset?.symbol}
        </span>
        <span className="text-foreground-muted">Network fee</span>
        <span className="text-right font-mono tabular-nums">
          {fee} {asset?.symbol}
        </span>
        <span className="text-foreground-muted">Total debit</span>
        <span className="text-right font-mono tabular-nums">
          {total.toLocaleString(undefined, { maximumFractionDigits: 8 })} {asset?.symbol}
        </span>
      </div>

      <Button onClick={onRequest} disabled={isPending || !amount || !address}>
        {isPending ? "Submitting…" : "Continue"}
      </Button>
    </div>
  );
}
