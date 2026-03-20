import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth";
import type { Session } from "next-auth";

export const TENANT_HEADER = "x-tenant-id";

const publicApiPaths = ["/api/auth", "/api/health", "/api/inngest"];

function isPublicApiPath(pathname: string): boolean {
  return publicApiPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function extractTenantId(request: NextRequest): string | undefined {
  const fromHeader = request.headers.get(TENANT_HEADER);
  const fromCookie = request.cookies.get("tenant-id")?.value;
  const fromQuery = request.nextUrl.searchParams.get("tenant_id");

  return fromHeader || fromCookie || fromQuery || undefined;
}

export async function middleware(request: NextRequest) {
  const session = (await auth()) as (Session & { user?: { tenantId?: string } }) | null;
  const sessionTenant = (session?.user as { tenantId?: string } | undefined)?.tenantId;
  const tenantId = extractTenantId(request) || sessionTenant;
  const path = request.nextUrl.pathname;

  if (!tenantId && path.startsWith("/api") && !isPublicApiPath(path)) {
    return NextResponse.json(
      { error: "Tenant context missing. Provide x-tenant-id or tenant_id query param." },
      { status: 401 },
    );
  }

  if (!tenantId) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(TENANT_HEADER, tenantId);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    {
      source: "/(.*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
