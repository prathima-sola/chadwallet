"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect } from "react";

const NAV_LINKS = [
  { href: "/", label: "Discover" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/deposit", label: "Deposit" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { login, logout, ready, authenticated, user } = usePrivy();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const wallet = user?.wallet?.address;
  const shortWallet = wallet
    ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
    : null;

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 20px",
        height: "52px",
        borderBottom: "1px solid var(--cw-border)",
        position: "sticky",
        top: 0,
        zIndex: 50,
        backgroundColor: "var(--cw-bg)",
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            backgroundColor: "var(--cw-accent)",
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: 15, fontWeight: 500, color: "#fff", letterSpacing: "-0.3px" }}>
          ChadWallet
        </span>
      </Link>

      {/* Nav links */}
      <div style={{ display: "flex", gap: 4 }}>
        {NAV_LINKS.map(({ href, label }) => {
          const active = mounted && pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                fontSize: 13,
                padding: "5px 12px",
                borderRadius: 6,
                textDecoration: "none",
                color: active ? "#fff" : "var(--cw-muted)",
                backgroundColor: active ? "rgba(255,255,255,0.07)" : "transparent",
                transition: "color 0.15s, background 0.15s",
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Wallet connect */}
      {ready && (
        <button
          onClick={authenticated ? logout : login}
          style={{
            fontSize: 12,
            fontWeight: 500,
            padding: "7px 14px",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            backgroundColor: authenticated ? "rgba(255,255,255,0.07)" : "var(--cw-accent)",
            color: authenticated ? "#fff" : "#080404",
            letterSpacing: authenticated ? "0" : "-0.2px",
            transition: "opacity 0.15s",
          }}
        >
          {authenticated ? shortWallet : "Connect wallet"}
        </button>
      )}

      {/* Skeleton while Privy loads */}
      {!ready && (
        <div
          style={{
            width: 110,
            height: 32,
            borderRadius: 8,
            backgroundColor: "rgba(255,255,255,0.05)",
          }}
        />
      )}
    </nav>
  );
}
