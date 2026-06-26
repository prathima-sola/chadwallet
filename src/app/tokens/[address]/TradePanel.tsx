"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { atomicToDecimalString, decimalToAtomic, decimalToNumber } from "@/lib/amounts";
import { getPhantomProvider } from "@/lib/phantom";
import { linkedSolanaAddresses } from "@/lib/privy-client";
import { usePhantomSiwsLink } from "@/lib/use-phantom-siws-link";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_DECIMALS = 9;
const RPC =
  process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";
const CONFIRMATION_POLL_MS = 1500;
const CONFIRMATION_TIMEOUT_MS = 45_000;

interface TradePanelProps {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
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

interface JupiterSwapResponse {
  swapTransaction?: unknown;
  error?: unknown;
}

type SwapStatus = "idle" | "swapping" | "confirming" | "done" | "error";

function formatOut(raw: string, decimals: number): string {
  const n = Number(atomicToDecimalString(raw, decimals, 8));
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(8);
}

function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(globalThis.atob(value), (char) => char.charCodeAt(0));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function responseError(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return fallback;
}

function isJupiterQuote(data: unknown): data is JupiterQuote {
  if (!data || typeof data !== "object") return false;
  const quote = data as Record<string, unknown>;
  return typeof quote.outAmount === "string"
    && typeof quote.priceImpactPct === "string"
    && typeof quote.otherAmountThreshold === "string"
    && typeof quote.inputMint === "string"
    && typeof quote.outputMint === "string"
    && typeof quote.inAmount === "string";
}

function tradeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/blockhash|block height exceeded|expired/i.test(message)) {
    return "The app could not confirm this transaction before the blockhash expired. Open Solscan to verify status before retrying.";
  }
  if (/user rejected|rejected the request|cancel/i.test(message)) {
    return "Transaction cancelled in Phantom.";
  }
  return message;
}

async function pollSignatureStatus(
  connection: Connection,
  signature: string,
): Promise<"success" | "failed" | "unknown"> {
  const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const { value } = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = value[0];

    if (status?.err) return "failed";
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") {
      return "success";
    }

    await delay(CONFIRMATION_POLL_MS);
  }

  return "unknown";
}

async function confirmSubmittedTransaction(
  connection: Connection,
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number,
): Promise<void> {
  try {
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, "confirmed");

    if (confirmation.value.err) {
      throw new Error("Swap failed on-chain");
    }
  } catch (caught) {
    const signatureStatus = await pollSignatureStatus(connection, signature);
    if (signatureStatus === "success") return;
    if (signatureStatus === "failed") throw new Error("Swap failed on-chain");
    throw caught;
  }
}

