/**
 * Client-side analytics helpers. No PII. Gated on consent + DNT.
 * Events are POSTed to /api/blog-events via sendBeacon for reliability.
 */
import { hasAnalyticsConsent } from "./consent";
import type { Funnel } from "./posts";

const VISITOR_COOKIE = "ksa_vid";
const SESSION_KEY = "ksa_sid";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSec: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; samesite=lax`;
}

export function getVisitorId(): string {
  let id = readCookie(VISITOR_COOKIE);
  if (!id) {
    id = uuid();
    writeCookie(VISITOR_COOKIE, id, 60 * 60 * 24 * 365);
  }
  return id;
}

export function getSessionId(): string {
  if (typeof sessionStorage === "undefined") return uuid();
  const now = Date.now();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string; last: number };
      if (now - parsed.last < SESSION_TIMEOUT_MS) {
        parsed.last = now;
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(parsed));
        return parsed.id;
      }
    }
  } catch {
    /* rewrite below */
  }
  const fresh = { id: uuid(), last: now };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
  return fresh.id;
}

export interface EventContext {
  slug?: string;
  funnel?: Funnel;
  lang?: string;
}

export function sendEvent(
  eventName: string,
  ctx: EventContext,
  props: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;
  if (!hasAnalyticsConsent()) return;

  const payload = {
    event_name: eventName,
    slug: ctx.slug,
    funnel: ctx.funnel,
    lang: ctx.lang,
    props,
    session_id: getSessionId(),
    visitor_id: getVisitorId(),
    referrer: document.referrer || undefined,
  };

  const body = JSON.stringify(payload);
  const url = "/api/blog-events";

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
  } catch {
    /* fall through to fetch */
  }
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

/**
 * Append UTM parameters to an outbound CTA link.
 * Uses campaign override if present, else funnel id.
 */
export function buildCtaUrl(
  href: string,
  funnel: Funnel,
  slug: string,
  campaign?: string | null,
): string {
  try {
    const u = new URL(href, typeof window !== "undefined" ? window.location.origin : "https://blog.ksa.ee");
    const setIfAbsent = (k: string, v: string) => {
      if (!u.searchParams.has(k)) u.searchParams.set(k, v);
    };
    setIfAbsent("utm_source", "blog");
    setIfAbsent("utm_medium", "cta");
    setIfAbsent("utm_campaign", campaign && campaign.trim() ? campaign : funnel);
    setIfAbsent("utm_content", slug);
    return u.toString();
  } catch {
    return href;
  }
}
