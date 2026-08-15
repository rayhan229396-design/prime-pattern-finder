import {
  adx,
  atr,
  bollinger,
  detectPatterns,
  ema,
  macd,
  rsi,
  sma,
  stochastic,
  swingLevels,
  volumeRatio,
} from "./indicators";
import { calibrate, probabilityBand, type CalibrationModel } from "./calibration";
import { aggregate, nextCandleOpen } from "./candle-engine";
import { getTimeframe } from "./instruments";
import type {
  Candle,
  MarketRegime,
  MarketType,
  ReasonItem,
  Signal,
  SignalStrength,
  TimeframeId,
} from "./types";

export interface AnalyzeInput {
  symbol: string;
  market: MarketType;
  timeframe: TimeframeId;
  /** CLOSED candles only, oldest first. Never pass the forming candle. */
  candles: Candle[];
  sourceName: string;
  placeholder: boolean;
  calibration?: CalibrationModel;
  /** Minimum |score| required before a direction is emitted instead of WAIT. */
  minScore?: number;
}

export interface AnalyzeError {
  ok: false;
  reason: string;
}

export type AnalyzeResult = { ok: true; signal: Signal } | AnalyzeError;

const MIN_CANDLES = 60;

/**
 * Confluence analysis of CLOSED candles. The produced signal always applies to
 * the NEXT candle — no future data is ever read.
 */
