import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/privy-server";
import { requireOwnedSolanaWallet } from "@/lib/wallet-auth";

const BIRDEYE_URL = "https://public-api.birdeye.so";

type JsonRecord = Record<string, unknown>;

interface NetWorthPoint {
  unixTime: number;
  valueUsd: number;
}

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function numberField(source: JsonRecord | null, keys: string[]): number | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function itemsFrom(source: JsonRecord | null): unknown[] {
  const data = record(source?.data);
  const candidates = [
    data?.items,
    data?.history,
    data?.data,
    source?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function normalizeHistory(source: JsonRecord | null): NetWorthPoint[] {
  return itemsFrom(source)
    .map((item) => {
      const row = record(item);
      const unixTime = numberField(row, ["unixTime", "unix_time", "timestamp", "time", "block_unix_time"]);
      const valueUsd = numberField(row, ["valueUsd", "value_usd", "netWorth", "net_worth", "totalUsd", "total_usd", "value"]);
      return unixTime && valueUsd !== null ? { unixTime, valueUsd } : null;
    })
    .filter((point): point is NetWorthPoint => point !== null)
    .sort((a, b) => a.unixTime - b.unixTime);
}

function totalValueFrom(source: JsonRecord | null): number | null {
  const data = record(source?.data);
  return numberField(data, [
    "totalUsd",
    "total_usd",
    "netWorth",
    "net_worth",
    "totalValue",
    "total_value",
    "value",
  ]);
}

async function birdeyeGet(path: string, params: URLSearchParams) {
  const key = process.env.BIRDEYE_API_KEY;
  if (!key) {
    return { ok: false as const, status: 500, json: { error: "Missing BIRDEYE_API_KEY" } };
  }

  const res = await fetch(`${BIRDEYE_URL}${path}?${params}`, {
    headers: {
      accept: "application/json",
      "x-chain": "solana",
      "X-API-KEY": key,
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({ error: "Invalid BirdEye response" }));

  if (!res.ok) {
    return { ok: false as const, status: res.status, json };
  }

  return { ok: true as const, status: res.status, json };
}

export async function GET(req: NextRequest) {
  try {
    const { address } = await requireOwnedSolanaWallet(req, req.nextUrl.searchParams.get("address"));
    const now = Math.floor(Date.now() / 1000);
    const timeFrom = now - 30 * 24 * 60 * 60;

    const currentParams = new URLSearchParams({ address });
    const historyParams = new URLSearchParams({
      address,
      time_from: String(timeFrom),
      time_to: String(now),
    });

    const [current, history] = await Promise.all([
      birdeyeGet("/wallet/v2/current-net-worth", currentParams),
      birdeyeGet("/wallet/v2/net-worth", historyParams),
    ]);

    if (!current.ok) {
      return NextResponse.json({ error: "BirdEye current net worth failed", details: current.json }, { status: current.status === 500 ? 500 : 502 });
    }

    if (!history.ok) {
      return NextResponse.json({ error: "BirdEye net worth history failed", details: history.json }, { status: history.status === 500 ? 500 : 502 });
    }

    const currentRecord = record(current.json);
    const historyRecord = record(history.json);

    return NextResponse.json({
      address,
      totalValueUsd: totalValueFrom(currentRecord),
      history: normalizeHistory(historyRecord),
      raw: {
        current: current.json,
        history: history.json,
      },
    });
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Unable to load wallet net worth" }, { status: 500 });
  }
}
