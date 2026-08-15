import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CandleEngine, alignToCandle, secondsToClose } from "@/lib/trading/candle-engine";
import { ASSETS, getAsset, getTimeframe } from "@/lib/trading/instruments";
import {
  generatePlaceholderSeries,
  placeholderStatus,
} from "@/lib/trading/providers/placeholder-provider";
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
  const usingPlaceholder = !realVerified;

  const dataAvailable = market === "REAL" ? true : otcAvailable;
  const unavailableReason =
    market === "OTC" && !otcAvailable
      ? "OTC data source unavailable — no verified broker feed is connected."
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
    return placeholderStatus(now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market, otcAvailable, Math.floor(now / 1000)]);

  /* Clock — 1s tick, drives Bangladesh time and the candle countdown. */
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* Load the series for the current selection and keep the forming candle live. */
  useEffect(() => {
    if (!dataAvailable) {
      setCandles([]);
      engineRef.current = null;
      return;
    }
    const seed = generatePlaceholderSeries(symbol, timeframe, HISTORY_LIMIT);
    const engine = new CandleEngine(timeframe, seed, HISTORY_LIMIT);
    engineRef.current = engine;
    lastClosedRef.current = alignToCandle(Date.now(), timeframe);
    setCandles([...engine.getCandles()]);
    setSignal(null);
    setSignalError(null);
  }, [symbol, timeframe, market, dataAvailable]);

  /* Placeholder tick feed: keeps the forming candle moving so the candle engine,
     countdown and candle-close pipeline can be exercised during UI development. */
  useEffect(() => {
    if (!dataAvailable) return;
    const digits = getAsset(symbol).digits;
    const id = setInterval(() => {
      const engine = engineRef.current;
      if (!engine) return;
      const current = engine.getCurrent();
      if (!current) return;
      const step = current.close * (getAsset(symbol).assetClass === "metal" ? 0.00012 : 0.00006);
      const price = Number((current.close + (Math.random() - 0.5) * step * 2).toFixed(digits));
      engine.addTick(price, Date.now());
      setCandles([...engine.getCandles()]);
    }, 1200);
    return () => clearInterval(id);
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

  /* Market scanner */
  const runScan = useCallback(async () => {
    if (!dataAvailable) {
      setOpportunities([]);
      return;
    }
    setScanning(true);
    const targets = ASSETS.flatMap((a) => SCAN_TIMEFRAMES.map((tf) => ({ symbol: a.symbol, timeframe: tf })));
    const { signals } = await scanMarkets(
      targets,
      async (sym, tf) => ({ candles: generatePlaceholderSeries(sym, tf, HISTORY_LIMIT) }),
      {
        market,
        sourceName: status.name,
        placeholder: status.quality === "placeholder",
        threshold,
        calibration: DEFAULT_MODEL,
        throttleMs: 0,
      },
    );
    setOpportunities(signals.slice(0, 12));
    setScanning(false);
  }, [dataAvailable, market, status.name, status.quality, threshold]);

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
