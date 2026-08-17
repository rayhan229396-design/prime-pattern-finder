import { MarketDataProvider, Candle, MarketStatus } from '../types';

// Rate Limiter Configurations
// 8 calls max per 60,000 ms (1 minute)
const MAX_CALLS_PER_MINUTE = 8;
const WINDOW_MS = 60 * 1000;
let callTimestamps: number[] = [];

// Cache to prevent repetitive API hits
const cache = new Map<string, { timestamp: number; data: Candle[] }>();
const CACHE_TTL_MS = 10 * 1000; // 10 seconds cache

function canMakeRequest(): boolean {
  const now = Date.now();
  // Clear calls older than 60 seconds
  callTimestamps = callTimestamps.filter(t => now - t < WINDOW_MS);
  return callTimestamps.length < MAX_CALLS_PER_MINUTE;
}

function trackRequest() {
  callTimestamps.push(Date.now());
}

export class TwelveDataServerProvider implements MarketDataProvider {
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.TWELVE_DATA_API_KEY || '';
  }

  async getCandles(symbol: string, interval: string, outputsize: number = 30): Promise<Candle[]> {
    if (!this.apiKey) {
      throw new Error('TWELVE_DATA_API_KEY is not configured.');
    }

    const cacheKey = `${symbol}-${interval}-${outputsize}`;
    const cached = cache.get(cacheKey);
    const now = Date.now();

    // Return cached data if fresh (within 10 seconds)
    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
      return cached.data;
    }

    // Rate limit safeguard: Max 8 requests/min
    if (!canMakeRequest()) {
      if (cached) {
        // Return stale cache gracefully instead of throwing 429 error
        return cached.data;
      }
      throw new Error('Twelve Data HTTP 429: Rate limit reached (Max 8 calls/min). Please wait a few seconds.');
    }

    // Track API call
    trackRequest();

    const formattedSymbol = symbol.includes('/') ? symbol : `${symbol.slice(0, 3)}/${symbol.slice(3)}`;
    const url = `https://api.twelvedata.com/time_series?symbol=${formattedSymbol}&interval=${interval}&outputsize=${outputsize}&apikey=${this.apiKey}`;

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Twelve Data HTTP 429');
      }
      if (response.status === 401) {
        throw new Error('Twelve Data HTTP 401');
      }
      throw new Error(`Twelve Data Error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status === 'error') {
      throw new Error(data.message || 'Failed to fetch Twelve Data');
    }

    if (!data.values || !Array.isArray(data.values)) {
      throw new Error('Invalid candle data format received from Twelve Data');
    }

    const candles: Candle[] = data.values.map((v: any) => ({
      timestamp: new Date(v.datetime).getTime(),
      open: parseFloat(v.open),
      high: parseFloat(v.high),
      low: parseFloat(v.low),
      close: parseFloat(v.close),
      volume: parseFloat(v.volume || '0')
    })).reverse();

    // Save to Cache
    cache.set(cacheKey, { timestamp: now, data: candles });

    return candles;
  }

  async getMarketStatus(): Promise<MarketStatus> {
    return {
      isOpen: true,
      mode: 'Real market'
    };
  }
}
