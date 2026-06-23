import { NextRequest, NextResponse } from "next/server";

const RPC_URL = process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  try {
    // Fetch all SPL token accounts
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          address,
          { programId: TOKEN_PROGRAM },
          { encoding: "jsonParsed" },
        ],
      }),
    });

    const json = await res.json();
    const accounts = json.result?.value ?? [];

    // Parse into clean token list
    const tokens = accounts
      .map((acc: any) => {
        const info = acc.account.data.parsed.info;
        return {
          mint: info.mint,
          amount: info.tokenAmount.uiAmount,
          decimals: info.tokenAmount.decimals,
        };
      })
      .filter((t: any) => t.amount > 0); // skip zero-balance accounts

    // Fetch prices from BirdEye for tokens we hold
    let withPrices = tokens;
    if (tokens.length > 0 && process.env.BIRDEYE_API_KEY) {
      const mints = tokens.map((t: any) => t.mint).slice(0, 10); // max 10
      const priceResults = await Promise.allSettled(
        mints.map((mint: string) =>
          fetch(`https://public-api.birdeye.so/defi/token_overview?address=${mint}`, {
            headers: {
              accept: "application/json",
              "x-chain": "solana",
              "X-API-KEY": process.env.BIRDEYE_API_KEY!,
            },
          }).then((r) => r.json())
        )
      );

      withPrices = tokens.map((t: any, i: number) => {
        const result = priceResults[i];
        if (result.status === "fulfilled" && result.value.data) {
          const d = result.value.data;
          return {
            ...t,
            name: d.name ?? t.mint.slice(0, 6),
            symbol: d.symbol ?? "???",
            logoURI: d.logoURI ?? null,
            price: d.price ?? 0,
            usdValue: (d.price ?? 0) * t.amount,
          };
        }
        return { ...t, name: t.mint.slice(0, 6), symbol: "???", price: 0, usdValue: 0 };
      });
    }

    return NextResponse.json({ tokens: withPrices });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