export default function TradePanel({
  tokenAddress,
  tokenSymbol,
  tokenName,
  tokenDecimals,
  price,
}: TradePanelProps) {
  const { authenticated: privyAuthenticated, getAccessToken, login, user } = usePrivy();
  const [wallet, setWallet] = useState<string | null>(null);
  const [phantomConnected, setPhantomConnected] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      const phantom = getPhantomProvider();
      if (phantom?.isPhantom && phantom.isConnected && phantom.publicKey) {
        setWallet(phantom.publicKey.toString());
        setPhantomConnected(true);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const linkedWallets = linkedSolanaAddresses(user).map((address) => address.toLowerCase());
  const walletLinked = wallet ? linkedWallets.includes(wallet.toLowerCase()) : false;
  const canTrade = privyAuthenticated && phantomConnected && !!wallet && walletLinked;

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.1");
  const [slippage, setSlippage] = useState(50); // bps: 50 = 0.5%
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [status, setStatus] = useState<SwapStatus>("idle");
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordWarning, setRecordWarning] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const { linkPhantom, linking: linkingWallet } = usePhantomSiwsLink();

  const inDecimals = side === "buy" ? SOL_DECIMALS : tokenDecimals;
  const inMint = side === "buy" ? SOL_MINT : tokenAddress;
  const outMint = side === "buy" ? tokenAddress : SOL_MINT;
  const outDecimals = side === "buy" ? tokenDecimals : SOL_DECIMALS;
  const inSymbol = side === "buy" ? "SOL" : tokenSymbol;
  const outSymbol = side === "buy" ? tokenSymbol : "SOL";
  const sameMint = inMint.toLowerCase() === outMint.toLowerCase();

  const requestQuote = useCallback(async (): Promise<JupiterQuote> => {
    if (!amount.trim()) throw new Error("Enter an amount to trade.");
    if (sameMint) {
      throw new Error("SOL is already the base asset. Search for another token to trade.");
    }

    const atomicAmount = decimalToAtomic(amount, inDecimals);
    const url = `/api/jupiter/quote?inputMint=${inMint}&outputMint=${outMint}&amount=${atomicAmount}&slippageBps=${slippage}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(responseError(data, `Jupiter ${res.status}`));
    }
    if (!isJupiterQuote(data)) {
      throw new Error("Jupiter returned an invalid quote.");
    }
    return data;
  }, [amount, inDecimals, inMint, outMint, sameMint, slippage]);

  const fetchQuote = useCallback(async () => {
    if (!amount.trim()) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    setQuoting(true);
    setQuoteError(null);
    try {
      setQuote(await requestQuote());
    } catch (e) {
      setQuote(null);
      setQuoteError(e instanceof Error ? e.message : "Quote failed");
    } finally {
      setQuoting(false);
    }
  }, [amount, requestQuote, setQuote, setQuoteError, setQuoting]);

  useEffect(() => {
    const t = setTimeout(fetchQuote, 600);
    return () => clearTimeout(t);
  }, [fetchQuote]);

  const reset = () => {
    setStatus("idle");
    setError(null);
    setTxSig(null);
    setRecordWarning(null);
  };

  const linkPhantomForTrading = async () => {
    setError(null);
    try {
      const address = await linkPhantom();
      setWallet(address);
      setPhantomConnected(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to link Phantom wallet.");
    }
  };

  const executeSwap = async () => {
    if (!wallet || !canTrade) return;
    setError(null);
    setRecordWarning(null);
    setStatus("swapping");

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("Sign in again before trading");
      const liveQuote = await requestQuote();
      setQuote(liveQuote);

      const swapRes = await fetch("/api/jupiter/swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          quoteResponse: liveQuote,
          userPublicKey: wallet,
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      });
      const swapData = await swapRes.json() as JupiterSwapResponse;
      if (!swapRes.ok) {
        throw new Error(typeof swapData.error === "string" ? swapData.error : "Jupiter failed to build swap transaction");
      }
      const swapTransaction = typeof swapData.swapTransaction === "string" ? swapData.swapTransaction : null;
      if (!swapTransaction) throw new Error("Jupiter did not return a swap transaction");

      const tx = VersionedTransaction.deserialize(base64ToBytes(swapTransaction));

      const phantom = getPhantomProvider();
      if (!phantom) throw new Error("Phantom not found. Install Phantom to trade.");
      const connection = new Connection(RPC, "confirmed");
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      tx.message.recentBlockhash = latestBlockhash.blockhash;
      const signed = await phantom.signTransaction(tx);

      setStatus("confirming");
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 5,
        preflightCommitment: "confirmed",
      });
      setTxSig(sig);

      await confirmSubmittedTransaction(
        connection,
        sig,
        latestBlockhash.blockhash,
        latestBlockhash.lastValidBlockHeight,
      );

      const solAmount = side === "buy"
        ? decimalToNumber(amount).toString()
        : atomicToDecimalString(liveQuote.outAmount, SOL_DECIMALS, SOL_DECIMALS);
      const tokenAmount = side === "buy"
        ? atomicToDecimalString(liveQuote.outAmount, tokenDecimals, tokenDecimals)
        : decimalToNumber(amount).toString();

      const recordRes = await fetch("/api/trades/record", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          user_wallet: wallet,
          token_mint: tokenAddress,
          token_symbol: tokenSymbol,
          token_name: tokenName,
          side,
          sol_amount: solAmount,
          token_amount: tokenAmount,
          price_usd: price,
          tx_signature: sig,
        }),
      });
      const recordData = await recordRes.json();
      if (!recordRes.ok) {
        setRecordWarning(
          responseError(recordData, "Trade history did not update. Refresh your portfolio before retrying.")
        );
      }

      setStatus("done");
    } catch (e: unknown) {
      setError(tradeErrorMessage(e));
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
          {quote ? formatOut(quote.outAmount, outDecimals) : "-"}
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
      {status === "confirming" && txSig && (
        <div style={{ backgroundColor: "rgba(0,217,126,0.05)", border: "1px solid rgba(0,217,126,0.15)", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, color: "var(--cw-green)", fontWeight: 500, marginBottom: 4 }}>Swap submitted</div>
          <div style={{ fontSize: 11, color: "var(--cw-dim)", marginBottom: 6 }}>Waiting for on-chain confirmation...</div>
          <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--cw-accent)", textDecoration: "none", fontFamily: "var(--font-mono)" }}>
            Open in Solscan
          </a>
        </div>
      )}

      {status === "done" && txSig && (
        <div style={{ backgroundColor: "rgba(0,217,126,0.08)", border: "1px solid rgba(0,217,126,0.2)", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, color: "var(--cw-green)", fontWeight: 500, marginBottom: 4 }}>Swap confirmed</div>
          {recordWarning && (
            <div style={{ fontSize: 11, color: "#ffbe50", marginBottom: 6 }}>
              Trade history did not update. Refresh your portfolio before retrying.
            </div>
          )}
          <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--cw-accent)", textDecoration: "none", fontFamily: "var(--font-mono)" }}>
            Open in Solscan
          </a>
        </div>
      )}

      {status === "error" && error && !txSig && (
        <div style={{ backgroundColor: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 8, padding: 12, fontSize: 12, color: "var(--cw-red)" }}>
          {error}
        </div>
      )}

      {status === "error" && txSig && (
        <div style={{ backgroundColor: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.2)", borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, color: "var(--cw-red)", fontWeight: 500, marginBottom: 4 }}>Swap needs review</div>
          <div style={{ fontSize: 11, color: "var(--cw-dim)", marginBottom: 6 }}>{error}</div>
          <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--cw-accent)", textDecoration: "none", fontFamily: "var(--font-mono)" }}>
            Open in Solscan
          </a>
        </div>
      )}

      {/* CTA */}
      {sameMint ? (
        <button
          disabled
          style={{
            width: "100%", padding: "12px 0", borderRadius: 8, border: "none",
            cursor: "not-allowed",
            fontSize: 14, fontWeight: 500,
            backgroundColor: "rgba(255,255,255,0.08)",
            color: "var(--cw-muted)",
          }}
        >
          Choose another token
        </button>
      ) : canTrade ? (
        <button
          onClick={status === "done" ? reset : executeSwap}
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
            : (status === "error" && txSig) ? "Swap again"
            : status === "error" ? "Try again"
            : `${side === "buy" ? "Buy" : "Sell"} ${tokenSymbol}`}
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={() => {
              if (!privyAuthenticated) {
                login();
                return;
              }
              linkPhantomForTrading().catch(() => undefined);
            }}
            disabled={linkingWallet}
            style={{ width: "100%", padding: "12px 0", borderRadius: 8, border: "none", cursor: linkingWallet ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 500, backgroundColor: "var(--cw-accent)", color: "#080404", opacity: linkingWallet ? 0.7 : 1 }}>
            {!privyAuthenticated
              ? "Sign in to trade"
              : linkingWallet
              ? "Linking Phantom..."
              : "Link Phantom to trade"}
          </button>
          <div style={{ textAlign: "center", fontSize: 11, lineHeight: 1.5, color: "var(--cw-dim)" }}>
            {privyAuthenticated
              ? "You need Phantom installed and unlocked. Create or import a Solana wallet in Phantom, then connect it here."
              : "Sign in first, then connect Phantom to trade on Solana."}
          </div>
        </div>
      )}

      {/* Slippage selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--cw-dim)" }}>Slippage</span>
        <div style={{ display: "flex", gap: 4 }}>
          {[{ label: "0.5%", bps: 50 }, { label: "1%", bps: 100 }, { label: "2%", bps: 200 }].map((s) => (
            <button
              key={s.bps}
              onClick={() => setSlippage(s.bps)}
              style={{
                padding: "3px 8px", fontSize: 11, borderRadius: 4, cursor: "pointer",
                border: `1px solid ${slippage === s.bps ? "rgba(255,255,255,0.3)" : "var(--cw-border)"}`,
                backgroundColor: slippage === s.bps ? "rgba(255,255,255,0.08)" : "transparent",
                color: slippage === s.bps ? "#fff" : "var(--cw-dim)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--cw-dim)", textAlign: "center" }}>
        Powered by Jupiter
      </div>
    </div>
  );
}
