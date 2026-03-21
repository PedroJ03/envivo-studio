import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { TENANT_HEADER } from "@/proxy";
import { inngestClient } from "@/inngest/client";

const scrapeEventBodySchema = z.object({
  sourceUrl: z.string().url().optional(),
});

type RouteContext = {
  params: {
    id: string;
  };
};

export async function POST(request: NextRequest, context: RouteContext) {
  const tenantId = request.headers.get(TENANT_HEADER);

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required. Send x-tenant-id header or tenant_id query param." },
      { status: 401 },
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsedBody = scrapeEventBodySchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parsedBody.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await inngestClient.send({
      name: "event/scrape.requested",
      data: {
        tenantId,
        eventId: context.params.id,
        sourceUrl: parsedBody.data.sourceUrl,
      },
    });

    return NextResponse.json({
      ok: true,
      eventId: context.params.id,
      inngestEventId: result.ids?.[0] ?? null,
    }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to dispatch scraping event", details: `${error}` },
      { status: 502 },
    );
  }
}
