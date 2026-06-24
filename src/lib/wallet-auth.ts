import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { AuthError, requirePrivyAuth, userOwnsSolanaWallet } from "@/lib/privy-server";

export function assertSolanaAddress(value: string | null, field = "address"): string {
  if (!value) {
    throw new AuthError(`Missing ${field}`, 400);
  }

  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new AuthError(`Invalid ${field}`, 400);
  }
}

export async function requireOwnedSolanaWallet(req: NextRequest, address: string | null) {
  const auth = await requirePrivyAuth(req);
  const normalizedAddress = assertSolanaAddress(address);
  const ownsWallet = await userOwnsSolanaWallet(auth.user_id, normalizedAddress);

  if (!ownsWallet) {
    throw new AuthError("Link this Solana wallet in Privy before using it here", 403);
  }

  return { auth, address: normalizedAddress };
}
