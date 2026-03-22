import { NextRequest, NextResponse } from "next/server";

import { TENANT_HEADER } from "@/proxy";
import { withTenantDb } from "@/lib/db/client";
import { candidateContent, contentStates } from "@/lib/db/schema";
import { inngestClient } from "@/inngest/client";
import { INSTAGRAM_PUBLISH_EVENT } from "@/inngest/functions/publish-instagram";
import { and, desc, eq } from "drizzle-orm";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const tenantId = request.headers.get(TENANT_HEADER);

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required. Send x-tenant-id header." },
      { status: 401 },
    );
  }

  const { id: contentId } = await context.params;

  // Verify the content piece exists and is in a publishable state
  const validation = await withTenantDb(tenantId, async (tx) => {
    // Get the candidate content
    const candidates = await tx
      .select()
      .from(candidateContent)
      .where(
        and(
          eq(candidateContent.id, contentId),
          eq(candidateContent.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!candidates[0]) {
      return { valid: false, error: "not_found" as const };
    }

    // Get the latest state
    const states = await tx
      .select()
      .from(contentStates)
      .where(
        and(
          eq(contentStates.candidateContentId, contentId),
          eq(contentStates.tenantId, tenantId),
        ),
      )
      .orderBy(desc(contentStates.createdAt))
      .limit(1);

    const latestState = states[0];

    // Content must be in reviewed or approved state to publish
    // (published state is also allowed for idempotent calls)
    if (
      !latestState ||
      !["reviewed", "approved", "published"].includes(latestState.state)
    ) {
      return {
        valid: false,
        error: "not_publishable" as const,
        currentState: latestState?.state ?? "unknown",
      };
    }

    // Already published - return idempotent success
    if (latestState.state === "published" && latestState.igPostId) {
      return {
        valid: true,
        alreadyPublished: true,
        igPostId: latestState.igPostId,
      };
    }

    return { valid: true, alreadyPublished: false };
  });

  if (validation.error === "not_found") {
    return NextResponse.json(
      { error: "Content piece not found" },
      { status: 404 },
    );
  }

  if (validation.error === "not_publishable") {
    return NextResponse.json(
      {
        error: `Content cannot be published from state '${validation.currentState}'. Content must be in 'reviewed', 'approved', or 'published' state.`,
        code: "NOT_PUBLISHABLE",
      },
      { status: 409 },
    );
  }

  if (validation.alreadyPublished) {
    return NextResponse.json({
      ok: true,
      status: "already_published",
      igPostId: validation.igPostId,
      message: "Content was already published to Instagram",
    });
  }

  // Dispatch the Instagram publish event
  const event = await inngestClient.send({
    name: INSTAGRAM_PUBLISH_EVENT,
    data: {
      tenantId,
      candidateContentId: contentId,
    },
  });

  return NextResponse.json(
    {
      ok: true,
      status: "dispatched",
      eventId: event.ids?.[0] ?? null,
      message: "Instagram publish job dispatched",
    },
    { status: 202 },
  );
}
