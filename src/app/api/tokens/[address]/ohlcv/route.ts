// API route so the client-side chart can refetch OHLCV when the user
// changes the time interval — keeps BIRDEYE_API_KEY server-side only.

import { NextRequest, NextResponse } from "next/server";
import { getOHLCV } from "@/lib/birdeye";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const type = (req.nextUrl.searchParams.get("type") ?? "15m") as Parameters<
    typeof getOHLCV
  >[0]["type"];
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "200");

  try {
    const bars = await getOHLCV({ address, type, limit });
    console.log("[OHLCV]", address, type, "→", bars.length, "bars", bars[0] ?? "empty");
    return NextResponse.json(bars, {
      headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=30" },
    });
  } catch (e) {
    console.error("[OHLCV error]", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
