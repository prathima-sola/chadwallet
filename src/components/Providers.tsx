"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { AvatarProvider } from "@/lib/avatar-context";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["wallet", "google", "apple"],
        appearance: {
          theme: "dark",
          accentColor: "#00d97e",
          showWalletLoginFirst: false,
          walletChainType: "solana-only",
        },
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors(),
          },
        },
        embeddedWallets: {
          ethereum: { createOnLogin: "off" },
          solana: { createOnLogin: "off" },
        },
      }}
    >
      <AvatarProvider>{children}</AvatarProvider>
    </PrivyProvider>
  );
}
