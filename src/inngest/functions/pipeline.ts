import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { withTenantDb } from "@/lib/db/client";
import { candidateContent, photos } from "@/lib/db/schema";
import {
  applyContentTransition,
  type ContentTransitionPayload,
} from "@/lib/pipeline/store";
import {
  type ContentMachineEvent,
  type ContentMachineState,
} from "@/lib/pipeline/machine";
import { renderCandidatePreview, type ComposerRenderOutput } from "@/lib/composer/composer";
import { inngestClient } from "@/inngest/client";
import { generatePersonaText } from "@/lib/ai/generate";

type CandidateRow = {
  id: string;
  tenantId: string;
  eventId: string | null;
  photoId: string | null;
  title: string;
  selectedFormat: "post" | "story" | "carousel";
  selectedTone: string | null;
  summaryJson: Record<string, unknown> | null;
};

type GatheredCandidate = {
  candidate: CandidateRow;
  availablePhotoIds: string[];
};

type SelectStepResult = {
  selectedPhotoId: string;
};

type GeneratedTextResult = {
  caption: string;
  hashtags: string[];
  source: "ai-hook" | "fallback";
};

export const PIPELINE_START_EVENT = "content/pipeline.start";
export const PIPELINE_REVIEW_DECISION_EVENT = "content/review.decision";
export const PIPELINE_PUBLISH_READY_EVENT = "content/pipeline.publish-ready";

// Backward-compatible name used by existing route tests.
export const REVIEW_DECISION_EVENT = PIPELINE_REVIEW_DECISION_EVENT;

const pipelineStartSchema = z.object({
  tenantId: z.string().min(1),
  candidateContentId: z.string().min(1),
  actor: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  reviewSessionId: z.string().optional(),
  selectedPhotoId: z.string().optional(),
  selectedPhotoIds: z.array(z.string()).optional(),
});

const reviewDecisionSchema = z.object({
  tenantId: z.string().min(1),
  candidateContentId: z.string().min(1),
  decision: z.enum(["approve", "reject", "regenerate"]),
  actor: z.string().optional(),
  reason: z.string().nullable().optional(),
  reviewSessionId: z.string().optional(),
});

const publishReadySchema = z.object({
  tenantId: z.string().min(1),
  candidateContentId: z.string().min(1),
  state: z.string(),
  reason: z.string().nullable(),
  actor: z.string().optional(),
  timedOut: z.boolean(),
  noEvent: z.boolean(),
  reviewSessionId: z.string().optional(),
});

export type PipelinePublishReadyPayload = z.infer<typeof publishReadySchema>;

export function parseReviewTimeout(timeoutMs: number | undefined): string {
  if (typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0) {
    return `${timeoutMs}ms`;
  }

  const envTimeoutMs = Number.parseInt(process.env.CONTENT_REVIEW_TIMEOUT_MS ?? "", 10);
  if (Number.isFinite(envTimeoutMs) && envTimeoutMs > 0) {
    return `${envTimeoutMs}ms`;
  }

  return "15m";
}

type ReviewDecisionResult = {
  timedOut: boolean;
  noEvent: boolean;
  transition: ContentMachineEvent;
  reason: string | null;
};

function resolveReviewTransition(
  decisionData: z.infer<typeof reviewDecisionSchema> | null,
  actorFallback?: string,
): ReviewDecisionResult {
  if (!decisionData) {
    return {
      timedOut: true,
      noEvent: true,
      transition: {
        type: "REVIEW_TIMEOUT",
        actor: actorFallback,
        reason: "Review timed out waiting for HITL decision.",
      },
      reason: "Review timed out waiting for HITL decision.",
    };
  }

  if (decisionData.decision === "approve") {
    return {
      timedOut: false,
      noEvent: false,
      transition: {
        type: "APPROVE",
        actor: decisionData.actor,
        rejectionReason: decisionData.reason ?? undefined,
      },
      reason: decisionData.reason ?? null,
    };

  }

  if (decisionData.decision === "reject") {
    return {
      timedOut: false,
      noEvent: false,
      transition: {
        type: "REJECT",
        actor: decisionData.actor,
        reason: decisionData.reason ?? undefined,
      },
      reason: decisionData.reason ?? null,
    };
  }

  return {
      timedOut: false,
      noEvent: false,
      transition: {
        type: "REGENERATE",
        actor: decisionData.actor,
        reason: decisionData.reason ?? undefined,
      },
      reason: decisionData.reason ?? null,
    };
  }

