import { NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const shouldTrack =
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/_next/") &&
    !pathname.startsWith("/admin") &&
    !pathname.includes(".") &&
    pathname !== "/favicon.ico";

  if (shouldTrack) {
    try {
      const country = req.headers.get("x-vercel-ip-country") || "";
      const region = req.headers.get("x-vercel-ip-country-region") || "";
      const city = req.headers.get("x-vercel-ip-city") || "";
      const userAgent = req.headers.get("user-agent") || "";
      const referrer = req.headers.get("referer") || "";

      const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
      const isTablet = /ipad|tablet/i.test(userAgent);
      const device = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

      const browser =
        userAgent.includes("Chrome") ? "Chrome" :
        userAgent.includes("Firefox") ? "Firefox" :
        userAgent.includes("Safari") ? "Safari" :
        userAgent.includes("Edge") ? "Edge" : "Other";

      const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || req.headers.get("x-real-ip") || "unknown";
      // Simple session ID without Buffer (Edge compatible)
      const sessionSeed = ip + "-" + userAgent.slice(0, 30) + "-" + new Date().toDateString();
      const sessionId = sessionSeed.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0).toString(36) + sessionSeed.length.toString(36);

      let referrerHost = "";
      try { referrerHost = referrer ? new URL(referrer).hostname : ""; } catch { referrerHost = ""; }

      const baseUrl = req.nextUrl.origin;
      fetch(`${baseUrl}/api/track-visit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          page: pathname,
          country: city ? city + ", " + country : country,
          country_code: country,
          region,
          city,
          device,
          browser,
          referrer: referrerHost,
        }),
      }).catch(() => {});
    } catch {
      // Never block request due to tracking errors
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};