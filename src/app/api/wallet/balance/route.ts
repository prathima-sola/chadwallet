import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/privy-server";
import { requireOwnedSolanaWallet } from "@/lib/wallet-auth";

const RPC_URL =
  process.env.ALCHEMY_SOLANA_RPC_URL ??
  process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

interface BalanceResponse {
  result?: {
    value?: number;
  };
  error?: {
    message?: string;
  };
}

async function getSolBalance(address: string): Promise<number> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getBalance",
      params: [address, { commitment: "confirmed" }],
    }),
  });
  const json = await res.json().catch(() => null) as BalanceResponse | null;
  if (!res.ok || !json || json.error) {
    throw new Error(json?.error?.message ?? "Unable to load SOL balance from RPC");
  }
  const lamports = json.result?.value ?? 0;
  return lamports / 1e9;
}

async function getSolPrice(): Promise<number> {
  try {
    // CoinGecko has a separate free rate limit from BirdEye.
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { headers: { accept: "application/json" }, next: { revalidate: 60 } }
    );
    const json = await res.json();
    return json?.solana?.usd ?? 0;
  } catch {
    return 0;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { address } = await requireOwnedSolanaWallet(req, req.nextUrl.searchParams.get("address"));

    const [solBalance, solPrice] = await Promise.all([getSolBalance(address), getSolPrice()]);
    const usdValue = solBalance * solPrice;

    return NextResponse.json({ solBalance, solPrice, usdValue });
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Unable to load wallet balance" }, { status: 500 });
  }
}
