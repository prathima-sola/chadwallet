"use client";

import { useCallback, useEffect, useState } from "react";

function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
}

export default function LivePrice({
  address,
  initialPrice,
  initialChange24h,
}: {
  address: string;
  initialPrice: number;
  initialChange24h: number;
}) {
  const [price, setPrice] = useState(initialPrice);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(`/api/tokens/${address}/price`);
      const data = await res.json();
      if (data.price && data.price !== price) {
        setFlash(data.price > price ? "up" : "down");
        setPrice(data.price);
        setTimeout(() => setFlash(null), 600);
      }
    } catch {
      // keep existing
    }
  }, [address, price]);

  useEffect(() => {
    const interval = setInterval(fetchPrice, 20000); // every 20s
    return () => clearInterval(interval);
  }, [fetchPrice]);

  const isPositive = initialChange24h >= 0;

  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span
        style={{
          fontSize: 22,
          fontWeight: 500,
          fontFamily: "var(--font-mono)",
          color:
            flash === "up"
              ? "var(--cw-green)"
              : flash === "down"
              ? "var(--cw-red)"
              : "#fff",
          transition: "color 0.3s ease",
        }}
      >
        {formatPrice(price)}
      </span>
      <span
        style={{
          fontSize: 14,
          fontFamily: "var(--font-mono)",
          color: isPositive ? "var(--cw-green)" : "var(--cw-red)",
        }}
      >
        {isPositive ? "+" : ""}
        {initialChange24h.toFixed(2)}%
      </span>
    </div>
  );
}
