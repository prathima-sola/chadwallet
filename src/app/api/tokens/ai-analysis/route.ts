import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse, requirePrivyAuth } from "@/lib/privy-server";

export async function POST(req: NextRequest) {
  try {
    await requirePrivyAuth(req);
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
    }

    const body = await req.json();
    const {
      name,
      symbol,
      price,
      change24h,
      volume24h,
      marketCap,
      liquidity,
      holders,
      recentBuys,
      recentSells,
      priceHigh24h,
      priceLow24h,
      barCount,
    } = body;

    const volatility =
      priceHigh24h && priceLow24h && price
        ? (((priceHigh24h - priceLow24h) / price) * 100).toFixed(1)
        : "unknown";

    const buySellRatio =
      recentBuys + recentSells > 0
        ? ((recentBuys / (recentBuys + recentSells)) * 100).toFixed(0)
        : "unknown";

    const prompt = `You are a Solana memecoin analyst. Analyze this token and return a JSON object only. Do not include markdown or explanation outside the JSON.

Token: ${name} (${symbol})
Price: $${price}
24h Change: ${change24h > 0 ? "+" : ""}${change24h?.toFixed(2)}%
24h Volume: $${(volume24h / 1_000_000).toFixed(2)}M
Market Cap: $${marketCap ? (marketCap / 1_000_000).toFixed(2) + "M" : "unknown"}
Liquidity: $${(liquidity / 1_000_000).toFixed(2)}M
Holders: ${holders?.toLocaleString() ?? "unknown"}
24h Price Range: $${priceLow24h} to $${priceHigh24h} (${volatility}% volatility)
Recent trade ratio: ${buySellRatio}% buys out of last ${recentBuys + recentSells} trades
Chart bars available: ${barCount}

Return exactly this JSON shape:
{
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": <0-100 integer>,
  "risk": "low" | "medium" | "high" | "extreme",
  "recommendation": "buy" | "hold" | "sell" | "avoid",
  "summary": "<2 sentence max, direct, no fluff>",
  "signals": ["<signal 1>", "<signal 2>", "<signal 3>"]
}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data?.error?.message ?? "Anthropic API error" }, { status: 500 });
    }

    const text = data.content?.[0]?.text ?? "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const analysis = JSON.parse(cleaned);

    return NextResponse.json(analysis);
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: e instanceof Error ? e.message : "Analysis failed" }, { status: 500 });
  }
}
