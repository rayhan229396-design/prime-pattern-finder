import { analyze } from "./signal-engine";
import type { CalibrationModel } from "./calibration";
import type { Candle, MarketType, Signal, TimeframeId } from "./types";

export interface ScanTarget {
  symbol: string;
  timeframe: TimeframeId;
}

export interface ScanOptions {
  market: MarketType;
  sourceName: string;
  placeholder: boolean;
  /** Minimum estimated probability to surface an opportunity. */
  threshold: number;
  calibration?: CalibrationModel;
  /** Milliseconds between provider requests to respect rate limits. */
  throttleMs?: number;
}

export type SeriesLoader = (
  symbol: string,
  timeframe: TimeframeId,
) => Promise<{ candles: Candle[] } | null>;

interface CacheEntry {
  at: number;
  candles: Candle[];
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 20_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Throttled + cached multi-asset scan. Returns ranked opportunities. */
export async function scanMarkets(
  targets: ScanTarget[],
  load: SeriesLoader,
  opts: ScanOptions,
): Promise<{ signals: Signal[]; errors: string[] }> {
  const signals: Signal[] = [];
  const errors: string[] = [];
  const throttle = opts.throttleMs ?? 60;

  for (const t of targets) {
    const key = `${opts.market}:${t.symbol}:${t.timeframe}`;
    const cached = cache.get(key);
    let candles: Candle[] | null = null;

    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      candles = cached.candles;
    } else {
      try {
        const res = await load(t.symbol, t.timeframe);
        if (res) {
          candles = res.candles;
          cache.set(key, { at: Date.now(), candles: res.candles });
        }
      } catch (err) {
        errors.push(`${t.symbol} ${t.timeframe}: ${(err as Error).message}`);
      }
      await sleep(throttle);
    }

    if (!candles) continue;
    const result = analyze({
      symbol: t.symbol,
      market: opts.market,
      timeframe: t.timeframe,
      candles: candles.filter((c) => c.closed),
      sourceName: opts.sourceName,
      placeholder: opts.placeholder,
      ...(opts.calibration ? { calibration: opts.calibration } : {}),
    });
    if (!result.ok) {
      errors.push(`${t.symbol} ${t.timeframe}: ${result.reason}`);
      continue;
    }
    if (result.signal.direction !== "WAIT" && result.signal.probability >= opts.threshold) {
      signals.push(result.signal);
    }
  }

  return { signals: signals.sort((a, b) => b.probability - a.probability), errors };
}

export function clearScanCache(): void {
  cache.clear();
}
