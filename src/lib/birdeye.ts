const BASE_URL = "https://public-api.birdeye.so";

function headers() {
  const key = process.env.BIRDEYE_API_KEY;
  if (!key) throw new Error("Missing BIRDEYE_API_KEY in .env.local");
  return {
    accept: "application/json",
    "x-chain": "solana",
    "X-API-KEY": key,
  };
}

// Retry up to 3 times on 429 with exponential backoff
async function birdeyeFetch(
  url: string,
  options: RequestInit & { next?: { revalidate?: number } },
  attempt = 0
): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 429 && attempt < 3) {
    const wait = 800 * Math.pow(2, attempt); // 800ms, 1.6s, 3.2s
    await new Promise((r) => setTimeout(r, wait));
    return birdeyeFetch(url, options, attempt + 1);
  }
  return res;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BirdeyeToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  price: number;
  mc: number;           // market cap
  v24hUSD: number;      // 24h volume in USD
  v24hChangePercent: number;
  liquidity: number;
}

export type SortBy = "v24hUSD" | "v24hChangePercent" | "mc" | "liquidity";
export type SortType = "desc" | "asc";

// ─── Token list ───────────────────────────────────────────────────────────────

export async function getTokenList({
  sortBy = "v24hUSD",
  sortType = "desc",
  limit = 20,
  offset = 0,
  minLiquidity = 1000,
}: {
  sortBy?: SortBy;
  sortType?: SortType;
  limit?: number;
  offset?: number;
  minLiquidity?: number;
} = {}): Promise<BirdeyeToken[]> {
  const params = new URLSearchParams({
    sort_by: sortBy,
    sort_type: sortType,
    limit: String(limit),
    offset: String(offset),
    min_liquidity: String(minLiquidity),
  });

  const res = await birdeyeFetch(`${BASE_URL}/defi/tokenlist?${params}`, {
    headers: headers(),
    next: { revalidate: 30 }, // cache for 30 seconds
  });

  if (!res.ok) {
    throw new Error(`BirdEye tokenlist error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  return json.data?.tokens ?? [];
}

// ─── Token overview (single token) ───────────────────────────────────────────

export interface BirdeyeTokenOverview {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  price: number;
  priceChange24hPercent: number;
  mc: number;
  v24hUSD: number;
  liquidity: number;
  supply: number;
  holder: number;
  extensions?: {
    website?: string;
    twitter?: string;
    description?: string;
  };
}

export async function getTokenOverview(address: string): Promise<BirdeyeTokenOverview> {
  const res = await birdeyeFetch(
    `${BASE_URL}/defi/token_overview?address=${address}`,
    {
      headers: headers(),
      next: { revalidate: 15 },
    }
  );

  if (!res.ok) {
    throw new Error(`BirdEye token_overview error: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

// ─── OHLCV price history (for TradingView chart) ─────────────────────────────

// BirdEye returns abbreviated field names: o/h/l/c not open/high/low/close
export interface OHLCVBar {
  unixTime: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

// How many seconds each interval spans
const INTERVAL_SECONDS: Record<string, number> = {
  "1m": 60, "3m": 180, "5m": 300, "15m": 900, "30m": 1800,
  "1H": 3600, "2H": 7200, "4H": 14400, "6H": 21600, "8H": 28800, "12H": 43200, "1D": 86400,
};

export async function getOHLCV({
  address,
  type = "15m",
  limit = 100,
}: {
  address: string;
  type?: "1m" | "3m" | "5m" | "15m" | "30m" | "1H" | "2H" | "4H" | "6H" | "8H" | "12H" | "1D";
  limit?: number;
}): Promise<OHLCVBar[]> {
  const now = Math.floor(Date.now() / 1000);
  const spanSeconds = (INTERVAL_SECONDS[type] ?? 900) * limit;
  const timeFrom = now - spanSeconds;

  const params = new URLSearchParams({
    address,
    type,
    time_from: String(timeFrom),
    time_to: String(now),
  });

  const res = await birdeyeFetch(`${BASE_URL}/defi/ohlcv?${params}`, {
    headers: headers(),
    next: { revalidate: 15 },
  });

  if (!res.ok) {
    throw new Error(`BirdEye OHLCV error: ${res.status}`);
  }

  const json = await res.json();
  return json.data?.items ?? [];
}

// ─── Token transactions (recent swaps) ───────────────────────────────────────

export interface TokenTransaction {
  txHash: string;
  blockUnixTime: number;
  owner: string;
  source?: string;
  side: "buy" | "sell";
  from: { symbol: string; uiAmount: number; address: string };
  to: { symbol: string; uiAmount: number; address: string };
  volumeUSD: number;
}

export async function getTokenTransactions(
  address: string,
  limit = 20
): Promise<TokenTransaction[]> {
  const params = new URLSearchParams({
    address,
    tx_type: "swap",
    sort_type: "desc",
    limit: String(limit),
  });

  const res = await birdeyeFetch(`${BASE_URL}/defi/txs/token?${params}`, {
    headers: headers(),
    next: { revalidate: 10 },
  });

  if (!res.ok) {
    throw new Error(`BirdEye txs error: ${res.status}`);
  }

  const json = await res.json();
  return json.data?.items ?? [];
}
