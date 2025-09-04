import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rate limiting storage (in production, use Redis or similar)
const rateLimit = new Map<string, { count: number; timestamp: number }>();

// Clean up old rate limit entries every 5 minutes
setInterval(
  () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [key, value] of rateLimit.entries()) {
      if (value.timestamp < fiveMinutesAgo) {
        rateLimit.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

function getRateLimitKey(request: NextRequest): string {
  // Use IP address + user agent for basic rate limiting
  const ip = request.ip || request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  return `${ip}-${userAgent.substring(0, 50)}`;
}

function isRateLimited(request: NextRequest): boolean {
  const key = getRateLimitKey(request);
  const now = Date.now();
  const windowMs = 5 * 60 * 1000; // 5 minutes
  const maxRequests = 100; // 100 requests per 5 minutes

  const current = rateLimit.get(key);

  if (!current || now - current.timestamp > windowMs) {
    // New window or expired
    rateLimit.set(key, { count: 1, timestamp: now });
    return false;
  }

  if (current.count >= maxRequests) {
    return true;
  }

  current.count++;
  return false;
}

function hasCSRFProtection(request: NextRequest): boolean {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return true;
  }

  // Check for CSRF token in header or form data
  const csrfToken = request.headers.get("x-csrf-token");
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Basic origin checking
  if (origin && host) {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  }

  return !!csrfToken;
}

export async function updateSession(request: NextRequest) {
  // Rate limiting check
  if (isRateLimited(request)) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: {
        "Retry-After": "300", // 5 minutes
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": (Date.now() + 5 * 60 * 1000).toString(),
      },
    });
  }

  // CSRF protection check
  if (!hasCSRFProtection(request)) {
    return new NextResponse("CSRF protection failed", {
      status: 403,
      headers: {
        "X-CSRF-Protection": "Required",
      },
    });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Enhanced auth check with admin route protection
  if (!user) {
    const isAuthRoute =
      request.nextUrl.pathname.startsWith("/login") ||
      request.nextUrl.pathname.startsWith("/register") ||
      request.nextUrl.pathname.startsWith("/auth");

    if (!isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  } else {
    // Check admin routes
    if (request.nextUrl.pathname.startsWith("/admin")) {
      // This will be handled by the component itself with proper role checking
      // Just ensure user is authenticated here
    }
  }

  // Add security headers
  supabaseResponse.headers.set("X-Frame-Options", "DENY");
  supabaseResponse.headers.set("X-Content-Type-Options", "nosniff");
  supabaseResponse.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );
  supabaseResponse.headers.set("X-XSS-Protection", "1; mode=block");

  return supabaseResponse;
}
