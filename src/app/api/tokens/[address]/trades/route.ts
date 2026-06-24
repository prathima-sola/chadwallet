import { NextRequest, NextResponse } from "next/server";

const BASE_URL = "https://public-api.birdeye.so";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const key = process.env.BIRDEYE_API_KEY ?? "";

  try {
    const res = await fetch(
      `${BASE_URL}/defi/txs/token?address=${address}&tx_type=swap&sort_type=desc&limit=20`,
      {
        headers: {
          accept: "application/json",
          "x-chain": "solana",
          "X-API-KEY": key,
        },
        next: { revalidate: 15 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({ trades: [] });
    }

    const json = await res.json();
    const items = json.data?.items ?? [];

    const trades = items.map((tx: any) => ({
      txHash: tx.txHash,
      blockUnixTime: tx.blockUnixTime,
      side: tx.side,
      owner: tx.owner ?? tx.source ?? "unknown",
      volumeUSD: tx.volumeUSD ?? tx.volume ?? 0,
      tokenAmount: tx.to?.uiAmount ?? tx.from?.uiAmount ?? 0,
    }));

    return NextResponse.json({ trades });
  } catch {
    return NextResponse.json({ trades: [] });
  }
}
