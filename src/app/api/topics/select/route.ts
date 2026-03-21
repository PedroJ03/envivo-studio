/**
 * POST /api/topics/select - Create a new topic selection
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createTopicSelection } from "@/lib/topics/queries";
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

const formatSchema = z.object({
  type: z.enum(["post", "story", "reel"]),
  tone: z.enum(["informative", "opinion", "nostalgic", "humorous", "urgent"]),
  priority: z.number().min(1).max(3),
});

const selectSchema = z.object({
  sourceType: z.enum(["calendar_event", "content_feed_item"]),
  sourceId: z.string().uuid(),
  formats: z.array(formatSchema).min(1),
  targetPublishAt: z.string().datetime().optional(),
  urgency: z.enum(["low", "medium", "high", "breaking"]).optional(),
  metadata: z.record(z.unknown()).optional(),
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
  const parsed = selectSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid selection payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await createTopicSelection(
      tenantId,
      MOCK_USER_ID,
      parsed.data,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    if (error.message === "Topic already selected") {
      return NextResponse.json(
        { error: "Topic already selected" },
        { status: 409 },
      );
    }
    console.error("[POST /api/topics/select] failed:", error);
    return NextResponse.json(
      { error: "Failed to create selection" },
      { status: 500 },
    );
  }
}
