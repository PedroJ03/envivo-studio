import { NextRequest, NextResponse } from "next/server";
import { inngestClient } from "@/inngest/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Emit event to Inngest for async image generation
    await inngestClient.send({
      name: "content/generate-image",
      data: {
        candidateId: id,
        requestedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      status: "pending",
      candidateId: id,
      message: "Image generation queued",
    });
  } catch (error) {
    console.error("Error queuing image generation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
