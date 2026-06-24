import { NextRequest, NextResponse } from "next/server";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const RPC_URL = process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

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
  const json = await res.json();
  const lamports = json.result?.value ?? 0;
  return lamports / 1e9;
}

async function getSolPrice(): Promise<number> {
  try {
    // CoinGecko free API — no key needed, separate from BirdEye rate limits
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
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  const [solBalance, solPrice] = await Promise.all([getSolBalance(address), getSolPrice()]);
  const usdValue = solBalance * solPrice;

  return NextResponse.json({ solBalance, solPrice, usdValue });
}
