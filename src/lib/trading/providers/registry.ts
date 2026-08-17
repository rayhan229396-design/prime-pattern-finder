import { getMarketSeries } from "../market-data.functions";
import { placeholderProvider } from "./placeholder-provider";
import { unavailableStatus } from "./types";
import type { BrokerAdapter, MarketDataProvider, SeriesRequest, SeriesResponse } from "./types";

/**
 * Unlimited Public Engine for Real Market Data
 */
export const twelveDataProvider: MarketDataProvider = {
  id: "binance-unlimited",
  name: "Binance Engine (Real market)",
  market: "REAL",
  implemented: true,
  streamsRealtime: false,
  supports: () => true,
  async fetchSeries(req: SeriesRequest): Promise<SeriesResponse> {
    try {
      const res = await getMarketSeries({
        data: { symbol: req.symbol, timeframe: req.timeframe, limit: req.limit },
      });
      if (!res.ok) return { ok: false, status: res.status, error: res.error ?? "Unavailable" };
      return { ok: true, candles: res.candles, status: res.status };
    } catch (err) {
      const message = (err as Error).message;
      return {
        ok: false,
        status: unavailableStatus("Binance Engine (Real market)", message),
        error: message,
      };
    }
  },
};

export const REAL_PROVIDERS: MarketDataProvider[] = [twelveDataProvider, placeholderProvider];

export const OTC_BROKERS: BrokerAdapter[] = [];

export function activeRealProvider(): MarketDataProvider {
  return REAL_PROVIDERS.find((p) => p.implemented) ?? placeholderProvider;
}

export function hasVerifiedRealData(): boolean {
  return REAL_PROVIDERS.some((p) => p.implemented);
}

export function hasVerifiedOtcData(): boolean {
  return OTC_BROKERS.some((b) => b.implemented);
}
