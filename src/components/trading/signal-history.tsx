import { SHORT_TF } from "@/lib/trading/instruments";
import { dhakaHM } from "@/lib/trading/time";
import { cn } from "@/lib/utils";
import type { Signal } from "@/lib/trading/types";

export function SignalHistory({ signals }: { signals: Signal[] }) {
  return (
    <section className="panel p-4">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase">Recent signals</h2>
        <span className="label-xs">Results settle after the target candle closes</span>
      </header>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead>
            <tr className="label-xs border-b border-border">
              <th className="py-2 pr-3 font-medium">Time</th>
              <th className="py-2 pr-3 font-medium">Asset</th>
              <th className="py-2 pr-3 font-medium">Market</th>
              <th className="py-2 pr-3 font-medium">TF</th>
              <th className="py-2 pr-3 font-medium">Signal</th>
              <th className="py-2 pr-3 font-medium">Prob.</th>
              <th className="py-2 pr-3 font-medium">Entry</th>
              <th className="py-2 pr-3 font-medium">Result</th>
              <th className="py-2 font-medium">Data source</th>
            </tr>
          </thead>
          <tbody>
            {signals.length === 0 && (
              <tr>
                <td colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                  No signals recorded yet.
                </td>
              </tr>
            )}
            {signals.map((s) => (
              <tr key={s.id} className="border-b border-border/60 last:border-0">
                <td className="tabular py-2 pr-3">{dhakaHM(s.analyzedCandleTime)}</td>
                <td className="tabular py-2 pr-3 font-medium">{s.symbol}</td>
                <td className="py-2 pr-3 text-muted-foreground">{s.market}</td>
                <td className="tabular py-2 pr-3">{SHORT_TF[s.timeframe]}</td>
                <td
                  className={cn(
                    "py-2 pr-3 font-bold",
                    s.direction === "BUY" && "text-bull",
                    s.direction === "SELL" && "text-bear",
                    s.direction === "WAIT" && "text-muted-foreground",
                  )}
                >
                  {s.direction}
                </td>
                <td className="tabular py-2 pr-3">{s.probability}%</td>
                <td className="py-2 pr-3 text-muted-foreground">Next candle</td>
                <td className="py-2 pr-3">
                  <ResultBadge result={s.result} />
                </td>
                <td className="py-2 text-muted-foreground">{s.sourceName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ResultBadge({ result }: { result: Signal["result"] }) {
  const map = {
    WIN: "text-bull border-bull/40 bg-bull/10",
    LOSS: "text-bear border-bear/40 bg-bear/10",
    PENDING: "text-muted-foreground border-border bg-elevated",
  } as const;
  const key = result ?? "PENDING";
  return (
    <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-semibold", map[key])}>
      {key}
    </span>
  );
}
