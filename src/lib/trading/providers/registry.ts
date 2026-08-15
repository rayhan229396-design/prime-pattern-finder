import { placeholderProvider } from "./placeholder-provider";
import type { BrokerAdapter, MarketDataProvider } from "./types";

/**
 * Provider registry.
 *
 * Real-market providers (Twelve Data etc.) are added in Phase 2 behind a
 * server-side API route so keys never reach the browser. Until an integration
 * exists and is verified, `implemented` stays false and the UI must not label
 * its output as live market data.
 */
export const REAL_PROVIDERS: MarketDataProvider[] = [placeholderProvider];

/**
 * OTC broker adapters (Phase 6). Intentionally EMPTY: no OTC broker feed has
 * been integrated or verified, so the UI shows "OTC data source unavailable"
 * rather than fabricating OTC prices. Add verified adapters here.
 */
export const OTC_BROKERS: BrokerAdapter[] = [];

export function activeRealProvider(): MarketDataProvider {
  return REAL_PROVIDERS.find((p) => p.implemented) ?? placeholderProvider;
}

export function hasVerifiedRealData(): boolean {
  return REAL_PROVIDERS.some((p) => p.implemented);
}

export function hasVerifiedOtcData(): boolean {
  return OTC_BROKERS.some((b) => b.implemented);
}
