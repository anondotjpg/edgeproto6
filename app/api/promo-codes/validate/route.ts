// app/api/promo-codes/validate/route.ts

import { NextRequest, NextResponse } from "next/server";
import type { PlanKey } from "@/lib/plans";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validatePromoCode } from "@/lib/promo-codes";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const planKey = body.planKey as PlanKey;
    const promoCode = typeof body.promoCode === "string" ? body.promoCode : "";
    const privyUserId =
      typeof body.privyUserId === "string" ? body.privyUserId : "";

    if (!planKey || !privyUserId) {
      return NextResponse.json({ error: "Missing fields." }, { status: 400 });
    }

    const { data: userRow, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("privy_user_id", privyUserId)
      .maybeSingle();

    if (userError || !userRow) {
      return NextResponse.json({ error: "User not found." }, { status: 401 });
    }

    const result = await validatePromoCode({
      code: promoCode,
      planKey,
      userId: userRow.id,
    });

    if (!result.valid) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to validate promo." },
      { status: 500 },
    );
  }
}