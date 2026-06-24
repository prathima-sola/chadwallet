import { NextRequest, NextResponse } from "next/server";
import { authErrorResponse } from "@/lib/privy-server";
import { requireOwnedSolanaWallet } from "@/lib/wallet-auth";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = record(await req.json());
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const userPublicKey = typeof body.userPublicKey === "string" ? body.userPublicKey : null;
    if (!userPublicKey) {
      return NextResponse.json({ error: "Missing userPublicKey" }, { status: 400 });
    }
    await requireOwnedSolanaWallet(req, userPublicKey);

    if (!record(body.quoteResponse)) {
      return NextResponse.json({ error: "Missing quoteResponse" }, { status: 400 });
    }

    const res = await fetch("https://api.jup.ag/swap/v1/swap", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        quoteResponse: body.quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: body.wrapAndUnwrapSol === true,
        dynamicComputeUnitLimit: body.dynamicComputeUnitLimit !== false,
        prioritizationFeeLamports: body.prioritizationFeeLamports === "auto" ? "auto" : undefined,
      }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    return authErrorResponse(e) ?? NextResponse.json({ error: "Unable to build swap transaction" }, { status: 500 });
  }
}
