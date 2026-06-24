import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { authErrorResponse, requirePrivyAuth } from "@/lib/privy-server";
import { requireOwnedSolanaWallet } from "@/lib/wallet-auth";

function limitFrom(req: NextRequest): number {
  const parsed = Number(req.nextUrl.searchParams.get("limit") ?? "50");
  if (!Number.isInteger(parsed) || parsed < 1) return 50;
  return Math.min(parsed, 100);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePrivyAuth(req);
    const wallet = req.nextUrl.searchParams.get("wallet");
    const supabase = createServerSupabase();

    let query = supabase
      .from("trades")
      .select("*")
      .eq("user_id", auth.user_id)
      .order("created_at", { ascending: false })
      .limit(limitFrom(req));

    if (wallet) {
      const { address } = await requireOwnedSolanaWallet(req, wallet);
      query = query.eq("user_wallet", address);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trades: data ?? [] });
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Unable to load trade history" }, { status: 500 });
  }
}
