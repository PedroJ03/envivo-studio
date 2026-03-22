import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { candidateContent } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { templateVariant } = body;

    // Validate template variant
    const validVariants = [
      "classic",
      "minimal",
      "centered",
      "toplogo",
      "fullbleed",
      "split",
      "magazine",
      "duotone",
    ];
    if (!validVariants.includes(templateVariant)) {
      return NextResponse.json(
        { error: "Invalid template variant", validVariants },
        { status: 400 },
      );
    }

    // Update candidate_content
    const [updated] = await db
      .update(candidateContent)
      .set({
        templateVariant,
        updatedAt: new Date(),
      })
      .where(eq(candidateContent.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Candidate not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      candidateId: updated.id,
      templateVariant: updated.templateVariant,
    });
  } catch (error) {
    console.error("Error saving template variant:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
