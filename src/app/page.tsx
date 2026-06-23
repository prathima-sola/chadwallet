import Link from "next/link";
import { getTokenList, type BirdeyeToken } from "@/lib/birdeye";
import TokenCard, { type Token } from "@/components/TokenCard";
import TokenSearch from "@/components/TokenSearch";

function toToken(t: BirdeyeToken): Token {
  return {
    address: t.address,
    symbol: t.symbol,
    name: t.name,
    price: t.price,
    priceChange24h: t.v24hChangePercent ?? 0,
    marketCap: t.mc,
    volume24h: t.v24hUSD,
    logoUrl: t.logoURI,
  };
}

const TABS = [
  { label: "Trending", value: "trending", sortBy: "v24hUSD", sortType: "desc" },
  { label: "Gainers",  value: "gainers",  sortBy: "v24hChangePercent", sortType: "desc" },
  { label: "Losers",   value: "losers",   sortBy: "v24hChangePercent", sortType: "asc" },
] as const;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = TABS.find((t) => t.value === tab) ?? TABS[0];

  let tokens: Token[] = [];
  let error: string | null = null;

  try {
    const raw = await getTokenList({
      sortBy: activeTab.sortBy,
      sortType: activeTab.sortType,
      limit: 50,
    });
    tokens = raw.map(toToken);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to fetch tokens";
  }

  const tickerTokens = tokens.slice(0, 10);

  return (
    <div>
      {/* Scrolling ticker */}
      <div
        style={{
          borderBottom: "1px solid var(--cw-border)",
          backgroundColor: "rgba(255,255,255,0.02)",
          height: 36,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
        }}
      >
        <div className="ticker-track" style={{ display: "flex", whiteSpace: "nowrap" }}>
          {[...tickerTokens, ...tickerTokens].map((t, i) => (
            <span
              key={i}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "0 16px",
                borderRight: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--cw-muted)", fontFamily: "var(--font-mono)" }}>
                ${t.symbol}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  color: t.priceChange24h >= 0 ? "var(--cw-green)" : "var(--cw-red)",
                }}
              >
                {t.priceChange24h >= 0 ? "+" : ""}
                {Math.abs(t.priceChange24h) >= 1000
                  ? `${(t.priceChange24h / 100).toFixed(1)}X`
                  : `${t.priceChange24h.toFixed(2)}%`}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ padding: "20px" }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--cw-dim)",
            textTransform: "uppercase",
            letterSpacing: "0.8px",
            marginBottom: 10,
          }}
        >
          {activeTab.label} memecoins
        </div>

        {/* Filter tabs + Search */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
          <div style={{ display: "flex", gap: 4 }}>
          {TABS.map((t) => {
            const isActive = t.value === activeTab.value;
            return (
              <Link
                key={t.value}
                href={t.value === "trending" ? "/" : `/?tab=${t.value}`}
                style={{
                  fontSize: 12,
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: `1px solid ${isActive ? "rgba(255,255,255,0.15)" : "transparent"}`,
                  textDecoration: "none",
                  backgroundColor: isActive ? "rgba(255,255,255,0.05)" : "transparent",
                  color: isActive ? "#fff" : "var(--cw-muted)",
                }}
              >
                {t.label}
              </Link>
            );
          })}
          </div>
          <TokenSearch />
        </div>

        {error && (
          <div
            style={{
              padding: "16px",
              borderRadius: 8,
              border: "1px solid rgba(255,68,68,0.2)",
              backgroundColor: "rgba(255,68,68,0.05)",
              color: "var(--cw-red)",
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {/* Token grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
          }}
        >
          {tokens.map((token) => (
            <TokenCard key={token.address} token={token} />
          ))}
        </div>
      </div>
    </div>
  );
}
