// lib/promo-codes.ts

import type { PlanKey } from "@/lib/plans";
import { supabaseAdmin } from "./supabase-admin";

type PromoResult = {
  valid: boolean;
  code: string | null;
  promoCodeId: string | null;
  subtotalCents: number;
  discountCents: number;
  finalCents: number;
  message: string | null;
};

const PLAN_FEES_CENTS: Record<PlanKey, number> = {
  "10000": 29900,
  "5000": 17900,
  "2000": 8900,
  "1000": 4900,
};

export function normalizePromoCode(code: string | null | undefined) {
  return code?.trim().toUpperCase().replace(/\s+/g, "") || null;
}

export function getPlanSubtotalCents(planKey: PlanKey) {
  return PLAN_FEES_CENTS[planKey];
}

export async function validatePromoCode({
  code,
  planKey,
  userId,
}: {
  code: string | null | undefined;
  planKey: PlanKey;
  userId: string;
}): Promise<PromoResult> {
  const subtotalCents = getPlanSubtotalCents(planKey);
  const normalizedCode = normalizePromoCode(code);

  if (!normalizedCode) {
    return {
      valid: true,
      code: null,
      promoCodeId: null,
      subtotalCents,
      discountCents: 0,
      finalCents: subtotalCents,
      message: null,
    };
  }

  const { data: promo, error } = await supabaseAdmin
    .from("promo_codes")
    .select("*")
    .eq("code", normalizedCode)
    .eq("active", true)
    .maybeSingle();

  if (error || !promo) {
    return {
      valid: false,
      code: normalizedCode,
      promoCodeId: null,
      subtotalCents,
      discountCents: 0,
      finalCents: subtotalCents,
      message: "Invalid promo code.",
    };
  }

  const now = Date.now();

  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) {
    return {
      valid: false,
      code: normalizedCode,
      promoCodeId: promo.id,
      subtotalCents,
      discountCents: 0,
      finalCents: subtotalCents,
      message: "Promo code is not active yet.",
    };
  }

  if (promo.expires_at && new Date(promo.expires_at).getTime() <= now) {
    return {
      valid: false,
      code: normalizedCode,
      promoCodeId: promo.id,
      subtotalCents,
      discountCents: 0,
      finalCents: subtotalCents,
      message: "Promo code has expired.",
    };
  }

  if (
    Array.isArray(promo.allowed_plan_keys) &&
    promo.allowed_plan_keys.length > 0 &&
    !promo.allowed_plan_keys.includes(planKey)
  ) {
    return {
      valid: false,
      code: normalizedCode,
      promoCodeId: promo.id,
      subtotalCents,
      discountCents: 0,
      finalCents: subtotalCents,
      message: "Promo code is not valid for this account.",
    };
  }

  const { count: globalCount } = await supabaseAdmin
    .from("promo_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("promo_code_id", promo.id)
    .in("status", ["reserved", "redeemed"]);

  if (
    promo.max_redemptions !== null &&
    promo.max_redemptions !== undefined &&
    (globalCount ?? 0) >= promo.max_redemptions
  ) {
    return {
      valid: false,
      code: normalizedCode,
      promoCodeId: promo.id,
      subtotalCents,
      discountCents: 0,
      finalCents: subtotalCents,
      message: "Promo code has reached its limit.",
    };
  }

  const { count: userCount } = await supabaseAdmin
    .from("promo_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("promo_code_id", promo.id)
    .eq("user_id", userId)
    .in("status", ["reserved", "redeemed"]);

  if (
    promo.max_redemptions_per_user !== null &&
    promo.max_redemptions_per_user !== undefined &&
    (userCount ?? 0) >= promo.max_redemptions_per_user
  ) {
    return {
      valid: false,
      code: normalizedCode,
      promoCodeId: promo.id,
      subtotalCents,
      discountCents: 0,
      finalCents: subtotalCents,
      message: "You already used this promo code.",
    };
  }

  const discountCents =
    promo.discount_type === "percent"
      ? Math.floor(subtotalCents * (Number(promo.percent_off) / 100))
      : Number(promo.amount_off_cents);

  const safeDiscountCents = Math.min(subtotalCents, Math.max(0, discountCents));
  const finalCents = Math.max(0, subtotalCents - safeDiscountCents);

  return {
    valid: true,
    code: normalizedCode,
    promoCodeId: promo.id,
    subtotalCents,
    discountCents: safeDiscountCents,
    finalCents,
    message: "Promo code applied.",
  };
}