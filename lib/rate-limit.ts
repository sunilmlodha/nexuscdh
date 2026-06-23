/**
 * In-memory sliding-window rate limiter for the public API.
 *
 * Keyed by API key (or client IP for keyless same-origin calls). Process-local —
 * fine for a single Vercel lambda / demo; swap the Map for Upstash/Redis to make
 * it durable across instances. Returns standard rate-limit headers either way.
 */
const WINDOW_MS = 60_000;     // 1 minute
const DEFAULT_LIMIT = 120;    // requests per window per key

const hits = new Map<string, number[]>();

export interface RateResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;   // ms until the window resets
}

export function rateLimit(key: string, limit = DEFAULT_LIMIT, windowMs = WINDOW_MS): RateResult {
  const now = Date.now();
  const cutoff = now - windowMs;
  const arr = (hits.get(key) ?? []).filter((t) => t > cutoff);
  const allowed = arr.length < limit;
  if (allowed) arr.push(now);
  hits.set(key, arr);

  // opportunistic cleanup so the Map doesn't grow unbounded
  if (hits.size > 5000) {
    Array.from(hits.keys()).forEach((k) => {
      const v = hits.get(k);
      if (v && v.every((t: number) => t <= cutoff)) hits.delete(k);
    });
  }

  const oldest = arr[0] ?? now;
  return { allowed, limit, remaining: Math.max(0, limit - arr.length), resetMs: Math.max(0, oldest + windowMs - now) };
}

/** Build the standard headers for a rate-limit result. */
export function rateLimitHeaders(r: RateResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(r.limit),
    'X-RateLimit-Remaining': String(r.remaining),
    'X-RateLimit-Reset': String(Math.ceil(r.resetMs / 1000)),
    ...(r.allowed ? {} : { 'Retry-After': String(Math.ceil(r.resetMs / 1000)) }),
  };
}

/** Derive a stable limiter key from a request: API key if present, else client IP. */
export function rateKey(req: Request): string {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) return `k:${apiKey.substring(0, 16)}`;
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `ip:${fwd || req.headers.get('x-real-ip') || 'local'}`;
}
