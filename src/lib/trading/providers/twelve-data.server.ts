import { alignToCandle, aggregate } from "../candle-engine";
import { getAsset } from "../instruments";
import type { Candle, TimeframeId } from "../types";

/**
 * Twelve Data REST access. SERVER ONLY — the API key never reaches the browser.
 *
 * The free plan is rate limited (8 requests/minute), so every response is cached
 * in-process for a fraction of the candle duration and 3m series are derived by
 * aggregating 1m data instead of spending an extra request.
 */

const BASE = "https://api.twelvedata.com";

/** Twelve Data intervals we actually request. 3m is aggregated from 1min. */
const INTERVAL: Record<TimeframeId, string> = { "1m": "1min", "3m": "1min", "5m": "5min" };

interface CacheEntry<T> {
  at: number;
  value: T;
}

const seriesCache = new Map<string, CacheEntry<Candle[]>>();
const priceCache = new Map<string, CacheEntry<number>>();

const SERIES_TTL_MS = 20_000;
const PRICE_TTL_MS = 6_000;

function apiKey(): string {
  const key = process.env["TWELVE_DATA_API_KEY"];
  if (!key) throw new Error("TWELVE_DATA_API_KEY is not configured.");
  return key;
}

function parseUtc(datetime: string): number {
  // Twelve Data returns "YYYY-MM-DD HH:mm:ss" (UTC when timezone=UTC is requested).
  const iso = datetime.includes("T") ? datetime : datetime.replace(" ", "T");
  return Date.parse(iso.endsWith("Z") ? iso : `${iso}Z`);
}

async function request(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("apikey", apiKey());
  const res = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, unknown>;
  if (json["status"] === "error" || json["code"] === 429) {
    throw new Error(String(json["message"] ?? "Twelve Data request rejected"));
  }
  return json;
}

/** Fetch a normalized, timeframe-aligned candle series. */
export async function fetchSeries(
  symbol: string,
  timeframe: TimeframeId,
  limit: number,
): Promise<{ candles: Candle[]; cached: boolean }> {
  const interval = INTERVAL[timeframe];
  const need = timeframe === "3m" ? Math.min(limit * 3 + 3, 5000) : limit;
  const key = `${symbol}:${interval}:${need}`;
  const hit = seriesCache.get(key);
  if (hit && Date.now() - hit.at < SERIES_TTL_MS) {
    return { candles: shape(hit.value, timeframe, limit), cached: true };
  }

  const json = (await request("/time_series", {
    symbol,
    interval,
    outputsize: String(need),
    timezone: "UTC",
    format: "JSON",
  })) as { values?: Array<Record<string, string>> };

  const digits = getAsset(symbol).digits;
  const rows = json.values ?? [];
  const raw: Candle[] = rows
    .map((v) => ({
      time: parseUtc(v["datetime"] ?? ""),
      open: round(Number(v["open"]), digits),
      high: round(Number(v["high"]), digits),
      low: round(Number(v["low"]), digits),
      close: round(Number(v["close"]), digits),
      ...(v["volume"] != null && v["volume"] !== "" ? { volume: Number(v["volume"]) } : {}),
      closed: true,
    }))
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close))
    .sort((a, b) => a.time - b.time);

  if (raw.length === 0) throw new Error(`No data returned for ${symbol} ${timeframe}`);
  seriesCache.set(key, { at: Date.now(), value: raw });
  return { candles: shape(raw, timeframe, limit), cached: false };
}

/** Aggregate to the requested timeframe and flag the still-forming candle. */
function shape(raw: Candle[], timeframe: TimeframeId, limit: number): Candle[] {
  const series = timeframe === "3m" ? aggregate(raw, "3m") : raw.map((c) => ({ ...c }));
  const currentOpen = alignToCandle(Date.now(), timeframe);
  for (const c of series) c.closed = c.time < currentOpen;
  return series.slice(-limit);
}

/** Latest traded price, used to keep the forming candle moving between series pulls. */
export async function fetchPrice(symbol: string): Promise<number | null> {
  const hit = priceCache.get(symbol);
  if (hit && Date.now() - hit.at < PRICE_TTL_MS) return hit.value;
  try {
    const json = (await request("/price", { symbol })) as { price?: string };
    const price = Number(json.price);
    if (!Number.isFinite(price)) return null;
    priceCache.set(symbol, { at: Date.now(), value: price });
    return price;
  } catch {
    return null;
  }
}

function round(v: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}
