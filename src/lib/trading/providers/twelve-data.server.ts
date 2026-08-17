import { MarketDataProvider, Candle, MarketStatus } from '../types';

// Symbol mapper to map Forex/Crypto to Binance Pairs
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

// Interval mapper to map app intervals to Binance intervals
const BINANCE_INTERVAL_MAP: Record<string, string> = {
  '1min': '1m',
  '5min': '5m',
  '15min': '15m',
  '30min': '30m',
  '1h': '1h',
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m'
};

export class TwelveDataServerProvider implements MarketDataProvider {
  constructor(apiKey?: string) {
    // No API key required for Binance Public Engine!
  }

  async getCandles(symbol: string, interval: string, outputsize: number = 30): Promise<Candle[]> {
    const cleanSymbol = symbol.replace('/', '').toUpperCase();
    const binanceSymbol = BINANCE_SYMBOL_MAP[symbol] || BINANCE_SYMBOL_MAP[cleanSymbol] || `${cleanSymbol}USDT`;
    const binanceInterval = BINANCE_INTERVAL_MAP[interval] || '5m';

    // Free Unlimited Binance Klines (Candlestick) Public API
    const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${binanceInterval}&limit=${outputsize}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API Error Status: ${response.status}`);
      }

      const data = await response.json();

      // Format Binance Kline Array into Application Candle Interface
      const candles: Candle[] = data.map((item: any) => ({
        timestamp: item[0],             // Open time
        open: parseFloat(item[1]),      // Open price
        high: parseFloat(item[2]),      // High price
        low: parseFloat(item[3]),       // Low price
        close: parseFloat(item[4]),     // Close price
        volume: parseFloat(item[5])     // Volume
      }));

      return candles;
    } catch (error: any) {
      console.error('Binance Data Fetch Error:', error);
      throw new Error(`Market Data Fetch Failed: ${error.message}`);
    }
  }

  async getMarketStatus(): Promise<MarketStatus> {
    return {
      isOpen: true,
      mode: 'Real market (Unlimited Binance Feed)'
    };
  }
}
