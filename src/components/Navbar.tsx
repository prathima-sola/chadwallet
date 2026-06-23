"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect } from "react";
import { useAvatar } from "@/lib/avatar-context";

const NAV_LINKS = [
  { href: "/", label: "Discover" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/deposit", label: "Deposit" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { login, logout, ready, authenticated, user } = usePrivy();
  const [mounted, setMounted] = useState(false);
  const { avatarUrl } = useAvatar();

  useEffect(() => setMounted(true), []);

  const displayName =
    user?.google?.name ??
    user?.google?.email?.split("@")[0] ??
    (user?.wallet?.address ? `${user.wallet.address.slice(0, 4)}...${user.wallet.address.slice(-4)}` : null);

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
        <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "var(--cw-accent)", display: "inline-block" }} />
        <span style={{ fontSize: 15, fontWeight: 500, color: "#fff", letterSpacing: "-0.3px" }}>ChadWallet</span>
      </Link>

      {/* Nav links */}
      <div style={{ display: "flex", gap: 4 }}>
        {NAV_LINKS.map(({ href, label }) => {
          const active = mounted && pathname === href;
          return (
            <Link key={href} href={href}
              style={{
                fontSize: 13, padding: "5px 12px", borderRadius: 6, textDecoration: "none",
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

      {/* Right: avatar + auth */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {ready && authenticated && (
          <Link
            href="/profile"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
              padding: "4px 10px 4px 4px",
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.04)",
              border: "1px solid var(--cw-border)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                overflow: "hidden",
                backgroundColor: "rgba(0,217,126,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 13, color: "var(--cw-accent)", fontWeight: 600 }}>
                  {displayName?.[0]?.toUpperCase() ?? "?"}
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: "var(--cw-muted)" }}>{displayName}</span>
          </Link>
        )}

        {ready && (
          <button
            onClick={authenticated ? logout : login}
            style={{
              fontSize: 12, fontWeight: 500, padding: "7px 14px", borderRadius: 8,
              border: "none", cursor: "pointer",
              backgroundColor: authenticated ? "rgba(255,68,68,0.1)" : "var(--cw-accent)",
              color: authenticated ? "var(--cw-red)" : "#080404",
              transition: "opacity 0.15s",
            }}
          >
            {authenticated ? "Sign out" : "Connect wallet"}
          </button>
        )}

        {!ready && <div style={{ width: 110, height: 32, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.05)" }} />}
      </div>
    </nav>
  );
}
