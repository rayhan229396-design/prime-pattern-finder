import type { ProbabilityBand } from "./types";

/**
 * Probability calibration layer.
 *
 * A raw confluence score is NOT a win probability. This module is the single
 * place where a score is turned into an estimated probability, so it can be
 * replaced later by logistic / isotonic calibration or a rolling historical
 * win rate computed by the backtester (Phase 5).
 */

export interface CalibrationBucket {
  /** Inclusive lower bound of |score|. */
  minScore: number;
  /** Historical win rate for this bucket, 0-1. */
  winRate: number;
  samples: number;
}

export interface CalibrationModel {
  method: "uncalibrated-prior" | "buckets" | "logistic" | "isotonic";
  /** True only when fitted on historical backtest results. */
  fitted: boolean;
  buckets?: CalibrationBucket[];
  updatedAt?: number;
  notes?: string;
}

/**
 * Default model. NOT fitted on historical data yet, so it deliberately stays
 * conservative and caps well below any "certainty" claim.
 */
export const DEFAULT_MODEL: CalibrationModel = {
  method: "uncalibrated-prior",
  fitted: false,
  notes:
    "Conservative prior mapping. Replace with backtest-fitted calibration before treating values as validated.",
};

export const PROBABILITY_CAP = 88;
export const PROBABILITY_FLOOR = 50;

/** Map a raw score (-100..100) to an estimated probability (0-100). */
export function calibrate(score: number, model: CalibrationModel = DEFAULT_MODEL): number {
  const abs = Math.min(100, Math.abs(score));

  if (model.fitted && model.buckets?.length) {
    const bucket = [...model.buckets]
      .sort((a, b) => b.minScore - a.minScore)
      .find((b) => abs >= b.minScore);
    if (bucket) return clamp(bucket.winRate * 100);
  }

  // Conservative logistic-shaped prior: 50% at score 0, ~80% at score 70.
  const p = 1 / (1 + Math.exp(-(abs - 38) / 16));
  return clamp(50 + (p - 0.5) * 78);
}

function clamp(p: number): number {
  return Math.round(Math.min(PROBABILITY_CAP, Math.max(PROBABILITY_FLOOR, p)));
}

export function probabilityBand(p: number): ProbabilityBand {
  if (p >= 90) return "VERY_HIGH";
  if (p >= 80) return "HIGH";
  if (p >= 70) return "GOOD";
  if (p >= 60) return "MODERATE";
  return "LOW";
}

export const BAND_LABEL: Record<ProbabilityBand, string> = {
  VERY_HIGH: "Very High",
  HIGH: "High",
  GOOD: "Good",
  MODERATE: "Moderate",
  LOW: "Low",
};