export function analyze(input: AnalyzeInput): AnalyzeResult {
  const { candles } = input;
  const closed = candles.filter((c) => c.closed);
  if (closed.length < MIN_CANDLES) {
    return { ok: false, reason: `Insufficient historical data (${closed.length}/${MIN_CANDLES})` };
  }

  const last = closed[closed.length - 1]!;
  const closes = closed.map((c) => c.close);

  const ema9 = ema(closes, 9);
  const ema21 = ema(closes, 21);
  const ema50 = ema(closes, 50);
  const ema200 = closes.length >= 200 ? ema(closes, 200) : null;
  const sma20 = sma(closes, 20);
  const rsi14 = rsi(closes, 14);
  const macdRes = macd(closes);
  const stoch = stochastic(closed);
  const bb = bollinger(closes);
  const atr14 = atr(closed);
  const adxRes = adx(closed);
  const levels = swingLevels(closed);
  const patterns = detectPatterns(closed);
  const vol = volumeRatio(closed);

  let score = 0;
  const reasons: ReasonItem[] = [];
  const add = (points: number, text: string) => {
    score += points;
    if (Math.abs(points) >= 4) reasons.push({ ok: points > 0, text });
  };

  // --- Trend ---
  if (ema9 != null && ema21 != null) {
    if (ema9 > ema21) add(12, "EMA 9/21 bullish alignment");
    else add(-12, "EMA 9/21 bearish alignment");
  }
  if (ema21 != null && ema50 != null) {
    if (ema21 > ema50) add(10, "EMA 21 above EMA 50");
    else add(-10, "EMA 21 below EMA 50");
  }
  if (ema200 != null) {
    if (last.close > ema200) add(8, "Price above EMA 200");
    else add(-8, "Price below EMA 200");
  }
  if (sma20 != null) {
    if (last.close > sma20) add(5, "Price above SMA 20");
    else add(-5, "Price below SMA 20");
  }

  // --- Momentum ---
  if (rsi14 != null) {
    if (rsi14 > 70) add(-8, "RSI overbought");
    else if (rsi14 < 30) add(8, "RSI oversold");
    else if (rsi14 > 55) add(8, "RSI momentum bullish");
    else if (rsi14 < 45) add(-8, "RSI momentum bearish");
  }
  if (macdRes) {
    if (macdRes.histogram > 0) add(10, "MACD histogram positive");
    else add(-10, "MACD histogram negative");
  }
  if (stoch) {
    if (stoch.k > stoch.d && stoch.k < 80) add(7, "Stochastic bullish cross");
    else if (stoch.k < stoch.d && stoch.k > 20) add(-7, "Stochastic bearish cross");
  }

  // --- Volatility ---
  let regime: MarketRegime = "UNKNOWN";
  if (adxRes) {
    if (adxRes.adx >= 30) regime = "STRONG_TREND";
    else if (adxRes.adx >= 20) regime = "WEAK_TREND";
    else regime = "RANGING";
    const dirBias = adxRes.plusDI > adxRes.minusDI ? 1 : -1;
    if (adxRes.adx >= 20) add(dirBias * 9, `ADX ${adxRes.adx.toFixed(0)} directional strength`);
    else add(0, "");
  }
  if (bb) {
    if (bb.percentB < 0.05) add(7, "Price at lower Bollinger band");
    else if (bb.percentB > 0.95) add(-7, "Price at upper Bollinger band");
    if (bb.width > 0 && atr14 != null && bb.width > 1.5) regime = "VOLATILE";
  }

  // --- Support / resistance ---
  if (atr14 != null && atr14 > 0) {
    if (levels.nearestSupport != null && (last.close - levels.nearestSupport) / atr14 < 0.6)
      add(9, "Support zone reaction");
    if (levels.nearestResistance != null && (levels.nearestResistance - last.close) / atr14 < 0.6)
      add(-9, "Resistance zone rejection");
  }

  // --- Price action ---
  for (const p of patterns) {
    if (p.bias === "bullish") add(6, `${p.name} confirmation`);
    else if (p.bias === "bearish") add(-6, `${p.name} confirmation`);
    else reasons.push({ ok: false, text: `${p.name} — indecision` });
  }

  // --- Volume (only when reliable) ---
  if (vol != null && vol > 1.3) add(score >= 0 ? 5 : -5, "Volume expansion confirms move");

  // --- Multi-timeframe confirmation ---
  const higher = getTimeframe(input.timeframe).higher;
  if (higher) {
    const htf = aggregate(closed, higher);
    const htfCloses = htf.map((c) => c.close);
    const h9 = ema(htfCloses, 9);
    const h21 = ema(htfCloses, 21);
    if (h9 != null && h21 != null) {
      if (h9 > h21) add(12, `Higher timeframe (${higher}) trend bullish`);
      else add(-12, `Higher timeframe (${higher}) trend bearish`);
    }
  }

  const normalized = Math.max(-100, Math.min(100, score));
  const minScore = input.minScore ?? 30;
  const direction = Math.abs(normalized) < minScore ? "WAIT" : normalized > 0 ? "BUY" : "SELL";

  const probability = calibrate(normalized, input.calibration);
  const strength = strengthOf(normalized, direction === "WAIT");

  const trend =
    ema9 != null && ema21 != null
      ? ema9 > ema21 * 1.0001
        ? "BULLISH"
        : ema9 < ema21 * 0.9999
          ? "BEARISH"
          : "NEUTRAL"
      : "NEUTRAL";

  const keptReasons = reasons
    .filter((r) => r.text)
    .filter((r) => (direction === "WAIT" ? true : r.ok === (direction === "BUY")))
    .slice(0, 6);

  const signal: Signal = {
    id: `${input.symbol}-${input.timeframe}-${last.time}`,
    symbol: input.symbol,
    market: input.market,
    timeframe: input.timeframe,
    direction,
    probability: direction === "WAIT" ? Math.min(probability, 59) : probability,
    band: probabilityBand(direction === "WAIT" ? Math.min(probability, 59) : probability),
    strength,
    trend,
    regime,
    score: normalized,
    reasons: keptReasons.length ? keptReasons : reasons.slice(0, 4),
    analyzedCandleTime: last.time,
    targetCandleTime: nextCandleOpen(last.time, input.timeframe),
    placeholder: input.placeholder,
    calibrated: Boolean(input.calibration?.fitted),
    result: "PENDING",
    sourceName: input.sourceName,
  };

  return { ok: true, signal };
}

function strengthOf(score: number, wait: boolean): SignalStrength {
  if (wait) return "NONE";
  const abs = Math.abs(score);
  if (abs >= 60) return "STRONG";
  if (abs >= 42) return "MODERATE";
  return "WEAK";
}

/** Evaluate a past signal against the candle it targeted (next-candle outcome). */
export function evaluateSignal(signal: Signal, targetCandle: Candle): "WIN" | "LOSS" | "PENDING" {
  if (!targetCandle.closed || targetCandle.time !== signal.targetCandleTime) return "PENDING";
  if (signal.direction === "WAIT") return "PENDING";
  const up = targetCandle.close > targetCandle.open;
  const down = targetCandle.close < targetCandle.open;
  if (!up && !down) return "LOSS";
  return (signal.direction === "BUY" && up) || (signal.direction === "SELL" && down)
    ? "WIN"
    : "LOSS";
}
