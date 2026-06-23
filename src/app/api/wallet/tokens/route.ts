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

    // Fetch metadata from Jupiter (free, no API key) + prices from BirdEye
    let withPrices = tokens;
    if (tokens.length > 0) {
      const mints = tokens.map((t: any) => t.mint).slice(0, 10);

      // Jupiter token metadata (free)
      const metaResults = await Promise.allSettled(
        mints.map((mint: string) =>
          fetch(`https://tokens.jup.ag/token/${mint}`, {
            headers: { accept: "application/json" },
          }).then((r) => r.ok ? r.json() : null)
        )
      );

      // BirdEye prices
      const priceResults = process.env.BIRDEYE_API_KEY
        ? await Promise.allSettled(
            mints.map((mint: string) =>
              fetch(`https://public-api.birdeye.so/defi/price?address=${mint}`, {
                headers: {
                  accept: "application/json",
                  "x-chain": "solana",
                  "X-API-KEY": process.env.BIRDEYE_API_KEY!,
                },
              }).then((r) => r.json())
            )
          )
        : [];

      withPrices = tokens.map((t: any, i: number) => {
        const meta = metaResults[i]?.status === "fulfilled" ? metaResults[i].value : null;
        const priceData = priceResults[i]?.status === "fulfilled" ? (priceResults[i] as any).value?.data : null;
        const price = priceData?.value ?? 0;
        return {
          ...t,
          name: meta?.name ?? t.mint.slice(0, 6),
          symbol: meta?.symbol ?? "???",
          logoURI: meta?.logoURI ?? null,
          price,
          usdValue: price * t.amount,
        };
      });
    }

    return NextResponse.json({ tokens: withPrices });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
