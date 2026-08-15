import { alignToCandle } from "../candle-engine";
import { getAsset, getTimeframe } from "../instruments";
import type { Candle, DataSourceStatus } from "../types";
import type { MarketDataProvider, SeriesRequest, SeriesResponse } from "./types";

/**
 * PHASE 1 UI DEVELOPMENT SOURCE — NOT MARKET DATA.
 *
 * Produces a deterministic synthetic series so the dashboard can be built and
 * reviewed before a real provider is connected. Everything it returns is
 * flagged `quality: "placeholder"` and the UI must label it as sample data.
 * It must never be presented as live, real or OTC market data.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const BASE_PRICE: Record<string, number> = {
  "EUR/USD": 1.0865,
  "GBP/USD": 1.2712,
  "USD/JPY": 151.42,
  "USD/CHF": 0.8934,
  "AUD/USD": 0.6612,
  "USD/CAD": 1.3585,
  "NZD/USD": 0.6098,
  "EUR/JPY": 164.35,
  "GBP/JPY": 192.4,
  "AUD/JPY": 100.12,
  "EUR/GBP": 0.8546,
  "EUR/CHF": 0.9705,
  "GBP/CHF": 1.1352,
  "AUD/CAD": 0.8981,
  "AUD/CHF": 0.5906,
  "CAD/JPY": 111.45,
  "EUR/AUD": 1.6432,
  "EUR/CAD": 1.4756,
  "GBP/CAD": 1.7268,
  "GBP/AUD": 1.9221,
  "XAU/USD": 2338.4,
};

export function generatePlaceholderSeries(
  symbol: string,
  timeframe: SeriesRequest["timeframe"],
  limit: number,
  nowMs = Date.now(),
): Candle[] {
  const asset = getAsset(symbol);
  const tf = getTimeframe(timeframe);
  const stepMs = tf.seconds * 1000;
  const base = BASE_PRICE[symbol] ?? 1;
  // Seed depends on symbol + timeframe + day so the series is stable per session.
  const day = Math.floor(nowMs / 86_400_000);
  const rand = mulberry32(hash(`${symbol}:${timeframe}:${day}`));

  const vol = base * (asset.assetClass === "metal" ? 0.0009 : 0.00045);
  const currentOpen = alignToCandle(nowMs, timeframe);
  const candles: Candle[] = [];
  let price = base;
  let drift = (rand() - 0.5) * vol * 0.5;

  for (let i = limit - 1; i >= 0; i--) {
    const time = currentOpen - i * stepMs;
    if (i % 24 === 0) drift = (rand() - 0.5) * vol * 0.6;
    const open = price;
    const noise = () => (rand() - 0.5) * vol * 2;
    const close = open + drift + noise();
    const high = Math.max(open, close) + Math.abs(noise()) * 0.7;
    const low = Math.min(open, close) - Math.abs(noise()) * 0.7;
    price = close;
    candles.push({
      time,
      open: round(open, asset.digits),
      high: round(high, asset.digits),
      low: round(low, asset.digits),
      close: round(close, asset.digits),
      volume: Math.round(400 + rand() * 900),
      closed: time !== currentOpen,
    });
  }
  return candles;
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export const placeholderStatus = (nowMs = Date.now()): DataSourceStatus => ({
  name: "Sample data (UI preview)",
  connected: false,
  quality: "placeholder",
  lastUpdate: nowMs,
  transport: "none",
  message: "Synthetic series for interface development. Not market data.",
});

export const placeholderProvider: MarketDataProvider = {
  id: "placeholder",
  name: "Sample data (UI preview)",
  market: "REAL",
  implemented: false,
  streamsRealtime: false,
  supports: () => true,
  async fetchSeries(req: SeriesRequest): Promise<SeriesResponse> {
    return {
      ok: true,
      candles: generatePlaceholderSeries(req.symbol, req.timeframe, req.limit),
      status: placeholderStatus(),
    };
  },
};
