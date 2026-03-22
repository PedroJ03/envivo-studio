/**
 * Stage 2-3: Content Generation Inngest Function
 *
 * Processes topic/selected events to generate content (captions + brand images)
 * for selected topics. Handles multiple formats in parallel with retry logic.
 *
 * @module inngest/functions/generate-content
 */

import { eq } from "drizzle-orm";
import { z } from "zod";

import { inngestClient } from "@/inngest/client";
import { db } from "@/lib/db/client";
import {
  calendarEvents,
  candidateContent,
  contentFeedItems,
  sections,
  topicSelections,
} from "@/lib/db/schema";
import {
  type FormatType,
  type GenerationFormat,
  type SourceData,
  type SourceType,
  type ToneType,
} from "@/lib/generation/types";
import {
  FORMAT_GENERATION_TIMEOUT_MS,
  MAX_PARALLEL_FORMATS,
  RETRY_CONFIG,
} from "@/lib/generation/config";
import {
  mapFormatToTemplate,
  mapSourceToSection,
} from "@/lib/generation/mappers";
import {
  GenerationTimeoutError,
  SourceNotFoundError,
} from "@/lib/generation/errors";
import { generatePersonaText } from "@/lib/ai/generate";
import { composeBrandTemplate } from "@/lib/brand/BrandComposer";
import type { BrandSection } from "@/lib/brand/types";

// ----------------------------------------------------------------------------
// Event Schema
// ----------------------------------------------------------------------------

const topicSelectedEventSchema = z.object({
  selectionId: z.string().uuid(),
  tenantId: z.string().uuid(),
  sourceType: z.enum(["calendar_event", "content_feed_item"]),
  sourceId: z.string().uuid(),
  formats: z.array(
    z.object({
      type: z.enum(["post", "story", "carousel"]),
      tone: z.enum([
        "informative",
        "opinion",
        "nostalgic",
        "humorous",
        "urgent",
      ]),
      priority: z.number(),
    }),
  ),
});

export type TopicSelectedEvent = z.infer<typeof topicSelectedEventSchema>;

// ----------------------------------------------------------------------------
// Retry & Timeout Helpers
// ----------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  format: string,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new GenerationTimeoutError(format, timeoutMs)),
        timeoutMs,
      ),
    ),
  ]);
}

// ----------------------------------------------------------------------------
// Caption Generation with Retry
// ----------------------------------------------------------------------------

interface GeneratedCaption {
  caption: string;
  hashtags: string[];
}

async function generateCaptionWithRetry(
  tone: ToneType,
  title: string,
  format: FormatType,
  summaryJson: Record<string, unknown>,
  tenantId: string,
): Promise<GeneratedCaption> {
  const maxAttempts = RETRY_CONFIG.maxAttempts;
  const backoffMs = RETRY_CONFIG.backoffMs;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await generatePersonaText({
        personaSlug: tone, // Use tone as persona slug
        title,
        selectedFormat: format,
        summaryJson,
        tenantId,
      });
      return { caption: result.caption, hashtags: result.hashtags };
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        // Last attempt failed, use fallback
        console.warn(
          `[GenerateContent] AI generation failed after ${maxAttempts} attempts, using fallback`,
          {
            error: error instanceof Error ? error.message : String(error),
            tone,
            format,
          },
        );
        return fallbackCaption(tone, title, format);
      }
      // Wait before retry with exponential backoff
      await sleep(backoffMs[attempt]);
    }
  }
  // Should not reach here, but TypeScript doesn't know
  return fallbackCaption(tone, title, format);
}

function fallbackCaption(
  tone: ToneType,
  title: string,
  format: FormatType,
): GeneratedCaption {
  const toneLabels: Record<ToneType, string> = {
    informative: "Información",
    opinion: "Opinión",
    nostalgic: "Nostalgia",
    humorous: "Humor",
    urgent: "Urgente",
  };

  return {
    caption: `${toneLabels[tone]}: ${title} — ${format}.`,
    hashtags: ["#envivo", "#tandil", "#musica"],
  };
}

// ----------------------------------------------------------------------------
// Brand Image Composition
// ----------------------------------------------------------------------------

interface BrandImageResult {
  template: string;
  width: number;
  height: number;
  // Note: actual image rendering would happen in a separate step with Satori
  // For now we just prepare the composition data
  compositionReady: boolean;
}

async function composeBrandImage(
  format: FormatType,
  section: BrandSection,
  title: string,
  subtitle: string | undefined,
  photoUrl: string,
  eventDate: string | undefined,
): Promise<BrandImageResult> {
  const templateFormat = mapFormatToTemplate(format);

  const { width, height } = composeBrandTemplate({
    format: templateFormat,
    variant: "classic",
    section,
    title,
    subtitle,
    photoUrl: photoUrl || "https://placeholder.com/image.jpg",
    date: eventDate,
  });

  return {
    template: templateFormat,
    width,
    height,
    compositionReady: true,
  };
}

