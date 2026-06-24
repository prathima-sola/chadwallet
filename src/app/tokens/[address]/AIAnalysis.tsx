"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

interface TokenData {
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  holders: number;
  recentBuys: number;
  recentSells: number;
  priceHigh24h: number;
  priceLow24h: number;
  barCount: number;
}

interface Analysis {
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  risk: "low" | "medium" | "high" | "extreme";
  recommendation: "buy" | "hold" | "sell" | "avoid";
  summary: string;
  signals: string[];
}

const SENTIMENT_COLOR = {
  bullish: "var(--cw-green)",
  bearish: "var(--cw-red)",
  neutral: "rgba(255,255,255,0.5)",
};

const RISK_COLOR = {
  low: "var(--cw-green)",
  medium: "#f0a500",
  high: "var(--cw-red)",
  extreme: "#ff00ff",
};

const REC_COLOR = {
  buy: "var(--cw-green)",
  hold: "#f0a500",
  sell: "var(--cw-red)",
  avoid: "var(--cw-red)",
};

export default function AIAnalysis({ tokenData }: { tokenData: TokenData }) {
  const { authenticated, getAccessToken, login } = usePrivy();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  const run = async () => {
    if (!authenticated) {
      login();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Sign in again to run analysis");

      const res = await fetch("/api/tokens/ai-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(tokenData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalysis(data);
      setRan(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        border: "1px solid var(--cw-border)",
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px",
          borderBottom: analysis ? "1px solid var(--cw-border)" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>✦</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#fff" }}>
            AI Analysis
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 6px",
              borderRadius: 4,
              backgroundColor: "rgba(139,92,246,0.15)",
              color: "#a78bfa",
              fontWeight: 500,
              letterSpacing: "0.3px",
            }}
          >
            Claude
          </span>
        </div>

        <button
          onClick={run}
          disabled={loading}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: "6px 14px",
            borderRadius: 7,
            border: "none",
            cursor: loading ? "wait" : "pointer",
            backgroundColor: loading
              ? "rgba(255,255,255,0.06)"
              : "rgba(139,92,246,0.2)",
            color: loading ? "var(--cw-muted)" : "#a78bfa",
            transition: "opacity 0.15s",
          }}
        >
          {loading ? "Analyzing..." : authenticated ? (ran ? "Re-analyze" : "Analyze") : "Sign in"}
        </button>
      </div>

      {/* Loading bar */}
      {loading && (
        <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
          <div
            style={{
              width: "100%",
              height: 3,
              borderRadius: 2,
              backgroundColor: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: "40%",
                backgroundColor: "#a78bfa",
                borderRadius: 2,
                animation: "slide 1.2s ease-in-out infinite",
              }}
            />
          </div>
          <span style={{ fontSize: 11, color: "var(--cw-dim)" }}>
            Reading on-chain signals...
          </span>
          <style>{`
            @keyframes slide {
              0% { transform: translateX(-100%) }
              100% { transform: translateX(350%) }
            }
          `}</style>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div style={{ padding: "12px 16px", fontSize: 12, color: "var(--cw-red)" }}>
          {error}
        </div>
      )}

      {/* Result */}
      {analysis && !loading && (
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Sentiment + confidence row */}
          <div style={{ display: "flex", gap: 10 }}>
            {/* Sentiment */}
            <div
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.03)",
                border: `1px solid ${SENTIMENT_COLOR[analysis.sentiment]}33`,
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--cw-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Sentiment
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: SENTIMENT_COLOR[analysis.sentiment], textTransform: "capitalize" }}>
                {analysis.sentiment}
              </div>
            </div>

            {/* Confidence */}
            <div
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.03)",
                border: "1px solid var(--cw-border)",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--cw-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Confidence
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#fff" }}>
                {analysis.confidence}%
              </div>
            </div>

            {/* Risk */}
            <div
              style={{
                flex: 1,
                backgroundColor: "rgba(255,255,255,0.03)",
                border: `1px solid ${RISK_COLOR[analysis.risk]}33`,
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--cw-dim)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Risk
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: RISK_COLOR[analysis.risk], textTransform: "capitalize" }}>
                {analysis.risk}
              </div>
            </div>
          </div>

          {/* Recommendation banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: `${REC_COLOR[analysis.recommendation]}11`,
              border: `1px solid ${REC_COLOR[analysis.recommendation]}33`,
              borderRadius: 10,
              padding: "10px 14px",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--cw-muted)" }}>Recommendation</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: REC_COLOR[analysis.recommendation],
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {analysis.recommendation}
            </span>
          </div>

          {/* Summary */}
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", lineHeight: 1.6, margin: 0 }}>
            {analysis.summary}
          </p>

          {/* Signals */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {analysis.signals.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.6)",
                }}
              >
                <span style={{ color: "#a78bfa", marginTop: 1, flexShrink: 0 }}>›</span>
                {s}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, color: "var(--cw-dim)", borderTop: "1px solid var(--cw-border)", paddingTop: 10 }}>
            AI analysis is not financial advice. Memecoins carry extreme risk.
          </div>
        </div>
      )}

      {/* Idle state */}
      {!analysis && !loading && !error && (
        <div style={{ padding: "16px", fontSize: 12, color: "var(--cw-dim)", lineHeight: 1.6 }}>
          Claude analyzes price action, volume, liquidity depth, and recent trade flow to give you a read on this token.
        </div>
      )}
    </div>
  );
}
