/**
 * Authorized OTC feed adapter (server-only).
 *
 * Talks to an operator-configured, authorized broker feed. No broker
 * credentials are bundled, nothing is scraped, and nothing is synthesized:
 * when the feed is not configured the adapter reports "not configured" and the
 * UI keeps OTC unavailable.
 */
import { alignToCandle } from "../candle-engine";
import { getTimeframe } from "../instruments";
import type { Candle, TimeframeId } from "../types";

export interface OtcConfig {
  url: string;
  token: string;
  brokerId: string;
  brokerName: string;
}

const BROKER_NAMES: Record<string, string> = {
  "pocket-option": "Pocket Option OTC",
  quotex: "Quotex OTC",
};

export function readOtcConfig(): OtcConfig | null {
  const url = process.env["OTC_FEED_URL"];
  const token = process.env["OTC_FEED_TOKEN"];
  const brokerId = process.env["OTC_FEED_BROKER"];
  if (!url || !token || !brokerId) return null;
  return {
    url: url.replace(/\/+$/, ""),
    token,
    brokerId,
    brokerName: BROKER_NAMES[brokerId] ?? `${brokerId} OTC`,
  };
}

/* Short-lived caches: never poll the broker harder than necessary. */
const seriesCache = new Map<string, { at: number; candles: Candle[] }>();
const assetCache = { at: 0, assets: [] as { symbol: string; digits: number }[] };
const SERIES_TTL = 15_000;
const ASSETS_TTL = 300_000;

async function call(cfg: OtcConfig, path: string): Promise<unknown> {
  const res = await fetch(`${cfg.url}${path}`, {
    headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/json" },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("Authorized OTC feed rejected the configured credentials.");
  }
  if (res.status === 429) throw new Error("Authorized OTC feed rate limit reached — backing off.");
  if (!res.ok) throw new Error(`Authorized OTC feed error ${res.status}.`);
  return (await res.json()) as unknown;
}

export async function fetchOtcAssets(
  cfg: OtcConfig,
): Promise<{ assets: { symbol: string; digits: number }[]; cached: boolean }> {
  if (Date.now() - assetCache.at < ASSETS_TTL && assetCache.assets.length > 0) {
    return { assets: assetCache.assets, cached: true };
  }
  const body = (await call(cfg, "/assets")) as { assets?: { symbol?: string; digits?: number }[] };
  const assets = (body.assets ?? [])
    .filter((a): a is { symbol: string; digits?: number } => typeof a.symbol === "string")
    .map((a) => ({
      symbol: a.symbol.toUpperCase(),
      digits: typeof a.digits === "number" ? a.digits : a.symbol.includes("JPY") ? 3 : 5,
    }));
  assetCache.at = Date.now();
  assetCache.assets = assets;
  return { assets, cached: false };
}

type RawCandle = {
  time?: number | string;
  timestamp?: number | string;
  open?: number | string;
  high?: number | string;
  low?: number | string;
  close?: number | string;
  volume?: number | string;
};

const ms = (v: number | string): number => {
  if (typeof v === "number") return v < 1e12 ? v * 1000 : v;
  const n = Number(v);
  if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
  return Date.parse(v.endsWith("Z") ? v : `${v}Z`);
};

/** Aggregates 1m broker candles into the requested timeframe when needed. */
function aggregate(candles: Candle[], timeframe: TimeframeId): Candle[] {
  if (timeframe === "1m") return candles;
  const buckets = new Map<number, Candle>();
  for (const c of candles) {
    const key = alignToCandle(c.time, timeframe);
    const b = buckets.get(key);
    if (!b) {
      buckets.set(key, { ...c, time: key });
    } else {
      b.high = Math.max(b.high, c.high);
      b.low = Math.min(b.low, c.low);
      b.close = c.close;
      if (c.volume != null) b.volume = (b.volume ?? 0) + c.volume;
    }
  }
  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

export async function fetchOtcSeries(
  cfg: OtcConfig,
  symbol: string,
  timeframe: TimeframeId,
  limit: number,
): Promise<{ candles: Candle[]; cached: boolean; brokerLastUpdate: number | null }> {
  const key = `${symbol}|${timeframe}|${limit}`;
  const hit = seriesCache.get(key);
  if (hit && Date.now() - hit.at < SERIES_TTL) {
    return {
      candles: hit.candles,
      cached: true,
      brokerLastUpdate: hit.candles[hit.candles.length - 1]?.time ?? null,
    };
  }

  /* 3m is derived from 1m when the broker only serves native intervals. */
  const native: TimeframeId = timeframe === "3m" ? "1m" : timeframe;
  const fetchLimit = timeframe === "3m" ? Math.min(limit * 3, 1500) : limit;
  const body = (await call(
    cfg,
    `/candles?symbol=${encodeURIComponent(symbol)}&interval=${native}&limit=${fetchLimit}`,
  )) as { candles?: RawCandle[] };

  const raw = (body.candles ?? [])
    .map((c): Candle | null => {
      const t = c.time ?? c.timestamp;
      if (t == null) return null;
      const time = ms(t);
      const open = Number(c.open);
      const high = Number(c.high);
      const low = Number(c.low);
      const close = Number(c.close);
      if (![time, open, high, low, close].every(Number.isFinite)) return null;
      return {
        time,
        open,
        high,
        low,
        close,
        ...(c.volume != null && Number.isFinite(Number(c.volume))
          ? { volume: Number(c.volume) }
          : {}),
        closed: true,
      };
    })
    .filter((c): c is Candle => c !== null)
    .sort((a, b) => a.time - b.time);

  if (raw.length === 0) throw new Error("Authorized OTC feed returned no candles for this symbol.");

  const series = aggregate(raw, timeframe).slice(-limit);
  const seconds = getTimeframe(timeframe).seconds * 1000;
  const openNow = alignToCandle(Date.now(), timeframe);
  for (const c of series) c.closed = c.time + seconds <= openNow;

  seriesCache.set(key, { at: Date.now(), candles: series });
  return {
    candles: series,
    cached: false,
    brokerLastUpdate: series[series.length - 1]?.time ?? null,
  };
}
