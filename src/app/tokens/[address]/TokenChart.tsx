"use client";

import { useEffect, useRef, useState } from "react";
import type { UTCTimestamp, CandlestickData } from "lightweight-charts";
import type { OHLCVBar } from "@/lib/birdeye";

type Interval = "15m" | "1H" | "4H" | "1D";

const INTERVALS: { label: string; value: Interval }[] = [
  { label: "15m", value: "15m" },
  { label: "1H", value: "1H" },
  { label: "4H", value: "4H" },
  { label: "1D", value: "1D" },
];

function toChartBars(bars: OHLCVBar[]): CandlestickData<UTCTimestamp>[] {
  // lightweight-charts needs strictly ascending unique timestamps
  // BirdEye uses o/h/l/c (not open/high/low/close)
  const sorted = [...bars].sort((a, b) => a.unixTime - b.unixTime);
  const seen = new Set<number>();
  return sorted
    .filter((b) => {
      if (seen.has(b.unixTime)) return false;
      seen.add(b.unixTime);
      return b.o > 0 && b.h > 0 && b.l > 0 && b.c > 0;
    })
    .map((b) => ({
      time: b.unixTime as UTCTimestamp,
      open: b.o,
      high: b.h,
      low: b.l,
      close: b.c,
    }));
}

export default function TokenChart({
  address,
  initialBars,
}: {
  address: string;
  initialBars: OHLCVBar[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  const [interval, setActiveInterval] = useState<Interval>("15m");
  const [bars, setBars] = useState<OHLCVBar[]>(initialBars);
  const [fetching, setFetching] = useState(false);
  // Always-current ref so async callbacks can read latest bars
  const barsRef = useRef<OHLCVBar[]>(initialBars);

  // Keep ref in sync with state
  useEffect(() => {
    barsRef.current = bars;
  }, [bars]);

  // Initialize chart once — reads barsRef so it always has latest data
  useEffect(() => {
    if (!containerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let cleanup: (() => void) | undefined;

    import("lightweight-charts").then(({ createChart, CandlestickSeries }) => {
      if (!containerRef.current) return;

      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 380,
        layout: {
          background: { color: "#080404" },
          textColor: "rgba(255,255,255,0.5)",
        },
        grid: {
          vertLines: { color: "rgba(255,255,255,0.04)" },
          horzLines: { color: "rgba(255,255,255,0.04)" },
        },
        crosshair: {
          vertLine: { color: "rgba(255,255,255,0.2)" },
          horzLine: { color: "rgba(255,255,255,0.2)" },
        },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
        timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#00d97e",
        downColor: "#ff4444",
        borderVisible: false,
        wickUpColor: "#00d97e",
        wickDownColor: "#ff4444",
      });

      chartRef.current = chart;
      seriesRef.current = series;

      // Read from ref — catches bars that arrived before chart was ready
      if (barsRef.current.length > 0) {
        series.setData(toChartBars(barsRef.current));
        chart.timeScale().fitContent();
      }

      const observer = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth });
        }
      });
      observer.observe(containerRef.current);

      cleanup = () => {
        observer.disconnect();
        chart.remove();
      };
    });

    return () => cleanup?.();
  }, []);

  // Push new bars into chart whenever state updates
  useEffect(() => {
    if (!seriesRef.current || bars.length === 0) return;
    seriesRef.current.setData(toChartBars(bars));
    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  // On mount: if server gave us no bars (rate limited), fetch client-side with backoff
  useEffect(() => {
    if (initialBars.length > 0) return;
    setFetching(true);
    let attempts = 0;
    const MAX = 5;

    const attempt = () => {
      if (attempts >= MAX) { setFetching(false); return; }
      attempts++;
      fetch(`/api/tokens/${address}/ohlcv?type=15m&limit=200`)
        .then((r) => r.json())
        .then((data: unknown) => {
          if (Array.isArray(data) && data.length > 0) {
            setBars(data as OHLCVBar[]);
            setFetching(false);
          } else {
            setTimeout(attempt, 1200 * attempts);
          }
        })
        .catch(() => setTimeout(attempt, 2000));
    };

    const t = setTimeout(attempt, 500);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch on interval change
  useEffect(() => {
    if (seriesRef.current === null) return; // skip before chart is ready
    setFetching(true);
    fetch(`/api/tokens/${address}/ohlcv?type=${interval}&limit=200`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setBars(data); setFetching(false); })
      .catch(() => setFetching(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval]);

  return (
    <div style={{ borderRight: "1px solid var(--cw-border)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          padding: "10px 16px",
          borderBottom: "1px solid var(--cw-border)",
        }}
      >
        {INTERVALS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setActiveInterval(value)}
            style={{
              fontSize: 12,
              padding: "4px 10px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              backgroundColor: interval === value ? "rgba(255,255,255,0.1)" : "transparent",
              color: interval === value ? "#fff" : "rgba(255,255,255,0.4)",
            }}
          >
            {label}
          </button>
        ))}
        {fetching && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: 8 }}>
            Loading...
          </span>
        )}
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", marginLeft: "auto" }}>
          {bars.length > 0 ? `${bars.length} bars` : "no data"}
        </span>
      </div>

      <div ref={containerRef} style={{ width: "100%", height: 380 }} />
    </div>
  );
}
