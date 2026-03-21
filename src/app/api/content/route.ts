import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { TENANT_HEADER } from "@/proxy";
import { withTenantDb } from "@/lib/db/client";
import {
  createContentCandidate,
  listContentCandidates,
} from "@/lib/pipeline/store";

const createContentPayloadSchema = z.object({
  sourceId: z.string().uuid(),
  eventId: z.string().uuid().optional(),
  photoId: z.string().uuid().optional(),
  title: z.string().min(1),
  summaryJson: z.record(z.string(), z.unknown()).default({}),
  selectedFormat: z.enum(["post", "story", "carousel"]),
  selectedTone: z.string().optional(),
  actor: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const tenantId = request.headers.get(TENANT_HEADER);

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required. Send x-tenant-id header or tenant_id query param." },
      { status: 401 },
    );
  }

  const content = await withTenantDb(tenantId, (tx) => listContentCandidates(tx, tenantId));

  return NextResponse.json(content);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const tenantId = request.headers.get(TENANT_HEADER);

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required. Send x-tenant-id header or tenant_id query param." },
      { status: 401 },
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = createContentPayloadSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid content creation payload",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const created = await withTenantDb(tenantId, (tx) =>
      createContentCandidate(tx, tenantId, {
        sourceId: parsed.data.sourceId,
        eventId: parsed.data.eventId ?? undefined,
        photoId: parsed.data.photoId ?? undefined,
        title: parsed.data.title,
        summaryJson: parsed.data.summaryJson,
        selectedFormat: parsed.data.selectedFormat,
        selectedTone: parsed.data.selectedTone,
        actor: parsed.data.actor,
      }),
    );

    return NextResponse.json({ ...created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create content candidate",
        details: `${error}`,
      },
      { status: 502 },
    );
  }
}
