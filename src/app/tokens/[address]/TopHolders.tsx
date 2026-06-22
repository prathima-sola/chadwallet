import type { TokenHolder } from "@/lib/birdeye";

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export default function TopHolders({
  holders,
  totalSupply,
}: {
  holders: TokenHolder[];
  totalSupply?: number;
}) {
  if (!holders.length) return null;

  return (
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
        Top holders
      </div>

      <div style={{ padding: "0 0 8px" }}>
        {holders.map((h, i) => (
          <div
            key={h.address}
            style={{
              display: "grid",
              gridTemplateColumns: "24px 1fr auto auto",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.03)",
            }}
          >
            {/* Rank */}
            <span style={{ fontSize: 11, color: "var(--cw-dim)", fontFamily: "var(--font-mono)" }}>
              {i + 1}
            </span>

            {/* Address + bar */}
            <div>
              <a
                href={`https://solscan.io/account/${h.address}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  color: "var(--cw-muted)",
                  textDecoration: "none",
                }}
              >
                {shortAddr(h.address)}
              </a>
              <div
                style={{
                  marginTop: 4,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(h.percentage, 100)}%`,
                    backgroundColor: i === 0 ? "var(--cw-accent)" : "rgba(255,255,255,0.2)",
                    borderRadius: 1,
                  }}
                />
              </div>
            </div>

            {/* Amount */}
            <span style={{ fontSize: 11, color: "var(--cw-dim)", fontFamily: "var(--font-mono)", textAlign: "right" }}>
              {h.uiAmount >= 1_000_000_000
                ? `${(h.uiAmount / 1_000_000_000).toFixed(1)}B`
                : h.uiAmount >= 1_000_000
                ? `${(h.uiAmount / 1_000_000).toFixed(1)}M`
                : h.uiAmount >= 1_000
                ? `${(h.uiAmount / 1_000).toFixed(1)}K`
                : h.uiAmount.toFixed(0)}
            </span>

            {/* Percentage */}
            <span
              style={{
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                color: i === 0 ? "var(--cw-accent)" : "#fff",
                minWidth: 48,
                textAlign: "right",
              }}
            >
              {h.percentage.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
