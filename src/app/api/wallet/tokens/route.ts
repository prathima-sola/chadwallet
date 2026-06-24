import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/privy-server";
import { requireOwnedSolanaWallet } from "@/lib/wallet-auth";

const RPC_URL =
  process.env.ALCHEMY_SOLANA_RPC_URL ??
  process.env.NEXT_PUBLIC_ALCHEMY_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

interface RpcTokenAccount {
  account: {
    data: {
      parsed: {
        info: {
          mint: string;
          tokenAmount: {
            decimals: number;
            uiAmount: number | null;
          };
        };
      };
    };
  };
}

interface Holding {
  mint: string;
  amount: number;
  decimals: number;
}

interface DasAsset {
  result?: {
    content?: {
      metadata?: {
        name?: string;
        symbol?: string;
      };
      links?: {
        image?: string;
      };
      files?: Array<{
        uri?: string;
      }>;
    };
  };
}

type CoinGeckoPrices = Record<string, { usd?: number }>;

interface TokenAccountsResponse {
  result?: {
    value?: RpcTokenAccount[];
  };
  error?: {
    message?: string;
  };
}

export async function GET(req: NextRequest) {
  try {
    const { address } = await requireOwnedSolanaWallet(req, req.nextUrl.searchParams.get("address"));

    // Fetch all SPL token accounts.
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

    const json = await res.json().catch(() => null) as TokenAccountsResponse | null;
    if (!res.ok || !json || json.error) {
      return NextResponse.json({
        error: json?.error?.message ?? "Unable to load token accounts from RPC",
      }, { status: 502 });
    }

    const accounts: RpcTokenAccount[] = json.result?.value ?? [];

    // Parse into clean token list.
    const tokens: Holding[] = accounts
      .map((acc) => {
        const info = acc.account.data.parsed.info;
        return {
          mint: info.mint,
          amount: info.tokenAmount.uiAmount ?? 0,
          decimals: info.tokenAmount.decimals,
        };
      })
      .filter((t) => t.amount > 0);

    let withPrices = tokens;
    if (tokens.length > 0) {
      const mints = tokens.map((t) => t.mint).slice(0, 50);

      const metaResults = await Promise.allSettled(
        mints.map((mint) =>
          fetch(RPC_URL, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "getAsset",
              params: { id: mint },
            }),
          }).then((r) => r.json() as Promise<DasAsset>)
        )
      );
      const metaByMint = new Map<string, DasAsset["result"]>();
      mints.forEach((mint, i) => {
        const result = metaResults[i];
        if (result?.status === "fulfilled" && result.value.result) {
          metaByMint.set(mint, result.value.result);
        }
      });

      const priceParams = new URLSearchParams({
        contract_addresses: mints.join(","),
        vs_currencies: "usd",
      });
      const cgRes: CoinGeckoPrices = await fetch(
        `https://api.coingecko.com/api/v3/simple/token_price/solana?${priceParams}`,
        { headers: { accept: "application/json" } }
      ).then((r) => r.json()).catch(() => ({}));

      withPrices = tokens.map((t) => {
        const asset = metaByMint.get(t.mint);
        const name = asset?.content?.metadata?.name ?? t.mint.slice(0, 6);
        const symbol = asset?.content?.metadata?.symbol ?? "???";
        const logoURI = asset?.content?.links?.image ?? asset?.content?.files?.[0]?.uri ?? null;
        const price = cgRes?.[t.mint.toLowerCase()]?.usd ?? cgRes?.[t.mint]?.usd ?? 0;
        return { ...t, name, symbol, logoURI, price, usdValue: price * t.amount };
      });
    }

    return NextResponse.json({ tokens: withPrices });
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Unable to load token holdings" }, { status: 500 });
  }
}
