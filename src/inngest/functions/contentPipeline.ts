import { z } from "zod";

import { withTenantDb } from "@/lib/db/client";
import { applyContentTransition, type ContentTransitionPayload } from "@/lib/pipeline/store";
import {
  resolveMachineTransition,
  type ContentMachineEvent,
  type ContentMachineState,
} from "@/lib/pipeline/machine";
import { inngestClient } from "@/inngest/client";

type ReviewDecision = "approve" | "reject" | "regenerate";

export const PIPELINE_START_EVENT = "content/pipeline.start";
export const REVIEW_START_EVENT = "content/review.start";
export const REVIEW_DECISION_EVENT = "content/review.decision";
export const REVIEW_OUTCOME_EVENT = "content/review.outcome";

const pipelineStartSchema = z.object({
  tenantId: z.string().min(1),
  candidateContentId: z.string().min(1),
  actor: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

const reviewStartSchema = z.object({
  tenantId: z.string().min(1),
  candidateContentId: z.string().min(1),
  actor: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

const reviewDecisionSchema = z.object({
  tenantId: z.string().min(1),
  candidateContentId: z.string().min(1),
  decision: z.enum(["approve", "reject", "regenerate"]),
  actor: z.string().optional(),
  reason: z.string().nullable().optional(),
});

const reviewOutcomeSchema = z.object({
  tenantId: z.string().min(1),
  candidateContentId: z.string().min(1),
  state: z.enum([
    "draft",
    "approved",
    "generating",
    "generated",
    "reviewed",
    "published",
    "rejected",
    "failed",
  ]),
  transitionEvent: z.string(),
  timedOut: z.boolean(),
  reason: z.string().nullable(),
});

function parseReviewTimeout(timeoutMs: number | undefined): string {
  if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return `${timeoutMs}ms`;
  }

  const envTimeoutMs = Number.parseInt(process.env.CONTENT_REVIEW_TIMEOUT_MS ?? "", 10);

  if (Number.isFinite(envTimeoutMs) && envTimeoutMs > 0) {
    return `${envTimeoutMs}ms`;
  }

  return "15m";
}

function resolveReviewTransitionEvent(
  decision: ReviewDecision,
  reason?: string,
  actor?: string,
): ContentMachineEvent {
  if (decision === "approve") {
    return { type: "APPROVE", actor, rejectionReason: reason };
  }

  if (decision === "reject") {
    return { type: "REJECT", actor, reason };
  }

  return { type: "REGENERATE", actor, reason };
}

export type ReviewTimeoutResult = {
  timedOut: boolean;
  transition: ContentMachineEvent;
  reason: string | null;
};

export function getReviewDecisionTransition(
  decisionData: z.infer<typeof reviewDecisionSchema> | null,
  actorFallback?: string,
): ReviewTimeoutResult {
  if (!decisionData) {
    return {
      timedOut: true,
      transition: {
        type: "REVIEW_TIMEOUT",
        actor: actorFallback,
        reason: "Review timed out waiting for HITL decision.",
      },
      reason: "Review timed out waiting for HITL decision.",
    };
  }

  return {
    timedOut: false,
    transition: resolveReviewTransitionEvent(
      decisionData.decision,
      decisionData.reason ?? undefined,
      decisionData.actor,
    ),
    reason: decisionData.reason ?? null,
  };
}

function createTransitionPayload(
  tenantId: string,
  candidateContentId: string,
  event: ContentMachineEvent,
  actorFallback?: string,
): ContentTransitionPayload {
  const eventReason =
    event.type === "REJECT" || event.type === "REGENERATE"
      ? event.reason
      : event.type === "APPROVE"
        ? event.rejectionReason
        : undefined;

  return {
    tenantId,
    candidateContentId,
    actor: event.actor ?? actorFallback,
    reason: eventReason,
    event,
  };
}

export const contentPipelineStartFunction = inngestClient.createFunction(
  {
    id: "content-pipeline-start",
    triggers: [{ event: PIPELINE_START_EVENT }],
  },
  async ({ event, step }) => {
    const payload = pipelineStartSchema.parse(event.data);

    const transitions = await step.run("advance-to-generated", async () => {
      const steps: Array<{ from: string; to: string }> = [];

      return withTenantDb(payload.tenantId, async (tx) => {
        const transitionSequence: Array<ContentMachineEvent> = [
          { type: "SUBMIT_FOR_REVIEW" },
          { type: "START_GENERATION" },
          { type: "GENERATION_SUCCESS" },
        ];

        let current: ContentMachineState = "draft";

        for (const transitionEvent of transitionSequence) {
          if (!resolveMachineTransition(current, transitionEvent.type)) {
            throw new Error(`Unsupported content transition ${current} -> ${transitionEvent.type}.`);
          }

          const applied = await applyContentTransition(
            tx,
            createTransitionPayload(
              payload.tenantId,
              payload.candidateContentId,
              transitionEvent,
              payload.actor,
            ),
          );

          current = applied.to;
          steps.push({ from: applied.from, to: applied.to });
        }

        return steps;
      });
    });

    await step.run("trigger-review", () =>
      inngestClient.send({
        name: REVIEW_START_EVENT,
        data: {
          tenantId: payload.tenantId,
          candidateContentId: payload.candidateContentId,
          actor: payload.actor,
          timeoutMs: payload.timeoutMs,
        },
      }),
    );

    return {
      candidateContentId: payload.candidateContentId,
      tenantId: payload.tenantId,
      transitions,
      reviewEventName: REVIEW_START_EVENT,
    };
  },
);

export const contentPipelineReviewFunction = inngestClient.createFunction(
  {
    id: "content-pipeline-review",
    triggers: [{ event: REVIEW_START_EVENT }],
  },
  async ({ event, step }) => {
    const payload = reviewStartSchema.parse(event.data);
    const decision = await step.waitForEvent("wait-for-review-decision", {
      event: REVIEW_DECISION_EVENT,
      timeout: parseReviewTimeout(payload.timeoutMs),
      if: "event.data.tenantId == async.data.tenantId && event.data.candidateContentId == async.data.candidateContentId",
    });

    const parsedDecision = decision ? reviewDecisionSchema.parse(decision.data) : null;
    const result = getReviewDecisionTransition(parsedDecision, payload.actor);

    const transition = createTransitionPayload(
      payload.tenantId,
      payload.candidateContentId,
      result.transition,
      payload.actor,
    );

    const applied = await step.run("apply-review-transition", async () =>
      withTenantDb(transition.tenantId, (tx) => applyContentTransition(tx, transition)),
    );

    await step.run("emit-review-outcome", async () =>
      inngestClient.send({
        name: REVIEW_OUTCOME_EVENT,
        data: {
          tenantId: payload.tenantId,
          candidateContentId: payload.candidateContentId,
          state: applied.to,
          transitionEvent: transition.event.type,
          timedOut: result.timedOut,
          reason: result.reason,
        },
      }),
    );

    return reviewOutcomeSchema.parse({
      tenantId: payload.tenantId,
      candidateContentId: payload.candidateContentId,
      state: applied.to,
      transitionEvent: transition.event.type,
      timedOut: result.timedOut,
      reason: result.reason,
    });
  },
);

export const contentPipelineFunctions = [contentPipelineStartFunction, contentPipelineReviewFunction] as const;
