import { NextResponse, type NextRequest } from 'next/server';

/**
 * Blanket authn gate. When ENFORCE_AUTH=true, any mutating request (POST/PUT/
 * PATCH/DELETE) to /api/* must carry a Supabase auth cookie — a coarse gate that
 * covers every route at once. Endpoints with their own auth (decide API key,
 * Pega V1/V4 contracts, inbound webhooks, the journey cron) are allow-listed.
 * Real verification + RBAC happens in-route via requireAuth().
 *
 * ENFORCE_AUTH off (demo) → pass through.
 */
const ENFORCE_AUTH = process.env.ENFORCE_AUTH === 'true';
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const PUBLIC_PREFIXES = [
  '/api/decide',          // X-API-Key / same-origin
  '/api/v1', '/api/v4',   // Pega-compatible contracts (own auth)
  '/api/webhooks',        // inbound, signed with WEBHOOK_SECRET
  '/api/journeys/tick',   // cron, CRON_SECRET
  '/api/me',              // session probe
  '/api/ping',
];

export function middleware(req: NextRequest) {
  if (!ENFORCE_AUTH) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (!pathname.startsWith('/api/') || !MUTATING.has(req.method)) return NextResponse.next();
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) return NextResponse.next();

  const hasSession = req.cookies.getAll().some(c => c.name.startsWith('sb-') && c.name.includes('auth-token'));
  if (!hasSession) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = { matcher: ['/api/:path*'] };
