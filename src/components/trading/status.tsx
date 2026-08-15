import { Clock, Radio, ShieldAlert, Wifi, WifiOff } from "lucide-react";

import { dhakaClock, dhakaDate, freshnessLabel } from "@/lib/trading/time";
import { cn } from "@/lib/utils";
import type { DataSourceStatus as Status } from "@/lib/trading/types";

export function BangladeshClock({ now }: { now: number }) {
  return (
    <div className="text-right">
      <div className="label-xs flex items-center justify-end gap-1">
        <Clock className="size-3" /> Bangladesh time
      </div>
      <div className="tabular text-lg leading-6 font-semibold">{dhakaClock(now)}</div>
      <div className="tabular text-[11px] text-muted-foreground">{dhakaDate(now)} · BST</div>
    </div>
  );
}

export function DataSourceStatusCard({ status, now }: { status: Status; now: number }) {
  const tone =
    status.quality === "live"
      ? "text-bull"
      : status.quality === "delayed"
        ? "text-warn"
        : status.quality === "placeholder"
          ? "text-primary"
          : "text-bear";

  const qualityLabel: Record<Status["quality"], string> = {
    live: "Live",
    delayed: "Data delayed",
    stale: "Stale data",
    unavailable: "Data unavailable",
    placeholder: "Sample data (not market data)",
  };

  return (
    <div className="panel p-4">
      <span className="label-xs">Data source</span>
      <div className="mt-1 flex items-center gap-2">
        {status.connected ? (
          <Wifi className={cn("size-4", tone)} />
        ) : (
          <WifiOff className={cn("size-4", tone)} />
        )}
        <span className="text-sm font-semibold">{status.name}</span>
      </div>
      <dl className="mt-3 space-y-1.5 text-xs">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Status</dt>
          <dd className={cn("font-medium", tone)}>{qualityLabel[status.quality]}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Transport</dt>
          <dd className="tabular uppercase">{status.transport}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Freshness</dt>
          <dd className="tabular">{freshnessLabel(status.lastUpdate, now)}</dd>
        </div>
      </dl>
      {status.message && (
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{status.message}</p>
      )}
    </div>
  );
}

export function MarketStatusCard({
  open,
  market,
  unavailableReason,
}: {
  open: boolean;
  market: string;
  unavailableReason: string | null;
}) {
  return (
    <div className="panel p-4">
      <span className="label-xs">Market status</span>
      <div className="mt-1 flex items-center gap-2">
        <span
          className={cn(
            "size-2 rounded-full",
            unavailableReason ? "bg-bear" : open ? "bg-bull pulse-dot" : "bg-warn",
          )}
        />
        <span className="text-sm font-semibold">
          {unavailableReason ? "Unavailable" : open ? "Open" : "Closed (weekend session)"}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Mode</span>
        <span className="font-medium">{market === "REAL" ? "Real market" : "OTC market"}</span>
      </div>
      {unavailableReason && (
        <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-4 text-bear">
          <Radio className="mt-0.5 size-3 shrink-0" />
          {unavailableReason}
        </p>
      )}
      {!unavailableReason && !open && (
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
          Forex and metals trade Sunday 21:00 UTC to Friday 21:00 UTC.
        </p>
      )}
    </div>
  );
}

export function PlaceholderBanner() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-primary/35 bg-primary/10 px-3 py-2 text-xs text-primary">
      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
      <span>
        <strong className="font-semibold">Phase 1 — interface preview.</strong> Prices, candles and
        signals shown here are generated from a synthetic sample series for UI development. No market
        data provider is connected yet, so nothing on screen is real or live market data.
      </span>
    </div>
  );
}

export function Disclaimer() {
  return (
    <p className="mx-auto max-w-3xl px-4 pb-8 text-center text-[11px] leading-4 text-muted-foreground/80">
      Signals are probabilistic estimates, not guaranteed outcomes. Binary options involve
      significant risk. Use appropriate risk management and verify market data before trading.
    </p>
  );
}
