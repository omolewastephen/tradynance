// Correctness test for VIP tier math: tier selection by volume, taker-fee discount, next-tier
// lookup. Pure — no DB writes.
import { vipTierFor, nextVipTier, effectiveTakerBps, VIP_TIERS } from "../src/index.js";

let ok = true;
const check = (n: string, p: boolean, e = "") => { console.log(p ? "PASS" : "FAIL", "-", n, e); if (!p) ok = false; };

// tier selection
check("0 volume → VIP 0", vipTierFor(0).level === 0);
check("just under VIP1 → VIP 0", vipTierFor(49_999).level === 0);
check("at VIP1 threshold → VIP 1", vipTierFor(50_000).level === 1);
check("mid range → VIP 2", vipTierFor(500_000).level === 2);
check("huge volume → top tier", vipTierFor(50_000_000).level === VIP_TIERS[VIP_TIERS.length - 1].level);

// next tier
check("next of VIP0 is VIP1", nextVipTier(VIP_TIERS[0])?.level === 1);
check("next of top tier is null", nextVipTier(VIP_TIERS[VIP_TIERS.length - 1]) === null);

// discount math (base 20 bps taker)
check("VIP0 no discount", effectiveTakerBps(20, VIP_TIERS[0]) === 20);
check("VIP1 10% off 20bps → 18", effectiveTakerBps(20, VIP_TIERS[1]) === 18);
check("VIP2 20% off 20bps → 16", effectiveTakerBps(20, VIP_TIERS[2]) === 16);
check("VIP4 35% off 20bps → 13", effectiveTakerBps(20, VIP_TIERS[4]) === 13);
check("discount never below 0", effectiveTakerBps(1, VIP_TIERS[4]) >= 0);

process.exit(ok ? 0 : 1);
