import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { TENANT_HEADER } from "@/proxy";
import {
  ComposerCandidateNotFoundError,
  ComposerPhotoNotFoundError,
  ComposerPhotoResolutionError,
  composeCandidate,
  type ComposerComposeInput,
} from "@/lib/composer/composer";

const composeRequestSchema = z.object({
  templateId: z.string().min(1).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

type ComposeRouteInput = z.infer<typeof composeRequestSchema>;

type ComposeRouteResponse = {
  ok: true;
  candidateContentId: string;
  templateId: string;
  generatedOutputId: string;
  contentStateId: string;
  fileUrl: string;
  filePath: string;
  width: number;
  height: number;
  sortOrder: number;
  bytes: number;
};

type RouteContext = {
  params: {
    id: string;
  };
};

function buildInput(raw: ComposeRouteInput, tenantId: string, candidateContentId: string): ComposerComposeInput {
  return {
    tenantId,
    candidateContentId,
    templateId: raw.templateId,
    sortOrder: raw.sortOrder,
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const tenantId = request.headers.get(TENANT_HEADER);

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required. Send x-tenant-id header or tenant_id query param." },
      { status: 401 },
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = composeRequestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid compose request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const output = await composeCandidate(buildInput(parsed.data, tenantId, context.params.id));

    const response: ComposeRouteResponse = {
      ok: true,
      candidateContentId: output.metadata.candidateContentId,
      templateId: output.templateId,
      generatedOutputId: output.generatedOutputId,
      contentStateId: output.contentStateId,
      fileUrl: output.fileUrl,
      filePath: output.filePath,
      width: output.width,
      height: output.height,
      sortOrder: output.sortOrder,
      bytes: output.bytes,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (
      error instanceof ComposerPhotoResolutionError
      || error instanceof ComposerCandidateNotFoundError
      || error instanceof ComposerPhotoNotFoundError
    ) {
      const status = error instanceof ComposerPhotoResolutionError ? 400 : 404;

      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }

    return NextResponse.json(
      {
        error: "Failed to compose content",
        details: `${error}`,
      },
      { status: 502 },
    );
  }
}
