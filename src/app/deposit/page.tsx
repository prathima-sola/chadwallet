"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { primarySolanaAddress } from "@/lib/privy-client";
import { usePhantomSiwsLink } from "@/lib/use-phantom-siws-link";

function shortAddr(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export default function DepositPage() {
  const { authenticated, ready, login, user } = usePrivy();
  const [copied, setCopied] = useState(false);
  const { linkPhantom, linking, error: linkError } = usePhantomSiwsLink();
  const wallet = primarySolanaAddress(user);

  const startWalletLink = () => {
    linkPhantom().catch(() => undefined);
  };

  const copy = () => {
    if (!wallet) return;
    navigator.clipboard.writeText(wallet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!ready) return null;

  if (!authenticated) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 15, color: "var(--cw-muted)" }}>Sign in to get your deposit address</div>
        <button onClick={login} style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", backgroundColor: "var(--cw-accent)", color: "#080404", fontSize: 14, fontWeight: 500 }}>
          Sign in
        </button>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontSize: 15, color: "var(--cw-muted)" }}>Link a Solana wallet to get your deposit address</div>
        <div style={{ maxWidth: 420, textAlign: "center", fontSize: 12, lineHeight: 1.5, color: "var(--cw-dim)" }}>
          You need Phantom installed and unlocked. Create or import a Solana wallet in Phantom, then connect it here.
        </div>
        <button disabled={linking} onClick={startWalletLink} style={{ padding: "10px 24px", borderRadius: 8, border: "none", cursor: linking ? "not-allowed" : "pointer", backgroundColor: "var(--cw-accent)", color: "#080404", fontSize: 14, fontWeight: 500, opacity: linking ? 0.7 : 1 }}>
          {linking ? "Linking Phantom..." : "Link Phantom wallet"}
        </button>
        {linkError && (
          <div style={{ maxWidth: 420, textAlign: "center", fontSize: 12, lineHeight: 1.5, color: "var(--cw-red)" }}>
            {linkError}
          </div>
        )}
      </div>
    );
  }

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&bgcolor=080404&color=ffffff&data=${encodeURIComponent(wallet)}`;

  return (
    <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ fontSize: 11, color: "var(--cw-dim)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 24, textAlign: "center" }}>
          Deposit SOL
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div style={{ padding: 16, backgroundColor: "var(--cw-card)", border: "1px solid var(--cw-border)", borderRadius: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="Wallet QR code" width={180} height={180} style={{ display: "block", borderRadius: 4 }} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 12px", borderRadius: 20, backgroundColor: "rgba(0,217,126,0.1)", border: "1px solid rgba(0,217,126,0.2)" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--cw-accent)" }} />
            <span style={{ fontSize: 11, color: "var(--cw-accent)", fontWeight: 500 }}>Linked Phantom</span>
            <span style={{ fontSize: 11, color: "var(--cw-muted)", fontFamily: "var(--font-mono)" }}>{shortAddr(wallet)}</span>
          </div>
        </div>

        <div style={{ backgroundColor: "var(--cw-card)", border: "1px solid var(--cw-border)", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, fontSize: 12, fontFamily: "var(--font-mono)", color: "#fff", wordBreak: "break-all" }}>
            {wallet}
          </div>
          <button onClick={copy} style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 6, border: "1px solid var(--cw-border)", backgroundColor: copied ? "rgba(0,217,126,0.15)" : "transparent", color: copied ? "var(--cw-accent)" : "var(--cw-muted)", fontSize: 12, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        <div style={{ fontSize: 12, color: "var(--cw-dim)", textAlign: "center", lineHeight: 1.6 }}>
          Send only SOL or Solana tokens to this address.<br />
          Sending other assets may result in permanent loss.
        </div>
      </div>
    </div>
  );
}
