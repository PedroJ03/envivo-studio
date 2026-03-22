import { NextRequest, NextResponse } from "next/server";
import { getCandidateContentData } from "@/lib/content/queries";
import { composeBrandTemplate } from "@/lib/brand";
import satori from "satori";
import type { TemplateFormat, BrandSectionSlug } from "@/lib/brand/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> },
) {
  try {
    const { candidateId } = await params;
    const { searchParams } = new URL(request.url);

    // Get variant from query param if provided (for live preview), otherwise use DB value
    const previewVariant = searchParams.get("variant");

    // Fetch candidate data
    const candidate = await getCandidateContentData(candidateId);

    if (!candidate) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 },
      );
    }

    // Use preview variant if provided, otherwise fall back to saved variant
    const activeVariant = previewVariant || candidate.templateVariant;

    // Build section object for BrandComposer
    // Using sectionSlug as id since BrandSection requires an id field
    const section = {
      id: candidate.sectionSlug,
      tenantId: "", // Not needed for preview
      slug: candidate.sectionSlug as BrandSectionSlug,
      name: candidate.sectionName,
      color: candidate.sectionColor,
    };

    // Compose brand template
    const { element, width, height, fonts } = composeBrandTemplate({
      format: candidate.templateId as TemplateFormat,
      variant: activeVariant as any,
      section,
      title: candidate.title,
      subtitle: candidate.subtitle,
      photoUrl: candidate.photoUrl || "",
      date: candidate.date,
    });

    // Render with Satori
    const svg = await satori(element, {
      width,
      height,
      fonts: fonts as unknown as Parameters<typeof satori>[1]["fonts"],
    });

    // Return SVG
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (error) {
    console.error("Preview generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 },
    );
  }
}
