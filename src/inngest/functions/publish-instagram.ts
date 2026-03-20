import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { withTenantDb } from "@/lib/db/client";
import { candidateContent, contentStates, generatedOutputs } from "@/lib/db/schema";
import {
  applyContentTransition,
  type ContentTransitionPayload,
} from "@/lib/pipeline/store";
import { inngestClient } from "@/inngest/client";
import { publishCarousel, publishSingleImage, type CarouselPublishResult, type PublishResult } from "@/lib/instagram/media";
import {
  InstagramPublishError,
  InstagramTokenExpiredError,
  getInstagramCredentials,
  getTokenStatus,
} from "@/lib/instagram/client";
import { resolveCandidateStatus, type CandidateContentRow, type ContentStateRow } from "@/lib/pipeline/store";

export const INSTAGRAM_PUBLISH_EVENT = "content/instagram.publish";

const instagramPublishSchema = z.object({
  tenantId: z.string().min(1),
  candidateContentId: z.string().min(1),
  actor: z.string().optional(),
});

export type InstagramPublishPayload = z.infer<typeof instagramPublishSchema>;

/**
 * Retrieves the generated output (composed image URL) for a content piece.
 */
async function getContentOutput(
  tenantId: string,
  candidateContentId: string,
): Promise<{ fileUrl: string; caption?: string } | null> {
  return withTenantDb(tenantId, async (tx) => {
    // Get the latest content state
    const stateRows = (await tx
      .select()
      .from(contentStates)
      .where(and(
        eq(contentStates.candidateContentId, candidateContentId),
        eq(contentStates.tenantId, tenantId),
      ))
      .orderBy(desc(contentStates.createdAt))
      .limit(1)) as ContentStateRow[];

    if (!stateRows[0]) {
      return null;
    }

    const latestStateId = stateRows[0].id;

    // Get generated outputs for this state
    const outputRows = await tx
      .select()
      .from(generatedOutputs)
      .where(and(
        eq(generatedOutputs.contentStateId, latestStateId),
        eq(generatedOutputs.tenantId, tenantId),
      ))
      .orderBy(generatedOutputs.sortOrder);

    if (!outputRows[0]) {
      return null;
    }

    // Get the candidate to find the caption
    const candidateRows = (await tx
      .select()
      .from(candidateContent)
      .where(and(
        eq(candidateContent.id, candidateContentId),
        eq(candidateContent.tenantId, tenantId),
      ))
      .limit(1)) as CandidateContentRow[];

    const candidate = candidateRows[0];

    return {
      fileUrl: outputRows[0].fileUrl,
      caption: typeof candidate?.summaryJson?.caption === "string"
        ? candidate.summaryJson.caption
        : undefined,
    };
  });
}

/**
 * Marks a content piece as publish failed and stores the error details.
 */
async function markPublishFailed(
  tenantId: string,
  candidateContentId: string,
  errorMessage: string,
  actor?: string,
): Promise<void> {
  await withTenantDb(tenantId, async (tx) => {
    const payload: ContentTransitionPayload = {
      tenantId,
      candidateContentId,
      event: {
        type: "GENERATION_FAILED",
        actor,
        reason: `Instagram publish failed: ${errorMessage}`,
      },
    };

    await applyContentTransition(tx, payload);
  });
}

/**
 * Marks a content piece as successfully published with the IG post ID.
 */
async function markPublished(
  tenantId: string,
  candidateContentId: string,
  igPostId: string,
  actor?: string,
): Promise<void> {
  await withTenantDb(tenantId, async (tx) => {
    // First transition to approved if needed
    const currentPayload: ContentTransitionPayload = {
      tenantId,
      candidateContentId,
      event: { type: "APPROVE", actor },
    };

    await applyContentTransition(tx, currentPayload);

    // Then transition to published with the IG post ID
    const publishPayload: ContentTransitionPayload = {
      tenantId,
      candidateContentId,
      event: { type: "PUBLISH", actor },
      igPostId,
    };

    await applyContentTransition(tx, publishPayload);
  });
}

export const instagramPublishFunction = inngestClient.createFunction(
  {
    id: "instagram-publish",
    triggers: [{ event: INSTAGRAM_PUBLISH_EVENT }],
  },
  async ({ event, step }) => {
    const payload = instagramPublishSchema.parse(event.data);

    // Step 1: Validate Instagram credentials
    const tokenStatus = await step.run("validate-token", async () => {
      return getTokenStatus(payload.tenantId);
    });

    if (!tokenStatus.isValid) {
      const errorMessage = tokenStatus.errorCode === "TOKEN_EXPIRED"
        ? "Instagram access token has expired. Please re-authorize in settings."
        : tokenStatus.errorMessage ?? "Instagram credentials are invalid.";

      await step.run("mark-failed", async () => {
        await markPublishFailed(
          payload.tenantId,
          payload.candidateContentId,
          errorMessage,
          payload.actor,
        );
      });

      return {
        success: false,
        error: errorMessage,
        errorCode: tokenStatus.errorCode,
      };
    }

    // Step 2: Get the composed image(s) to publish
    const contentOutput = await step.run("get-content", async () => {
      return getContentOutput(payload.tenantId, payload.candidateContentId);
    });

    if (!contentOutput) {
      await step.run("mark-failed", async () => {
        await markPublishFailed(
          payload.tenantId,
          payload.candidateContentId,
          "No composed content found. Please compose before publishing.",
          payload.actor,
        );
      });

      return {
        success: false,
        error: "No composed content found",
      };
    }

    // Step 3: Get Instagram credentials for API calls
    const credentials = await step.run("get-credentials", async () => {
      return getInstagramCredentials(payload.tenantId);
    });

    // Step 4: Publish to Instagram
    let publishResult: PublishResult | CarouselPublishResult;

    try {
      publishResult = await step.run("publish-to-instagram", async () => {
        // For now, we only support single image publishing
        // Carousel support would need to detect multiple outputs
        return publishSingleImage(
          contentOutput.fileUrl,
          contentOutput.caption ?? "",
          credentials.accessToken,
        );
      });
    } catch (err) {
      const error = err as Error;

      if (error instanceof InstagramTokenExpiredError) {
        await step.run("mark-failed", async () => {
          await markPublishFailed(
            payload.tenantId,
            payload.candidateContentId,
            "Instagram access token expired during publishing. Please re-authorize.",
            payload.actor,
          );
        });

        return {
          success: false,
          error: "Token expired during publish",
          errorCode: "TOKEN_EXPIRED",
        };
      }

      const errorMessage = error instanceof InstagramPublishError
        ? error.message
        : "Unknown error during Instagram publish";

      await step.run("mark-failed", async () => {
        await markPublishFailed(
          payload.tenantId,
          payload.candidateContentId,
          errorMessage,
          payload.actor,
        );
      });

      return {
        success: false,
        error: errorMessage,
      };
    }

    if (publishResult.status === "failed") {
      await step.run("mark-failed", async () => {
        await markPublishFailed(
          payload.tenantId,
          payload.candidateContentId,
          publishResult.errorMessage ?? "Unknown publish error",
          payload.actor,
        );
      });

      return {
        success: false,
        error: publishResult.errorMessage ?? "Publish failed",
      };
    }

    // Step 5: Mark as published with IG post ID
    await step.run("mark-published", async () => {
      await markPublished(
        payload.tenantId,
        payload.candidateContentId,
        publishResult.instagramPostId,
        payload.actor,
      );
    });

    return {
      success: true,
      instagramPostId: publishResult.instagramPostId,
    };
  },
);
