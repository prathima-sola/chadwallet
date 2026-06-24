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

      // Fetch token metadata via Alchemy DAS API (getAsset) — uses existing RPC endpoint
      const metaResults = await Promise.allSettled(
        mints.map((mint: string) =>
          fetch(RPC_URL, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getAsset",
              params: { id: mint },
            }),
          }).then((r) => r.json())
        )
      );

      // Fetch prices via CoinGecko (free, no key, separate rate limit from BirdEye)
      const mintList = mints.join(",");
      const cgRes = await fetch(
        `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${mintList}&vs_currencies=usd`,
        { headers: { accept: "application/json" } }
      ).then((r) => r.json()).catch(() => ({}));

      withPrices = tokens.map((t: any, i: number) => {
        const asset = metaResults[i].status === "fulfilled" ? metaResults[i].value?.result : null;
        const name = asset?.content?.metadata?.name ?? t.mint.slice(0, 6);
        const symbol = asset?.content?.metadata?.symbol ?? "???";
        const logoURI = asset?.content?.links?.image ?? asset?.content?.files?.[0]?.uri ?? null;
        const price = cgRes?.[t.mint.toLowerCase()]?.usd ?? cgRes?.[t.mint]?.usd ?? 0;
        return { ...t, name, symbol, logoURI, price, usdValue: price * t.amount };
      });
    }

    return NextResponse.json({ tokens: withPrices });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
