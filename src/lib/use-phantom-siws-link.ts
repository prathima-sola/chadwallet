"use client";

import { useCallback, useState } from "react";
import { useLinkWithSiws } from "@privy-io/react-auth";
import { getPhantomProvider } from "@/lib/phantom";
import { bytesToBase64, privyErrorCode } from "@/lib/solana-signature";
import { walletLinkErrorMessage } from "@/lib/wallet-link-errors";

function phantomErrorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;
  const source = error as Record<string, unknown>;
  const code = source.code;

  if (code === 4001 || code === "4001") {
    return "You cancelled the Phantom approval.";
  }
  if (code === -32002 || code === "-32002") {
    return "Phantom already has a pending request. Open Phantom, finish or reject it, then retry.";
  }

  return null;
}

export function usePhantomSiwsLink() {
  const { generateSiwsMessage, linkWithSiws } = useLinkWithSiws();
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linkPhantom = useCallback(async () => {
    setError(null);
    setLinking(true);

    try {
      const phantom = getPhantomProvider();
      if (!phantom) {
        throw new Error("Phantom not found. Install Phantom first.");
      }
      if (!phantom.signMessage) {
        throw new Error("This Phantom wallet cannot sign Solana messages. Update Phantom and try again.");
      }

      const connected = await phantom.connect();
      const address = connected.publicKey.toString();
      const message = await generateSiwsMessage({ address });
      const signed = await phantom.signMessage(new TextEncoder().encode(message), "utf8");

      await linkWithSiws({
        message,
        signature: bytesToBase64(signed.signature),
        walletClientType: "phantom",
        connectorType: "injected",
      });

      return address;
    } catch (caught) {
      const phantomMessage = phantomErrorMessage(caught);
      const code = privyErrorCode(caught);
      const message =
        phantomMessage ??
        (code ? walletLinkErrorMessage(code) : null) ??
        (caught instanceof Error ? caught.message : "Unable to link Phantom wallet.");

      setError(message);
      throw new Error(message);
    } finally {
      setLinking(false);
    }
  }, [generateSiwsMessage, linkWithSiws]);

  return { linkPhantom, linking, error, setError };
}
