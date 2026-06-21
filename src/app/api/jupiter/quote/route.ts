import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const upstream = `https://api.jup.ag/swap/v1/quote?${searchParams.toString()}`;

  try {
    console.log("[jupiter/quote] upstream:", upstream);
    const res = await fetch(upstream, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });

    const text = await res.text();
    console.log("[jupiter/quote] status:", res.status, "body:", text.slice(0, 200));

    if (!text) {
      return NextResponse.json({ error: "Empty response from Jupiter" }, { status: 502 });
    }

    const data = JSON.parse(text);
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error("[jupiter/quote] error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
