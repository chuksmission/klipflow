import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only track public and dashboard pages, skip API, static, and admin
  const shouldTrack =
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next/") &&
    !pathname.startsWith("/admin") &&
    !pathname.includes(".") &&
    pathname !== "/favicon.ico";

  if (shouldTrack) {
    try {
      // Get visitor info from Vercel headers
      const country = req.headers.get("x-vercel-ip-country") || "";
      const countryCode = req.headers.get("x-vercel-ip-country") || "";
      const region = req.headers.get("x-vercel-ip-country-region") || "";
      const city = req.headers.get("x-vercel-ip-city") || "";
      const userAgent = req.headers.get("user-agent") || "";
      const referrer = req.headers.get("referer") || "";

      // Detect device type
      const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
      const isTablet = /ipad|tablet/i.test(userAgent);
      const device = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

      // Detect browser
      const browser =
        userAgent.includes("Chrome") ? "Chrome" :
        userAgent.includes("Firefox") ? "Firefox" :
        userAgent.includes("Safari") ? "Safari" :
        userAgent.includes("Edge") ? "Edge" : "Other";

      // Generate session ID from IP + user agent (simple fingerprint)
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const sessionSeed = ip + userAgent.slice(0, 50) + new Date().toDateString();
      const sessionId = Buffer.from(sessionSeed).toString("base64").slice(0, 32);

      // Fire and forget — don't await to avoid slowing down the response
      fetch(new URL("/api/track-visit", req.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          page: pathname,
          country: city ? city + ", " + country : country,
          country_code: countryCode,
          region,
          city,
          device,
          browser,
          referrer: referrer ? new URL(referrer).hostname : "",
        }),
      }).catch(() => {});
    } catch {
      // Never block the request due to tracking errors
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
