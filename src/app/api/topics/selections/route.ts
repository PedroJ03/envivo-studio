/**
 * GET /api/topics/selections - List existing topic selections for the tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getTopicSelections } from "@/lib/topics/queries";
import { TENANT_HEADER } from "@/proxy";
import { getTenantIdBySlug } from "@/lib/db/tenant";

/**
 * Resolves tenant ID from request.
 * Checks header first (x-tenant-id), then query param (tenant_id).
 * If the value is a slug (not UUID), resolves it to UUID via getTenantIdBySlug.
 */
async function resolveTenantId(request: NextRequest): Promise<string | null> {
  const headerTenant = request.headers.get(TENANT_HEADER);
  if (headerTenant) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        headerTenant,
      );
    if (isUuid) {
      return headerTenant;
    }
    return await getTenantIdBySlug(headerTenant);
  }

  const url = new URL(request.url);
  const queryTenant = url.searchParams.get("tenant_id");
  if (!queryTenant) {
    return null;
  }

  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      queryTenant,
    );

  if (isUuid) {
    return queryTenant;
  }

  return await getTenantIdBySlug(queryTenant);
}

const querySchema = z.object({
  status: z.enum(["pending", "generating", "ready", "discarded"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export async function GET(request: NextRequest) {
  const tenantId = await resolveTenantId(request);

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context required" },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    page: url.searchParams.get("page") ?? 1,
    limit: url.searchParams.get("limit") ?? 20,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await getTopicSelections(
      tenantId,
      parsed.data.status,
      parsed.data.page,
      parsed.data.limit,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/topics/selections] failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch selections" },
      { status: 500 },
    );
  }
}
