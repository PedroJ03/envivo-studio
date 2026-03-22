import { db } from "@/lib/db/client";
import { candidateContent, sections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { CandidateContentData } from "./types";
import type { BrandSectionSlug } from "@/lib/brand/types";

export async function getCandidateContentData(
  candidateId: string,
): Promise<CandidateContentData | null> {
  const [candidate] = await db
    .select()
    .from(candidateContent)
    .where(eq(candidateContent.id, candidateId))
    .limit(1);

  if (!candidate) return null;

  // Fetch section if exists
  let sectionData: {
    slug: "proximos-shows" | "efemerides" | "noticias" | "bandas-locales";
    name: string;
    color: string;
  } = {
    slug: "noticias",
    name: "General",
    color: "#8B5CF6",
  };

  if (candidate.sectionId) {
    const [section] = await db
      .select()
      .from(sections)
      .where(eq(sections.id, candidate.sectionId))
      .limit(1);

    if (section) {
      sectionData = {
        slug: section.slug as BrandSectionSlug,
        name: section.name,
        color: section.color,
      };
    }
  }

  const summary = (candidate.summaryJson as Record<string, unknown>) || {};

  return {
    id: candidate.id,
    title: candidate.title,
    subtitle: summary.description as string,
    photoUrl: summary.imageUrl as string,
    date: summary.eventDate as string,
    sectionSlug: sectionData.slug,
    sectionName: sectionData.name,
    sectionColor: sectionData.color,
    templateId: candidate.templateId || "post-vertical-45",
    templateVariant: (candidate.templateVariant || "classic") as any,
    caption: summary.caption as string,
    hashtags: summary.hashtags as string[],
    status: candidate.status,
  };
}
