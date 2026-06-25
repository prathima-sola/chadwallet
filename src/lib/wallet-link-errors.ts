export function walletLinkErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "linked_to_another_user":
      return "This wallet is already linked to another Privy user. Delete the stale wallet-only user in Privy or use a different Phantom wallet, then try again.";
    case "no_solana_accounts":
      return "Phantom did not return a Solana account. Unlock Phantom, select your Solana account, and try again.";
    case "client_request_timeout":
      return "Phantom did not finish the request. Open Phantom, approve the pending request, and retry.";
    case "exited_link_flow":
      return "Wallet linking was cancelled before it finished.";
    case "cannot_link_more_of_type":
      return "This account already has the maximum number of linked wallets.";
    case "generic_connect_wallet_error":
    case "unknown_connect_wallet_error":
      return "Privy could not connect this wallet. Make sure Phantom is unlocked, there is no pending Phantom request in another window, and this wallet is not already listed as a separate Privy user.";
    default:
      return `Privy could not link the wallet (${errorCode}). Try again, or use a different Phantom wallet.`;
  }
}
