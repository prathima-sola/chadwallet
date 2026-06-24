import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const key = process.env.BIRDEYE_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "BIRDEYE_API_KEY is not configured" }, { status: 500 });
  }

  let mint: string;
  try {
    mint = new PublicKey(address).toBase58();
  } catch {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${mint}`,
      {
        headers: {
          accept: "application/json",
          "x-chain": "solana",
          "X-API-KEY": key,
        },
      }
    );
    if (!res.ok) {
      return NextResponse.json({ error: "BirdEye price failed" }, { status: 502 });
    }
    const json = await res.json();
    return NextResponse.json({ price: json.data?.value ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unable to load token price" }, { status: 500 });
  }
}
