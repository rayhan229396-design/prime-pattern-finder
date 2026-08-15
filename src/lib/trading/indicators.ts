import type { Candle } from "./types";

/** Pure technical indicator library. Every function reads only past candles. */

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function emaSeries(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]!];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i]! * k + out[i - 1]! * (1 - k));
  }
  return out;
}

export function ema(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const s = emaSeries(values, period);
  return s[s.length - 1]!;
}

export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i]! - values[i - 1]!;
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  const avgGain = gain / period;
  const avgLoss = loss / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export interface MacdResult {
  macd: number;
  signal: number;
  histogram: number;
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult | null {
  if (values.length < slow + signalPeriod) return null;
  const fastS = emaSeries(values, fast);
  const slowS = emaSeries(values, slow);
  const macdLine = values.map((_, i) => fastS[i]! - slowS[i]!);
  const signalS = emaSeries(macdLine, signalPeriod);
  const m = macdLine[macdLine.length - 1]!;
  const s = signalS[signalS.length - 1]!;
  return { macd: m, signal: s, histogram: m - s };
}

export function stochastic(candles: Candle[], period = 14, smoothing = 3) {
  if (candles.length < period + smoothing) return null;
  const ks: number[] = [];
  for (let i = candles.length - smoothing; i < candles.length; i++) {
    const window = candles.slice(i - period + 1, i + 1);
    const high = Math.max(...window.map((c) => c.high));
    const low = Math.min(...window.map((c) => c.low));
    const close = candles[i]!.close;
    ks.push(high === low ? 50 : ((close - low) / (high - low)) * 100);
  }
  const k = ks[ks.length - 1]!;
  const d = ks.reduce((a, b) => a + b, 0) / ks.length;
  return { k, d };
}

export function bollinger(values: number[], period = 20, mult = 2) {
  const mid = sma(values, period);
  if (mid == null) return null;
  const slice = values.slice(-period);
  const variance = slice.reduce((a, v) => a + (v - mid) ** 2, 0) / period;
  const sd = Math.sqrt(variance);
  const upper = mid + mult * sd;
  const lower = mid - mult * sd;
  const price = values[values.length - 1]!;
  const width = mid === 0 ? 0 : ((upper - lower) / mid) * 100;
  const percentB = upper === lower ? 0.5 : (price - lower) / (upper - lower);
  return { upper, mid, lower, width, percentB };
}

export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i]!;
    const prev = candles[i - 1]!;
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close)));
  }
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

/** Wilder ADX with +DI / -DI. */
export function adx(candles: Candle[], period = 14) {
  if (candles.length < period * 2 + 1) return null;
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i]!;
    const p = candles[i - 1]!;
    const up = c.high - p.high;
    const down = p.low - c.low;
    plusDM.push(up > down && up > 0 ? up : 0);
    minusDM.push(down > up && down > 0 ? down : 0);
    trs.push(Math.max(c.high - c.low, Math.abs(c.high - p.close), Math.abs(c.low - p.close)));
  }
  const smooth = (arr: number[]) => {
    const seed = arr.slice(0, period).reduce((a, b) => a + b, 0);
    let val = seed;
    const out = [seed];
    for (let i = period; i < arr.length; i++) {
      val = val - val / period + arr[i]!;
      out.push(val);
    }
    return out;
  };
  const trS = smooth(trs);
  const pS = smooth(plusDM);
  const mS = smooth(minusDM);
  const dxs: number[] = [];
  for (let i = 0; i < trS.length; i++) {
    const tr = trS[i]!;
    if (tr === 0) continue;
    const pdi = (pS[i]! / tr) * 100;
    const mdi = (mS[i]! / tr) * 100;
    const sum = pdi + mdi;
    dxs.push(sum === 0 ? 0 : (Math.abs(pdi - mdi) / sum) * 100);
  }
  if (dxs.length < period) return null;
  const adxVal = dxs.slice(-period).reduce((a, b) => a + b, 0) / period;
  const tr = trS[trS.length - 1]!;
  return {
    adx: adxVal,
    plusDI: tr === 0 ? 0 : (pS[pS.length - 1]! / tr) * 100,
    minusDI: tr === 0 ? 0 : (mS[mS.length - 1]! / tr) * 100,
  };
}

export interface Levels {
  supports: number[];
  resistances: number[];
  nearestSupport: number | null;
  nearestResistance: number | null;
}

/** Swing-based support / resistance zones from closed candles. */
export function swingLevels(candles: Candle[], lookback = 60, span = 2): Levels {
  const window = candles.slice(-lookback);
  const supports: number[] = [];
  const resistances: number[] = [];
  for (let i = span; i < window.length - span; i++) {
    const c = window[i]!;
    const left = window.slice(i - span, i);
    const right = window.slice(i + 1, i + 1 + span);
    if (left.every((l) => l.low > c.low) && right.every((r) => r.low > c.low)) supports.push(c.low);
    if (left.every((l) => l.high < c.high) && right.every((r) => r.high < c.high))
      resistances.push(c.high);
  }
  const price = candles[candles.length - 1]?.close ?? 0;
  const below = supports.filter((s) => s <= price).sort((a, b) => b - a);
  const above = resistances.filter((r) => r >= price).sort((a, b) => a - b);
  return {
    supports,
    resistances,
    nearestSupport: below[0] ?? null,
    nearestResistance: above[0] ?? null,
  };
}

export type PatternName =
  | "Bullish Engulfing"
  | "Bearish Engulfing"
  | "Hammer"
  | "Shooting Star"
  | "Doji"
  | "Bullish Pin Bar"
  | "Bearish Pin Bar";

export interface PatternHit {
  name: PatternName;
  bias: "bullish" | "bearish" | "neutral";
}

export function detectPatterns(candles: Candle[]): PatternHit[] {
  const hits: PatternHit[] = [];
  const c = candles[candles.length - 1];
  const p = candles[candles.length - 2];
  if (!c) return hits;
  const body = Math.abs(c.close - c.open);
  const range = c.high - c.low || 1e-9;
  const upper = c.high - Math.max(c.close, c.open);
  const lower = Math.min(c.close, c.open) - c.low;

  if (body / range < 0.1) hits.push({ name: "Doji", bias: "neutral" });
  if (lower > body * 2 && upper < body) hits.push({ name: "Hammer", bias: "bullish" });
  if (upper > body * 2 && lower < body) hits.push({ name: "Shooting Star", bias: "bearish" });
  if (lower / range > 0.6) hits.push({ name: "Bullish Pin Bar", bias: "bullish" });
  if (upper / range > 0.6) hits.push({ name: "Bearish Pin Bar", bias: "bearish" });

  if (p) {
    const pBull = p.close > p.open;
    const cBull = c.close > c.open;
    if (!pBull && cBull && c.close >= p.open && c.open <= p.close)
      hits.push({ name: "Bullish Engulfing", bias: "bullish" });
    if (pBull && !cBull && c.close <= p.open && c.open >= p.close)
      hits.push({ name: "Bearish Engulfing", bias: "bearish" });
  }
  return hits;
}

/** Volume ratio vs recent average; null when no reliable volume data. */
export function volumeRatio(candles: Candle[], period = 20): number | null {
  const window = candles.slice(-(period + 1));
  if (window.length < period + 1 || window.some((c) => c.volume == null || c.volume === 0))
    return null;
  const avg = window.slice(0, period).reduce((a, c) => a + (c.volume ?? 0), 0) / period;
  const last = window[window.length - 1]!.volume ?? 0;
  return avg === 0 ? null : last / avg;
}
