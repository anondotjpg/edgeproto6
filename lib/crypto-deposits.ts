import { formatUnits, parseUnits } from "viem";
import type { PlanKey } from "@/lib/plans";

export type DepositChain = "solana" | "ethereum" | "bitcoin";
export type DepositAsset = "SOL" | "ETH" | "BTC";
export type DestinationAsset = "USDC";

export type DepositStatus =
  | "pending"
  | "processing"
  | "paid"
  | "expired"
  | "refunded"
  | "failed"
  | "invalid";

export const RELAY_SOLANA_CHAIN_ID = Number(
  process.env.RELAY_SOLANA_CHAIN_ID ?? 792703809,
);

export const RELAY_BITCOIN_CHAIN_ID = Number(
  process.env.RELAY_BITCOIN_CHAIN_ID ?? 8253038,
);

export const RELAY_ETHEREUM_CHAIN_ID = Number(
  process.env.RELAY_ETHEREUM_CHAIN_ID ?? 1,
);

export const SOLANA_USDC_MINT =
  process.env.RELAY_SOLANA_USDC_MINT ??
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export const RELAY_TREASURY_SOLANA_ADDRESS =
  process.env.RELAY_TREASURY_SOLANA_ADDRESS ??
  "2i5RNHQFmiEWFqwvmRsGK6iaV6YqiW3WqzJkArRinXiQ";

export const RELAY_AUTO_REFUND_ADDRESSES: Record<DepositChain, string> = {
  ethereum:
    process.env.RELAY_ETH_REFUND_TO ??
    "0x0000000000000000000000000000000000000000",
  bitcoin:
    process.env.RELAY_BTC_REFUND_TO ??
    "bc1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqmql8k8",
  solana:
    process.env.RELAY_SOL_REFUND_TO ??
    "11111111111111111111111111111111",
};

export const CHAIN_CONFIG: Record<
  DepositChain,
  {
    asset: DepositAsset;
    decimals: number;
    relayChainId: number;
    relayOriginCurrency: string;
    label: string;
    networkLabel: string;
  }
> = {
  solana: {
    asset: "SOL",
    decimals: 9,
    relayChainId: RELAY_SOLANA_CHAIN_ID,
    relayOriginCurrency: "11111111111111111111111111111111",
    label: "Solana",
    networkLabel: "Solana",
  },
  ethereum: {
    asset: "ETH",
    decimals: 18,
    relayChainId: RELAY_ETHEREUM_CHAIN_ID,
    relayOriginCurrency: "0x0000000000000000000000000000000000000000",
    label: "Ethereum",
    networkLabel: "Ethereum mainnet",
  },
  bitcoin: {
    asset: "BTC",
    decimals: 8,
    relayChainId: RELAY_BITCOIN_CHAIN_ID,
    relayOriginCurrency: "btc",
    label: "Bitcoin",
    networkLabel: "Bitcoin Network",
  },
};

export const DESTINATION_CONFIG = {
  chain: "solana",
  chainId: RELAY_SOLANA_CHAIN_ID,
  asset: "USDC" as DestinationAsset,
  decimals: 6,
  currency: SOLANA_USDC_MINT,
  recipient: RELAY_TREASURY_SOLANA_ADDRESS,
};

export function makePlanUsdcAmountAtomic(feeAmount: number) {
  return parseUnits(String(feeAmount), DESTINATION_CONFIG.decimals);
}

export function usdcAtomicToDisplay(atomic: bigint) {
  return formatUnits(atomic, DESTINATION_CONFIG.decimals);
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

export function getRelayRefundTo(chain: DepositChain) {
  return RELAY_AUTO_REFUND_ADDRESSES[chain];
}

export function isDepositChain(value: unknown): value is DepositChain {
  return (
    value === "solana" || value === "ethereum" || value === "bitcoin"
  );
}

export function getDepositAsset(chain: DepositChain) {
  return CHAIN_CONFIG[chain].asset;
}

export function getPaymentMethodLabel(chain: DepositChain) {
  return CHAIN_CONFIG[chain].label;
}

export function getNetworkLabel(chain: DepositChain) {
  return CHAIN_CONFIG[chain].networkLabel;
}

export function getPlanKeyValue(planKey: PlanKey) {
  return Number(planKey);
}