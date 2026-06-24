"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface SearchToken {
  address: string;
  symbol: string;
  name: string;
  price: number;
  logoURI: string | null;
  v24hUSD: number;
}

export default function TokenSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchToken[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (query.length < 2) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/tokens/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.tokens ?? []);
        setOpen(true);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (value.length < 2) {
      setResults([]);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} style={{ position: "relative", width: 280 }}>
      <div style={{ display: "flex", alignItems: "center", backgroundColor: "rgba(255,255,255,0.04)", border: "1px solid var(--cw-border)", borderRadius: 8, padding: "0 12px", gap: 8 }}>
        <span style={{ fontSize: 13, color: "var(--cw-dim)" }}>⌕</span>
        <input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search tokens..."
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: 13, padding: "8px 0", fontFamily: "inherit" }}
        />
        {loading && <span style={{ fontSize: 11, color: "var(--cw-dim)" }}>...</span>}
      </div>

      {open && results.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, backgroundColor: "#111", border: "1px solid var(--cw-border)", borderRadius: 10, overflow: "hidden", zIndex: 50, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
          {results.map((t) => (
            <Link key={t.address} href={`/tokens/${t.address}`} onClick={() => { setOpen(false); setQuery(""); }}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
              {t.logoURI ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.logoURI} alt={t.symbol} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: "50%", backgroundColor: "rgba(0,217,126,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--cw-accent)" }}>
                  {t.symbol?.[0]}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: "var(--cw-dim)" }}>${t.symbol}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--cw-muted)", fontFamily: "var(--font-mono)" }}>
                ${t.price < 0.01 ? t.price.toFixed(8) : t.price.toFixed(4)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
