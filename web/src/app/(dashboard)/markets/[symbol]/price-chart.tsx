"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
} from "lightweight-charts";

import { cn } from "@/lib/utils";

const INTERVALS = ["15m", "1h", "4h", "1d", "1w"] as const;
type Interval = (typeof INTERVALS)[number];

export function PriceChart({ symbol }: { symbol: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [interval, setInterval] = useState<Interval>("1h");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // create chart once
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: "transparent" },
        textColor: "#8a93a6",
        fontFamily: "var(--font-mono)",
      },
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
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // load candles when symbol/interval changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/markets/${symbol}/klines?interval=${interval}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { candles: CandlestickData[] }) => {
        if (cancelled || !seriesRef.current) return;
        seriesRef.current.setData(data.candles);
        chartRef.current?.timeScale().fitContent();
        setLoading(false);
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
