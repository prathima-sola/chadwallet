import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PrivyClient, type VerifyAccessTokenResponse } from "@privy-io/node";

const APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const APP_SECRET = process.env.PRIVY_APP_SECRET;

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function authErrorResponse(e: unknown) {
  if (e instanceof AuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  return null;
}

function bearerToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length).trim();
  return req.cookies.get("privy-token")?.value ?? null;
}

export async function requirePrivyAuth(req: NextRequest): Promise<VerifyAccessTokenResponse> {
  const accessToken = bearerToken(req);
  if (!accessToken) {
    throw new AuthError("Sign in to continue", 401);
  }

  try {
    return await privyClient().utils().auth().verifyAccessToken(accessToken);
  } catch {
    throw new AuthError("Your session expired. Sign in again.", 401);
  }
}

function privyClient() {
  if (!APP_ID || !APP_SECRET) {
    throw new AuthError("Privy server client is not configured", 500);
  }

  return new PrivyClient({
    appId: APP_ID,
    appSecret: APP_SECRET,
  });
}

export async function userOwnsSolanaWallet(userId: string, address: string): Promise<boolean> {
  const normalized = address.toLowerCase();
  const user = await privyClient().users()._get(userId);

  return user.linked_accounts.some((account) => (
    account.type === "wallet" &&
    "chain_type" in account &&
    account.chain_type === "solana" &&
    "address" in account &&
    account.address.toLowerCase() === normalized
  ));
}
