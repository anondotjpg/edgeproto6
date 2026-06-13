import {
  CHAIN_CONFIG,
  DESTINATION_CONFIG,
  type DepositAsset,
  type DepositChain,
  getRelayRefundTo,
} from "@/lib/crypto-deposits";

type JsonRecord = Record<string, unknown>;

export type RelayIntentStatus =
  | "waiting"
  | "depositing"
  | "pending"
  | "submitted"
  | "success"
  | "delayed"
  | "refund"
  | "failure";

export type RelayStatusResponse = {
  status: RelayIntentStatus;
  details?: string | null;
  failReason?: string | null;
  refundFailReason?: string | null;
  inTxHashes?: string[];
  txHashes?: string[];
  updatedAt?: number;
  originChainId?: number;
  destinationChainId?: number;
  quoteCreatedAt?: number;
};

export type RelayDepositQuote = {
  requestId: string;
  depositAddress: string;
  amountInAtomic: string;
  amountInDisplay: string;
  originChainId: number;
  originCurrency: string;
  destinationChainId: number;
  destinationCurrency: string;
  quote: unknown;
};

const RELAY_API_BASE = process.env.RELAY_API_BASE ?? "https://api.relay.link";
const RELAY_API_KEY = process.env.RELAY_API_KEY;

function relayHeaders() {
  return {
    "Content-Type": "application/json",
    ...(RELAY_API_KEY ? { "x-api-key": RELAY_API_KEY } : {}),
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function walk(
  value: unknown,
  visitor: (value: unknown) => string | null,
): string | null {
  const direct = visitor(value);

  if (direct) {
    return direct;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found: string | null = walk(item, visitor);

      if (found) {
        return found;
      }
    }

    return null;
  }

  if (isRecord(value)) {
    for (const item of Object.values(value)) {
      const found: string | null = walk(item, visitor);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

function findDepositAddress(quote: unknown) {
  return walk(quote, (value) => {
    if (!isRecord(value)) return null;

    const depositAddress = value.depositAddress;

    if (typeof depositAddress === "string" && depositAddress.length > 8) {
      return depositAddress;
    }

    if (
      isRecord(depositAddress) &&
      typeof depositAddress.address === "string" &&
      depositAddress.address.length > 8
    ) {
      return depositAddress.address;
    }

    return null;
  });
}

function findRequestId(quote: unknown) {
  if (isRecord(quote) && Array.isArray(quote.steps)) {
    for (const step of quote.steps) {
      if (isRecord(step) && typeof step.requestId === "string") {
        return step.requestId;
      }

      if (isRecord(step) && Array.isArray(step.items)) {
        for (const item of step.items) {
          if (!isRecord(item)) continue;

          const check = item.check;

          if (
            isRecord(check) &&
            typeof check.endpoint === "string" &&
            check.endpoint.includes("requestId=")
          ) {
            const requestId = check.endpoint.split("requestId=")[1]?.split("&")[0];

            if (requestId) return requestId;
          }
        }
      }
    }
  }

  return walk(quote, (value) => {
    if (!isRecord(value)) return null;
    return typeof value.requestId === "string" ? value.requestId : null;
  });
}

function getQuoteDetails(quote: unknown) {
  if (!isRecord(quote)) return null;

  const details = quote.details;

  return isRecord(details) ? details : null;
}

function findCurrencyAmountInDetails(
  quote: unknown,
  asset: DepositAsset,
): {
  amount: string;
  amountFormatted: string;
} | null {
  const details = getQuoteDetails(quote);

  const currencyIn = details?.currencyIn;

  if (isRecord(currencyIn)) {
    const currency = currencyIn.currency;

    if (
      isRecord(currency) &&
      currency.symbol === asset &&
      typeof currencyIn.amount === "string"
    ) {
      return {
        amount: currencyIn.amount,
        amountFormatted:
          typeof currencyIn.amountFormatted === "string"
            ? currencyIn.amountFormatted
            : currencyIn.amount,
      };
    }
  }

  const fromNamedCurrencyIn = walk(quote, (value) => {
    if (!isRecord(value)) return null;

    const currencyInValue = value.currencyIn;

    if (!isRecord(currencyInValue)) return null;

    const currency = currencyInValue.currency;

    if (
      isRecord(currency) &&
      currency.symbol === asset &&
      typeof currencyInValue.amount === "string"
    ) {
      return JSON.stringify({
        amount: currencyInValue.amount,
        amountFormatted:
          typeof currencyInValue.amountFormatted === "string"
            ? currencyInValue.amountFormatted
            : currencyInValue.amount,
      });
    }

    return null;
  });

  if (fromNamedCurrencyIn) {
    return JSON.parse(fromNamedCurrencyIn) as {
      amount: string;
      amountFormatted: string;
    };
  }

  const fallback = walk(quote, (value) => {
    if (!isRecord(value)) return null;

    const currency = value.currency;

    if (
      isRecord(currency) &&
      currency.symbol === asset &&
      typeof value.amount === "string"
    ) {
      return JSON.stringify({
        amount: value.amount,
        amountFormatted:
          typeof value.amountFormatted === "string"
            ? value.amountFormatted
            : value.amount,
      });
    }

    return null;
  });

  return fallback
    ? (JSON.parse(fallback) as {
        amount: string;
        amountFormatted: string;
      })
    : null;
}

async function readRelayJson(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      `Relay returned non-JSON response. Status: ${response.status}. ${text.slice(
        0,
        160,
      )}`,
    );
  }
}

export async function createRelayDepositQuote({
  chain,
  destinationAmountAtomic,
}: {
  chain: DepositChain;
  destinationAmountAtomic: bigint;
}): Promise<RelayDepositQuote> {
  const origin = CHAIN_CONFIG[chain];

  const body = {
    user: DESTINATION_CONFIG.recipient,
    recipient: DESTINATION_CONFIG.recipient,

    originChainId: origin.relayChainId,
    originCurrency: origin.relayOriginCurrency,

    destinationChainId: DESTINATION_CONFIG.chainId,
    destinationCurrency: DESTINATION_CONFIG.currency,

    amount: destinationAmountAtomic.toString(),
    tradeType: "EXACT_OUTPUT",

    useDepositAddress: true,
    strict: true,
    refundTo: getRelayRefundTo(chain),

    referrer: "edge",
  };

  const response = await fetch(`${RELAY_API_BASE}/quote/v2`, {
    method: "POST",
    headers: relayHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const quote = await readRelayJson(response);

  if (!response.ok) {
    throw new Error(
      quote?.message ||
        quote?.error ||
        `Relay quote failed with status ${response.status}.`,
    );
  }

  const requestId = findRequestId(quote);
  const depositAddress = findDepositAddress(quote);
  const amountIn = findCurrencyAmountInDetails(quote, origin.asset);

  if (!requestId) {
    throw new Error("Relay quote did not return a requestId.");
  }

  if (!depositAddress) {
    throw new Error("Relay quote did not return a deposit address.");
  }

  if (!amountIn) {
    throw new Error(
      `Relay quote did not return the required ${origin.asset} deposit amount.`,
    );
  }

  return {
    requestId,
    depositAddress,
    amountInAtomic: amountIn.amount,
    amountInDisplay: amountIn.amountFormatted,
    originChainId: origin.relayChainId,
    originCurrency: origin.relayOriginCurrency,
    destinationChainId: DESTINATION_CONFIG.chainId,
    destinationCurrency: DESTINATION_CONFIG.currency,
    quote,
  };
}

export async function getRelayIntentStatus(requestId: string) {
  const url = new URL(`${RELAY_API_BASE}/intents/status/v3`);
  url.searchParams.set("requestId", requestId);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: relayHeaders(),
    cache: "no-store",
  });

  const data = await readRelayJson(response);

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        `Relay status failed with status ${response.status}.`,
    );
  }

  return data as RelayStatusResponse;
}