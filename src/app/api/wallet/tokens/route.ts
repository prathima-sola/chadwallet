import { NextRequest, NextResponse } from "next/server";
import { getTokenOverview } from "@/lib/birdeye";
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

interface TokenMetadata {
  name?: string;
  symbol?: string;
  logoURI?: string | null;
  price?: number;
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

interface BirdeyeOverviewShape {
  name?: unknown;
  symbol?: unknown;
  logoURI?: unknown;
  logo_uri?: unknown;
  price?: unknown;
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

function textField(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberField(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function shortMint(mint: string): string {
  return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
}

function normalizeBirdeyeOverview(value: BirdeyeOverviewShape): TokenMetadata {
  return {
    name: textField(value.name),
    symbol: textField(value.symbol),
    logoURI: textField(value.logoURI) ?? textField(value.logo_uri) ?? null,
    price: numberField(value.price),
  };
}

function normalizeDasAsset(asset: DasAsset["result"]): TokenMetadata {
  return {
    name: textField(asset?.content?.metadata?.name),
    symbol: textField(asset?.content?.metadata?.symbol),
    logoURI: textField(asset?.content?.links?.image) ?? textField(asset?.content?.files?.[0]?.uri) ?? null,
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

      const [overviewResults, metaResults, cgRes] = await Promise.all([
        Promise.allSettled(
          mints.map((mint) => getTokenOverview(mint))
        ),
        Promise.allSettled(
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
        ),
        fetch(
          `https://api.coingecko.com/api/v3/simple/token_price/solana?${new URLSearchParams({
            contract_addresses: mints.join(","),
            vs_currencies: "usd",
          })}`,
          { headers: { accept: "application/json" }, next: { revalidate: 60 } }
        ).then((r) => r.json() as Promise<CoinGeckoPrices>).catch((): CoinGeckoPrices => ({})),
      ]);

      const overviewByMint = new Map<string, TokenMetadata>();
      mints.forEach((mint, i) => {
        const result = overviewResults[i];
        if (result?.status === "fulfilled") {
          const metadata = normalizeBirdeyeOverview(result.value as BirdeyeOverviewShape);
          if (metadata.name || metadata.symbol || metadata.logoURI || metadata.price !== undefined) {
            overviewByMint.set(mint, metadata);
          }
        }
      });

      const assetByMint = new Map<string, TokenMetadata>();
      mints.forEach((mint, i) => {
        const result = metaResults[i];
        if (result?.status === "fulfilled" && result.value.result) {
          const metadata = normalizeDasAsset(result.value.result);
          if (metadata.name || metadata.symbol || metadata.logoURI) {
            assetByMint.set(mint, metadata);
          }
        }
      });

      withPrices = tokens.map((t) => {
        const overview = overviewByMint.get(t.mint);
        const asset = assetByMint.get(t.mint);
        const price = overview?.price
          ?? cgRes?.[t.mint.toLowerCase()]?.usd
          ?? cgRes?.[t.mint]?.usd
          ?? 0;

        return {
          ...t,
          name: overview?.name ?? asset?.name ?? t.mint,
          symbol: overview?.symbol ?? asset?.symbol ?? shortMint(t.mint),
          logoURI: overview?.logoURI ?? asset?.logoURI ?? null,
          price,
          usdValue: price * t.amount,
        };
      }).sort((a, b) => (b.usdValue ?? 0) - (a.usdValue ?? 0));
    }

    return NextResponse.json({ tokens: withPrices });
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Unable to load token holdings" }, { status: 500 });
  }
}
