import { placeholderProvider } from "./placeholder-provider";
import { unavailableStatus } from "./types";
import type { BrokerAdapter, MarketDataProvider, SeriesRequest, SeriesResponse, Candle } from "./types";

// Client-Side Symbol Mapper
const BINANCE_SYMBOL_MAP: Record<string, string> = {
  'EUR/USD': 'EURUSDT',
  'GBP/USD': 'GBPUSDT',
  'BTC/USD': 'BTCUSDT',
  'ETH/USD': 'ETHUSDT',
  'EURUSD': 'EURUSDT',
  'GBPUSD': 'GBPUSDT',
  'BTCUSD': 'BTCUSDT',
  'ETHUSD': 'ETHUSDT'
};

const BINANCE_INTERVAL_MAP: Record<string, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '1min': '1m',
  '5min': '5m',
  '15min': '15m',
  '30min': '30m'
};

/**
 * Direct Browser-to-Binance Engine (Bypasses Twelve Data & Vercel Server Functions)
 */
export const twelveDataProvider: MarketDataProvider = {
  id: "twelve-data",
  name: "Binance Public Feed (Unlimited)",
  market: "REAL",
  implemented: true,
  streamsRealtime: false,
  supports: () => true,
  async fetchSeries(req: SeriesRequest): Promise<SeriesResponse> {
    try {
      const symbol = req.symbol || 'EUR/USD';
      const timeframe = req.timeframe || '5m';
      const limit = req.limit || 30;

      const cleanSymbol = symbol.replace('/', '').toUpperCase();
      const binanceSymbol = BINANCE_SYMBOL_MAP[symbol] || BINANCE_SYMBOL_MAP[cleanSymbol] || `${cleanSymbol}USDT`;
      const binanceInterval = BINANCE_INTERVAL_MAP[timeframe] || '5m';

      // Direct client-side fetch (bypass server functions)
      const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        return {
          ok: false,
          status: unavailableStatus("Binance Public Feed", `Status ${response.status}`),
          error: `Binance HTTP Error ${response.status}`
        };
      }

      const rawData = await response.json();

      const candles: Candle[] = rawData.map((item: any) => ({
        timestamp: item[0],
        open: parseFloat(item[1]),
        high: parseFloat(item[2]),
        low: parseFloat(item[3]),
        close: parseFloat(item[4]),
        volume: parseFloat(item[5])
      }));

      return {
        ok: true,
        candles,
        status: { provider: "Binance Public Feed", message: "Live Market Active" }
      };
    } catch (err: any) {
      return {
        ok: false,
        status: unavailableStatus("Binance Public Feed", err.message),
        error: err.message || "Binance connection error"
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
