import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getTenantIdBySlug } from "@/lib/db/tenant";

export const TENANT_HEADER = "x-tenant-id";

const publicApiPaths = ["/api/auth", "/api/health", "/api/inngest"];

function isPublicApiPath(pathname: string): boolean {
  return publicApiPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Checks if a value looks like a UUID (8-4-4-4-12 hex format)
 */
function isUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Extracts tenant ID from request and resolves slugs to UUIDs if needed.
 * Returns the resolved UUID, the original value if resolution fails, or undefined.
 */
async function extractTenantId(request: NextRequest): Promise<string | undefined> {
  const fromHeader = request.headers.get(TENANT_HEADER);
  const fromCookie = request.cookies.get("tenant-id")?.value;
  const fromQuery = request.nextUrl.searchParams.get("tenant_id");

  const rawTenantId = fromHeader || fromCookie || fromQuery || undefined;

  if (!rawTenantId) {
    return undefined;
  }

  // If it's already a UUID, return it as-is
  if (isUuid(rawTenantId)) {
    return rawTenantId;
  }

  // It's likely a slug, try to resolve it to a UUID
  try {
    const resolvedId = await getTenantIdBySlug(rawTenantId);
    // Return resolved UUID if found, otherwise fall back to original value
    return resolvedId || rawTenantId;
  } catch {
    // If resolution fails, fall back to the original value to maintain existing behavior
    return rawTenantId;
  }
}

export async function proxy(request: NextRequest) {
  const tenantId = await extractTenantId(request);
  const path = request.nextUrl.pathname;

  // Allow public paths without tenant
  if (path.startsWith("/api") && isPublicApiPath(path)) {
    return NextResponse.next();
  }

  // For API routes, require tenant
  if (!tenantId && path.startsWith("/api")) {
    return NextResponse.json(
      { error: "Tenant context missing. Provide x-tenant-id or tenant_id query param." },
      { status: 401 },
    );
  }

  // For dashboard routes without tenant, redirect to a tenant selection page
  // or let them through and handle it in the page
  if (!tenantId && path.startsWith("/(dashboard)")) {
    // For now, let it through - the page will handle missing tenant
    return NextResponse.next();
  }

  // If tenant_id came from query param, set a cookie for persistence
  const fromQuery = request.nextUrl.searchParams.get("tenant_id");
  const cookieNeedsUpdate = fromQuery && fromQuery !== request.cookies.get("tenant-id")?.value;

  if (!tenantId) {
    return NextResponse.next();
  }

  // Add tenant header to the request
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(TENANT_HEADER, tenantId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Set cookie if tenant_id came from query param (for persistence across navigations)
  if (cookieNeedsUpdate) {
    response.cookies.set("tenant-id", tenantId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      httpOnly: false, // Allow client-side access
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
