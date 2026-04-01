import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ─── Upstash Redis Rate Limiting ─────────────────────────────────────────────
// Requires env vars: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
// Set these in Vercel dashboard → Project → Settings → Environment Variables
// Get them from: https://console.upstash.com

const isUpstashConfigured =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;

// Only initialise Redis clients if credentials are present
const redis = isUpstashConfigured
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Auth routes: 5 requests per 10s — prevents OTP brute-force / credential stuffing
const authRatelimit =
  redis &&
  new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '10 s'),
    prefix: 'rl_auth',
    analytics: false,
  });

// Chat API: 20 requests per 60s — aligns with the existing in-app limit
const chatRatelimit =
  redis &&
  new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '60 s'),
    prefix: 'rl_chat',
    analytics: false,
  });

// All other API routes: 60 requests per 60s — general DoS protection
const apiRatelimit =
  redis &&
  new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '60 s'),
    prefix: 'rl_api',
    analytics: false,
  });

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  // Skip rate limiting when Upstash is not configured (e.g. local dev without Redis)
  if (!redis) {
    return NextResponse.next();
  }

  // Vercel forwards the real IP via x-forwarded-for
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  const pathname = request.nextUrl.pathname;

  // Skip rate limiting for admin routes (already authenticated by admin key),
  // crisis endpoints, conversation reads, and user profile fetches
  // These are all read-heavy, high-frequency polling routes
  if (
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/crisis') ||
    pathname.startsWith('/api/conversations') ||
    pathname.startsWith('/api/users')
  ) {
    return NextResponse.next();
  }

  // Pick the right bucket based on the route
  let ratelimit: typeof authRatelimit;
  if (pathname.startsWith('/api/auth')) {
    ratelimit = authRatelimit;
  } else if (pathname.startsWith('/api/chat')) {
    ratelimit = chatRatelimit;
  } else {
    ratelimit = apiRatelimit;
  }

  if (!ratelimit) return NextResponse.next();

  const { success, limit, reset, remaining } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return NextResponse.next();
}

// Only run on API routes — static assets and pages are unaffected
export const config = {
  matcher: ['/api/:path*'],
};
