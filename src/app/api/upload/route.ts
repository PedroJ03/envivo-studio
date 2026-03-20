import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { withTenantDb } from "@/lib/db/client";
import { candidateContent, events, photos } from "@/lib/db/schema";
import { tenantFilter } from "@/lib/db/tenant";
import { TENANT_HEADER } from "@/middleware";

const uploadPayloadSchema = z.object({
  eventId: z.string().min(1),
  originalUrl: z.string().url(),
  storageKey: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

type UploadResponse = {
  photoId: string;
  candidateId: string;
};

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse | { error: string; details?: unknown }>> {
  const tenantId = request.headers.get(TENANT_HEADER);
  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required. Send x-tenant-id header or tenant_id query param." },
      { status: 401 },
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = uploadPayloadSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid upload payload",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const created = await withTenantDb(tenantId, async (tx) => {
      const [eventRecord] = await tx
        .select({
          id: events.id,
          sourceId: events.sourceId,
        })
        .from(events)
        .where(and(eq(events.id, parsed.data.eventId), tenantFilter(events.tenantId)));

      if (!eventRecord) {
        throw new Error(`Event ${parsed.data.eventId} not found for tenant.`);
      }

      const [photoRecord] = await tx
        .insert(photos)
        .values({
          tenantId,
          eventId: eventRecord.id,
          sourceId: eventRecord.sourceId,
          originalUrl: parsed.data.originalUrl,
          storageKey: parsed.data.storageKey,
          width: parsed.data.width,
          height: parsed.data.height,
          metadataJson: {
            uploadedAt: new Date().toISOString(),
            source: "manual-upload",
          },
        })
        .returning({ id: photos.id, width: photos.width, height: photos.height });

      const [candidateRecord] = await tx
        .insert(candidateContent)
        .values({
          tenantId,
          sourceId: eventRecord.sourceId,
          eventId: eventRecord.id,
          photoId: photoRecord.id,
          title: "Manual upload",
          summaryJson: {
            uploadedAt: new Date().toISOString(),
            eventId: eventRecord.id,
            originalUrl: parsed.data.originalUrl,
            width: photoRecord.width,
            height: photoRecord.height,
          },
          selectedFormat: "post",
        })
        .returning({ id: candidateContent.id });

      return {
        photoId: photoRecord.id,
        candidateId: candidateRecord.id,
      };
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to persist upload candidate",
        details: `${error}`,
      },
      { status: 502 },
    );
  }
}
