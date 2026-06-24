"use client";

import { useEffect, useState } from "react";

interface Trade {
  txHash: string;
  blockUnixTime: number;
  side: "buy" | "sell";
  owner: string;
  volumeUSD: number;
  tokenAmount: number;
}

function timeAgo(unixTime: number): string {
  const secs = Math.floor(Date.now() / 1000) - unixTime;
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

function shortWallet(addr: string): string {
  if (!addr || addr === "unknown") return "—";
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatUSD(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(2);
}

export default function LiveTrades({
  address,
  tokenSymbol,
}: {
  address: string;
  tokenSymbol: string;
}) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = async () => {
    try {
      const res = await fetch(`/api/tokens/${address}/trades`);
      const data = await res.json();
      setTrades(data.trades ?? []);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, [address]);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--cw-dim)", fontSize: 13 }}>
        Loading trades...
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "var(--cw-dim)", fontSize: 13 }}>
        No recent trades
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 60px 90px 80px", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--cw-border)" }}>
        {["Time", "Wallet", "Type", "Amount", "Value"].map((h) => (
          <div key={h} style={{ fontSize: 10, color: "var(--cw-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {h}
          </div>
        ))}
      </div>

      {trades.map((tx, i) => {
        const isBuy = tx.side === "buy";
        return (
          <div
            key={`${tx.txHash}-${i}`}
            style={{ display: "grid", gridTemplateColumns: "60px 1fr 60px 90px 80px", gap: 8, padding: "7px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)", alignItems: "center" }}
          >
            <div style={{ fontSize: 11, color: "var(--cw-dim)", fontFamily: "var(--font-mono)" }}>
              {timeAgo(tx.blockUnixTime)}
            </div>
            <div style={{ fontSize: 12, color: "var(--cw-muted)", fontFamily: "var(--font-mono)" }}>
              <a href={`https://solscan.io/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer"
                style={{ color: "inherit", textDecoration: "none" }}>
                {shortWallet(tx.owner)}
              </a>
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, color: isBuy ? "var(--cw-green)" : "var(--cw-red)" }}>
              {isBuy ? "Buy" : "Sell"}
            </div>
            <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#fff" }}>
              {formatAmount(tx.tokenAmount)}{" "}
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