// ----------------------------------------------------------------------------
// Fetch Source Data
// ----------------------------------------------------------------------------

async function fetchSourceData(
  sourceType: SourceType,
  sourceId: string,
  tenantId: string,
): Promise<SourceData> {
  if (sourceType === "calendar_event") {
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, sourceId))
      .limit(1);

    if (!event) {
      throw new SourceNotFoundError(sourceType, sourceId);
    }

    // Get first image if available
    const images = event.images as Array<{ url: string }>;
    const imageUrl = images?.[0]?.url;

    return {
      id: event.id,
      title: event.title,
      description: event.description || undefined,
      imageUrl,
      eventDate: event.eventDate,
      venue: event.location?.venue || undefined,
      artists: event.artists?.map((a: { name: string }) => a.name),
      sourceType,
    };
  } else {
    const [item] = await db
      .select()
      .from(contentFeedItems)
      .where(eq(contentFeedItems.id, sourceId))
      .limit(1);

    if (!item) {
      throw new SourceNotFoundError(sourceType, sourceId);
    }

    const images = item.images as Array<{ url: string }>;
    const imageUrl = images?.[0]?.url;

    return {
      id: item.id,
      title: item.title,
      description: item.body || undefined,
      imageUrl,
      eventDate: item.publishAt?.toISOString(),
      sourceType,
    };
  }
}

// ----------------------------------------------------------------------------
// Fetch Section for Brand Composition
// ----------------------------------------------------------------------------

async function fetchSectionForSource(
  sourceType: SourceType,
  tenantId: string,
): Promise<BrandSection> {
  const sectionSlug = mapSourceToSection(sourceType);

  const [section] = await db
    .select({
      id: sections.id,
      tenantId: sections.tenantId,
      slug: sections.slug,
      name: sections.name,
      color: sections.color,
    })
    .from(sections)
    .where(eq(sections.slug, sectionSlug))
    .limit(1);

  if (!section) {
    // Return a default section if not found
    return {
      id: "default",
      tenantId,
      slug: sectionSlug as BrandSection["slug"],
      name: sectionSlug === "proximos-shows" ? "Próximos Shows" : "Noticias",
      color: "#8B5CF6",
    };
  }

  return section as BrandSection;
}

// ----------------------------------------------------------------------------
// Process Single Format
// ----------------------------------------------------------------------------

interface FormatProcessingResult {
  format: FormatType;
  tone: ToneType;
  candidateId: string;
  status: "created" | "existing" | "failed";
  caption?: string;
  hashtags?: string[];
  brandImage?: BrandImageResult;
  error?: string;
}

