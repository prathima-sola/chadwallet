"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database";

type Trade = Database["public"]["Tables"]["trades"]["Row"];

function formatSOL(n: number) {
  return `${n.toFixed(4)} SOL`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

// Simple SVG area chart from an array of numbers
function MiniAreaChart({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const W = 100, H = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - ((v - min) / range) * (H - 4) - 2,
  ]);
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 48 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaGrad)" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export default function PortfolioPage() {
  const { authenticated, ready, login, user } = usePrivy();
  const [phantomAddress, setPhantomAddress] = useState<string | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [solPrice, setSolPrice] = useState<number | null>(null);
  const [usdValue, setUsdValue] = useState<number | null>(null);
  const [tokenHoldings, setTokenHoldings] = useState<any[]>([]);
  const wallet = user?.wallet?.address ?? phantomAddress ?? null;
  const totalNetWorth = (usdValue ?? 0) + tokenHoldings.reduce((s, t) => s + (t.usdValue ?? 0), 0);

  // Detect Phantom wallet and fetch balance
  useEffect(() => {
    if (!authenticated) return;
    const solana = (window as any).solana;
    if (!solana) return;

    const fetchBalance = (addr: string) => {
      setPhantomAddress(addr);
      fetch(`/api/wallet/balance?address=${addr}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.solBalance !== undefined) {
            setSolBalance(d.solBalance);
            setSolPrice(d.solPrice);
            setUsdValue(d.usdValue);
          }
        });
      fetch(`/api/wallet/tokens?address=${addr}`)
        .then((r) => r.json())
        .then((d) => { if (d.tokens) setTokenHoldings(d.tokens); });
    };

    if (solana.publicKey) {
      fetchBalance(solana.publicKey.toString());
    } else {
      // Try silent reconnect (no popup)
      solana.connect({ onlyIfTrusted: true })
        .then((resp: any) => fetchBalance(resp.publicKey.toString()))
        .catch(() => {}); // ignore if not previously approved
    }
  }, [authenticated]);

  useEffect(() => {
    if (!wallet) return;
    setLoading(true);
    supabase
      .from("trades")
      .select("*")
      .eq("user_wallet", wallet)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setTrades(data ?? []);
        setLoading(false);
      });
  }, [wallet]);

  // Stats derived from trades
  const totalBuys = trades.filter((t) => t.side === "buy");
  const totalSells = trades.filter((t) => t.side === "sell");
  const solSpent = totalBuys.reduce((s, t) => s + Number(t.sol_amount), 0);
  const solReceived = totalSells.reduce((s, t) => s + Number(t.sol_amount), 0);
  const netSOL = solReceived - solSpent;

  // Activity chart: cumulative SOL flow over time (oldest → newest)
  const chronological = [...trades].reverse();
  let running = 0;
  const chartValues = chronological.map((t) => {
    running += t.side === "sell" ? Number(t.sol_amount) : -Number(t.sol_amount);
    return running;
  });

  const isPositive = netSOL >= 0;

  if (!ready) return null;

  if (!authenticated) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 15, color: "var(--cw-muted)" }}>Connect your wallet to see your portfolio</div>
        <button
          onClick={login}
          style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", backgroundColor: "var(--cw-accent)", color: "#080404", fontSize: 14, fontWeight: 500 }}
        >
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: "var(--cw-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Portfolio</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(0,217,126,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--cw-accent)", fontWeight: 500 }}>
            {wallet ? wallet[0].toUpperCase() : "?"}
          </div>
          <div>
            <div style={{ fontSize: 15, color: "#fff", fontWeight: 500, fontFamily: "var(--font-mono)" }}>
              {wallet ? shortAddr(wallet) : "—"}
            </div>
            <Link href="/deposit" style={{ fontSize: 12, color: "var(--cw-accent)", textDecoration: "none" }}>
              Deposit →
            </Link>
          </div>
        </div>
      </div>

      {/* Connect Phantom prompt */}
      {usdValue === null && (
        <div style={{ backgroundColor: "var(--cw-card)", border: "1px solid var(--cw-border)", borderRadius: 12, padding: "20px 24px", marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 14, color: "#fff", marginBottom: 4 }}>Connect Phantom to see your balance</div>
            <div style={{ fontSize: 12, color: "var(--cw-dim)" }}>Shows your live SOL balance and net worth</div>
          </div>
          <button
            onClick={async () => {
              const solana = (window as any).solana;
              if (!solana) { alert("Phantom not installed"); return; }
              try {
                const resp = await solana.connect();
                const addr = resp.publicKey.toString();
                setPhantomAddress(addr);
                const d = await fetch(`/api/wallet/balance?address=${addr}`).then(r => r.json());
                if (d.solBalance !== undefined) {
                  setSolBalance(d.solBalance);
                  setSolPrice(d.solPrice);
                  setUsdValue(d.usdValue);
                }
              } catch {}
            }}
            style={{ padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", backgroundColor: "var(--cw-accent)", color: "#080404", fontSize: 13, fontWeight: 500, whiteSpace: "nowrap" }}
          >
            Connect Phantom
          </button>
        </div>
      )}

      {/* Net worth */}
      {usdValue !== null && (
        <div style={{ backgroundColor: "var(--cw-card)", border: "1px solid var(--cw-border)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "var(--cw-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Net worth</div>
          <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--font-mono)", color: "#fff", marginBottom: 4 }}>
            ${totalNetWorth.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 13, color: "var(--cw-muted)", fontFamily: "var(--font-mono)" }}>
            {solBalance?.toFixed(4)} SOL
            {solPrice ? <span style={{ color: "var(--cw-dim)", marginLeft: 8 }}>@ ${solPrice.toFixed(2)}</span> : null}
          </div>
        </div>
      )}

      {/* Token holdings */}
      {tokenHoldings.length > 0 && (
        <div style={{ backgroundColor: "var(--cw-card)", border: "1px solid var(--cw-border)", borderRadius: 10, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--cw-border)", fontSize: 12, fontWeight: 500, color: "var(--cw-muted)" }}>
            Token holdings
          </div>
          {tokenHoldings.map((t) => (
            <Link key={t.mint} href={`/tokens/${t.mint}`} style={{ textDecoration: "none" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {t.logoURI ? (
                    <img src={t.logoURI} alt={t.symbol} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "rgba(0,217,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--cw-accent)" }}>
                      {t.symbol?.[0] ?? "?"}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{t.symbol}</div>
                    <div style={{ fontSize: 11, color: "var(--cw-dim)" }}>{t.amount >= 1_000_000 ? `${(t.amount / 1_000_000).toFixed(2)}M` : t.amount >= 1_000 ? `${(t.amount / 1_000).toFixed(2)}K` : t.amount.toFixed(4)}</div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, color: "#fff", fontFamily: "var(--font-mono)" }}>
                    {t.usdValue > 0 ? `$${t.usdValue.toFixed(2)}` : "—"}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--cw-dim)", fontFamily: "var(--font-mono)" }}>
                    {t.price > 0 ? `$${t.price < 0.01 ? t.price.toFixed(8) : t.price.toFixed(4)}` : ""}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
        {[
          { label: "Total trades", value: trades.length.toString() },
          { label: "SOL spent", value: formatSOL(solSpent) },
          { label: "SOL received", value: formatSOL(solReceived) },
          { label: "Net P/L", value: `${isPositive ? "+" : ""}${formatSOL(netSOL)}`, color: isPositive ? "var(--cw-green)" : "var(--cw-red)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: "var(--cw-card)", border: "1px solid var(--cw-border)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "var(--cw-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 500, fontFamily: "var(--font-mono)", color: color ?? "#fff" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Activity chart */}
      {chartValues.length > 1 && (
        <div style={{ backgroundColor: "var(--cw-card)", border: "1px solid var(--cw-border)", borderRadius: 10, padding: "16px 20px", marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: "var(--cw-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>SOL P/L over time</div>
          <MiniAreaChart values={chartValues} color={isPositive ? "#00d97e" : "#ff4444"} />
        </div>
      )}

      {/* Trade history */}
      <div style={{ backgroundColor: "var(--cw-card)", border: "1px solid var(--cw-border)", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--cw-border)", fontSize: 12, fontWeight: 500, color: "var(--cw-muted)" }}>
          Trade history
        </div>

        {loading && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--cw-dim)", fontSize: 13 }}>Loading...</div>
        )}

        {!loading && trades.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--cw-dim)", fontSize: 13 }}>
            No trades yet. <Link href="/" style={{ color: "var(--cw-accent)", textDecoration: "none" }}>Find a token →</Link>
          </div>
        )}

        {trades.length > 0 && (
          <>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px 110px 110px", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--cw-border)" }}>
              {["Time", "Token", "Side", "Amount", "SOL"].map((h) => (
                <div key={h} style={{ fontSize: 10, color: "var(--cw-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</div>
              ))}
            </div>

            {trades.map((t) => (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px 110px 110px", gap: 8, padding: "9px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)", alignItems: "center" }}>
                <div style={{ fontSize: 11, color: "var(--cw-dim)", fontFamily: "var(--font-mono)" }}>{formatDate(t.created_at)}</div>
                <div>
                  <Link href={`/tokens/${t.token_mint}`} style={{ fontSize: 12, color: "#fff", textDecoration: "none", fontWeight: 500 }}>
                    {t.token_name}
                  </Link>
                  <div style={{ fontSize: 10, color: "var(--cw-dim)", fontFamily: "var(--font-mono)" }}>${t.token_symbol}</div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 500, color: t.side === "buy" ? "var(--cw-green)" : "var(--cw-red)" }}>
                  {t.side === "buy" ? "Buy" : "Sell"}
                </div>
                <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "#fff" }}>
                  {Number(t.token_amount) > 1_000_000
                    ? `${(Number(t.token_amount) / 1_000_000).toFixed(2)}M`
                    : Number(t.token_amount) > 1_000
                    ? `${(Number(t.token_amount) / 1_000).toFixed(2)}K`
                    : Number(t.token_amount).toFixed(4)}{" "}
                  <span style={{ color: "var(--cw-dim)", fontSize: 10 }}>{t.token_symbol}</span>
                </div>
                <div style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--cw-muted)" }}>
                  {t.side === "buy" ? "-" : "+"}{formatSOL(Number(t.sol_amount))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
