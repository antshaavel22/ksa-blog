/**
 * First-party cookie consent.
 * Stored as JSON in cookie `ksa_consent`, 365 days.
 * Shape: { a: boolean, m: boolean, ts: number }
 *   a = analytics (blog_events + GTM + GA4)
 *   m = marketing (Meta pixel, etc.)
 */

export interface ConsentState {
  a: boolean;
  m: boolean;
  ts: number;
}

export const CONSENT_COOKIE = "ksa_consent";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function readConsent(): ConsentState | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match.split("=")[1]);
    const parsed = JSON.parse(raw);
    if (typeof parsed.a === "boolean" && typeof parsed.m === "boolean") {
      return parsed as ConsentState;
    }
  } catch {
    /* fall through */
  }
  return null;
}

export function writeConsent(state: Omit<ConsentState, "ts">): ConsentState {
  const full: ConsentState = { ...state, ts: Date.now() };
  document.cookie =
    `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(full))}; ` +
    `path=/; max-age=${ONE_YEAR}; samesite=lax`;
  return full;
}

export function isDNT(): boolean {
  if (typeof navigator === "undefined") return false;
  const dnt =
    navigator.doNotTrack ||
    (window as unknown as { doNotTrack?: string }).doNotTrack ||
    (navigator as unknown as { msDoNotTrack?: string }).msDoNotTrack;
  return dnt === "1" || dnt === "yes";
}

export function hasAnalyticsConsent(): boolean {
  if (isDNT()) return false;
  const c = readConsent();
  return !!c?.a;
}

export function hasMarketingConsent(): boolean {
  if (isDNT()) return false;
  const c = readConsent();
  return !!c?.m;
}
