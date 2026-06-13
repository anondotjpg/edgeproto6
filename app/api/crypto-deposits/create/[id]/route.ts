import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const privyUserId = url.searchParams.get("privyUserId");

    if (!privyUserId) {
      return NextResponse.json(
        { error: "Missing Privy user ID." },
        { status: 400 }
      );
    }

    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("privy_user_id", privyUserId)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (!user?.id) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("crypto_deposit_invoices")
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
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json(
        { error: "Invoice not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      invoice,
    });
  } catch (error) {
    console.error("Read crypto deposit invoice error:", error);

    return NextResponse.json(
      { error: "Unable to read deposit invoice." },
      { status: 500 }
    );
  }
}