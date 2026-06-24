import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

function validMint(value: string | null, name: string): string | NextResponse {
  if (!value) return NextResponse.json({ error: `Missing ${name}` }, { status: 400 });
  try {
    return new PublicKey(value).toBase58();
  } catch {
    return NextResponse.json({ error: `Invalid ${name}` }, { status: 400 });
  }
}

function validAtomicAmount(value: string | null): string | NextResponse {
  if (!value) return NextResponse.json({ error: "Missing amount" }, { status: 400 });
  if (!/^[1-9]\d*$/.test(value)) {
    return NextResponse.json({ error: "Amount must be a positive integer in atomic units" }, { status: 400 });
  }
  return value;
}

function validSlippage(value: string | null): string | NextResponse {
  const parsed = Number(value ?? "50");
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    return NextResponse.json({ error: "Slippage must be between 1 and 1000 bps" }, { status: 400 });
  }
  return String(parsed);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const inputMint = validMint(searchParams.get("inputMint"), "inputMint");
  if (inputMint instanceof NextResponse) return inputMint;
  const outputMint = validMint(searchParams.get("outputMint"), "outputMint");
  if (outputMint instanceof NextResponse) return outputMint;
  const amount = validAtomicAmount(searchParams.get("amount"));
  if (amount instanceof NextResponse) return amount;
  const slippageBps = validSlippage(searchParams.get("slippageBps"));
  if (slippageBps instanceof NextResponse) return slippageBps;

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps,
  });
  const upstream = `https://api.jup.ag/swap/v1/quote?${params}`;

  try {
    const res = await fetch(upstream, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });

    const text = await res.text();

    if (!text) {
      return NextResponse.json({ error: "Empty response from Jupiter" }, { status: 502 });
    }

    const data = JSON.parse(text);
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to fetch Jupiter quote" }, { status: 500 });
  }
}
