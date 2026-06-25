export interface PhantomProvider {
  isPhantom?: boolean;
  isConnected?: boolean;
  publicKey?: { toString(): string };
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>;
  signMessage?(message: Uint8Array, display?: "utf8" | "hex"): Promise<{ signature: Uint8Array }>;
  signTransaction<T>(transaction: T): Promise<T>;
}

interface SolanaWindow extends Window {
  solana?: PhantomProvider;
}

export function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const provider = (window as SolanaWindow).solana;
  return provider?.isPhantom ? provider : null;
}
