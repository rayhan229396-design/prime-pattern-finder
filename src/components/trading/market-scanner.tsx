import { useMemo, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { SHORT_TF } from "@/lib/trading/instruments";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SignalStrengthBadge } from "./signal-card";
import type { Signal } from "@/lib/trading/types";

type SortKey = "probability" | "strength" | "asset" | "timeframe";

const STRENGTH_ORDER: Record<string, number> = { STRONG: 3, MODERATE: 2, WEAK: 1, NONE: 0 };

export function OpportunityCard({
  signal,
  onSelect,
}: {
  signal: Signal;
  onSelect: (s: Signal) => void;
}) {
  const buy = signal.direction === "BUY";
  return (
    <button
      type="button"
      onClick={() => onSelect(signal)}
      className="flex w-full items-center gap-3 rounded-md border border-border bg-elevated px-3 py-2.5 text-left transition-colors hover:border-primary/50"
    >
      <span className="tabular w-[86px] shrink-0 text-sm font-semibold">{signal.symbol}</span>
      <span
        className={cn(
          "tabular w-12 shrink-0 text-sm font-bold",
          buy ? "text-bull" : "text-bear",
        )}
      >
        {signal.direction}
      </span>
      <span className="tabular w-12 shrink-0 text-sm">{signal.probability}%</span>
      <span className="tabular w-9 shrink-0 text-xs text-muted-foreground">
        {SHORT_TF[signal.timeframe]}
      </span>
      <span className="hidden w-20 shrink-0 text-xs text-muted-foreground sm:inline">
        {signal.trend}
      </span>
      <span className="hidden w-14 shrink-0 text-xs text-muted-foreground md:inline">
        {signal.market}
      </span>
      <span className="ml-auto hidden md:inline">
        <SignalStrengthBadge strength={signal.strength} />
      </span>
    </button>
  );
}

export function MarketScanner({
  opportunities,
  scanning,
  threshold,
  onThreshold,
  onRescan,
  onSelect,
  unavailable,
}: {
  opportunities: Signal[];
  scanning: boolean;
  threshold: number;
  onThreshold: (n: number) => void;
  onRescan: () => void;
  onSelect: (s: Signal) => void;
  unavailable: string | null;
}) {
  const [sort, setSort] = useState<SortKey>("probability");

  const sorted = useMemo(() => {
    const list = [...opportunities];
    switch (sort) {
      case "asset":
        return list.sort((a, b) => a.symbol.localeCompare(b.symbol));
      case "timeframe":
        return list.sort((a, b) => a.timeframe.localeCompare(b.timeframe));
      case "strength":
        return list.sort(
          (a, b) =>
            (STRENGTH_ORDER[b.strength] ?? 0) - (STRENGTH_ORDER[a.strength] ?? 0) ||
            b.probability - a.probability,
        );
      default:
        return list.sort((a, b) => b.probability - a.probability);
    }
  }, [opportunities, sort]);

  return (
    <section className="panel p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-wide uppercase">
          High probability opportunities
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(threshold)} onValueChange={(v) => onThreshold(Number(v))}>
            <SelectTrigger className="h-8 w-[130px] bg-elevated text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[60, 65, 70, 75, 80].map((t) => (
                <SelectItem key={t} value={String(t)}>
                  Min {t}%
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-8 w-[150px] bg-elevated text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="probability">Sort: Probability</SelectItem>
              <SelectItem value="strength">Sort: Strength</SelectItem>
              <SelectItem value="asset">Sort: Asset</SelectItem>
              <SelectItem value="timeframe">Sort: Timeframe</SelectItem>
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={onRescan}
            disabled={scanning || Boolean(unavailable)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-elevated px-3 text-xs font-medium disabled:opacity-40"
          >
            {scanning ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Scan
          </button>
        </div>
      </header>

      <div className="mt-3 space-y-1.5">
        {unavailable ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{unavailable}</p>
        ) : sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {scanning
              ? "Scanning supported instruments…"
              : `No instrument currently meets the ${threshold}% threshold.`}
          </p>
        ) : (
          sorted.map((s) => (
            <OpportunityCard key={`${s.symbol}-${s.timeframe}`} signal={s} onSelect={onSelect} />
          ))
        )}
      </div>
    </section>
  );
}
