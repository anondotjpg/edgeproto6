import crypto from "crypto";
import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { formatUnits, isAddress, parseUnits } from "viem";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PLAN_CONFIG, type PlanKey } from "@/lib/plans";

type DepositChain = "solana" | "ethereum" | "bitcoin";

type CreateDepositBody = {
  planKey?: PlanKey;
  chain?: DepositChain;
  fromAddress?: string;
  privyUserId?: string;
  email?: string | null;
  walletAddress?: string | null;
};

const PROFIT_TARGET_PERCENT = 25;
const DAILY_DRAWDOWN_PERCENT = 2;
const TOTAL_DRAWDOWN_PERCENT = 5;
const MAX_RISK_PER_TRADE_PERCENT = 5;

const CHAIN_CONFIG = {
  solana: {
    asset: "SOL",
    decimals: 9,
    depositAddressEnv: "SOL_DEPOSIT_ADDRESS",
  },
  ethereum: {
    asset: "ETH",
    decimals: 18,
    depositAddressEnv: "ETH_DEPOSIT_ADDRESS",
  },
  bitcoin: {
    asset: "BTC",
    decimals: 8,
    depositAddressEnv: "BTC_DEPOSIT_ADDRESS",
  },
} as const;

const PLAN_CRYPTO_AMOUNTS: Partial<
  Record<PlanKey, Record<DepositChain, string>>
> = {
  "10000": {
    solana: "0.65",
    ethereum: "0.025",
    bitcoin: "0.001",
  },
  "5000": {
    solana: "0.38",
    ethereum: "0.014",
    bitcoin: "0.00055",
  },
};

function isValidFromAddress(chain: DepositChain, address: string) {
  if (chain === "ethereum") {
    return isAddress(address);
  }

  if (chain === "solana") {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,90}$/.test(address);
}

function getDepositAddress(chain: DepositChain) {
  const envName = CHAIN_CONFIG[chain].depositAddressEnv;
  const address = process.env[envName];

  if (!address) {
    throw new Error(`Missing ${envName}`);
  }

  return address;
}

function makeInvoiceAmountAtomic({
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateDepositBody;

    const {
      planKey,
      chain,
      fromAddress,
      privyUserId,
      email,
      walletAddress,
    } = body;

    if (!planKey || !(planKey in PLAN_CONFIG)) {
      return NextResponse.json(
        { error: "Invalid plan selected." },
        { status: 400 }
      );
    }

    if (!chain || !(chain in CHAIN_CONFIG)) {
      return NextResponse.json(
        { error: "Invalid deposit currency." },
        { status: 400 }
      );
    }

    if (!privyUserId) {
      return NextResponse.json(
        { error: "Missing Privy user ID." },
        { status: 400 }
      );
    }

    const cleanFromAddress = String(fromAddress || "").trim();

    if (!isValidFromAddress(chain, cleanFromAddress)) {
      return NextResponse.json(
        { error: "Invalid sending address." },
        { status: 400 }
      );
    }

    const selectedPlan = PLAN_CONFIG[planKey];
    const planSize = Number(selectedPlan.planKey);

    const { data: existingUser, error: existingUserError } =
      await supabaseAdmin
        .from("users")
        .select("id")
        .eq("privy_user_id", privyUserId)
        .maybeSingle();

    if (existingUserError) {
      throw existingUserError;
    }

    let userId = existingUser?.id as string | undefined;

    if (!userId) {
      const { data: insertedUser, error: insertUserError } =
        await supabaseAdmin
          .from("users")
          .insert({
            privy_user_id: privyUserId,
            email: email ?? null,
            wallet_address: walletAddress ?? null,
          })
          .select("id")
          .single();

      if (insertUserError) {
        throw insertUserError;
      }

      userId = insertedUser.id;
    } else {
      const { error: updateUserError } = await supabaseAdmin
        .from("users")
        .update({
          email: email ?? null,
          wallet_address: walletAddress ?? null,
        })
        .eq("id", userId);

      if (updateUserError) {
        throw updateUserError;
      }
    }

    const amountAtomic = makeInvoiceAmountAtomic({ planKey, chain });
    const amountDisplay = formatUnits(amountAtomic, CHAIN_CONFIG[chain].decimals);

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("crypto_deposit_invoices")
      .insert({
        user_id: userId,
        plan_key: selectedPlan.planKey,

        chain,
        asset: CHAIN_CONFIG[chain].asset,

        deposit_address: getDepositAddress(chain),
        expected_from_address: cleanFromAddress,

        expected_amount_atomic: amountAtomic.toString(),
        expected_amount_display: amountDisplay,

        status: "pending",
        expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),

        account_starting_balance: planSize,
        account_max_risk_amount:
          planSize * (MAX_RISK_PER_TRADE_PERCENT / 100),
        account_daily_loss_limit_amount:
          planSize * (DAILY_DRAWDOWN_PERCENT / 100),
        account_total_loss_limit_amount:
          planSize * (TOTAL_DRAWDOWN_PERCENT / 100),
        one_time_fee: selectedPlan.feeAmount,
      })
      .select(
        `
        id,
        chain,
        asset,
        deposit_address,
        expected_from_address,
        expected_amount_display,
        status,
        expires_at,
        tx_hash,
        confirmations,
        credited_account_id
      `
      )
      .single();

    if (invoiceError) {
      throw invoiceError;
    }

    return NextResponse.json({
      ok: true,
      invoice,
    });
  } catch (error) {
    console.error("Create crypto deposit invoice error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create deposit invoice.",
      },
      { status: 500 }
    );
  }
}