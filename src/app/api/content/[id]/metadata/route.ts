import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { TENANT_HEADER } from "@/proxy";
import { withTenantDb } from "@/lib/db/client";
import { candidateContent } from "@/lib/db/schema";

const updateContentSchema = z.object({
  sectionId: z.string().uuid().optional().nullable(),
  templateId: z.string().optional().nullable(),
  templateVariant: z.string().optional().nullable(),
});

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PUT(
  request: NextRequest,
  context: RouteContext,
): Promise<
  NextResponse<{ ok: boolean } | { error: string; details?: unknown }>
> {
  const { id } = await context.params;
  const tenantId = request.headers.get(TENANT_HEADER);

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required" },
      { status: 401 },
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = updateContentSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid update payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { sectionId, templateId, templateVariant } = parsed.data;

  try {
    await withTenantDb(tenantId, async (tx) => {
      const updateData: Record<string, unknown> = {};

      if (sectionId !== undefined) {
        updateData.sectionId = sectionId;
      }
      if (templateId !== undefined) {
        updateData.templateId = templateId;
      }
      if (templateVariant !== undefined) {
        updateData.templateVariant = templateVariant;
      }

      if (Object.keys(updateData).length === 0) {
        return;
      }

      await tx
        .update(candidateContent)
        .set(updateData)
        .where(eq(candidateContent.id, id));
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to update content:", error);
    return NextResponse.json(
      { error: "Failed to update content", details: `${error}` },
      { status: 500 },
    );
  }
}
