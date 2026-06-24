import { NextRequest, NextResponse } from "next/server";
import { getTokenTransactions } from "@/lib/birdeye";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  try {
    const normalizedAddress = address.toLowerCase();
    const txs = await getTokenTransactions(address, 20);

    const trades = txs.map((tx) => {
      const tokenSide =
        tx.from.address.toLowerCase() === normalizedAddress ? tx.from :
        tx.to.address.toLowerCase() === normalizedAddress ? tx.to :
        tx.side === "buy" ? tx.from : tx.to;

      return {
        txHash: tx.txHash,
        blockUnixTime: tx.blockUnixTime,
        side: tx.side,
        owner: tx.owner,
        volumeUSD: tx.volumeUSD,
        tokenAmount: tokenSide.uiAmount,
      };
    });

    return NextResponse.json({ trades });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load recent trades";
    return NextResponse.json({ trades: [], error: message }, { status: 502 });
  }
}
