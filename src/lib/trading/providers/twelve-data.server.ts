import { createServerFn } from "@tanstack/start";
import type { Candle, SeriesRequest, SeriesResponse } from "./types";

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

export const getMarketSeries = createServerFn({ method: "POST" })
  .validator((d: SeriesRequest) => d)
  .handler(async ({ data }): Promise<SeriesResponse> => {
    try {
      const symbol = data.symbol || 'EUR/USD';
      const timeframe = data.timeframe || '5m';
      const limit = data.limit || 30;

      const cleanSymbol = symbol.replace('/', '').toUpperCase();
      const binanceSymbol = BINANCE_SYMBOL_MAP[symbol] || BINANCE_SYMBOL_MAP[cleanSymbol] || `${cleanSymbol}USDT`;
      const binanceInterval = BINANCE_INTERVAL_MAP[timeframe] || '5m';

      const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${limit}`;

      const response = await fetch(url);

      if (!response.ok) {
        return {
          ok: false,
          status: { provider: "Binance Engine", message: `Binance Error ${response.status}` },
          error: `Binance API Error: ${response.statusText}`
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
        status: { provider: "Binance Engine", message: "Live Market Data" }
      };
    } catch (err: any) {
      return {
        ok: false,
        status: { provider: "Binance Engine", message: "Connection Error" },
        error: err.message || "Failed to fetch market data"
      };
    }
  });
