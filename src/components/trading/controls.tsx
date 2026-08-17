import { ChevronDown } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ASSETS, TIMEFRAMES } from "@/lib/trading/instruments";
import { cn } from "@/lib/utils";
import type { BrokerAdapter } from "@/lib/trading/providers/types";
import type { MarketType, TimeframeId } from "@/lib/trading/types";

export function MarketSelector({
  value,
  onChange,
}: {
  value: MarketType;
  onChange: (m: MarketType) => void;
}) {
  const options: { id: MarketType; label: string }[] = [
    { id: "REAL", label: "Real Market" },
    { id: "OTC", label: "OTC Market" },
  ];
  return (
    <div className="inline-flex rounded-md border border-border bg-elevated p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "rounded-[5px] px-3 py-1.5 text-xs font-semibold tracking-wide uppercase transition-colors",
            value === o.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AssetDropdown({
  value,
  onChange,
  symbols,
}: {
  value: string;
  onChange: (s: string) => void;
  /** When provided (e.g. assets discovered from the OTC feed), overrides the registry. */
  symbols?: string[];
}) {
  if (symbols) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[150px] bg-elevated tabular text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[340px]">
          <SelectGroup>
            <SelectLabel>OTC assets</SelectLabel>
            {symbols.map((s) => (
              <SelectItem key={s} value={s} className="tabular">
                {s} OTC
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
  }
  const forex = ASSETS.filter((a) => a.assetClass === "forex");
  const metals = ASSETS.filter((a) => a.assetClass === "metal");
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[150px] bg-elevated tabular text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-[340px]">
        <SelectGroup>
          <SelectLabel>Forex</SelectLabel>
          {forex.map((a) => (
            <SelectItem key={a.symbol} value={a.symbol} className="tabular">
              {a.symbol}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectGroup>
          <SelectLabel>Metals</SelectLabel>
          {metals.map((a) => (
            <SelectItem key={a.symbol} value={a.symbol} className="tabular">
              {a.symbol}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function TimeframeSelector({
  value,
  onChange,
}: {
  value: TimeframeId;
  onChange: (t: TimeframeId) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TimeframeId)}>
      <SelectTrigger className="w-[130px] bg-elevated text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TIMEFRAMES.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function BrokerSelector({
  brokers,
  value,
  onChange,
}: {
  brokers: BrokerAdapter[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  if (brokers.length === 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-md border border-dashed border-border bg-elevated px-3 py-2 text-xs text-muted-foreground">
        <span className="label-xs">OTC Broker</span>
        <span className="flex items-center gap-1">
          No verified broker integrations <ChevronDown className="size-3 opacity-50" />
        </span>
      </div>
    );
  }
  return (
    <Select {...(value ? { value } : {})} onValueChange={onChange}>
      <SelectTrigger className="w-[190px] bg-elevated text-sm">
        <SelectValue placeholder="Select Broker" />
      </SelectTrigger>
      <SelectContent>
        {brokers.map((b) => (
          <SelectItem key={b.brokerId} value={b.brokerId}>
            {b.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
