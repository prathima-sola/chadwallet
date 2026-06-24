import { NextRequest, NextResponse } from "next/server";
import { Connection, type ParsedTransactionMeta, type TokenBalance } from "@solana/web3.js";
import { createServerSupabase } from "@/lib/supabase-server";
import { authErrorResponse } from "@/lib/privy-server";
import { assertSolanaAddress, requireOwnedSolanaWallet } from "@/lib/wallet-auth";
import { atomicToDecimalString } from "@/lib/amounts";

const RPC_URL =
  process.env.ALCHEMY_SOLANA_RPC_URL ??
  process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

type JsonRecord = Record<string, unknown>;
type TradeSide = "buy" | "sell";
const SOL_DECIMALS = 9;

interface ConfirmedTradeAmounts {
  solAmount: string;
  tokenAmount: string;
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function cleanText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`Missing ${field}`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Missing ${field}`);
  }
  return trimmed.slice(0, maxLength);
}

function cleanSide(value: unknown): TradeSide {
  if (value === "buy" || value === "sell") return value;
  throw new Error("Invalid trade side");
}

function cleanNullableDecimal(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const text = typeof value === "number" ? value.toString() : typeof value === "string" ? value.trim() : "";
  if (!/^\d+(\.\d+)?$/.test(text) || Number(text) < 0) {
    throw new Error("Invalid price_usd");
  }
  return text;
}

function cleanSignature(value: unknown): string {
  const signature = cleanText(value, "tx_signature", 128);
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,128}$/.test(signature)) {
    throw new Error("Invalid tx_signature");
  }
  return signature;
}

function absBigInt(value: bigint): bigint {
  return value < BigInt(0) ? -value : value;
}

function tokenBalanceRaw(balances: TokenBalance[] | null | undefined, mint: string, owner: string): bigint {
  const normalizedOwner = owner.toLowerCase();
  return (balances ?? []).reduce((sum, balance) => {
    if (balance.mint !== mint || balance.owner?.toLowerCase() !== normalizedOwner) {
      return sum;
    }
    return sum + BigInt(balance.uiTokenAmount.amount);
  }, BigInt(0));
}

function tokenDecimals(meta: ParsedTransactionMeta, mint: string, owner: string): number {
  const normalizedOwner = owner.toLowerCase();
  const balance = [
    ...(meta.preTokenBalances ?? []),
    ...(meta.postTokenBalances ?? []),
  ].find((item) => item.mint === mint && item.owner?.toLowerCase() === normalizedOwner);

  if (typeof balance?.uiTokenAmount.decimals !== "number") {
    throw new Error("Unable to determine token decimals from transaction");
  }

  return balance.uiTokenAmount.decimals;
}

function deriveAmountsFromMeta(
  meta: ParsedTransactionMeta,
  accountKeys: string[],
  userWallet: string,
  tokenMint: string,
  side: TradeSide
): ConfirmedTradeAmounts {
  const walletIndex = accountKeys.indexOf(userWallet);
  if (walletIndex < 0) {
    throw new Error("Transaction does not include the trading wallet");
  }

  const decimals = tokenDecimals(meta, tokenMint, userWallet);
  const preTokenRaw = tokenBalanceRaw(meta.preTokenBalances, tokenMint, userWallet);
  const postTokenRaw = tokenBalanceRaw(meta.postTokenBalances, tokenMint, userWallet);
  const tokenDeltaRaw = postTokenRaw - preTokenRaw;

  if (side === "buy" && tokenDeltaRaw <= BigInt(0)) {
    throw new Error("Transaction did not increase the traded token balance");
  }
  if (side === "sell" && tokenDeltaRaw >= BigInt(0)) {
    throw new Error("Transaction did not decrease the traded token balance");
  }

  const preLamports = BigInt(meta.preBalances[walletIndex] ?? 0);
  const postLamports = BigInt(meta.postBalances[walletIndex] ?? 0);
  const walletLamportDelta = postLamports - preLamports;
  const walletPaidFee = accountKeys[0] === userWallet;
  const feeLamports = walletPaidFee ? BigInt(meta.fee) : BigInt(0);
  const tradeLamports = side === "buy"
    ? absBigInt(walletLamportDelta) - feeLamports
    : walletLamportDelta + feeLamports;

  if (side === "buy" && walletLamportDelta >= BigInt(0)) {
    throw new Error("Transaction did not spend SOL from the trading wallet");
  }
  if (side === "sell" && walletLamportDelta <= BigInt(0)) {
    throw new Error("Transaction did not return SOL to the trading wallet");
  }
  if (tradeLamports <= BigInt(0)) {
    throw new Error("Unable to derive a positive SOL trade amount");
  }

  return {
    solAmount: atomicToDecimalString(tradeLamports.toString(), SOL_DECIMALS, SOL_DECIMALS),
    tokenAmount: atomicToDecimalString(absBigInt(tokenDeltaRaw).toString(), decimals, decimals),
  };
}

async function confirmedTradeAmounts(
  signature: string,
  userWallet: string,
  tokenMint: string,
  side: TradeSide
): Promise<ConfirmedTradeAmounts> {
  const connection = new Connection(RPC_URL, "confirmed");
  const tx = await connection.getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error("Transaction is not confirmed yet");
  }

  if (!tx.meta) {
    throw new Error("Transaction metadata is unavailable");
  }

  if (tx.meta.err) {
    throw new Error("Transaction failed on-chain");
  }

  const accountKeys = tx.transaction.message.accountKeys.map((account) => account.pubkey.toBase58());
  const tokenBalances = [
    ...(tx.meta.preTokenBalances ?? []),
    ...(tx.meta.postTokenBalances ?? []),
  ];
  const touchesMint = tokenBalances.some((balance) => balance.mint === tokenMint);
  if (!touchesMint) {
    throw new Error("Transaction does not include the traded token mint");
  }

  return deriveAmountsFromMeta(tx.meta, accountKeys, userWallet, tokenMint, side);
}

export async function POST(req: NextRequest) {
  try {
    const body = record(await req.json());
    if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

    const { auth, address: userWallet } = await requireOwnedSolanaWallet(req, typeof body.user_wallet === "string" ? body.user_wallet : null);
    const tokenMint = assertSolanaAddress(typeof body.token_mint === "string" ? body.token_mint : null, "token_mint");
    const tokenSymbol = cleanText(body.token_symbol, "token_symbol", 24);
    const tokenName = cleanText(body.token_name, "token_name", 160);
    const side = cleanSide(body.side);
    const priceUsd = cleanNullableDecimal(body.price_usd);
    const txSignature = cleanSignature(body.tx_signature);

    const amounts = await confirmedTradeAmounts(txSignature, userWallet, tokenMint, side);

    const supabase = createServerSupabase();
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        user_id: auth.user_id,
        wallet_address: userWallet,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const { error } = await supabase.from("trades").insert({
      user_id: auth.user_id,
      user_wallet: userWallet,
      token_mint: tokenMint,
      token_symbol: tokenSymbol,
      token_name: tokenName,
      side,
      sol_amount: amounts.solAmount,
      token_amount: amounts.tokenAmount,
      price_usd: priceUsd,
      tx_signature: txSignature,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: e instanceof Error ? e.message : "Unable to record trade" }, { status: 400 });
  }
}
