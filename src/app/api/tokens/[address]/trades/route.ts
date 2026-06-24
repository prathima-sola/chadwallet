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

    const trades = items.map((tx: any) => {
      // BirdEye tx shape: buy = SOL goes "from", token goes "to"; sell = opposite
      const isBuy = tx.side === "buy";
      const tokenSide = isBuy ? tx.to : tx.from;
      const solSide = isBuy ? tx.from : tx.to;
      const tokenAmount = tokenSide?.uiAmount ?? 0;
      // volumeUSD: try explicit field first, then compute from SOL amount × SOL price
      const volumeUSD =
        tx.volumeUSD ??
        tx.volume ??
        (solSide?.uiAmount ? solSide.uiAmount * (tx.solPrice ?? 0) : 0);
      return {
        txHash: tx.txHash,
        blockUnixTime: tx.blockUnixTime,
        side: tx.side,
        owner: tx.owner ?? tx.source ?? "unknown",
        volumeUSD,
        tokenAmount,
      };
    });

    return NextResponse.json({ trades });
  } catch {
    return NextResponse.json({ trades: [] });
  }
}
