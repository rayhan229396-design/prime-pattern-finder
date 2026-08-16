import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CandleEngine, alignToCandle, secondsToClose } from "@/lib/trading/candle-engine";
import { ASSETS, getAsset, getTimeframe } from "@/lib/trading/instruments";
import { getMarketPrice, getMarketSeries } from "@/lib/trading/market-data.functions";
import { OTC_BROKERS, hasVerifiedOtcData, hasVerifiedRealData } from "@/lib/trading/providers/registry";
import { scanMarkets } from "@/lib/trading/scanner";
import { analyze, evaluateSignal } from "@/lib/trading/signal-engine";
import { DEFAULT_MODEL } from "@/lib/trading/calibration";
import { forexMarketOpen } from "@/lib/trading/time";
import type {
  Candle,
  DataSourceStatus,
  MarketType,
  Signal,
  TimeframeId,
} from "@/lib/trading/types";

const HISTORY_LIMIT = 320;
const SCAN_TIMEFRAMES: TimeframeId[] = ["1m", "3m", "5m"];
/** Free-tier provider limits: only a few targets per scan cycle. */
const SCAN_BATCH = 3;
const SERIES_REFRESH_MS = 20_000;
const PRICE_POLL_MS = 8_000;


export interface TerminalState {
  market: MarketType;
  symbol: string;
  timeframe: TimeframeId;
  brokerId: string | null;
  now: number;
  candles: Candle[];
  status: DataSourceStatus;
  dataAvailable: boolean;
  unavailableReason: string | null;
  signal: Signal | null;
  signalError: string | null;
  generating: boolean;
  history: Signal[];
  opportunities: Signal[];
  scanning: boolean;
  threshold: number;
  marketOpen: boolean;
  usingPlaceholder: boolean;
}

