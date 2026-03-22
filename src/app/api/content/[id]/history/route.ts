import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";

import { TENANT_HEADER } from "@/proxy";
import { withTenantDb } from "@/lib/db/client";
import { contentStates } from "@/lib/db/schema";
import { tenantFilter } from "@/lib/db/tenant";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const tenantId = request.headers.get(TENANT_HEADER);

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    const history = await withTenantDb(tenantId, async (tx) => {
      const rows = await tx
        .select()
        .from(contentStates)
        .where(
          and(
            eq(contentStates.candidateContentId, id),
            tenantFilter(contentStates.tenantId),
          ),
        )
        .orderBy(desc(contentStates.createdAt));

      return rows.map((row) => ({
        id: row.id,
        state: row.state,
        actor: row.actor,
        rejectionReason: row.rejectionReason,
        createdAt: row.createdAt.toISOString(),
        metadataJson: row.metadataJson,
      }));
    });

    return NextResponse.json({ history });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load history", details: String(error) },
      { status: 502 },
    );
  }
}
