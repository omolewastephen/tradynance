"use client";

import { useEffect, useRef, useState } from "react";
// Types only (erased at build) — the heavy runtime (`lightweight-charts`) is loaded on demand
// via dynamic import() inside the effect, so it ships as a separate async chunk rather than in
// this route's initial JS.
import type { IChartApi, ISeriesApi, CandlestickData } from "lightweight-charts";

import { cn } from "@/lib/utils";

const INTERVALS = ["15m", "1h", "4h", "1d", "1w"] as const;
type Interval = (typeof INTERVALS)[number];

export function PriceChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [ready, setReady] = useState(false);
  const [interval, setInterval] = useState<Interval>("1h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [candles, setCandles] = useState<CandlestickData[] | null>(null);

  // create chart once (dynamic import → separate chunk)
  useEffect(() => {
    if (!containerRef.current) return;
    let disposed = false;
    let chart: IChartApi | null = null;
    (async () => {
      try {
        const { createChart, CandlestickSeries } = await import("lightweight-charts");
        if (disposed || !containerRef.current) return;
        chart = createChart(containerRef.current, {
          layout: { background: { color: "transparent" }, textColor: "#8a93a6", fontFamily: "var(--font-mono)" },
          grid: {
            vertLines: { color: "rgba(255,255,255,0.04)" },
            horzLines: { color: "rgba(255,255,255,0.04)" },
          },
          rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
          timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true },
          autoSize: true,
          crosshair: { mode: 0 },
        });
        const series = chart.addSeries(CandlestickSeries, {
          upColor: "#18c964",
          downColor: "#ef4444",
          borderVisible: false,
          wickUpColor: "#18c964",
          wickDownColor: "#ef4444",
        });
        chartRef.current = chart;
        seriesRef.current = series;
        setReady(true);
      } catch {
        // Without this the chunk failing (or a chart API change) left `ready` false forever, so the
        // component sat on "Loading chart…" with no error — indistinguishable from a hung page.
        if (!disposed) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      disposed = true;
      chart?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Fetch candles for the current symbol/interval. Deliberately NOT gated on `ready`: the request
  // starts immediately, in parallel with the chart library's dynamic import, instead of waiting for
  // it — that serialization cost several seconds and made the chart look hung. The result is held
  // until the series exists, then drawn by the effect below.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setCandles(null);
    fetch(`/api/markets/${symbol}/klines?interval=${interval}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { candles: CandlestickData[] }) => {
        if (!cancelled) setCandles(data.candles);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

  // Draw once both the series and the candles are available, whichever finishes last.
  useEffect(() => {
    if (!ready || !candles || !seriesRef.current) return;
    seriesRef.current.setData(candles);
    chartRef.current?.timeScale().fitContent();
    setLoading(false);
  }, [ready, candles]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        {INTERVALS.map((iv) => (
          <button
            key={iv}
            onClick={() => setInterval(iv)}
            className={cn(
              "rounded-xs px-2.5 py-1 text-xs font-medium transition-colors",
              interval === iv
                ? "bg-surface-raised text-foreground"
                : "text-foreground-muted hover:text-foreground",
            )}
          >
            {iv}
          </button>
        ))}
      </div>
      <div className="relative h-[380px] w-full">
        <div ref={containerRef} className="h-full w-full" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-foreground-muted">
            Loading chart…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-danger">
            Couldn&apos;t load chart data.
          </div>
        )}
      </div>
    </div>
  );
}
