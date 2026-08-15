import type { Asset, Timeframe, TimeframeId } from "./types";

/**
 * Instrument registry. Adding an instrument later = one entry here.
 * `markets` lists the market modes where the instrument *could* be offered;
 * actual availability still depends on a connected provider/broker adapter.
 */
const forex = (symbol: string, name: string): Asset => ({
  symbol,
  name,
  assetClass: "forex",
  digits: symbol.includes("JPY") ? 3 : 5,
  markets: ["REAL", "OTC"],
});

export const ASSETS: Asset[] = [
  forex("EUR/USD", "Euro / US Dollar"),
  forex("GBP/USD", "British Pound / US Dollar"),
  forex("USD/JPY", "US Dollar / Japanese Yen"),
  forex("USD/CHF", "US Dollar / Swiss Franc"),
  forex("AUD/USD", "Australian Dollar / US Dollar"),
  forex("USD/CAD", "US Dollar / Canadian Dollar"),
  forex("NZD/USD", "New Zealand Dollar / US Dollar"),
  forex("EUR/JPY", "Euro / Japanese Yen"),
  forex("GBP/JPY", "British Pound / Japanese Yen"),
  forex("AUD/JPY", "Australian Dollar / Japanese Yen"),
  forex("EUR/GBP", "Euro / British Pound"),
  forex("EUR/CHF", "Euro / Swiss Franc"),
  forex("GBP/CHF", "British Pound / Swiss Franc"),
  forex("AUD/CAD", "Australian Dollar / Canadian Dollar"),
  forex("AUD/CHF", "Australian Dollar / Swiss Franc"),
  forex("CAD/JPY", "Canadian Dollar / Japanese Yen"),
  forex("EUR/AUD", "Euro / Australian Dollar"),
  forex("EUR/CAD", "Euro / Canadian Dollar"),
  forex("GBP/CAD", "British Pound / Canadian Dollar"),
  forex("GBP/AUD", "British Pound / Australian Dollar"),
  {
    symbol: "XAU/USD",
    name: "Gold / US Dollar",
    assetClass: "metal",
    digits: 2,
    markets: ["REAL", "OTC"],
  },
];

export function getAsset(symbol: string): Asset {
  return ASSETS.find((a) => a.symbol === symbol) ?? ASSETS[0]!;
}

export const TIMEFRAMES: Timeframe[] = [
  { id: "1m", label: "1 Minute", seconds: 60, higher: "5m" },
  { id: "3m", label: "3 Minutes", seconds: 180, higher: "5m" },
  { id: "5m", label: "5 Minutes", seconds: 300, higher: null },
];

export function getTimeframe(id: TimeframeId): Timeframe {
  return TIMEFRAMES.find((t) => t.id === id) ?? TIMEFRAMES[0]!;
}

export const SHORT_TF: Record<TimeframeId, string> = { "1m": "1M", "3m": "3M", "5m": "5M" };
