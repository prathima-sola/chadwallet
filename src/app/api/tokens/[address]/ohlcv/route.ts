// API route so the client-side chart can refetch OHLCV when the user
// changes the time interval while BIRDEYE_API_KEY stays server-side.

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
    return NextResponse.json(bars, {
      headers: { "Cache-Control": "s-maxage=15, stale-while-revalidate=30" },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
