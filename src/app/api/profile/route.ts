import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { authErrorResponse, AuthError, requirePrivyAuth, userOwnsSolanaWallet } from "@/lib/privy-server";
import { assertSolanaAddress } from "@/lib/wallet-auth";

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePrivyAuth(req);
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,wallet_address,display_name,avatar_url,created_at,updated_at")
      .eq("user_id", auth.user_id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data ?? null });
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Unable to load profile" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requirePrivyAuth(req);
    const body = await req.json();
    const updates: {
      display_name?: string | null;
      wallet_address?: string | null;
      avatar_url?: string | null;
    } = {};

    if ("display_name" in body) updates.display_name = cleanText(body.display_name, 80);
    if ("avatar_url" in body) updates.avatar_url = cleanText(body.avatar_url, 2048);

    if ("wallet_address" in body) {
      const cleanedWallet = cleanText(body.wallet_address, 64);
      if (cleanedWallet) {
        const walletAddress = assertSolanaAddress(cleanedWallet, "wallet_address");
        const ownsWallet = await userOwnsSolanaWallet(auth.user_id, walletAddress);
        if (!ownsWallet) {
          throw new AuthError("Link this Solana wallet in Privy before saving it", 403);
        }
        updates.wallet_address = walletAddress;
      } else {
        updates.wallet_address = null;
      }
    }

    const supabase = createServerSupabase();
    const { data, error } = await supabase
      .from("profiles")
      .upsert({
        user_id: auth.user_id,
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
      .select("user_id,wallet_address,display_name,avatar_url,created_at,updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Unable to save profile" }, { status: 500 });
  }
}