export function useTerminal() {
  const [market, setMarket] = useState<MarketType>("REAL");
  const [symbol, setSymbol] = useState("EUR/USD");
  const [timeframe, setTimeframe] = useState<TimeframeId>("5m");
  const [brokerId, setBrokerId] = useState<string | null>(null);
  // Starts at 0 so SSR and first client render match; set on mount.
  const [now, setNow] = useState(0);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [signalError, setSignalError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<Signal[]>([]);
  const [opportunities, setOpportunities] = useState<Signal[]>([]);
  const [scanning, setScanning] = useState(false);
  const [threshold, setThreshold] = useState(70);

  const engineRef = useRef<CandleEngine | null>(null);
  const lastClosedRef = useRef<number>(0);

  const otcAvailable = hasVerifiedOtcData();
  const realVerified = hasVerifiedRealData();
  const usingPlaceholder = false;

  const [feedStatus, setFeedStatus] = useState<DataSourceStatus>({
    name: "Twelve Data (real market)",
    connected: false,
    quality: "delayed",
    lastUpdate: null,
    transport: "rest",
    message: "Connecting to market data…",
  });

  const dataAvailable = market === "REAL" ? realVerified : otcAvailable;
  const unavailableReason =
    market === "OTC" && !otcAvailable
      ? "OTC data source unavailable — no verified broker feed is connected."
      : market === "REAL" && !realVerified
        ? "Real market data source unavailable."
        : null;

  const status: DataSourceStatus = useMemo(() => {
    if (market === "OTC" && !otcAvailable) {
      return {
        name: "OTC broker feed",
        connected: false,
        quality: "unavailable",
        lastUpdate: null,
        transport: "none",
        message: "No verified OTC broker adapter registered.",
      };
    }
    return feedStatus;
  }, [market, otcAvailable, feedStatus]);

  /* Clock — 1s tick, drives Bangladesh time and the candle countdown. */
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* Load the real series for the current selection and keep it refreshed. */
  useEffect(() => {
    if (!dataAvailable) {
      setCandles([]);
      engineRef.current = null;
      return;
    }
    let cancelled = false;

    const load = async (seed: boolean) => {
      try {
        const res = await getMarketSeries({
          data: { symbol, timeframe, limit: HISTORY_LIMIT },
        });
        if (cancelled) return;
        setFeedStatus(res.status);
        if (!res.ok || res.candles.length === 0) {
          if (seed) {
            engineRef.current = null;
            setCandles([]);
          }
          setSignalError(res.error ?? "Market data unavailable.");
          return;
        }
        const engine = new CandleEngine(timeframe, res.candles, HISTORY_LIMIT);
        engineRef.current = engine;
        lastClosedRef.current = alignToCandle(Date.now(), timeframe);
        setCandles([...engine.getCandles()]);
        setSignalError(null);
      } catch (err) {
        if (cancelled) return;
        setSignalError((err as Error).message);
      }
    };

    setSignal(null);
    void load(true);
    const id = setInterval(() => void load(false), SERIES_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, timeframe, market, dataAvailable]);

  /* Live price polling keeps the forming candle moving between series refreshes. */
  useEffect(() => {
    if (!dataAvailable) return;
    let cancelled = false;
    const digits = getAsset(symbol).digits;
    const tick = async () => {
      try {
        const { price } = await getMarketPrice({ data: { symbol } });
        if (cancelled || price == null) return;
        const engine = engineRef.current;
        if (!engine) return;
        engine.addTick(Number(price.toFixed(digits)), Date.now());
        setCandles([...engine.getCandles()]);
        setFeedStatus((prev) => ({ ...prev, connected: true, quality: "live", lastUpdate: Date.now() }));
      } catch {
        /* transient provider error — the next poll retries */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), PRICE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [symbol, timeframe, dataAvailable]);


  const runAnalysis = useCallback(
    (source: "manual" | "auto") => {
      const engine = engineRef.current;
      if (!dataAvailable || !engine) {
        setSignalError(unavailableReason ?? "Market data unavailable.");
        setSignal(null);
        return;
      }
      const closed = engine.getClosedCandles();
      const result = analyze({
        symbol,
        market,
        timeframe,
        candles: closed,
        sourceName: status.name,
        placeholder: status.quality === "placeholder",
        calibration: DEFAULT_MODEL,
      });
      if (!result.ok) {
        setSignalError(result.reason);
        setSignal(null);
        return;
      }
      setSignalError(null);
      setSignal(result.signal);
      if (result.signal.direction !== "WAIT" || source === "manual") {
        setHistory((prev) =>
          prev.some((s) => s.id === result.signal.id) ? prev : [result.signal, ...prev].slice(0, 40),
        );
      }
    },
    [dataAvailable, market, status.name, status.quality, symbol, timeframe, unavailableReason],
  );

  const generateSignal = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      runAnalysis("manual");
      setGenerating(false);
    }, 420);
  }, [runAnalysis]);

  /* Candle close -> analyze closed candle -> signal for the NEXT candle. */
  useEffect(() => {
    if (!dataAvailable) return;
    if (now === 0) return;
    const currentOpen = alignToCandle(now, timeframe);
    if (currentOpen > lastClosedRef.current) {
      lastClosedRef.current = currentOpen;
      runAnalysis("auto");
    }
  }, [now, timeframe, dataAvailable, runAnalysis]);

  /* Settle results only after the targeted candle has actually closed. */
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const closed = engine.getClosedCandles();
    setHistory((prev) => {
      let changed = false;
      const next = prev.map((s) => {
        if (s.result && s.result !== "PENDING") return s;
        if (s.symbol !== symbol || s.timeframe !== timeframe) return s;
        const target = closed.find((c) => c.time === s.targetCandleTime);
        if (!target) return s;
        const outcome = evaluateSignal(s, target);
        if (outcome === "PENDING") return s;
        changed = true;
        return { ...s, result: outcome };
      });
      return changed ? next : prev;
    });
  }, [candles, symbol, timeframe]);

  /* Market scanner — rotates through a small batch each cycle to stay inside
     the provider's request budget; results accumulate and refresh over time. */
  const scanCursor = useRef(0);
  const runScan = useCallback(async () => {
    if (!dataAvailable) {
      setOpportunities([]);
      return;
    }
    setScanning(true);
    const all = ASSETS.flatMap((a) => SCAN_TIMEFRAMES.map((tf) => ({ symbol: a.symbol, timeframe: tf })));
    const start = scanCursor.current % all.length;
    const targets = Array.from({ length: SCAN_BATCH }, (_, i) => all[(start + i) % all.length]!);
    scanCursor.current = start + SCAN_BATCH;

    const { signals } = await scanMarkets(
      targets,
      async (sym, tf) => {
        const res = await getMarketSeries({ data: { symbol: sym, timeframe: tf, limit: 200 } });
        return res.ok ? { candles: res.candles } : null;
      },
      {
        market,
        sourceName: status.name,
        placeholder: false,
        threshold,
        calibration: DEFAULT_MODEL,
        throttleMs: 250,
      },
    );
    setOpportunities((prev) => {
      const merged = [
        ...signals,
        ...prev.filter(
          (p) => !targets.some((t) => t.symbol === p.symbol && t.timeframe === p.timeframe),
        ),
      ];
      return merged
        .filter((s) => s.probability >= threshold)
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 12);
    });
    setScanning(false);
  }, [dataAvailable, market, status.name, threshold]);

  useEffect(() => {
    void runScan();
    const id = setInterval(() => void runScan(), 60_000);
    return () => clearInterval(id);
  }, [runScan]);


  const countdown = now === 0 ? 0 : secondsToClose(now, timeframe);
  const marketOpen = forexMarketOpen(now);

  return {
    state: {
      market,
      symbol,
      timeframe,
      brokerId,
      now,
      candles,
      status,
      dataAvailable,
      unavailableReason,
      signal,
      signalError,
      generating,
      history,
      opportunities,
      scanning,
      threshold,
      marketOpen,
      usingPlaceholder,
    } satisfies TerminalState,
    countdown,
    candleSeconds: getTimeframe(timeframe).seconds,
    brokers: OTC_BROKERS,
    actions: {
      setMarket,
      setSymbol,
      setTimeframe,
      setBrokerId,
      setThreshold,
      generateSignal,
      runScan,
      selectOpportunity: (s: Signal) => {
        setMarket(s.market);
        setSymbol(s.symbol);
        setTimeframe(s.timeframe);
      },
    },
  };
}
