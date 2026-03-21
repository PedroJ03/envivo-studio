import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { TENANT_HEADER } from "@/proxy";
import { withTenantDb } from "@/lib/db/client";
import {
  applyContentTransition,
  ContentNotFoundError,
  InvalidTransitionError,
  type ContentTransitionPayload,
} from "@/lib/pipeline/store";
import { PIPELINE_START_EVENT, REVIEW_DECISION_EVENT } from "@/inngest/functions/pipeline";
import { inngestClient } from "@/inngest/client";
import type { ContentMachineEvent } from "@/lib/pipeline/machine";

const patchActionSchema = z.object({
  action: z.enum([
    "submit",
    "start_generation",
    "generation_succeeded",
    "generation_failed",
    "publish",
    "review_timeout",
    "start_review",
    "approve",
    "reject",
    "regenerate",
  ]),
  actor: z.string().optional(),
  reason: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

type RouteContext = {
  params: {
    id: string;
  };
};

function toMachineEvent(action: z.infer<typeof patchActionSchema>["action"]): ContentMachineEvent {
  switch (action) {
    case "submit":
      return { type: "SUBMIT_FOR_REVIEW" };
    case "start_generation":
      return { type: "START_GENERATION" };
    case "generation_succeeded":
      return { type: "GENERATION_SUCCESS" };
    case "generation_failed":
      return { type: "GENERATION_FAILED" };
    case "publish":
      return { type: "PUBLISH" };
    case "review_timeout":
      return { type: "REVIEW_TIMEOUT" };
    case "approve":
      return { type: "APPROVE" };
    case "reject":
      return { type: "REJECT" };
    case "regenerate":
      return { type: "REGENERATE" };
    case "start_review":
      throw new Error("start_review is handled separately");
  }
}

function toDecisionPayload(body: {
  action: "approve" | "reject" | "regenerate";
  actor?: string;
  reason?: string;
  tenantId: string;
  candidateContentId: string;
}) {
  return {
    tenantId: body.tenantId,
    candidateContentId: body.candidateContentId,
    decision: body.action === "approve" ? "approve" : body.action === "reject" ? "reject" : "regenerate",
    actor: body.actor,
    reason: body.reason,
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const tenantId = request.headers.get(TENANT_HEADER);

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required. Send x-tenant-id header or tenant_id query param." },
      { status: 401 },
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = patchActionSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid patch payload",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { action, actor, reason, timeoutMs } = parsed.data;

  if (action === "start_review") {
    const reviewEvent = await inngestClient.send({
      name: PIPELINE_START_EVENT,
      data: {
        tenantId,
        candidateContentId: context.params.id,
        actor,
        timeoutMs,
      },
      });

    return NextResponse.json({
      ok: true,
      action: "start_review",
      eventId: reviewEvent.ids?.[0] ?? null,
    }, { status: 202 });
  }

  if (action === "approve" || action === "reject" || action === "regenerate") {
    const reviewDecisionEvent = await inngestClient.send({
      name: REVIEW_DECISION_EVENT,
      data: toDecisionPayload({
        action,
        actor,
        reason,
        tenantId,
        candidateContentId: context.params.id,
      }),
    });

    return NextResponse.json({
      ok: true,
      action,
      eventId: reviewDecisionEvent.ids?.[0] ?? null,
    }, { status: 202 });
  }

  try {
    const event = toMachineEvent(action);
    const transition = await withTenantDb(tenantId, (tx) => {
      const payload: ContentTransitionPayload = {
        tenantId,
        candidateContentId: context.params.id,
        actor,
        reason,
        event,
      };

      return applyContentTransition(tx, payload);
    });

    return NextResponse.json({
      ok: true,
      from: transition.from,
      to: transition.to,
      state: transition.state,
      idempotent: transition.from === transition.to,
    });
  } catch (error) {
    if (error instanceof InvalidTransitionError) {
      return NextResponse.json(
        { error: "Invalid transition", code: error.code, details: `${error}` },
        { status: 409 },
      );
    }

    if (error instanceof ContentNotFoundError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 404 });
    }

    return NextResponse.json({ error: "Failed to apply transition", details: `${error}` }, { status: 502 });
  }
}
