import crypto from "crypto";
import { formatUnits, parseUnits } from "viem";
import type { PlanKey } from "@/lib/plans";

export type DepositChain = "solana" | "ethereum" | "bitcoin";
export type DepositAsset = "SOL" | "ETH" | "BTC";

export const CHAIN_CONFIG: Record<
  DepositChain,
  {
    asset: DepositAsset;
    decimals: number;
    minConfirmations: number;
    depositAddressEnv: string;
  }
> = {
  solana: {
    asset: "SOL",
    decimals: 9,
    minConfirmations: 1,
    depositAddressEnv: "SOL_DEPOSIT_ADDRESS",
  },
  ethereum: {
    asset: "ETH",
    decimals: 18,
    minConfirmations: 12,
    depositAddressEnv: "ETH_DEPOSIT_ADDRESS",
  },
  bitcoin: {
    asset: "BTC",
    decimals: 8,
    minConfirmations: 2,
    depositAddressEnv: "BTC_DEPOSIT_ADDRESS",
  },
};

export const PLAN_CRYPTO_AMOUNTS: Partial<
  Record<PlanKey, Record<DepositChain, string>>
> = {
  "1000": {
    solana: "0.105",
    ethereum: "0.004",
    bitcoin: "0.00015",
  },
  "2000": {
    solana: "0.19",
    ethereum: "0.007",
    bitcoin: "0.0003",
  },
  "5000": {
    solana: "0.38",
    ethereum: "0.014",
    bitcoin: "0.00055",
  },
  "10000": {
    solana: "0.65",
    ethereum: "0.025",
    bitcoin: "0.001",
  },
};

export function getDepositAddress(chain: DepositChain) {
  const envName = CHAIN_CONFIG[chain].depositAddressEnv;
  const address = process.env[envName];

  if (!address) {
    throw new Error(`Missing ${envName}`);
  }

  return address;
}

export function makeInvoiceAmountAtomic({
  planKey,
  chain,
}: {
  planKey: PlanKey;
  chain: DepositChain;
}) {
  const baseAmount = PLAN_CRYPTO_AMOUNTS[planKey]?.[chain];

  if (!baseAmount) {
    throw new Error(`Missing crypto amount for ${planKey} on ${chain}.`);
  }

  const decimals = CHAIN_CONFIG[chain].decimals;
  const baseAtomic = parseUnits(baseAmount, decimals);

  const dust = BigInt(crypto.randomInt(1, 999));

  return baseAtomic + dust;
}

export function atomicToDisplay({
  chain,
  atomic,
}: {
  chain: DepositChain;
  atomic: bigint;
}) {
  return formatUnits(atomic, CHAIN_CONFIG[chain].decimals);
}

export function hasEnoughConfirmations({
  chain,
  confirmations,
}: {
  chain: DepositChain;
  confirmations: number;
}) {
  return confirmations >= CHAIN_CONFIG[chain].minConfirmations;
}