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

      // Fetch metadata + price from BirdEye token_overview (one call per token)
      const overviewResults = await Promise.allSettled(
        mints.map((mint: string) =>
          fetch(`https://public-api.birdeye.so/defi/token_overview?address=${mint}`, {
            headers: {
              accept: "application/json",
              "x-chain": "solana",
              "X-API-KEY": process.env.BIRDEYE_API_KEY ?? "",
            },
          }).then((r) => r.json())
        )
      );

      // Fallback: Jupiter token list for any that failed
      const failedMints = mints.filter((_: string, i: number) => {
        const r = overviewResults[i];
        return r.status !== "fulfilled" || !r.value?.data?.symbol;
      });

      const jupiterMeta: Record<string, any> = {};
      if (failedMints.length > 0) {
        await Promise.allSettled(
          failedMints.map((mint: string) =>
            fetch(`https://api.jup.ag/tokens/v1/token/${mint}`)
              .then((r) => r.ok ? r.json() : null)
              .then((d) => { if (d) jupiterMeta[mint] = d; })
          )
        );
      }

      withPrices = tokens.map((t: any, i: number) => {
        const r = overviewResults[i];
        const d = r.status === "fulfilled" ? r.value?.data : null;
        const jup = jupiterMeta[t.mint];
        const name = d?.name ?? jup?.name ?? t.mint.slice(0, 6);
        const symbol = d?.symbol ?? jup?.symbol ?? "???";
        const logoURI = d?.logoURI ?? jup?.logoURI ?? null;
        const price = d?.price ?? 0;
        return { ...t, name, symbol, logoURI, price, usdValue: price * t.amount };
      });
    }

    return NextResponse.json({ tokens: withPrices });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
