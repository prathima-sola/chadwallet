import Link from "next/link";
import { getTokenOverview, getOHLCV, getTokenHolders } from "@/lib/birdeye";
import TokenChart from "./TokenChart";
import TradePanel from "./TradePanel";
import LiveTrades from "./LiveTrades";
import AIAnalysis from "./AIAnalysis";
import TopHolders from "./TopHolders";
import LivePrice from "./LivePrice";

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

  const [barsResult, holdersResult] = await Promise.allSettled([
    getOHLCV({ address, type: "15m", limit: 200 }),
    getTokenHolders(address, 10),
  ]);

  const initialBars = barsResult.status === "fulfilled" ? barsResult.value : [];
  const holders = holdersResult.status === "fulfilled" ? holdersResult.value : [];

  // BirdEye free tier often returns mc=0. Try supply×price, then CoinGecko.
  let mc = (overview.mc && overview.mc > 0)
    ? overview.mc
    : (overview.supply ?? 0) * (overview.price ?? 0);

  if (!mc || mc === 0) {
    try {
      const cgRes = await fetch(
        `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${address}&vs_currencies=usd&include_market_cap=true`,
        { next: { revalidate: 60 } }
      );
      if (cgRes.ok) {
        const cgJson = await cgRes.json();
        const entry = cgJson[address.toLowerCase()] ?? cgJson[address];
        mc = entry?.usd_market_cap ?? 0;
      }
    } catch { /* ignore */ }
  }

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
            // eslint-disable-next-line @next/next/no-img-element
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

        {/* Live price */}
        <LivePrice
          address={address}
          initialPrice={overview.price ?? 0}
          initialChange24h={overview.priceChange24hPercent ?? 0}
        />

        {/* Stats pills */}
        <div style={{ display: "flex", gap: 16, marginLeft: "auto", flexWrap: "wrap" }}>
          {[
            { label: "Mkt cap", value: formatCompact(mc) },
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
      <div className="token-detail-grid">
        <TokenChart address={address} initialBars={initialBars} />

        <div style={{ borderBottom: "1px solid var(--cw-border)" }}>
          <TradePanel
            tokenAddress={address}
            tokenSymbol={overview.symbol}
            tokenName={overview.name}
            tokenDecimals={overview.decimals}
            price={overview.price ?? 0}
          />
        </div>
      </div>

      {/* AI Analysis + Live trades */}
      <div className="token-detail-grid">
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
          <LiveTrades address={address} tokenSymbol={overview.symbol} />
        </div>

        {/* AI Analysis + Top Holders */}
        <div className="token-side-panel">
          <div style={{ padding: 16 }}>
          <AIAnalysis
            tokenData={{
              name: overview.name ?? overview.symbol,
              symbol: overview.symbol,
              price: overview.price ?? 0,
              change24h: overview.priceChange24hPercent ?? 0,
              volume24h: overview.v24hUSD ?? 0,
              marketCap: mc,
              liquidity: overview.liquidity ?? 0,
              holders: overview.holder ?? 0,
              recentBuys: 0,
              recentSells: 0,
              priceHigh24h: (overview.price ?? 0) * (1 + Math.abs(overview.priceChange24hPercent ?? 0) / 100),
              priceLow24h: overview.price ?? 0,
              barCount: initialBars.length,
            }}
          />
          </div>
          <div style={{ borderTop: "1px solid var(--cw-border)", marginTop: 8 }}>
            <TopHolders holders={holders} totalSupply={overview.supply} />
          </div>
        </div>
      </div>
    </div>
  );
}
