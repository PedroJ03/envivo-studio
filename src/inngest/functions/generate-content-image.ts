import { inngestClient } from "@/inngest/client";
import { db } from "@/lib/db/client";
import { candidateContent, sections, generatedOutputs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { composeBrandTemplate } from "@/lib/brand";
import type { BrandSection } from "@/lib/brand/types";
import { generateImageFromTemplate } from "@/lib/generation/image-generator";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

export const generateContentImageFunction = inngestClient.createFunction(
  {
    id: "generate-content-image",
    name: "Generate Content Image",
    retries: 3,
    triggers: [{ event: "content/generate-image" }],
  },
  async ({
    event,
    step,
  }: {
    event: { data: { candidateId: string; requestedAt: string } };
    step: any;
  }) => {
    const { candidateId } = event.data;

    // Step 1: Fetch candidate content
    const candidate = await step.run("fetch-candidate", async () => {
      const [result] = await db
        .select()
        .from(candidateContent)
        .where(eq(candidateContent.id, candidateId))
        .limit(1);

      if (!result) {
        throw new Error(`Candidate not found: ${candidateId}`);
      }
      return result;
    });

    // Step 2: Fetch section
    const section = await step.run("fetch-section", async () => {
      if (!candidate.sectionId) return null;

      const [result] = await db
        .select()
        .from(sections)
        .where(eq(sections.id, candidate.sectionId))
        .limit(1);

      return result;
    });

    // Step 3: Generate image with BrandComposer
    const imageResult = await step.run("generate-image", async () => {
      const summary = (candidate.summaryJson as Record<string, unknown>) || {};

      // Build section with tenantId from candidate or use default
      const sectionData: BrandSection = section
        ? {
            id: section.id,
            tenantId: section.tenantId,
            slug: section.slug as BrandSection["slug"],
            name: section.name,
            color: section.color,
          }
        : {
            id: "default",
            tenantId: candidate.tenantId,
            slug: "noticias" as BrandSection["slug"], // Default section slug
            name: "General",
            color: "#8B5CF6",
          };

      // Generate image using Satori + Sharp
      const { buffer, width, height } = await generateImageFromTemplate({
        format: candidate.templateId || "post-vertical-45",
        variant: (candidate.templateVariant || "classic") as string,
        section: sectionData,
        title: candidate.title,
        subtitle: summary.description as string,
        photoUrl:
          (summary.imageUrl as string) || "https://placeholder.com/image.jpg",
        date: summary.eventDate as string,
      });

      // Save image to public/generated directory
      const outputDir = join(process.cwd(), "public", "generated");
      await mkdir(outputDir, { recursive: true });
      const fileName = `${candidateId}.png`;
      const filePath = join(outputDir, fileName);
      await writeFile(filePath, buffer);

      // Save to generated_outputs table
      await db.insert(generatedOutputs).values({
        tenantId: candidate.tenantId,
        contentStateId: candidateId, // Using candidateId as contentStateId for now
        candidateContentId: candidateId,
        fileUrl: `/generated/${fileName}`,
        width,
        height,
        sortOrder: 1,
        metadataJson: {
          format: candidate.templateId,
          variant: candidate.templateVariant,
          generatedAt: new Date().toISOString(),
        },
      });

      return {
        imageUrl: `/generated/${fileName}`,
        width,
        height,
      };
    });

    // Step 4: Update candidate with image URL
    await step.run("update-candidate", async () => {
      await db
        .update(candidateContent)
        .set({
          summaryJson: {
            ...((candidate.summaryJson as Record<string, unknown>) || {}),
            generatedImageUrl: imageResult.imageUrl,
            generatedAt: new Date().toISOString(),
          },
          updatedAt: new Date(),
        })
        .where(eq(candidateContent.id, candidateId));
    });

    return {
      candidateId,
      imageUrl: imageResult.imageUrl,
    };
  },
);
