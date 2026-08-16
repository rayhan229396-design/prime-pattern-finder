import { useEffect, useRef } from "react";

import type { Candle } from "@/lib/trading/types";

const DHAKA_OFFSET_SECONDS = 6 * 3600;

/**
 * Candlestick chart (lightweight-charts). Loaded after mount so the charting
 * library never runs during SSR. Time axis is shifted to Asia/Dhaka.
 */
export function CandleChart({
  candles,
  digits,
  height = 340,
}: {
  candles: Candle[];
  digits: number;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const seriesRef = useRef<{ setData: (d: unknown[]) => void } | null>(null);
  const chartRef = useRef<{ remove: () => void; timeScale: () => { fitContent: () => void } } | null>(
    null,
  );
  const dataRef = useRef<Candle[]>(candles);
  dataRef.current = candles;

  useEffect(() => {
    let disposed = false;
    const el = containerRef.current;
    if (!el) return;

    void (async () => {
      const { createChart, CandlestickSeries, ColorType } = await import("lightweight-charts");
      if (disposed || !containerRef.current) return;
      // lightweight-charts cannot parse oklch(), so chart colors are hex
      // mirrors of the design tokens.
      const token = (_name: string, fallback: string) => fallback;

      const chart = createChart(containerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: token("--muted-foreground", "#94a0b0"),
          fontFamily: "JetBrains Mono, monospace",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: token("--grid", "#242b37") },
          horzLines: { color: token("--grid", "#242b37") },
        },
        rightPriceScale: { borderColor: token("--border", "#2c3441") },
        timeScale: {
          borderColor: token("--border", "#2c3441"),
          timeVisible: true,
          secondsVisible: false,
        },
        crosshair: { mode: 0 },
        // Explicit locale: relying on the environment default can throw on
        // hosts with a non-standard LANG and blank the axis labels.
        localization: { locale: "en-GB" },
        height,
        autoSize: true,
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: token("--bull", "#3ddc97"),
        downColor: token("--bear", "#f2555a"),
        borderUpColor: token("--bull", "#3ddc97"),
        borderDownColor: token("--bear", "#f2555a"),
        wickUpColor: token("--bull", "#3ddc97"),
        wickDownColor: token("--bear", "#f2555a"),
        priceFormat: { type: "price", precision: digits, minMove: 1 / 10 ** digits },
      });

      chartRef.current = chart as unknown as typeof chartRef.current;
      seriesRef.current = series as unknown as typeof seriesRef.current;
      series.setData(toSeries(dataRef.current) as never);
      chart.timeScale().fitContent();
    })();

    return () => {
      disposed = true;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [digits, height]);

  useEffect(() => {
    seriesRef.current?.setData(toSeries(candles));
  }, [candles]);

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="absolute inset-0" />
      {candles.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          No candle data available
        </div>
      )}
    </div>
  );
}

function toSeries(candles: Candle[]) {
  return candles.slice(-180).map((c) => ({
    time: Math.floor(c.time / 1000) + DHAKA_OFFSET_SECONDS,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
  }));
}
