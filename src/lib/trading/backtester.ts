import { analyze, evaluateSignal } from "./signal-engine";
import type { CalibrationBucket, CalibrationModel } from "./calibration";
import type { Candle, MarketType, TimeframeId } from "./types";

export interface BacktestConfig {
  symbol: string;
  market: MarketType;
  timeframe: TimeframeId;
  candles: Candle[];
  sourceName: string;
  placeholder: boolean;
  minScore?: number;
  /** Candles required before the first signal is generated. */
  warmup?: number;
}

export interface BacktestStats {
  totalSignals: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  maxWinStreak: number;
  maxLossStreak: number;
  byRegime: Record<string, { signals: number; wins: number }>;
  byDirection: Record<string, { signals: number; wins: number }>;
}

export interface BacktestResult {
  symbol: string;
  timeframe: TimeframeId;
  stats: BacktestStats;
  /** Score-bucketed win rates, usable as a calibration model. */
  buckets: CalibrationBucket[];
}

/**
 * Walk-forward backtest with no look-ahead bias: at each step only candles up
 * to and including index `i` (all closed) are visible, and the outcome is read
 * from candle `i + 1`, which the analysis never saw.
 */
export function backtest(config: BacktestConfig): BacktestResult {
  const warmup = config.warmup ?? 220;
  const candles = config.candles.filter((c) => c.closed);
  const stats: BacktestStats = {
    totalSignals: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    profitFactor: 0,
    maxDrawdown: 0,
    maxWinStreak: 0,
    maxLossStreak: 0,
    byRegime: {},
    byDirection: {},
  };
  const bucketAgg = new Map<number, { wins: number; samples: number }>();

  let equity = 0;
  let peak = 0;
  let winStreak = 0;
  let lossStreak = 0;

  for (let i = warmup; i < candles.length - 1; i++) {
    const history = candles.slice(0, i + 1);
    const res = analyze({
      symbol: config.symbol,
      market: config.market,
      timeframe: config.timeframe,
      candles: history,
      sourceName: config.sourceName,
      placeholder: config.placeholder,
      minScore: config.minScore,
    });
    if (!res.ok || res.signal.direction === "WAIT") continue;

    const outcome = evaluateSignal(res.signal, candles[i + 1]!);
    if (outcome === "PENDING") continue;

    stats.totalSignals++;
    const bucketKey = Math.min(90, Math.floor(Math.abs(res.signal.score) / 10) * 10);
    const bucket = bucketAgg.get(bucketKey) ?? { wins: 0, samples: 0 };
    bucket.samples++;

    const regime = stats.byRegime[res.signal.regime] ?? { signals: 0, wins: 0 };
    const dir = stats.byDirection[res.signal.direction] ?? { signals: 0, wins: 0 };
    regime.signals++;
    dir.signals++;

    if (outcome === "WIN") {
      stats.wins++;
      bucket.wins++;
      regime.wins++;
      dir.wins++;
      equity += 0.8; // typical binary payout of 80%
      winStreak++;
      lossStreak = 0;
    } else {
      stats.losses++;
      equity -= 1;
      lossStreak++;
      winStreak = 0;
    }
    stats.maxWinStreak = Math.max(stats.maxWinStreak, winStreak);
    stats.maxLossStreak = Math.max(stats.maxLossStreak, lossStreak);
    peak = Math.max(peak, equity);
    stats.maxDrawdown = Math.max(stats.maxDrawdown, peak - equity);
    stats.byRegime[res.signal.regime] = regime;
    stats.byDirection[res.signal.direction] = dir;
    bucketAgg.set(bucketKey, bucket);
  }

  stats.winRate = stats.totalSignals ? stats.wins / stats.totalSignals : 0;
  const grossWin = stats.wins * 0.8;
  const grossLoss = stats.losses;
  stats.profitFactor = grossLoss === 0 ? (grossWin > 0 ? Infinity : 0) : grossWin / grossLoss;

  const buckets: CalibrationBucket[] = [...bucketAgg.entries()]
    .map(([minScore, b]) => ({ minScore, winRate: b.samples ? b.wins / b.samples : 0, samples: b.samples }))
    .sort((a, b) => a.minScore - b.minScore);

  return { symbol: config.symbol, timeframe: config.timeframe, stats, buckets };
}

/** Build a calibration model from backtest buckets with enough samples. */
export function fitCalibration(results: BacktestResult[], minSamples = 40): CalibrationModel {
  const merged = new Map<number, { wins: number; samples: number }>();
  for (const r of results) {
    for (const b of r.buckets) {
      const m = merged.get(b.minScore) ?? { wins: 0, samples: 0 };
      m.wins += Math.round(b.winRate * b.samples);
      m.samples += b.samples;
      merged.set(b.minScore, m);
    }
  }
  const buckets = [...merged.entries()]
    .filter(([, m]) => m.samples >= minSamples)
    .map(([minScore, m]) => ({ minScore, winRate: m.wins / m.samples, samples: m.samples }));

  if (!buckets.length) {
    return {
      method: "uncalibrated-prior",
      fitted: false,
      notes: "Not enough historical samples to calibrate.",
    };
  }
  return { method: "buckets", fitted: true, buckets, updatedAt: Date.now() };
}
