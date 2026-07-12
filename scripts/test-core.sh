#!/usr/bin/env bash
# Run every packages/core money-correctness test in sequence; fail if any fails. These are direct
# DB tests (they create + clean up their own throwaway data) — run against a seeded DB with NO
# market-maker resting orders (see prisma/seed-ci.ts), else its liquidity crosses the trading
# test's own orders. Used by CI and runnable locally: `npm run test:core`.
set -euo pipefail
cd "$(dirname "$0")/.."

TESTS=(trading futures convert withdrawal referrals vip staking launchpad nft)
FAILED=()

for t in "${TESTS[@]}"; do
  echo "── $t ─────────────────────────────────────────"
  if node_modules/.bin/tsx "packages/core/scripts/${t}-test.ts"; then
    echo "✓ $t"
  else
    echo "✗ $t"
    FAILED+=("$t")
  fi
done

echo
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "All ${#TESTS[@]} core test suites passed."
else
  echo "FAILED: ${FAILED[*]}"
  exit 1
fi
