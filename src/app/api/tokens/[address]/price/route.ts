import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const key = process.env.BIRDEYE_API_KEY ?? "";

  try {
    const res = await fetch(
      `https://public-api.birdeye.so/defi/price?address=${address}`,
      {
        headers: {
          accept: "application/json",
          "x-chain": "solana",
          "X-API-KEY": key,
        },
      }
    );
    if (!res.ok) return NextResponse.json({ price: null });
    const json = await res.json();
    return NextResponse.json({ price: json.data?.value ?? null });
  } catch {
    return NextResponse.json({ price: null });
  }
}
