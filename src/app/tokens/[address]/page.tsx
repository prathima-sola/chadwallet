import Link from "next/link";
import { getTokenOverview, getOHLCV, getTokenTransactions } from "@/lib/birdeye";
import TokenChart from "./TokenChart";
import TradePanel from "./TradePanel";
import LiveTrades from "./LiveTrades";
import AIAnalysis from "./AIAnalysis";

function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export default async function TokenPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;

  // Sequential: overview first, then OHLCV + trades together.
  // BirdEye free tier rate-limits parallel calls (429).
  const overview = await getTokenOverview(address);

  const [barsResult, tradesResult] = await Promise.allSettled([
    getOHLCV({ address, type: "15m", limit: 200 }),
    getTokenTransactions(address, 30),
  ]);

  const initialBars = barsResult.status === "fulfilled" ? barsResult.value : [];
  const trades = tradesResult.status === "fulfilled" ? tradesResult.value : [];

  const isPositive = (overview.priceChange24hPercent ?? 0) >= 0;

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Token header */}
      <div
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid var(--cw-border)",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        {/* Back */}
        <Link
          href="/"
          style={{
            color: "var(--cw-muted)",
            textDecoration: "none",
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ←
        </Link>

        {/* Logo + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {overview.logoURI ? (
            <img
              src={overview.logoURI}
              alt={overview.symbol}
              width={36}
              height={36}
              style={{ borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                backgroundColor: "rgba(0,217,126,0.15)",
                color: "var(--cw-accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              {overview.symbol?.[0]}
            </div>
          )}
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: "#fff" }}>
              {overview.name}
            </div>
            <div style={{ fontSize: 12, color: "var(--cw-muted)", fontFamily: "var(--font-mono)" }}>
              ${overview.symbol}
            </div>
          </div>
        </div>

        {/* Price */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 500,
              fontFamily: "var(--font-mono)",
              color: "#fff",
            }}
          >
            {formatPrice(overview.price ?? 0)}
          </span>
          <span
            style={{
              fontSize: 14,
              fontFamily: "var(--font-mono)",
              color: isPositive ? "var(--cw-green)" : "var(--cw-red)",
            }}
          >
            {isPositive ? "+" : ""}
            {(overview.priceChange24hPercent ?? 0).toFixed(2)}%
          </span>
        </div>

        {/* Stats pills */}
        <div style={{ display: "flex", gap: 16, marginLeft: "auto", flexWrap: "wrap" }}>
          {[
            { label: "Mkt cap", value: formatCompact(overview.mc ?? 0) },
            { label: "Vol 24h", value: formatCompact(overview.v24hUSD ?? 0) },
            { label: "Liquidity", value: formatCompact(overview.liquidity ?? 0) },
            { label: "Holders", value: (overview.holder ?? 0).toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 10, color: "var(--cw-dim)", marginBottom: 2 }}>
                {label}
              </div>
              <div style={{ fontSize: 13, fontFamily: "var(--font-mono)", color: "#fff" }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chart + Trade panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px" }}>
        <TokenChart address={address} initialBars={initialBars} />

        <div style={{ borderBottom: "1px solid var(--cw-border)" }}>
          <TradePanel
            tokenAddress={address}
            tokenSymbol={overview.symbol}
            tokenDecimals={overview.decimals}
            price={overview.price ?? 0}
          />
        </div>
      </div>

      {/* AI Analysis + Live trades */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px" }}>
        {/* Live trades */}
        <div>
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid var(--cw-border)",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--cw-muted)",
            }}
          >
            Recent trades
          </div>
          <LiveTrades trades={trades} tokenSymbol={overview.symbol} />
        </div>

        {/* AI Analysis panel */}
        <div style={{ borderLeft: "1px solid var(--cw-border)", padding: 16 }}>
          <AIAnalysis
            tokenData={{
              name: overview.name ?? overview.symbol,
              symbol: overview.symbol,
              price: overview.price ?? 0,
              change24h: overview.priceChange24hPercent ?? 0,
              volume24h: overview.v24hUSD ?? 0,
              marketCap: overview.mc ?? 0,
              liquidity: overview.liquidity ?? 0,
              holders: overview.holder ?? 0,
              recentBuys: trades.filter((t) => t.side === "buy").length,
              recentSells: trades.filter((t) => t.side === "sell").length,
              priceHigh24h: overview.priceChange24h ? (overview.price ?? 0) * (1 + Math.abs(overview.priceChange24hPercent ?? 0) / 100) : 0,
              priceLow24h: overview.price ?? 0,
              barCount: initialBars.length,
            }}
          />
        </div>
      </div>
    </div>
  );
}
