import { createServerFn } from "@tanstack/react-start";

import type { SeriesResult } from "./market-data.functions";
import type { TimeframeId } from "./types";

/** Client-callable OTC RPC. Any feed credential stays server-side. */

export interface OtcFeedInfo {
  configured: boolean;
  brokerId: string | null;
  name: string;
  assets: { symbol: string; digits: number }[];
  message: string;
}

const TIMEFRAMES = new Set<string>(["1m", "3m", "5m"]);
const SYMBOL = /^[A-Z]{3}\/[A-Z]{3}$/;

const NOT_CONFIGURED =
  "OTC live integration requires an authorized broker feed/API. No authorized Pocket Option or Quotex feed is configured.";

export const getOtcFeedInfo = createServerFn({ method: "GET" }).handler(
  async (): Promise<OtcFeedInfo> => {
    const { readOtcConfig, fetchOtcAssets } = await import("./providers/otc-feed.server");
    const cfg = readOtcConfig();
    if (!cfg) {
      return {
        configured: false,
        brokerId: null,
        name: "OTC broker feed",
        assets: [],
        message: NOT_CONFIGURED,
      };
    }
    try {
      const { assets } = await fetchOtcAssets(cfg);
      return {
        configured: true,
        brokerId: cfg.brokerId,
        name: cfg.brokerName,
        assets,
        message:
          assets.length === 0 ? "Authorized OTC feed exposed no tradable assets." : "",
      };
    } catch (err) {
      return {
        configured: false,
        brokerId: cfg.brokerId,
        name: cfg.brokerName,
        assets: [],
        message: (err as Error).message,
      };
    }
  },
);

export const getOtcSeries = createServerFn({ method: "GET" })
  .inputValidator((input: { symbol: string; timeframe: TimeframeId; limit?: number }) => {
    if (typeof input?.symbol !== "string" || !SYMBOL.test(input.symbol)) {
      throw new Error("Invalid symbol");
    }
    if (!TIMEFRAMES.has(input.timeframe)) throw new Error("Invalid timeframe");
    const limit = Math.min(Math.max(Number(input.limit ?? 320), 50), 500);
    return { symbol: input.symbol, timeframe: input.timeframe, limit };
  })
  .handler(async ({ data }): Promise<SeriesResult> => {
    const { readOtcConfig, fetchOtcSeries } = await import("./providers/otc-feed.server");
    const cfg = readOtcConfig();
    if (!cfg) {
      return {
        ok: false,
        candles: [],
        status: {
          name: "OTC broker feed",
          connected: false,
          quality: "unavailable",
          lastUpdate: null,
          transport: "none",
          message: NOT_CONFIGURED,
        },
        error: NOT_CONFIGURED,
      };
    }
    try {
      const { candles, cached, brokerLastUpdate } = await fetchOtcSeries(
        cfg,
        data.symbol,
        data.timeframe,
        data.limit,
      );
      return {
        ok: true,
        candles,
        status: {
          name: cfg.brokerName,
          connected: true,
          quality: cached ? "delayed" : "live",
          lastUpdate: brokerLastUpdate ?? Date.now(),
          transport: "rest",
          ...(cached
            ? { message: "Served from a short-lived cache to respect the broker's rate limits." }
            : {}),
        },
      };
    } catch (err) {
      const message = (err as Error).message;
      return {
        ok: false,
        candles: [],
        status: {
          name: cfg.brokerName,
          connected: false,
          quality: "unavailable",
          lastUpdate: null,
          transport: "none",
          message,
        },
        error: message,
      };
    }
  });
