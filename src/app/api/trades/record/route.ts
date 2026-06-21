import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      user_wallet,
      token_mint,
      token_symbol,
      token_name,
      side,
      sol_amount,
      token_amount,
      price_usd,
      tx_signature,
    } = body;

    if (!user_wallet || !token_mint || !side || !tx_signature) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServerSupabase();

    // Upsert on tx_signature (UNIQUE) — safe to call twice if user retries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("trades") as any).upsert(
      {
        user_wallet,
        token_mint,
        token_symbol,
        token_name,
        side,
        sol_amount,
        token_amount,
        price_usd: price_usd ?? null,
        tx_signature,
      },
      { onConflict: "tx_signature" }
    );

    if (error) {
      console.error("[trades/record]", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
