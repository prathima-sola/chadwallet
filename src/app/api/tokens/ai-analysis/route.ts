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

    const prompt = `You are a Solana on-chain trading signal analyst. Analyze this token and return a JSON object only. Do not include markdown or explanation outside the JSON.

This output is an informational trading signal, not investment advice. Use only the data below. Do not default to hold.

Signal rules:
- Use "buy" only when momentum, liquidity, volume, holder count, and recent buy flow all support a short-term bullish setup.
- Use "hold" only for stablecoins, genuinely mixed data, or a balanced setup where action is unclear.
- Use "sell" when bearish price action, weak flow, or liquidity risk suggests an existing holder should reduce exposure.
- Use "avoid" when liquidity is thin, holders are weak, volatility looks manipulated, data is poor, or the move already looks like a chase. If data quality is weak, prefer "avoid" over "hold".

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
  "signals": ["<specific signal 1>", "<specific signal 2>", "<specific signal 3>"]
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
