"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Connection, VersionedTransaction } from "@solana/web3.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_DECIMALS = 9;
const RPC = process.env.NEXT_PUBLIC_ALCHEMY_RPC!;

interface TradePanelProps {
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  price: number;
}

interface JupiterQuote {
  outAmount: string;
  priceImpactPct: string;
  otherAmountThreshold: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
}

type SwapStatus = "idle" | "swapping" | "confirming" | "done" | "error";

function formatOut(raw: string, decimals: number): string {
  const n = Number(raw) / Math.pow(10, decimals);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(8);
}

export default function TradePanel({
  tokenAddress,
  tokenSymbol,
  tokenDecimals,
  price,
}: TradePanelProps) {
  const { login } = usePrivy();
  const [wallet, setWallet] = useState<string | null>(null);
  const [phantomConnected, setPhantomConnected] = useState(false);

  // Connect directly to Phantom's Solana account (not Privy's EVM flow)
  const connectPhantom = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phantom = (window as any).solana;
    if (!phantom?.isPhantom) {
      alert("Phantom not found. Install phantom.app first.");
      return;
    }
    const resp = await phantom.connect();
    setWallet(resp.publicKey.toString());
    setPhantomConnected(true);
  };

  useEffect(() => {
    // Auto-detect if Phantom is already connected
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phantom = (window as any).solana;
    if (phantom?.isPhantom && phantom.isConnected && phantom.publicKey) {
      setWallet(phantom.publicKey.toString());
      setPhantomConnected(true);
    }
  }, []);

  const authenticated = phantomConnected && !!wallet;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.1");
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [status, setStatus] = useState<SwapStatus>("idle");
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const inDecimals = side === "buy" ? SOL_DECIMALS : tokenDecimals;
  const inMint = side === "buy" ? SOL_MINT : tokenAddress;
  const outMint = side === "buy" ? tokenAddress : SOL_MINT;
  const outDecimals = side === "buy" ? tokenDecimals : SOL_DECIMALS;
  const inSymbol = side === "buy" ? "SOL" : tokenSymbol;
  const outSymbol = side === "buy" ? tokenSymbol : "SOL";

  const fetchQuote = useCallback(async () => {
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { setQuote(null); return; }
    setQuoting(true);
    setQuoteError(null);
    try {
      const lamports = Math.floor(parsed * Math.pow(10, inDecimals));
      const url = `/api/jupiter/quote?inputMint=${inMint}&outputMint=${outMint}&amount=${lamports}&slippageBps=50`;
      console.log("[Jupiter quote]", url);
      const res = await fetch(url);
      const data = await res.json();
      console.log("[Jupiter quote response]", res.status, data);
      if (res.ok) setQuote(data);
      else setQuoteError(data?.error ?? `Jupiter ${res.status}`);
    } catch (e) {
      console.error("[Jupiter quote error]", e);
      setQuoteError(String(e));
    } finally {
      setQuoting(false);
    }
  }, [amount, side, inMint, outMint, inDecimals]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 600);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  const reset = () => { setStatus("idle"); setError(null); setTxSig(null); };

  const executeSwap = async () => {
    if (!quote || !wallet) return;
    setError(null);
    setStatus("swapping");

    try {
      // 1. Get serialized swap tx from Jupiter
      const swapRes = await fetch("/api/jupiter/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: wallet,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      });
      if (!swapRes.ok) throw new Error("Jupiter failed to build swap transaction");
      const { swapTransaction } = await swapRes.json();

      // 2. Deserialize
      const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));

      // 3. Sign with Phantom
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const phantom = (window as any).solana;
      if (!phantom?.isPhantom) throw new Error("Phantom not found. Install Phantom to trade.");
      const signed = await phantom.signTransaction(tx);

      // 4. Send via Alchemy RPC
      setStatus("confirming");
      const connection = new Connection(RPC, "confirmed");
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      setTxSig(sig);

      // 5. Wait for confirmation
      await connection.confirmTransaction(sig, "confirmed");

      // 6. Record trade in Supabase
      const solAmount = side === "buy"
        ? parseFloat(amount)
        : Number(quote.outAmount) / Math.pow(10, SOL_DECIMALS);
      const tokenAmount = side === "buy"
        ? Number(quote.outAmount) / Math.pow(10, tokenDecimals)
        : parseFloat(amount);

      await fetch("/api/trades/record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_wallet: wallet,
          token_mint: tokenAddress,
          token_symbol: tokenSymbol,
          token_name: tokenSymbol,
          side,
          sol_amount: solAmount,
          token_amount: tokenAmount,
          price_usd: price,
          tx_signature: sig,
        }),
      });

      setStatus("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  };

  const isLoading = status === "swapping" || status === "confirming";

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Buy / Sell toggle */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 3, gap: 3 }}>
        {(["buy", "sell"] as const).map((s) => (
          <button key={s} onClick={() => { setSide(s); reset(); }}
            style={{
              padding: "7px 0", borderRadius: 6, border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 500,
              backgroundColor: side === s ? (s === "buy" ? "var(--cw-green)" : "var(--cw-red)") : "transparent",
              color: side === s ? (s === "buy" ? "#080404" : "#fff") : "rgba(255,255,255,0.4)",
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Amount input */}
      <div>
        <div style={{ fontSize: 11, color: "var(--cw-dim)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Amount ({inSymbol})
        </div>
        <div style={{ display: "flex", alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid var(--cw-border)", borderRadius: 8, padding: "0 12px" }}>
          <input
            type="number" value={amount}
            onChange={(e) => { setAmount(e.target.value); reset(); }}
            min="0" step="0.1"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 15, fontFamily: "var(--font-mono)", padding: "10px 0" }}
          />
          <span style={{ fontSize: 13, color: "var(--cw-muted)", fontFamily: "var(--font-mono)" }}>{inSymbol}</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {["0.1", "0.5", "1", "5"].map((v) => (
            <button key={v} onClick={() => { setAmount(v); reset(); }}
              style={{ flex: 1, padding: "4px 0", fontSize: 11, borderRadius: 5, border: "1px solid var(--cw-border)", backgroundColor: "transparent", color: "var(--cw-muted)", cursor: "pointer", fontFamily: "var(--font-mono)" }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Quote */}
      <div style={{ backgroundColor: "rgba(255,255,255,0.03)", border: "1px solid var(--cw-border)", borderRadius: 8, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "var(--cw-dim)" }}>You get</span>
          {quoting && <span style={{ fontSize: 11, color: "var(--cw-dim)" }}>Fetching...</span>}
        </div>
        <div style={{ fontSize: 18, fontWeight: 500, fontFamily: "var(--font-mono)", color: "#fff" }}>
          {quote ? formatOut(quote.outAmount, outDecimals) : "—"}
          <span style={{ fontSize: 13, color: "var(--cw-muted)", marginLeft: 6 }}>{outSymbol}</span>
        </div>
        {quote && (
          <div style={{ fontSize: 11, color: "var(--cw-dim)", marginTop: 4 }}>
            Price impact: {parseFloat(quote.priceImpactPct).toFixed(3)}%
            {parseFloat(quote.priceImpactPct) > 1 && <span style={{ color: "var(--cw-red)", marginLeft: 6 }}>High impact</span>}
          </div>
        )}
        {quoteError && (
          <div style={{ fontSize: 11, color: "var(--cw-red)", marginTop: 4 }}>
            Quote failed: {quoteError}
          </div>
        )}
      </div>

      {/* Tx feedback */}
      {status === "done" && txSig && (
        <div style={{ backgroundColor: "rgba(0,217,126,0.08)", border: "1px solid rgba(0,217,126,0.2)", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, color: "var(--cw-green)", fontWeight: 500, marginBottom: 4 }}>Swap confirmed</div>
          <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--cw-muted)", textDecoration: "none", fontFamily: "var(--font-mono)" }}>
            {txSig.slice(0, 16)}...{txSig.slice(-8)} ↗
          </a>
        </div>
      )}

      {status === "error" && error && (
        <div style={{ backgroundColor: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 8, padding: 12, fontSize: 12, color: "var(--cw-red)" }}>
          {error}
        </div>
      )}

      {/* CTA */}
      {authenticated ? (
        <button
          onClick={status === "done" || status === "error" ? reset : executeSwap}
          disabled={isLoading || (!quote && status === "idle")}
          style={{
            width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
            cursor: isLoading || (!quote && status === "idle") ? "not-allowed" : "pointer",
            fontSize: 14, fontWeight: 500,
            backgroundColor: status === "done" ? "rgba(0,217,126,0.15)"
              : status === "error" ? "rgba(255,68,68,0.15)"
              : side === "buy" ? "var(--cw-green)" : "var(--cw-red)",
            color: status === "done" ? "var(--cw-green)"
              : status === "error" ? "var(--cw-red)"
              : side === "buy" ? "#080404" : "#fff",
            opacity: isLoading || (!quote && status === "idle") ? 0.6 : 1,
          }}
        >
          {status === "swapping" ? "Signing..."
            : status === "confirming" ? "Confirming on-chain..."
            : status === "done" ? "Swap again"
            : status === "error" ? "Try again"
            : `${side === "buy" ? "Buy" : "Sell"} ${tokenSymbol}`}
        </button>
      ) : (
        <button onClick={connectPhantom}
          style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 500, backgroundColor: "var(--cw-accent)", color: "#080404" }}>
          Connect Phantom to trade
        </button>
      )}

      <div style={{ fontSize: 11, color: "var(--cw-dim)", textAlign: "center" }}>
        0.5% slippage · Powered by Jupiter
      </div>
    </div>
  );
}
