/** All display time is Asia/Dhaka (BST, UTC+6); internals stay UTC epoch ms. */

export const DHAKA_TZ = "Asia/Dhaka";

const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: DHAKA_TZ,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const hmFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: DHAKA_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: DHAKA_TZ,
  weekday: "short",
  day: "2-digit",
  month: "short",
});

export function dhakaClock(ms: number): string {
  return timeFmt.format(new Date(ms));
}

export function dhakaHM(ms: number): string {
  return hmFmt.format(new Date(ms));
}

export function dhakaDate(ms: number): string {
  return dateFmt.format(new Date(ms));
}

export function freshnessLabel(lastUpdate: number | null, nowMs: number): string {
  if (lastUpdate == null) return "No data";
  const s = Math.max(0, Math.floor((nowMs - lastUpdate) / 1000));
  if (s <= 1) return "Updated just now";
  if (s < 60) return `Updated ${s} sec ago`;
  const m = Math.floor(s / 60);
  return `Updated ${m} min ago`;
}

/** Forex/metals session window: Sunday 21:00 UTC to Friday 21:00 UTC. */
export function forexMarketOpen(nowMs: number): boolean {
  const d = new Date(nowMs);
  const day = d.getUTCDay();
  const hour = d.getUTCHours();
  if (day === 6) return false;
  if (day === 0) return hour >= 21;
  if (day === 5) return hour < 21;
  return true;
}
