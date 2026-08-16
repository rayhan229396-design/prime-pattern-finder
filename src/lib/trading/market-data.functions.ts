import { createServerFn } from "@tanstack/react-start";

import type { Candle, DataSourceStatus, TimeframeId } from "./types";

/** Client-callable market data RPC. The provider key stays on the server. */

export interface SeriesResult {
  ok: boolean;
  candles: Candle[];
  status: DataSourceStatus;
  error?: string;
}

const TIMEFRAMES = new Set<string>(["1m", "3m", "5m"]);

export const getMarketSeries = createServerFn({ method: "GET" })
  .inputValidator((input: { symbol: string; timeframe: TimeframeId; limit?: number }) => {
    if (typeof input?.symbol !== "string" || !/^[A-Z]{3}\/[A-Z]{3}$/.test(input.symbol)) {
      throw new Error("Invalid symbol");
    }
    if (!TIMEFRAMES.has(input.timeframe)) throw new Error("Invalid timeframe");
    const limit = Math.min(Math.max(Number(input.limit ?? 320), 50), 500);
    return { symbol: input.symbol, timeframe: input.timeframe, limit };
  })
  .handler(async ({ data }): Promise<SeriesResult> => {
    const { fetchSeries } = await import("./providers/twelve-data.server");
    const name = "Twelve Data (real market)";
    try {
      const { candles, cached } = await fetchSeries(data.symbol, data.timeframe, data.limit);
      const last = candles[candles.length - 1];
      return {
        ok: true,
        candles,
        status: {
          name,
          connected: true,
          quality: cached ? "delayed" : "live",
          lastUpdate: last ? Date.now() : null,
          transport: "rest",
          ...(cached ? { message: "Served from short-lived cache to respect provider rate limits." } : {}),
        },
      };
    } catch (err) {
      const message = (err as Error).message;
      return {
        ok: false,
        candles: [],
        status: {
          name,
          connected: false,
          quality: "unavailable",
          lastUpdate: null,
          transport: "rest",
          message,
        },
        error: message,
      };
    }
  });

export const getMarketPrice = createServerFn({ method: "GET" })
  .inputValidator((input: { symbol: string }) => {
    if (typeof input?.symbol !== "string" || !/^[A-Z]{3}\/[A-Z]{3}$/.test(input.symbol)) {
      throw new Error("Invalid symbol");
    }
    return { symbol: input.symbol };
  })
  .handler(async ({ data }): Promise<{ price: number | null }> => {
    const { fetchPrice } = await import("./providers/twelve-data.server");
    return { price: await fetchPrice(data.symbol) };
  });
