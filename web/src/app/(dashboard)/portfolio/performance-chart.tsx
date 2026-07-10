"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

import { cn } from "@/lib/utils";

const RANGES = ["24h", "7d", "30d"] as const;
type Range = (typeof RANGES)[number];

export function PerformanceChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const [range, setRange] = useState<Range>("7d");
  const [state, setState] = useState<"loading" | "ok" | "empty" | "error">("loading");

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#8a93a6", fontFamily: "var(--font-mono)" },
      grid: { vertLines: { visible: false }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true },
      autoSize: true,
      crosshair: { mode: 0 },
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: "#18c964",
      topColor: "rgba(24,201,100,0.28)",
      bottomColor: "rgba(24,201,100,0.02)",
      lineWidth: 2,
    });
    chartRef.current = chart;
    seriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    fetch(`/api/portfolio/performance?range=${range}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: { series: { time: number; value: number }[] }) => {
        if (cancelled || !seriesRef.current) return;
        if (!data.series.length) {
          setState("empty");
          return;
        }
        seriesRef.current.setData(
          data.series.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })),
        );
        chartRef.current?.timeScale().fitContent();
        setState("ok");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground-muted">
          Performance{" "}
          <span className="text-xs">(current holdings at historical prices)</span>
        </span>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-xs px-2.5 py-1 text-xs font-medium transition-colors",
                range === r ? "bg-surface-raised text-foreground" : "text-foreground-muted hover:text-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-[300px] w-full">
        <div ref={containerRef} className="h-full w-full" />
        {state !== "ok" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-foreground-muted">
            {state === "loading" && "Loading…"}
            {state === "empty" && "Fund your account to see performance."}
            {state === "error" && "Couldn't load performance."}
          </div>
        )}
      </div>
    </div>
  );
}
