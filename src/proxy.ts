import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { resolveTenant } from "./lib/tenant-resolver";

const ORG_ID_HEADER = "x-org-id";
const ORG_ID_PROXY_MARKER_HEADER = "x-org-id-proxy";

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

const GLOBAL_API_PREFIXES = [
  "/api/auth",
  "/api/diagnostics",
  "/api/health",
  "/api/webhook",
  "/api/webhooks",
  "/api/post-signin",
] as const;

function isGlobalApiRoute(pathname: string): boolean {
  return GLOBAL_API_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

function requiresOrgContext(pathname: string): boolean {
  return (
    matchesPrefix(pathname, "/dashboard") ||
    matchesPrefix(pathname, "/chat") ||
    (matchesPrefix(pathname, "/api") && !isGlobalApiRoute(pathname))
  );
}

function requiresSession(pathname: string): boolean {
  return (
    matchesPrefix(pathname, "/dashboard") ||
    matchesPrefix(pathname, "/chat") ||
    matchesPrefix(pathname, "/profile")
  );
}

/**
 * Next.js 16 proxy that performs the same guard logic as the legacy middleware.
 * It keeps the optimistic session redirect while also resolving org context.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const needsSession = requiresSession(pathname);
  const needsOrg = requiresOrgContext(pathname);

  // Never trust client-supplied org context headers.
  // We strip them and (if applicable) re-inject trusted values after resolution.
  const sanitizedHeaders = new Headers(request.headers);
  sanitizedHeaders.delete(ORG_ID_HEADER);
  sanitizedHeaders.delete(ORG_ID_PROXY_MARKER_HEADER);

  if (needsSession) {
    const sessionCookie = getSessionCookie(request);
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  if (!needsOrg) {
    return NextResponse.next({
      request: { headers: sanitizedHeaders },
    });
  }

  const orgId = await resolveTenant(request, sanitizedHeaders);

  if (!orgId) {
    if (matchesPrefix(pathname, "/api")) {
      return NextResponse.json(
        { error: "Organization context required" },
        { status: 400 }
      );
    }

    return NextResponse.redirect(new URL("/", request.url));
  }

  // Forward resolved org context as REQUEST headers (not response headers).
  sanitizedHeaders.set(ORG_ID_HEADER, orgId);
  sanitizedHeaders.set(ORG_ID_PROXY_MARKER_HEADER, "1");

  return NextResponse.next({
    request: { headers: sanitizedHeaders },
  });
}

export const config = {
  matcher: [
    "/api/:path*",
    "/dashboard/:path*",
    "/chat/:path*",
    "/profile/:path*",
  ],
};
