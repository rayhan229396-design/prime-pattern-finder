/**
 * OTC MARKET DATA ACCESS — INVESTIGATION RESULT (documented, code-visible).
 *
 * Findings for the two requested brokers, as of the current investigation:
 *
 * Pocket Option
 *  - No official public market-data API. No developer portal, no documented
 *    REST/WebSocket product, no partner data endpoint for OTC quotes.
 *  - Every existing "Pocket Option API" is an unofficial community project that
 *    connects to the platform's private WebSocket by extracting the logged-in
 *    user's `SSID` session cookie from the browser. That is session-token
 *    extraction against a private endpoint — explicitly out of bounds here.
 *
 * Quotex
 *  - No official public API either. Community libraries (pyquotex and friends)
 *    log in with email/password or a stolen SSID and speak the internal
 *    WebSocket protocol of the web terminal.
 *  - Also out of bounds: it needs credential replay / private-protocol
 *    reverse engineering and defeats the platform's own access controls.
 *
 * Neither broker publishes an authorized browser-accessible feed, an official
 * extension API, or a documented integration partner program for quote data.
 * Their OTC prices are broker-internal synthetic instruments, so no third-party
 * market-data vendor (Twelve Data included) can supply them either.
 *
 * Consequence: this app ships an OTC ADAPTER with no built-in broker
 * credentials. It only streams OTC data when the operator points it at an
 * authorized feed they are entitled to use (broker partner/institutional API,
 * or a broker-approved bridge). Until then OTC is reported as
 * "requires an authorized broker feed" — never simulated and never labelled live.
 */

export interface BrokerAccessReport {
  brokerId: string;
  name: string;
  officialApi: boolean;
  officialWebsocket: boolean;
  documentedIntegration: boolean;
  authorizedBrowserFeed: boolean;
  /** What is technically missing to make a legitimate feed possible. */
  missing: string[];
  notes: string;
}

export const OTC_ACCESS_REPORTS: BrokerAccessReport[] = [
  {
    brokerId: "pocket-option",
    name: "Pocket Option",
    officialApi: false,
    officialWebsocket: false,
    documentedIntegration: false,
    authorizedBrowserFeed: false,
    missing: [
      "A broker-issued API key / data entitlement for OTC quotes",
      "A documented REST or WebSocket quote endpoint (host, protocol, symbol list)",
      "Written authorization to relay OTC quotes into a third-party terminal",
    ],
    notes:
      "Only unofficial clients exist; they require extracting the SSID session cookie and speaking a private WebSocket protocol.",
  },
  {
    brokerId: "quotex",
    name: "Quotex",
    officialApi: false,
    officialWebsocket: false,
    documentedIntegration: false,
    authorizedBrowserFeed: false,
    missing: [
      "A broker-issued API key / data entitlement for OTC quotes",
      "A documented quote endpoint with a supported authentication scheme",
      "Written authorization to relay OTC quotes into a third-party terminal",
    ],
    notes:
      "Community libraries authenticate with user credentials or a stolen session id against the internal web-terminal socket.",
  },
];

/**
 * Contract an authorized OTC feed must expose for this adapter to consume it.
 * Configure with the server-side secrets OTC_FEED_URL, OTC_FEED_TOKEN and
 * OTC_FEED_BROKER (pocket-option | quotex | other label).
 */
export const OTC_FEED_CONTRACT = {
  assets: "GET {OTC_FEED_URL}/assets -> { assets: [{ symbol: 'EUR/USD', digits?: 5 }] }",
  candles:
    "GET {OTC_FEED_URL}/candles?symbol=EUR/USD&interval=1m&limit=320 -> { candles: [{ time, open, high, low, close, volume? }] }",
  auth: "Authorization: Bearer {OTC_FEED_TOKEN}",
} as const;
