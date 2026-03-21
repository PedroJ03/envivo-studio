import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { TENANT_HEADER } from "@/proxy";
import { withTenantDb } from "@/lib/db/client";
import { sections } from "@/lib/db/schema";

export interface SectionResponse {
  id: string;
  slug: string;
  name: string;
  color: string;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<SectionResponse[] | { error: string }>> {
  const tenantId = request.headers.get(TENANT_HEADER);

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required" },
      { status: 401 },
    );
  }

  try {
    const sectionsList = await withTenantDb(tenantId, async (tx) => {
      return tx
        .select({
          id: sections.id,
          slug: sections.slug,
          name: sections.name,
          color: sections.color,
        })
        .from(sections)
        .where(eq(sections.tenantId, tenantId))
        .orderBy(sections.name);
    });

    return NextResponse.json(sectionsList as SectionResponse[], {
      status: 200,
    });
  } catch (error) {
    console.error("Failed to fetch sections:", error);
    return NextResponse.json(
      { error: "Failed to fetch sections" },
      { status: 500 },
    );
  }
}
