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

export interface BrokerOption {
  id: string;
  name: string;
  /** True only when an authorized feed for this broker is connected. */
  available: boolean;
}

export function BrokerSelector({
  options,
  value,
  onChange,
}: {
  options: BrokerOption[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  const anyAvailable = options.some((o) => o.available);
  return (
    <Select {...(value ? { value } : {})} onValueChange={onChange}>
      <SelectTrigger
        className={cn(
          "w-[210px] bg-elevated text-sm",
          !anyAvailable && "border-dashed text-muted-foreground",
        )}
      >
        <SelectValue placeholder="OTC broker" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>OTC broker feed</SelectLabel>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id} disabled={!o.available}>
              {o.name}
              {o.available ? "" : " — no authorized feed"}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
