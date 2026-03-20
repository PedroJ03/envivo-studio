import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

import { TENANT_HEADER } from "@/middleware";
import { renderCandidatePreview } from "@/lib/composer/composer";
import {
  ComposerCandidateNotFoundError,
  ComposerPhotoNotFoundError,
  ComposerPhotoResolutionError,
} from "@/lib/composer/composer";

const previewRenderSchema = z.object({
  candidateContentId: z.string().min(1),
  templateId: z.string().min(1).optional(),
});

type PreviewRenderRequest = {
  candidateContentId: string;
  templateId?: string;
};

type PreviewRenderResponse = {
  ok: true;
  candidateContentId: string;
  templateId: string;
  fileUrl: string;
  filePath: string;
  width: number;
  height: number;
  bytes: number;
};

export async function POST(request: NextRequest): Promise<NextResponse<PreviewRenderResponse | { error: string; details?: unknown }>> {
  const tenantId = request.headers.get(TENANT_HEADER);

  if (!tenantId) {
    return NextResponse.json(
      { error: "Tenant context is required. Send x-tenant-id header or tenant_id query param." },
      { status: 401 },
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const parsed = previewRenderSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid preview request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const body = parsed.data as PreviewRenderRequest;

  try {
    const output = await renderCandidatePreview({
      tenantId,
      candidateContentId: body.candidateContentId,
      templateId: body.templateId,
    });

    return NextResponse.json(
      {
        ok: true,
        candidateContentId: output.metadata.candidateContentId,
        templateId: output.templateId,
        fileUrl: output.fileUrl,
        filePath: output.filePath,
        width: output.width,
        height: output.height,
        bytes: output.bytes,
      },
      { status: 200 },
    );
  } catch (error) {
    if (
      error instanceof ComposerPhotoResolutionError
      || error instanceof ComposerCandidateNotFoundError
      || error instanceof ComposerPhotoNotFoundError
    ) {
      const status = error instanceof ComposerPhotoResolutionError ? 400 : 404;

      return NextResponse.json(
        { error: error.message, code: error.code },
        { status },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to render candidate preview",
        details: `${error}`,
      },
      { status: 502 },
    );
  }
}
