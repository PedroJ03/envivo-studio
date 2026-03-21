/**
 * POST /api/topics/discard - Discard a topic (soft delete)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { discardTopicSelection } from "@/lib/topics/queries";
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

const discardSchema = z.object({
  sourceType: z.enum(["calendar_event", "content_feed_item"]),
  sourceId: z.string().uuid(),
});

// Mock user ID for now - in production this would come from session
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function POST(request: NextRequest) {
  const tenantId = await resolveTenantId(request);

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context required" },
      { status: 401 },
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = discardSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid discard payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await discardTopicSelection(
      tenantId,
      MOCK_USER_ID,
      parsed.data.sourceType,
      parsed.data.sourceId,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST /api/topics/discard] failed:", error);
    return NextResponse.json(
      { error: "Failed to discard topic" },
      { status: 500 },
    );
  }
}