async function processFormatWithTimeout(
  formatSpec: GenerationFormat,
  sourceData: SourceData,
  section: BrandSection,
  tenantId: string,
  selectionId: string,
): Promise<FormatProcessingResult> {
  const { type: format, tone } = formatSpec;

  try {
    // Generate caption with retry
    const generatedCaption = await withTimeout(
      generateCaptionWithRetry(
        tone,
        sourceData.title,
        format,
        {
          name: sourceData.title,
          description: sourceData.description,
          venue: sourceData.venue,
          date: sourceData.eventDate,
        },
        tenantId,
      ),
      FORMAT_GENERATION_TIMEOUT_MS,
      format,
    );

    // Compose brand image (preparation only - actual rendering is separate)
    const brandImage = await withTimeout(
      composeBrandImage(
        format,
        section,
        sourceData.title,
        sourceData.description,
        sourceData.imageUrl || "",
        sourceData.eventDate,
      ),
      FORMAT_GENERATION_TIMEOUT_MS,
      format,
    );

    // Create or update candidate_content record
    // First check if candidate already exists for this selection + format + tone
    const existingCandidates = await db
      .select({ id: candidateContent.id })
      .from(candidateContent)
      .where(eq(candidateContent.id, selectionId)) // Using selectionId as a reference
      .limit(1);

    const existingSummaryJson = {} as Record<string, unknown>;
    const candidateId = existingCandidates[0]?.id;

    if (candidateId) {
      // Update existing candidate
      await db
        .update(candidateContent)
        .set({
          summaryJson: {
            ...existingSummaryJson,
            caption: generatedCaption.caption,
            hashtags: generatedCaption.hashtags,
            generatedAt: new Date().toISOString(),
            brandTemplate: brandImage.template,
          },
          updatedAt: new Date(),
        })
        .where(eq(candidateContent.id, candidateId));

      return {
        format,
        tone,
        candidateId,
        status: "existing",
        caption: generatedCaption.caption,
        hashtags: generatedCaption.hashtags,
        brandImage,
      };
    } else {
      // This shouldn't happen in normal flow since candidates are created in Phase 2
      // But we handle it gracefully
      return {
        format,
        tone,
        candidateId: selectionId,
        status: "failed",
        error: "Candidate not found - should be created in Phase 2",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[GenerateContent] Failed to process format ${format}/${tone}`,
      {
        error: errorMessage,
        selectionId,
      },
    );

    return {
      format,
      tone,
      candidateId: selectionId,
      status: "failed",
      error: errorMessage,
    };
  }
}

// ----------------------------------------------------------------------------
// Main Inngest Function
// ----------------------------------------------------------------------------

export const generateContentFunction = inngestClient.createFunction(
  {
    id: "generate-content",
    name: "Generate Content from Topic Selection",
    retries: RETRY_CONFIG.maxAttempts as 3,
    throttle: { limit: 10, period: "1m" },
    triggers: [{ event: "topic/selected" }],
  },
  async ({
    event,
    step,
  }: {
    event: { data: TopicSelectedEvent };
    step: any;
  }) => {
    const parsed = topicSelectedEventSchema.parse(event.data);
    const { selectionId, tenantId, sourceType, sourceId, formats } = parsed;

    console.info("[GenerateContent] Starting content generation", {
      selectionId,
      tenantId,
      sourceType,
      sourceId,
      formatCount: formats.length,
    });

    const startTime = Date.now();

    // -------------------------------------------------------------------------
    // Step 1: Update status to "generating"
    // -------------------------------------------------------------------------
    await step.run("update-status-to-generating", async () => {
      await db
        .update(topicSelections)
        .set({ status: "generating", updatedAt: new Date() })
        .where(eq(topicSelections.id, selectionId));
    });

    // -------------------------------------------------------------------------
    // Step 2: Fetch source data
    // -------------------------------------------------------------------------
    const sourceData = await step.run("fetch-source-data", async () => {
      return fetchSourceData(sourceType, sourceId, tenantId);
    });

    // -------------------------------------------------------------------------
    // Step 3: Fetch section for brand composition
    // -------------------------------------------------------------------------
    const section = await step.run("fetch-section", async () => {
      return fetchSectionForSource(sourceType, tenantId);
    });

    // -------------------------------------------------------------------------
    // Step 4: Process formats in parallel (with timeout per format)
    // -------------------------------------------------------------------------
    const results = await step.run("process-formats", async () => {
      // Limit parallel processing to MAX_PARALLEL_FORMATS
      const limitedFormats = formats.slice(0, MAX_PARALLEL_FORMATS);

      const formatResults = await Promise.all(
        limitedFormats.map((formatSpec) =>
          processFormatWithTimeout(
            formatSpec,
            sourceData,
            section,
            tenantId,
            selectionId,
          ),
        ),
      );

      return formatResults;
    });

    // -------------------------------------------------------------------------
    // Step 5: Update individual candidates with generated content
    // -------------------------------------------------------------------------
    await step.run("update-candidates", async () => {
      for (const result of results) {
        if (result.status === "existing" && result.caption) {
          // Candidates were updated inside processFormatWithTimeout
          // This step is for logging/metrics if needed
          console.info(
            `[GenerateContent] Updated candidate for ${result.format}/${result.tone}`,
            {
              candidateId: result.candidateId,
              captionLength: result.caption.length,
            },
          );
        }
      }
    });

    // -------------------------------------------------------------------------
    // Step 6: Finalize status based on results
    // -------------------------------------------------------------------------
    const { finalStatus, successCount, failureCount } = await step.run(
      "finalize-status",
      async () => {
        const successCount = results.filter(
          (r: FormatProcessingResult) => r.status !== "failed",
        ).length;
        const failureCount = results.filter(
          (r: FormatProcessingResult) => r.status === "failed",
        ).length;

        // If ALL formats failed, mark as discarded
        // If at least one succeeded, mark as ready
        // Note: "failed" is not a valid topic_selection status, so we use "discarded"
        const finalStatus: "ready" | "discarded" =
          failureCount === results.length ? "discarded" : "ready";

        const existingMetadata =
          (await db
            .select({ metadata: topicSelections.metadata })
            .from(topicSelections)
            .where(eq(topicSelections.id, selectionId))
            .limit(1)
            .then(
              (rows) =>
                rows[0]?.metadata as Record<string, unknown> | undefined,
            )) || {};

        await db
          .update(topicSelections)
          .set({
            status: finalStatus,
            updatedAt: new Date(),
            metadata: {
              ...existingMetadata,
              lastGenerationAt: new Date().toISOString(),
              generationResults: results.map((r: FormatProcessingResult) => ({
                format: r.format,
                tone: r.tone,
                status: r.status,
                error: r.error,
              })),
            },
          })
          .where(eq(topicSelections.id, selectionId));

        return { finalStatus, successCount, failureCount };
      },
    );

    const durationMs = Date.now() - startTime;

    console.info("[GenerateContent] Content generation complete", {
      selectionId,
      tenantId,
      finalStatus,
      successCount,
      failureCount,
      durationMs,
    });

    return {
      selectionId,
      tenantId,
      status: finalStatus,
      formatsProcessed: results.length,
      successCount,
      failureCount,
      results: results.map((r: FormatProcessingResult) => ({
        format: r.format,
        tone: r.tone,
        status: r.status,
        error: r.error,
      })),
      durationMs,
    };
  },
);
