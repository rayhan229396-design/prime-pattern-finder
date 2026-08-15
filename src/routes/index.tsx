import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";

import { AssetDropdown, BrokerSelector, MarketSelector, TimeframeSelector } from "@/components/trading/controls";
import { CandleChart } from "@/components/trading/candle-chart";
import { MarketScanner } from "@/components/trading/market-scanner";
import { CandleCountdown, PriceCard } from "@/components/trading/price-card";
import { SignalCard } from "@/components/trading/signal-card";
import { SignalHistory } from "@/components/trading/signal-history";
import {
  BangladeshClock,
  DataSourceStatusCard,
  Disclaimer,
  MarketStatusCard,
  PlaceholderBanner,
} from "@/components/trading/status";
import { useTerminal } from "@/hooks/use-terminal";
import { getAsset } from "@/lib/trading/instruments";

const TITLE = "Binary Signal Terminal — Next-Candle Signal Analysis";
const DESCRIPTION =
  "Dark trading terminal for binary signal analysis: 1M/3M/5M candles, next-candle signal confluence scoring, estimated win probability and a high-probability market scanner in Bangladesh time.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Terminal,
});

function Terminal() {
  const { state, countdown, candleSeconds, brokers, actions } = useTerminal();
  const asset = getAsset(state.symbol);
  const closedCandles = state.candles.filter((c) => c.closed);
  const current = state.candles[state.candles.length - 1];
  const previous = closedCandles[closedCandles.length - (current?.closed ? 2 : 1)];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary">
              <Activity className="size-4" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-bold tracking-wide uppercase">Binary Signal Terminal</div>
              <div className="label-xs">Signal analysis · decision support</div>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <MarketSelector value={state.market} onChange={actions.setMarket} />
            {state.market === "OTC" && (
              <BrokerSelector
                brokers={brokers}
                value={state.brokerId}
                onChange={actions.setBrokerId}
              />
            )}
            <AssetDropdown value={state.symbol} onChange={actions.setSymbol} />
            <TimeframeSelector value={state.timeframe} onChange={actions.setTimeframe} />
            <BangladeshClock now={state.now} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] space-y-4 px-4 py-4">
        {state.usingPlaceholder && state.dataAvailable && <PlaceholderBanner />}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <section className="panel p-4">
              <PriceCard
                symbol={asset.symbol}
                name={asset.name}
                digits={asset.digits}
                current={state.dataAvailable ? current : undefined}
                previous={state.dataAvailable ? previous : undefined}
              />
              <div className="mt-4 border-t border-border pt-2">
                {state.dataAvailable ? (
                  <CandleChart candles={state.candles} digits={asset.digits} />
                ) : (
                  <div className="flex h-[340px] items-center justify-center text-sm text-muted-foreground">
                    {state.unavailableReason}
                  </div>
                )}
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-3">
              <CandleCountdown
                seconds={countdown}
                total={candleSeconds}
                timeframe={state.timeframe}
                disabled={!state.dataAvailable}
              />
              <MarketStatusCard
                open={state.marketOpen}
                market={state.market}
                unavailableReason={state.unavailableReason}
              />
              <DataSourceStatusCard status={state.status} now={state.now} />
            </div>
          </div>

          <aside className="space-y-4">
            <SignalCard
              signal={state.signal}
              error={state.signalError}
              generating={state.generating}
              onGenerate={actions.generateSignal}
              disabled={!state.dataAvailable}
            />
          </aside>
        </div>

        <MarketScanner
          opportunities={state.opportunities}
          scanning={state.scanning}
          threshold={state.threshold}
          onThreshold={actions.setThreshold}
          onRescan={() => void actions.runScan()}
          onSelect={actions.selectOpportunity}
          unavailable={state.unavailableReason}
        />

        <SignalHistory signals={state.history} />
      </main>

      <Disclaimer />
    </div>
  );
}
