import { Check, Loader2, TriangleAlert, X } from "lucide-react";

import { BAND_LABEL } from "@/lib/trading/calibration";
import { SHORT_TF } from "@/lib/trading/instruments";
import { dhakaHM } from "@/lib/trading/time";
import { cn } from "@/lib/utils";
import type { Signal, SignalStrength } from "@/lib/trading/types";

const REGIME_LABEL: Record<string, string> = {
  STRONG_TREND: "Strong Trend",
  WEAK_TREND: "Weak Trend",
  RANGING: "Ranging",
  VOLATILE: "Volatile",
  UNKNOWN: "Unknown",
};

export function ProbabilityMeter({ value, band }: { value: number; band: Signal["band"] }) {
  const segments = 20;
  const filled = Math.round((value / 100) * segments);
  const tone =
    band === "VERY_HIGH" || band === "HIGH"
      ? "bg-bull"
      : band === "GOOD"
        ? "bg-primary"
        : band === "MODERATE"
          ? "bg-warn"
          : "bg-muted-foreground";
  return (
    <div>
      <div className="flex items-end justify-between">
        <span className="label-xs">Estimated win probability</span>
        <span className="tabular text-sm text-muted-foreground">{BAND_LABEL[band]}</span>
      </div>
      <div className="tabular mt-1 text-3xl font-semibold">{value}%</div>
      <div className="mt-2 flex gap-[3px]">
        {Array.from({ length: segments }).map((_, i) => (
          <span
            key={i}
            className={cn("h-2.5 flex-1 rounded-[2px]", i < filled ? tone : "bg-elevated")}
          />
        ))}
      </div>
    </div>
  );
}

export function SignalStrengthBadge({ strength }: { strength: SignalStrength }) {
  const map: Record<SignalStrength, { label: string; cls: string }> = {
    STRONG: { label: "Strong", cls: "text-bull border-bull/40 bg-bull/10" },
    MODERATE: { label: "Moderate", cls: "text-primary border-primary/40 bg-primary/10" },
    WEAK: { label: "Weak", cls: "text-warn border-warn/40 bg-warn/10" },
    NONE: { label: "None", cls: "text-muted-foreground border-border bg-elevated" },
  };
  const s = map[strength];
  return (
    <span className={cn("rounded border px-2 py-0.5 text-xs font-semibold", s.cls)}>{s.label}</span>
  );
}

export function SignalCard({
  signal,
  error,
  generating,
  onGenerate,
  disabled,
}: {
  signal: Signal | null;
  error: string | null;
  generating: boolean;
  onGenerate: () => void;
  disabled?: boolean;
}) {
  const dirTone =
    signal?.direction === "BUY"
      ? "text-bull"
      : signal?.direction === "SELL"
        ? "text-bear"
        : "text-muted-foreground";

  return (
    <div className="panel flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <span className="label-xs">Next candle signal</span>
        {signal && (
          <span className="tabular text-xs text-muted-foreground">
            {SHORT_TF[signal.timeframe]} · {dhakaHM(signal.targetCandleTime)} BST
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={disabled || generating}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary text-sm font-bold tracking-wide text-primary-foreground uppercase transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {generating && <Loader2 className="size-4 animate-spin" />}
        {generating ? "Analyzing" : "Generate Signal"}
      </button>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-warn/40 bg-warn/10 p-3 text-xs text-warn">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!signal && !error && (
        <p className="text-sm text-muted-foreground">
          No signal yet. Generate one now, or wait for the current candle to close — analysis always
          runs on finalized candles only.
        </p>
      )}

      {signal && (
        <>
          <div className="flex items-center justify-between rounded-md border border-border bg-elevated px-4 py-3">
            <div>
              <div className={cn("text-4xl font-bold tracking-tight", dirTone)}>
                {signal.direction}
              </div>
              <div className="label-xs mt-1">Entry: next candle</div>
            </div>
            <SignalStrengthBadge strength={signal.strength} />
          </div>

          <ProbabilityMeter value={signal.probability} band={signal.band} />

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Row label="Trend" value={signal.trend} />
            <Row label="Market regime" value={REGIME_LABEL[signal.regime] ?? signal.regime} />
            <Row label="Confluence score" value={String(signal.score)} />
            <Row label="Analyzed candle" value={`${dhakaHM(signal.analyzedCandleTime)} BST`} />
          </dl>

          <div>
            <span className="label-xs">Reasoning</span>
            <ul className="mt-1.5 space-y-1">
              {signal.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                  {r.ok ? (
                    <Check className="mt-0.5 size-3.5 shrink-0 text-bull" />
                  ) : (
                    <X className="mt-0.5 size-3.5 shrink-0 text-bear" />
                  )}
                  {r.text}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] leading-4 text-muted-foreground">
            {signal.calibrated
              ? "Probability calibrated on historical backtest results."
              : "Probability is an uncalibrated model estimate — historical calibration is not yet fitted."}
          </p>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-xs">{label}</dt>
      <dd className="tabular text-sm">{value}</dd>
    </div>
  );
}
