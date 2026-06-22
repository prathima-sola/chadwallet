import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") ?? "CnLtxATz6h7kFLH4ijZGiAAy274hrHkfEXT6zXJ8yGZf";
  const key = process.env.BIRDEYE_API_KEY ?? "";

  const params = new URLSearchParams({ address, offset: "0", limit: "10" });
  const res = await fetch(`https://public-api.birdeye.so/defi/token_holder?${params}`, {
    headers: {
      accept: "application/json",
      "x-chain": "solana",
      "X-API-KEY": key,
    },
  });

  const text = await res.text();
  return NextResponse.json({ status: res.status, body: text });
}
