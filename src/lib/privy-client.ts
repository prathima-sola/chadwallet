interface LinkedSolanaAccount {
  type?: string;
  address?: string;
  chainType?: string;
  chain_type?: string;
}

export interface PrivyLinkedAccountsUser {
  linkedAccounts?: unknown[];
}

export function linkedSolanaAddresses(user: PrivyLinkedAccountsUser | null | undefined): string[] {
  return (user?.linkedAccounts ?? [])
    .map((account): LinkedSolanaAccount | null => {
      if (!account || typeof account !== "object") return null;
      return account as LinkedSolanaAccount;
    })
    .filter((account): account is LinkedSolanaAccount => (
      account !== null &&
      account.type === "wallet" &&
      typeof account.address === "string" &&
      (account.chainType === "solana" || account.chain_type === "solana")
    ))
    .map((account) => account.address)
    .filter((address): address is string => typeof address === "string");
}

export function primarySolanaAddress(user: PrivyLinkedAccountsUser | null | undefined): string | null {
  return linkedSolanaAddresses(user)[0] ?? null;
}
