import type { Candle, DataSourceStatus, MarketType, TimeframeId } from "../types";

export interface SeriesRequest {
  symbol: string;
  timeframe: TimeframeId;
  limit: number;
}

export type SeriesResponse =
  | { ok: true; candles: Candle[]; status: DataSourceStatus }
  | { ok: false; status: DataSourceStatus; error: string };

/**
 * Abstraction every data source implements — real-market providers
 * (e.g. Twelve Data) and OTC broker adapters alike. Adapters are responsible
 * for normalizing their payloads into `Candle`.
 */
export interface MarketDataProvider {
  id: string;
  /** Name shown in the UI as the data source. */
  name: string;
  market: MarketType;
  /** Set to false until an integration is actually implemented and verified. */
  implemented: boolean;
  supports(symbol: string, timeframe: TimeframeId): boolean;
  fetchSeries(req: SeriesRequest): Promise<SeriesResponse>;
  /** Optional realtime stream; when absent the app falls back to REST polling. */
  streamsRealtime?: boolean;
}

export interface BrokerAdapter extends MarketDataProvider {
  market: "OTC";
  brokerId: string;
}

export const unavailableStatus = (name: string, message: string): DataSourceStatus => ({
  name,
  connected: false,
  quality: "unavailable",
  lastUpdate: null,
  transport: "none",
  message,
});
