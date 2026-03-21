/**
 * GET /api/topics/pending - Get pending topics from calendar_events and content_feed_items
 * that haven't been selected/discarded by the tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPendingTopics } from "@/lib/topics/queries";
import { TENANT_HEADER } from "@/proxy";
import { getTenantIdBySlug } from "@/lib/db/tenant";

/**
 * Resolves tenant ID from request.
 * Checks header first (x-tenant-id), then query param (tenant_id).
 * If the value is a slug (not UUID), resolves it to UUID via getTenantIdBySlug.
 */
async function resolveTenantId(request: NextRequest): Promise<string | null> {
  // Try header first
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

  // Try query param
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
  source: z.string().optional(),
  type: z.enum(["calendar_event", "content_feed_item", "all"]).default("all"),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
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
    source: url.searchParams.get("source") ?? undefined,
    type: url.searchParams.get("type") ?? "all",
    dateFrom: url.searchParams.get("date_from") ?? undefined,
    dateTo: url.searchParams.get("date_to") ?? undefined,
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
    const result = await getPendingTopics(tenantId, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/topics/pending] failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending topics" },
      { status: 500 },
    );
  }
}
