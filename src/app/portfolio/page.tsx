"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { primarySolanaAddress } from "@/lib/privy-client";
import { usePhantomSiwsLink } from "@/lib/use-phantom-siws-link";
import type { Database } from "@/types/database";

type Trade = Database["public"]["Tables"]["trades"]["Row"];

interface TokenHolding {
  mint: string;
  amount: number;
  symbol: string;
  name?: string;
  logoURI?: string | null;
  price: number;
  usdValue: number;
}

interface NetWorthPoint {
  unixTime: number;
  valueUsd: number;
}

interface NetWorthResponse {
  totalValueUsd: number | null;
  history: NetWorthPoint[];
}

function formatSOL(n: number) {
  return `${n.toFixed(4)} SOL`;
}

function formatUSD(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function MiniAreaChart({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const W = 100;
  const H = 48;
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
        <linearGradient id="netWorthAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#netWorthAreaGrad)" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export default function PortfolioPage() {
  const { authenticated, ready, login, getAccessToken, user } = usePrivy();
  const wallet = primarySolanaAddress(user);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tokenHoldings, setTokenHoldings] = useState<TokenHolding[]>([]);
  const [netWorthHistory, setNetWorthHistory] = useState<NetWorthPoint[]>([]);
  const [netWorthUsd, setNetWorthUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const { linkPhantom, linking, error: linkError } = usePhantomSiwsLink();

  const startWalletLink = () => {
    linkPhantom().catch(() => undefined);
  };

  useEffect(() => {
    if (!authenticated || !wallet) return;
    const walletAddress = wallet;

    let cancelled = false;
    const timer = setTimeout(() => {
      async function loadPortfolio() {
        setLoading(true);
        setError(null);
        setWarnings([]);

        try {
          const accessToken = await getAccessToken();
          if (!accessToken) throw new Error("Sign in again to load your portfolio");

          const headers = { Authorization: `Bearer ${accessToken}` };
          const [tradesRes, tokensRes, netWorthRes] = await Promise.all([
            fetch(`/api/trades/history?wallet=${encodeURIComponent(walletAddress)}`, { headers }),
            fetch(`/api/wallet/tokens?address=${encodeURIComponent(walletAddress)}`, { headers }),
            fetch(`/api/wallet/net-worth?address=${encodeURIComponent(walletAddress)}`, { headers }),
          ]);

          const tradesData = await tradesRes.json().catch(() => ({ error: "Unable to parse trade history" }));
          const tokensData = await tokensRes.json().catch(() => ({ error: "Unable to parse token holdings" }));
          const netWorthData = await netWorthRes.json().catch(() => ({ error: "Unable to parse net worth" })) as NetWorthResponse & { error?: string };

          if (!tradesRes.ok) throw new Error(tradesData?.error ?? "Unable to load trade history");
          if (!tokensRes.ok) throw new Error(tokensData?.error ?? "Unable to load token holdings");

          if (!cancelled) {
            const loadedTokenHoldings = tokensData.tokens ?? [];
            setTrades(tradesData.trades ?? []);
            setTokenHoldings(loadedTokenHoldings);
            if (netWorthRes.ok) {
              setNetWorthUsd(netWorthData.totalValueUsd);
              setNetWorthHistory(netWorthData.history ?? []);
            } else {
              setNetWorthUsd(null);
              setNetWorthHistory([]);
              setWarnings(
                loadedTokenHoldings.length > 0
                  ? []
                  : ["Net worth estimate unavailable. No token holdings found for this wallet."]
              );
            }
          }
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load portfolio");
        } finally {
          if (!cancelled) setLoading(false);
        }
      }

      loadPortfolio().catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unable to load portfolio");
          setLoading(false);
        }
      });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authenticated, getAccessToken, wallet]);

  const totalBuys = trades.filter((t) => t.side === "buy");
  const totalSells = trades.filter((t) => t.side === "sell");
  const solSpent = totalBuys.reduce((s, t) => s + Number(t.sol_amount), 0);
  const solReceived = totalSells.reduce((s, t) => s + Number(t.sol_amount), 0);
  const netSOL = solReceived - solSpent;
  const fallbackNetWorth = tokenHoldings.reduce((s, t) => s + (t.usdValue ?? 0), 0);
  const displayedNetWorth = netWorthUsd ?? fallbackNetWorth;
  const netWorthValues = netWorthHistory.map((point) => point.valueUsd);
  const chartIsPositive =
    netWorthValues.length < 2 ||
    netWorthValues[netWorthValues.length - 1] >= netWorthValues[0];

  if (!ready) return null;

  if (!authenticated) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 15, color: "var(--cw-muted)" }}>Sign in to see your portfolio</div>
        <button
          onClick={login}
          style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", backgroundColor: "var(--cw-accent)", color: "#080404", fontSize: 14, fontWeight: 500 }}
        >
          Sign in
        </button>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 15, color: "var(--cw-muted)" }}>Link a Solana wallet to see your portfolio</div>
        <div style={{ maxWidth: 420, textAlign: "center", fontSize: 12, lineHeight: 1.5, color: "var(--cw-dim)" }}>
          You need Phantom installed and unlocked. Create or import a Solana wallet in Phantom, then connect it here.
        </div>
        <button
          disabled={linking}
          onClick={startWalletLink}
          style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: linking ? "not-allowed" : "pointer", backgroundColor: "var(--cw-accent)", color: "#080404", fontSize: 14, fontWeight: 500, opacity: linking ? 0.7 : 1 }}
        >
          {linking ? "Linking Phantom..." : "Link Phantom wallet"}
        </button>
        {linkError && (
          <div style={{ maxWidth: 420, textAlign: "center", fontSize: 12, lineHeight: 1.5, color: "var(--cw-red)" }}>
            {linkError}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, color: "var(--cw-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>Portfolio</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", backgroundColor: "rgba(0,217,126,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--cw-accent)", fontWeight: 500 }}>
            {wallet[0].toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 15, color: "#fff", fontWeight: 500, fontFamily: "var(--font-mono)" }}>
              {shortAddr(wallet)}
            </div>
            <Link href="/deposit" style={{ fontSize: 12, color: "var(--cw-accent)", textDecoration: "none" }}>
              Deposit →
            </Link>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ backgroundColor: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 24, fontSize: 12, color: "var(--cw-red)" }}>
          {error}
        </div>
      )}

      {warnings.map((warning) => (
        <div key={warning} style={{ backgroundColor: "rgba(255,190,80,0.08)", border: "1px solid rgba(255,190,80,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 24, fontSize: 12, color: "#ffbe50" }}>
          {warning}
        </div>
      ))}

      <div style={{ backgroundColor: "var(--cw-card)", border: "1px solid var(--cw-border)", borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: "var(--cw-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Net worth</div>
        <div style={{ fontSize: 32, fontWeight: 600, fontFamily: "var(--font-mono)", color: "#fff", marginBottom: 4 }}>
          ${formatUSD(displayedNetWorth)}
        </div>
        <div style={{ fontSize: 13, color: "var(--cw-muted)", fontFamily: "var(--font-mono)" }}>
          {netWorthUsd === null ? "Token holding estimate" : "BirdEye wallet net worth"}
          {loading ? <span style={{ color: "var(--cw-dim)", marginLeft: 8 }}>Loading...</span> : null}
        </div>
      </div>

      {netWorthValues.length > 1 && (
        <div style={{ backgroundColor: "var(--cw-card)", border: "1px solid var(--cw-border)", borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "var(--cw-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Net worth over time</div>
          <MiniAreaChart values={netWorthValues} color={chartIsPositive ? "#00d97e" : "#ff4444"} />
        </div>
      )}

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
                    // eslint-disable-next-line @next/next/no-img-element
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
                    {t.usdValue > 0 ? `$${t.usdValue.toFixed(2)}` : "-"}
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

      <div className="portfolio-stats-grid" style={{ gap: 12, marginBottom: 32 }}>
        {[
          { label: "Total trades", value: trades.length.toString() },
          { label: "SOL spent", value: formatSOL(solSpent) },
          { label: "SOL received", value: formatSOL(solReceived) },
          { label: "Net SOL flow", value: `${netSOL >= 0 ? "+" : ""}${formatSOL(netSOL)}`, color: netSOL >= 0 ? "var(--cw-green)" : "var(--cw-red)" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ backgroundColor: "var(--cw-card)", border: "1px solid var(--cw-border)", borderRadius: 10, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "var(--cw-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 500, fontFamily: "var(--font-mono)", color: color ?? "#fff" }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ backgroundColor: "var(--cw-card)", border: "1px solid var(--cw-border)", borderRadius: 10, overflowX: "auto" }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "120px minmax(180px,1fr) 80px 110px 110px", minWidth: 620, gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--cw-border)" }}>
              {["Time", "Token", "Side", "Amount", "SOL"].map((h) => (
                <div key={h} style={{ fontSize: 10, color: "var(--cw-dim)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</div>
              ))}
            </div>

            {trades.map((t) => (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: "120px minmax(180px,1fr) 80px 110px 110px", minWidth: 620, gap: 8, padding: "9px 16px", borderBottom: "1px solid rgba(255,255,255,0.03)", alignItems: "center" }}>
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
