import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { TENANT_HEADER } from "@/middleware";

const { renderCandidatePreview } = vi.hoisted(() => ({
  renderCandidatePreview: vi.fn(),
}));

vi.mock("@/lib/composer/composer", () => ({
  renderCandidatePreview,
  ComposerPhotoResolutionError: class extends Error {
    public readonly code = "COMPOSER_PHOTO_RESOLUTION_TOO_LOW";
    constructor() {
      super("Photo resolution is too low");
    }
  },
  ComposerCandidateNotFoundError: class extends Error {
    public readonly code = "COMPOSER_CANDIDATE_NOT_FOUND";
    constructor() {
      super("Candidate not found");
    }
  },
  ComposerPhotoNotFoundError: class extends Error {
    public readonly code = "COMPOSER_PHOTO_NOT_FOUND";
    constructor() {
      super("Photo not found");
    }
  },
}));

import { POST } from "./route";

function createRequest(input: unknown, tenantId?: string): NextRequest {
  const headers: Record<string, string> = {};

  if (tenantId) {
    headers[TENANT_HEADER] = tenantId;
  }

  return new NextRequest("http://localhost/api/composer/preview", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
}

describe("composer preview API", () => {
  it("requires tenant header", async () => {
    const response = await POST(createRequest({ candidateContentId: "cand-1"}));
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toMatch(/Tenant context is required/);
  });

  it("validates payload shape", async () => {
    const response = await POST(createRequest({}, "tenant-1"));
    const payload = (await response.json()) as { error: string; details?: unknown };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid preview request");
    expect(payload.details).toBeDefined();
  });

  it("returns preview metadata on success", async () => {
    renderCandidatePreview.mockResolvedValueOnce({
      filePath: "/tmp/composer-assets/tenant/candidate/file.png",
      fileUrl: "/composer-assets/tenant/candidate/file.png",
      templateId: "ig-post-square",
      width: 1080,
      height: 1080,
      bytes: 321,
      metadata: {
        candidateContentId: "cand-1",
      },
    });

    const response = await POST(createRequest({ candidateContentId: "cand-1" }, "tenant-1"));
    const payload = (await response.json()) as {
      ok: boolean;
      candidateContentId: string;
      templateId: string;
      fileUrl: string;
      filePath: string;
      width: number;
      height: number;
      bytes: number;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.candidateContentId).toBe("cand-1");
    expect(payload.templateId).toBe("ig-post-square");

    expect(renderCandidatePreview).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      candidateContentId: "cand-1",
      templateId: undefined,
    });
  });

  it("maps render failures to 502", async () => {
    renderCandidatePreview.mockRejectedValueOnce(new Error("render failed"));

    const response = await POST(createRequest({ candidateContentId: "cand-1" }, "tenant-1"));
    const payload = (await response.json()) as { error: string; details?: unknown };

    expect(response.status).toBe(502);
    expect(payload.error).toBe("Failed to render candidate preview");
    expect(payload.details).toContain("Error: render failed");
  });
});
