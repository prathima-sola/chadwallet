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

// Types

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

// Token list

const MEME_SORT_BY: Record<SortBy, string> = {
  v24hUSD: "volume_24h_usd",
  v24hChangePercent: "price_change_24h_percent",
  mc: "market_cap",
  liquidity: "liquidity",
};

interface BirdeyeMemeToken {
  address?: string;
  symbol?: string;
  name?: string;
  decimals?: number;
  logo_uri?: string;
  logoURI?: string;
  price?: number;
  market_cap?: number;
  mc?: number;
  volume_24h_usd?: number;
  v24hUSD?: number;
  price_change_24h_percent?: number;
  v24hChangePercent?: number;
  liquidity?: number;
}

function normalizeToken(t: BirdeyeMemeToken): BirdeyeToken | null {
  if (!t.address || !t.symbol || !t.name) return null;
  return {
    address: t.address,
    symbol: t.symbol,
    name: t.name,
    decimals: t.decimals ?? 0,
    logoURI: t.logo_uri ?? t.logoURI,
    price: t.price ?? 0,
    mc: t.market_cap ?? t.mc ?? 0,
    v24hUSD: t.volume_24h_usd ?? t.v24hUSD ?? 0,
    v24hChangePercent: t.price_change_24h_percent ?? t.v24hChangePercent ?? 0,
    liquidity: t.liquidity ?? 0,
  };
}

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
    sort_by: MEME_SORT_BY[sortBy],
    sort_type: sortType,
    limit: String(limit),
    offset: String(offset),
    min_liquidity: String(minLiquidity),
  });

  const res = await birdeyeFetch(`${BASE_URL}/defi/v3/token/meme/list?${params}`, {
    headers: headers(),
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    throw new Error(`BirdEye meme list error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const tokens: BirdeyeMemeToken[] = json.data?.items ?? [];

  return tokens
    .map(normalizeToken)
    .filter((t): t is BirdeyeToken => t !== null)
    .slice(0, limit);
}

// Token overview (single token)

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
  const d = json.data ?? {};
  // BirdEye returns realMc (circulating) and mc (fully diluted); prefer realMc when mc is 0
  if (!d.mc || d.mc === 0) {
    d.mc = d.realMc ?? 0;
  }
  return d;
}

// OHLCV price history (for TradingView chart)

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

// Top token holders

export interface TokenHolder {
  address: string;
  tokenAccount?: string;
  amount: string;
  decimals: number;
  uiAmount: number;
  percentage?: number;
}

interface BirdeyeTokenHolder {
  amount?: string | number;
  decimals?: number;
  owner?: string;
  address?: string;
  token_account?: string;
  ui_amount?: number;
  uiAmount?: number;
  percentage?: number;
}

export async function getTokenHolders(
  address: string,
  limit = 10
): Promise<TokenHolder[]> {
  const params = new URLSearchParams({
    address,
    offset: "0",
    limit: String(limit),
    ui_amount_mode: "scaled",
  });

  const res = await birdeyeFetch(`${BASE_URL}/defi/v3/token/holder?${params}`, {
    headers: headers(),
    next: { revalidate: 60 },
  });

  if (!res.ok) return [];
  const json = await res.json();
  const items: BirdeyeTokenHolder[] = json.data?.items ?? [];

  const holders: TokenHolder[] = [];
  for (const h of items) {
    const holderAddress = h.owner ?? h.address;
    if (!holderAddress) continue;
    holders.push({
      ...(h.token_account ? { tokenAccount: h.token_account } : {}),
      address: holderAddress,
      amount: String(h.amount ?? "0"),
      decimals: h.decimals ?? 0,
      uiAmount: h.ui_amount ?? h.uiAmount ?? 0,
      percentage: h.percentage,
    });
  }
  return holders;
}

// Token transactions (recent swaps)

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

interface BirdeyeTxLeg {
  symbol?: string;
  address?: string;
  ui_amount?: number;
  uiAmount?: number;
}

interface BirdeyeTokenTx {
  tx_hash?: string;
  txHash?: string;
  block_unix_time?: number;
  blockUnixTime?: number;
  owner?: string;
  source?: string;
  signers?: string[];
  tx_type?: string;
  side?: string;
  from?: BirdeyeTxLeg;
  to?: BirdeyeTxLeg;
  volume_usd?: number;
  volumeUSD?: number;
}

function normalizeTxLeg(leg?: BirdeyeTxLeg): TokenTransaction["from"] {
  return {
    symbol: leg?.symbol ?? "",
    address: leg?.address ?? "",
    uiAmount: leg?.ui_amount ?? leg?.uiAmount ?? 0,
  };
}

function normalizeTokenTransaction(tx: BirdeyeTokenTx, tokenAddress: string): TokenTransaction | null {
  const txHash = tx.tx_hash ?? tx.txHash;
  const blockUnixTime = tx.block_unix_time ?? tx.blockUnixTime;
  const from = normalizeTxLeg(tx.from);
  const to = normalizeTxLeg(tx.to);
  const normalizedTokenAddress = tokenAddress.toLowerCase();
  const explicitSide = tx.side === "buy" || tx.side === "sell" ? tx.side : null;
  const inferredSide = to.address.toLowerCase() === normalizedTokenAddress
    ? "buy"
    : from.address.toLowerCase() === normalizedTokenAddress
    ? "sell"
    : null;
  const side = explicitSide ?? inferredSide;

  if (!txHash || !blockUnixTime || !side) {
    return null;
  }

  return {
    txHash,
    blockUnixTime,
    owner: tx.owner ?? tx.signers?.[0] ?? tx.source ?? "unknown",
    source: tx.source,
    side,
    from,
    to,
    volumeUSD: tx.volume_usd ?? tx.volumeUSD ?? 0,
  };
}

export async function getTokenTransactions(
  address: string,
  limit = 20
): Promise<TokenTransaction[]> {
  const params = new URLSearchParams({
    address,
    tx_type: "swap",
    sort_by: "block_unix_time",
    sort_type: "desc",
    limit: String(limit),
    ui_amount_mode: "scaled",
  });

  const res = await birdeyeFetch(`${BASE_URL}/defi/v3/token/txs?${params}`, {
    headers: headers(),
    next: { revalidate: 10 },
  });

  if (!res.ok) {
    throw new Error(`BirdEye txs error: ${res.status}`);
  }

  const json = await res.json();
  const items: BirdeyeTokenTx[] = json.data?.items ?? [];
  return items
    .map((tx) => normalizeTokenTransaction(tx, address))
    .filter((tx): tx is TokenTransaction => tx !== null);
}
