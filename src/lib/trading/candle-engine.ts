import type { Candle, TimeframeId } from "./types";
import { getTimeframe } from "./instruments";

/** Align a UTC timestamp (ms) down to the opening boundary of its candle. */
export function alignToCandle(timeMs: number, tf: TimeframeId): number {
  const ms = getTimeframe(tf).seconds * 1000;
  return Math.floor(timeMs / ms) * ms;
}

export function candleCloseTime(openTimeMs: number, tf: TimeframeId): number {
  return openTimeMs + getTimeframe(tf).seconds * 1000;
}

export function nextCandleOpen(openTimeMs: number, tf: TimeframeId): number {
  return candleCloseTime(openTimeMs, tf);
}

/** Seconds remaining in the candle that contains `nowMs`. */
export function secondsToClose(nowMs: number, tf: TimeframeId): number {
  const close = candleCloseTime(alignToCandle(nowMs, tf), tf);
  return Math.max(0, Math.ceil((close - nowMs) / 1000));
}

export function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Reusable candle engine: folds a stream of ticks into aligned candles for a
 * timeframe. Closed candles are frozen — they are never mutated again.
 */
export class CandleEngine {
  private candles: Candle[] = [];
  private readonly maxCandles: number;
  private listeners = new Set<(closed: Candle) => void>();

  constructor(
    private readonly timeframe: TimeframeId,
    seed: Candle[] = [],
    maxCandles = 500,
  ) {
    this.maxCandles = maxCandles;
    this.candles = seed.slice(-maxCandles);
  }

  onCandleClose(listener: (closed: Candle) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Ingest a price tick. Returns the current (forming) candle. */
  addTick(price: number, timeMs: number): Candle {
    const openTime = alignToCandle(timeMs, this.timeframe);
    const current = this.candles[this.candles.length - 1];

    if (!current || openTime > current.time) {
      if (current && !current.closed) {
        const finalized: Candle = { ...current, closed: true };
        this.candles[this.candles.length - 1] = finalized;
        this.listeners.forEach((l) => l(finalized));
      }
      const fresh: Candle = {
        time: openTime,
        open: current?.close ?? price,
        high: Math.max(current?.close ?? price, price),
        low: Math.min(current?.close ?? price, price),
        close: price,
        closed: false,
      };
      this.candles.push(fresh);
      if (this.candles.length > this.maxCandles) this.candles.shift();
      return fresh;
    }

    if (current.closed) return current;
    const updated: Candle = {
      ...current,
      high: Math.max(current.high, price),
      low: Math.min(current.low, price),
      close: price,
    };
    this.candles[this.candles.length - 1] = updated;
    return updated;
  }

  /** All candles, oldest first. */
  getCandles(): Candle[] {
    return this.candles;
  }

  /** Only finalized candles — the only data the signal engine may analyze. */
  getClosedCandles(): Candle[] {
    return this.candles.filter((c) => c.closed);
  }

  getCurrent(): Candle | undefined {
    return this.candles[this.candles.length - 1];
  }
}

/** Aggregate lower-timeframe candles into a higher timeframe (e.g. 1m -> 5m). */
export function aggregate(candles: Candle[], to: TimeframeId): Candle[] {
  const out: Candle[] = [];
  for (const c of candles) {
    const openTime = alignToCandle(c.time, to);
    const last = out[out.length - 1];
    if (!last || last.time !== openTime) {
      out.push({ ...c, time: openTime });
    } else {
      last.high = Math.max(last.high, c.high);
      last.low = Math.min(last.low, c.low);
      last.close = c.close;
      last.closed = c.closed;
      if (c.volume != null) last.volume = (last.volume ?? 0) + c.volume;
    }
  }
  return out;
}
