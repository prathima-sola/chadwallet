"use client";

import Link from "next/link";

export default function TokenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 480, border: "1px solid rgba(255,68,68,0.2)", borderRadius: 10, backgroundColor: "rgba(255,68,68,0.06)", padding: 20 }}>
        <div style={{ fontSize: 13, color: "var(--cw-red)", fontWeight: 500, marginBottom: 8 }}>
          Token data failed to load
        </div>
        <div style={{ fontSize: 12, color: "var(--cw-muted)", lineHeight: 1.5, marginBottom: 16 }}>
          {error.message || "BirdEye or the market data provider returned an error."}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={reset}
            style={{ border: "none", borderRadius: 8, padding: "8px 12px", backgroundColor: "var(--cw-accent)", color: "#080404", cursor: "pointer", fontSize: 12, fontWeight: 500 }}
          >
            Retry
          </button>
          <Link href="/" style={{ borderRadius: 8, padding: "8px 12px", backgroundColor: "rgba(255,255,255,0.06)", color: "#fff", textDecoration: "none", fontSize: 12 }}>
            Back to tokens
          </Link>
        </div>
      </div>
    </div>
  );
}