export const getReviewDecisionTransition = resolveReviewTransition;

function escapeReviewSessionId(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function buildReviewGuardExpression(sessionId: string | undefined): string {
  if (!sessionId) {
    return "event.data.tenantId == async.data.tenantId && event.data.candidateContentId == async.data.candidateContentId";
  }

  return `event.data.tenantId == async.data.tenantId && event.data.candidateContentId == async.data.candidateContentId && event.data.reviewSessionId == '${escapeReviewSessionId(sessionId)}'`;
}

export async function gatherCandidatesForPipeline(
  tenantId: string,
  candidateContentId: string,
): Promise<GatheredCandidate> {
  return withTenantDb(tenantId, async (tx) => {
    const [candidate] = (await tx
      .select({
        id: candidateContent.id,
        tenantId: candidateContent.tenantId,
        eventId: candidateContent.eventId,
        photoId: candidateContent.photoId,
        title: candidateContent.title,
        summaryJson: candidateContent.summaryJson,
        selectedFormat: candidateContent.selectedFormat,
        selectedTone: candidateContent.selectedTone,
      })
      .from(candidateContent)
      .where(and(eq(candidateContent.id, candidateContentId), eq(candidateContent.tenantId, tenantId)))
      .limit(1)) as CandidateRow[];

    if (!candidate) {
      throw new Error(`Candidate '${candidateContentId}' was not found for tenant '${tenantId}'.`);
    }

    const availablePhotoRows =
      candidate.eventId !== null
        ? ((await tx
            .select({ id: photos.id })
            .from(photos)
            .where(and(eq(photos.tenantId, tenantId), eq(photos.eventId, candidate.eventId)))
            .orderBy(desc(photos.createdAt))) as Array<{ id: string }>)
        : [];

    const availablePhotoIds = availablePhotoRows.map((row) => row.id);

    return {
      candidate: {
        id: candidate.id,
        tenantId: candidate.tenantId,
        eventId: candidate.eventId,
        photoId: candidate.photoId,
        title: candidate.title,
        summaryJson: candidate.summaryJson as Record<string, unknown> | null,
        selectedFormat: candidate.selectedFormat,
        selectedTone: candidate.selectedTone,
      },
      availablePhotoIds,
    };
  });
}

function selectPhotoForCandidate(
  payload: z.infer<typeof pipelineStartSchema>,
  gathered: GatheredCandidate,
): SelectStepResult {
  const explicitSelection = [
    ...(payload.selectedPhotoIds ?? []),
    ...(payload.selectedPhotoId ? [payload.selectedPhotoId] : []),
  ];

  const matchedSelection = explicitSelection.find((candidatePhotoId) =>
    gathered.availablePhotoIds.includes(candidatePhotoId),
  );

  const fallbackSelection = gathered.candidate.photoId ?? gathered.availablePhotoIds[0] ?? null;
  const selectedPhotoId = matchedSelection ?? fallbackSelection;

  if (!selectedPhotoId) {
    throw new Error(`No photos found for candidate '${gathered.candidate.id}'.`);
  }

  return { selectedPhotoId };
}

async function persistSelectedPhoto(
  tenantId: string,
  candidateContentId: string,
  photoId: string,
): Promise<void> {
  await withTenantDb(tenantId, (tx) =>
    tx
      .update(candidateContent)
      .set({ photoId })
      .where(and(eq(candidateContent.id, candidateContentId), eq(candidateContent.tenantId, tenantId))),
  );
}

async function fallbackTextGenerator(input: {
  title: string;
  selectedFormat: "post" | "story" | "carousel";
  selectedTone: string | null;
  summaryJson: Record<string, unknown> | null;
}): Promise<GeneratedTextResult> {
  const tone = input.selectedTone ? ` tone:${input.selectedTone}` : "";
  const eventName = typeof input.summaryJson?.name === "string" ? `${input.summaryJson.name} ` : "";

  return {
    caption: `${eventName}Contenido ${tone} para ${input.title} (${input.selectedFormat}).`,
    hashtags: ["#envivo", "#musica", "#tandil"],
    source: "fallback",
  };
}

async function runTextGenerationHook(
  payload: {
    title: string;
    selectedFormat: "post" | "story" | "carousel";
    selectedTone: string | null;
    summaryJson: Record<string, unknown> | null;
  },
): Promise<GeneratedTextResult> {
  try {
    const generated = await generatePersonaText({
      personaSlug: payload.selectedTone || "informativo",
      title: payload.title,
      selectedFormat: payload.selectedFormat,
      summaryJson: payload.summaryJson,
      selectedTone: payload.selectedTone,
    });

    return {
      caption: generated.caption,
      hashtags: generated.hashtags,
      source: "ai-hook",
    };
  } catch {
    return fallbackTextGenerator(payload);
  }
}

async function applyTransition(
  tenantId: string,
  candidateContentId: string,
  event: ContentMachineEvent,
): Promise<{ from: ContentMachineState; to: ContentMachineState }> {
  const payload: ContentTransitionPayload = {
    tenantId,
    candidateContentId,
    actor: event.actor,
    event,
  };

  return withTenantDb(tenantId, async (tx) => {
    const transition = await applyContentTransition(tx, payload);
    return {
      from: transition.from,
      to: transition.to,
    };
  });
}

export const contentPipelineFunction = inngestClient.createFunction(
  {
    id: "content-pipeline",
    triggers: [{ event: PIPELINE_START_EVENT }],
  },
  async ({ event, step }) => {
    const payload = pipelineStartSchema.parse(event.data);
    const timeout = parseReviewTimeout(payload.timeoutMs);

    const gathered = await step.run("gather", () =>
      gatherCandidatesForPipeline(payload.tenantId, payload.candidateContentId),
    );

    const selected = await step.run("select", () => selectPhotoForCandidate(payload, gathered));
    await step.run("persist-selection", () =>
      persistSelectedPhoto(payload.tenantId, payload.candidateContentId, selected.selectedPhotoId),
    );

    await step.run("mark-submitted", () =>
      applyTransition(payload.tenantId, payload.candidateContentId, {
        type: "SUBMIT_FOR_REVIEW",
        actor: payload.actor,
      }),
    );

    await step.run("start-generation", () =>
      applyTransition(payload.tenantId, payload.candidateContentId, {
        type: "START_GENERATION",
        actor: payload.actor,
      }),
    );

    let generatedText: GeneratedTextResult;

    try {
      generatedText = await step.run("generate-text", () =>
        runTextGenerationHook({
          title: gathered.candidate.title,
          selectedFormat: gathered.candidate.selectedFormat,
          selectedTone: gathered.candidate.selectedTone,
          summaryJson: gathered.candidate.summaryJson,
        }),
      );

      await step.run("compose", () =>
        withTenantDb(payload.tenantId, async () => {
          const output = (await renderCandidatePreview({
            tenantId: payload.tenantId,
            candidateContentId: payload.candidateContentId,
          })) as ComposerRenderOutput;

          return {
            composeOutput: {
              fileUrl: output.fileUrl,
              width: output.width,
              height: output.height,
            },
            generatedText,
          };
        }),
      );

      await step.run("mark-generation-success", () =>
        applyTransition(payload.tenantId, payload.candidateContentId, {
          type: "GENERATION_SUCCESS",
          actor: payload.actor,
        }),
      );
    } catch (error) {
      await step.run("mark-generation-failed", () =>
        applyTransition(payload.tenantId, payload.candidateContentId, {
          type: "GENERATION_FAILED",
          actor: payload.actor,
        }),
      );

      throw error;
    }

    const reviewEvent = await step.waitForEvent("review", {
      event: PIPELINE_REVIEW_DECISION_EVENT,
      timeout,
      if: buildReviewGuardExpression(payload.reviewSessionId),
    });

    const reviewDecision = reviewEvent ? reviewDecisionSchema.parse(reviewEvent.data) : null;
    const decisionResult = getReviewDecisionTransition(reviewDecision, payload.actor);

    const reviewTransition = await step.run("apply-review", () =>
      applyTransition(payload.tenantId, payload.candidateContentId, decisionResult.transition),
    );

    const publishReadyPayload: PipelinePublishReadyPayload = {
      tenantId: payload.tenantId,
      candidateContentId: payload.candidateContentId,
      state: reviewTransition.to,
      actor: payload.actor,
      reason: decisionResult.reason,
      timedOut: decisionResult.timedOut,
      noEvent: decisionResult.noEvent,
      reviewSessionId: payload.reviewSessionId,
    };

    await step.run("emit-publish-ready", () =>
      inngestClient.send({
        name: PIPELINE_PUBLISH_READY_EVENT,
        data: publishReadySchema.parse(publishReadyPayload),
      }),
    );

    return publishReadySchema.parse(publishReadyPayload);
  },
);

export const contentPipelineFunctions = [contentPipelineFunction] as const;
