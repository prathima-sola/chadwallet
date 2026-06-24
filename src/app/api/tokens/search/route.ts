import { NextRequest, NextResponse } from "next/server";

interface BirdeyeSearchToken {
  address?: string;
  symbol?: string;
  name?: string;
  price?: number;
  logo_uri?: string | null;
  market_cap?: number;
  volume_24h_usd?: number;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.length < 2) return NextResponse.json({ tokens: [] });

  const key = process.env.BIRDEYE_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "BIRDEYE_API_KEY is not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://public-api.birdeye.so/defi/v3/search?keyword=${encodeURIComponent(q)}&target=token&sort_by=volume_24h_usd&sort_type=desc&offset=0&limit=10&chain=solana`,
      { headers: { accept: "application/json", "X-API-KEY": key } }
    );

    if (!res.ok) {
      return NextResponse.json({ error: "BirdEye search failed" }, { status: 502 });
    }
    const json = await res.json();
    const items: BirdeyeSearchToken[] = json.data?.items?.[0]?.result ?? [];

    const tokens = items
      .filter((t): t is BirdeyeSearchToken & { address: string; symbol: string; name: string } =>
        Boolean(t.address && t.symbol && t.name)
      )
      .map((t) => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        price: t.price ?? 0,
        logoURI: t.logo_uri ?? null,
        mc: t.market_cap ?? 0,
        v24hUSD: t.volume_24h_usd ?? 0,
      }));

    return NextResponse.json({ tokens });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to search tokens" }, { status: 500 });
  }
}
