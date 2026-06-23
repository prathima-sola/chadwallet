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
    const key = process.env.BIRDEYE_API_KEY ?? "";
    const res = await fetch(
      `https://public-api.birdeye.so/defi/token_overview?address=${SOL_MINT}`,
      { headers: { accept: "application/json", "x-chain": "solana", "X-API-KEY": key } }
    );
    const json = await res.json();
    return json.data?.price ?? 0;
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
