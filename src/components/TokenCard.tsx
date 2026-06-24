"use client";
import Link from "next/link";

export interface Token {
  address: string;
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number; // percentage
  marketCap: number;
  volume24h: number;
  logoUrl?: string;
}

function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatChange(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  const abs = Math.abs(pct);
  if (abs >= 1_000_000_000) return `${sign}${(pct / 1_000_000_000).toFixed(1)}B%`;
  if (abs >= 1_000_000) return `${sign}${(pct / 1_000_000).toFixed(1)}M%`;
  if (abs >= 10_000) return `${sign}${(pct / 1_000).toFixed(1)}K%`;
  return `${sign}${pct.toFixed(2)}%`;
}

// Deterministic color from token symbol
function tokenColor(symbol: string): { bg: string; fg: string } {
  const colors = [
    { bg: "#1a2e1a", fg: "#00d97e" },
    { bg: "#2a1a1a", fg: "#ff4444" },
    { bg: "#1a1e2a", fg: "#6688ff" },
    { bg: "#252515", fg: "#cccc44" },
    { bg: "#251525", fg: "#cc44cc" },
    { bg: "#152525", fg: "#44cccc" },
  ];
  const idx = symbol.charCodeAt(0) % colors.length;
  return colors[idx];
}

export default function TokenCard({ token }: { token: Token }) {
  const { bg, fg } = tokenColor(token.symbol);
  const isPositive = token.priceChange24h >= 0;

  return (
    <Link
      href={`/tokens/${token.address}`}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          backgroundColor: "var(--cw-card)",
          border: "1px solid var(--cw-border)",
          borderRadius: 10,
          padding: 12,
          cursor: "pointer",
          transition: "border-color 0.15s, background 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--cw-border-hover)";
          (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--cw-card-hover)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--cw-border)";
          (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--cw-card)";
        }}
      >
        {/* Token identity */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          {token.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={token.logoUrl}
              alt={token.symbol}
              width={32}
              height={32}
              style={{ borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: bg,
                color: fg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              {token.symbol[0]}
            </div>
          )}
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>
              {token.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--cw-muted)",
                fontFamily: "var(--font-mono)",
                marginTop: 1,
              }}
            >
              ${token.symbol}
            </div>
          </div>
        </div>

        {/* Price + change */}
        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "#fff",
            fontFamily: "var(--font-mono)",
            marginBottom: 4,
          }}
        >
          {formatPrice(token.price)}
        </div>
        <div
          style={{
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            color: isPositive ? "var(--cw-green)" : "var(--cw-red)",
          }}
        >
          {formatChange(token.priceChange24h)}
        </div>

        {/* Market cap + volume */}
        <div
          style={{
            marginTop: 8,
            paddingTop: 8,
            borderTop: "1px solid rgba(255,255,255,0.05)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: "var(--cw-dim)", marginBottom: 2 }}>
              Mkt cap
            </div>
            <div style={{ fontSize: 11, color: "var(--cw-muted)", fontFamily: "var(--font-mono)" }}>
              {formatCompact(token.marketCap)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "var(--cw-dim)", marginBottom: 2 }}>
              Vol 24h
            </div>
            <div style={{ fontSize: 11, color: "var(--cw-muted)", fontFamily: "var(--font-mono)" }}>
              {formatCompact(token.volume24h)}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
