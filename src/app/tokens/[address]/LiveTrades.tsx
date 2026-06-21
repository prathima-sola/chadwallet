import type { TokenTransaction } from "@/lib/birdeye";

function timeAgo(unixTime: number): string {
  const secs = Math.floor(Date.now() / 1000) - unixTime;
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function shortWallet(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatUSD(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

export default function LiveTrades({
  trades,
  tokenSymbol,
}: {
  trades: TokenTransaction[];
  tokenSymbol: string;
}) {
  if (trades.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--cw-dim)", fontSize: 13 }}>
        No recent trades
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "60px 1fr 80px 80px 80px",
          gap: 8,
          padding: "8px 16px",
          borderBottom: "1px solid var(--cw-border)",
        }}
      >
        {["Time", "Wallet", "Type", "Amount", "Value"].map((h) => (
          <div
            key={h}
            style={{
              fontSize: 10,
              color: "var(--cw-dim)",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {h}
          </div>
        ))}
      </div>

      {/* Rows */}
      {trades.map((tx, i) => {
        const isBuy = tx.side === "buy";
        return (
          <div
            key={`${tx.txHash}-${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "60px 1fr 80px 80px 80px",
              gap: 8,
              padding: "7px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--cw-dim)", fontFamily: "var(--font-mono)" }}>
              {timeAgo(tx.blockUnixTime)}
            </div>
            <div style={{ fontSize: 12, color: "var(--cw-muted)", fontFamily: "var(--font-mono)" }}>
              <a
                href={`https://solscan.io/account/${tx.owner}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                {shortWallet(tx.owner)}
              </a>
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: isBuy ? "var(--cw-green)" : "var(--cw-red)",
              }}
            >
              {isBuy ? "Buy" : "Sell"}
            </div>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#fff" }}>
              {tx.to?.uiAmount
                ? tx.to.uiAmount > 1_000_000
                  ? `${(tx.to.uiAmount / 1_000_000).toFixed(1)}M`
                  : tx.to.uiAmount > 1_000
                  ? `${(tx.to.uiAmount / 1_000).toFixed(1)}K`
                  : tx.to.uiAmount.toFixed(2)
                : "—"}{" "}
              <span style={{ color: "var(--cw-dim)", fontSize: 10 }}>{tokenSymbol}</span>
            </div>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--cw-muted)" }}>
              {tx.volumeUSD ? formatUSD(tx.volumeUSD) : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
