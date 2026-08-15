import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { formatCountdown } from "@/lib/trading/candle-engine";
import { cn } from "@/lib/utils";
import type { Candle, TimeframeId } from "@/lib/trading/types";
import { SHORT_TF } from "@/lib/trading/instruments";

export function PriceCard({
  symbol,
  name,
  digits,
  current,
  previous,
}: {
  symbol: string;
  name: string;
  digits: number;
  current: Candle | undefined;
  previous: Candle | undefined;
}) {
  const price = current?.close;
  const change = price != null && previous ? price - previous.close : 0;
  const pct = previous && previous.close !== 0 ? (change / previous.close) * 100 : 0;
  const dir = change > 0 ? "up" : change < 0 ? "down" : "flat";
  const bullish = current ? current.close > current.open : false;

  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="tabular text-2xl font-semibold tracking-tight">{symbol}</h1>
          <span className="rounded border border-border px-1.5 py-0.5 label-xs">{name}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="tabular text-4xl font-semibold">
            {price != null ? price.toFixed(digits) : "—"}
          </span>
          <span
            className={cn(
              "tabular flex items-center gap-1 text-sm font-medium",
              dir === "up" && "text-bull",
              dir === "down" && "text-bear",
              dir === "flat" && "text-muted-foreground",
            )}
          >
            {dir === "up" ? (
              <ArrowUpRight className="size-4" />
            ) : dir === "down" ? (
              <ArrowDownRight className="size-4" />
            ) : (
              <Minus className="size-4" />
            )}
            {price != null ? `${change >= 0 ? "+" : ""}${pct.toFixed(3)}%` : "—"}
          </span>
        </div>
      </div>

      <div className="text-right">
        <div className="label-xs">Current candle</div>
        <div
          className={cn(
            "tabular text-lg font-semibold",
            price == null ? "text-muted-foreground" : bullish ? "text-bull" : "text-bear",
          )}
        >
          {price == null ? "—" : bullish ? "BULLISH" : "BEARISH"}
        </div>
      </div>
    </div>
  );
}

export function CandleCountdown({
  seconds,
  total,
  timeframe,
  disabled,
}: {
  seconds: number;
  total: number;
  timeframe: TimeframeId;
  disabled?: boolean;
}) {
  const progress = total > 0 ? 1 - seconds / total : 0;
  const urgent = seconds <= 15;
  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <span className="label-xs">Current candle · {SHORT_TF[timeframe]}</span>
        <span className="label-xs">Closes in</span>
      </div>
      <div
        className={cn(
          "tabular mt-1 text-3xl font-semibold",
          disabled ? "text-muted-foreground" : urgent ? "text-warn" : "text-foreground",
        )}
      >
        {disabled ? "--:--" : formatCountdown(seconds)}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-elevated">
        <div
          className={cn("h-full rounded-full transition-[width] duration-1000 ease-linear", urgent ? "bg-warn" : "bg-primary")}
          style={{ width: `${disabled ? 0 : Math.min(100, progress * 100)}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
        At close the candle is finalized, analyzed, and a signal is produced for the next candle.
      </p>
    </div>
  );
}
