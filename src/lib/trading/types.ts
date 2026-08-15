/** Core domain types shared by data providers, candle engine, signal engine and UI. */

export type MarketType = "REAL" | "OTC";

export type TimeframeId = "1m" | "3m" | "5m";

export interface Timeframe {
  id: TimeframeId;
  label: string;
  /** Candle duration in seconds. */
  seconds: number;
  /** Higher timeframe used for multi-timeframe confirmation. */
  higher: TimeframeId | null;
}

export type AssetClass = "forex" | "metal";

export interface Asset {
  /** Standardized internal symbol, e.g. "EUR/USD". */
  symbol: string;
  /** User friendly display name. */
  name: string;
  assetClass: AssetClass;
  /** Decimal places used for price display. */
  digits: number;
  markets: MarketType[];
}

/** Normalized OHLC candle. All providers/adapters must emit this shape. */
export interface Candle {
  /** Candle open time, UTC epoch milliseconds, aligned to the timeframe. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Undefined when the source exposes no reliable volume. */
  volume?: number;
  /** False while the candle is still forming. */
  closed: boolean;
}

export type DataQuality = "live" | "delayed" | "stale" | "unavailable" | "placeholder";

export interface DataSourceStatus {
  /** Human readable source name shown in the UI. */
  name: string;
  connected: boolean;
  quality: DataQuality;
  /** Epoch ms of the last received update, null when never received. */
  lastUpdate: number | null;
  transport: "websocket" | "rest" | "none";
  message?: string;
}

export interface MarketSeries {
  symbol: string;
  timeframe: TimeframeId;
  candles: Candle[];
  source: DataSourceStatus;
}

export type SignalDirection = "BUY" | "SELL" | "WAIT";

export type SignalStrength = "STRONG" | "MODERATE" | "WEAK" | "NONE";

export type ProbabilityBand = "VERY_HIGH" | "HIGH" | "GOOD" | "MODERATE" | "LOW";

export type MarketRegime = "STRONG_TREND" | "WEAK_TREND" | "RANGING" | "VOLATILE" | "UNKNOWN";

export interface ReasonItem {
  ok: boolean;
  text: string;
}

export interface Signal {
  id: string;
  symbol: string;
  market: MarketType;
  timeframe: TimeframeId;
  direction: SignalDirection;
  /** Estimated probability 0-100. Never a guarantee. */
  probability: number;
  band: ProbabilityBand;
  strength: SignalStrength;
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  regime: MarketRegime;
  /** Raw confluence score, -100..100. */
  score: number;
  reasons: ReasonItem[];
  /** Open time (UTC ms) of the closed candle the analysis is based on. */
  analyzedCandleTime: number;
  /** Open time (UTC ms) of the candle the signal applies to. */
  targetCandleTime: number;
  /** Marks output derived from placeholder data (Phase 1 UI development). */
  placeholder: boolean;
  calibrated: boolean;
  result?: "WIN" | "LOSS" | "PENDING";
  sourceName: string;
}

export interface Opportunity {
  signal: Signal;
}
