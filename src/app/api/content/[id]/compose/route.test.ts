import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { TENANT_HEADER } from "@/middleware";

const { composeCandidate, MockComposerPhotoResolutionError } = vi.hoisted(() => {
  class MockComposerPhotoResolutionError extends Error {
    public readonly code = "COMPOSER_PHOTO_RESOLUTION_TOO_LOW";

    constructor(width = 0, height = 0, min = 0) {
      super(`Photo resolution ${width}x${height} is below minimum ${min}x${min}.`);
      this.name = "ComposerPhotoResolutionError";
    }
  }

  return {
    composeCandidate: vi.fn(),
    MockComposerPhotoResolutionError,
  };
});

vi.mock("@/lib/composer/composer", () => ({
  composeCandidate,
  ComposerPhotoResolutionError: MockComposerPhotoResolutionError,
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

  return new NextRequest("http://localhost/api/content/content-1/compose", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
}

describe("content compose API", () => {
  it("requires tenant header", async () => {
    const response = await POST(createRequest({}, undefined), { params: { id: "content-1" } });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(401);
    expect(payload.error).toContain("Tenant context is required");
  });

  it("validates payload", async () => {
    const response = await POST(createRequest({ templateId: 123 }, "tenant-1"), { params: { id: "content-1" } });
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Invalid compose request");
  });

  it("persists composed asset and returns composed metadata", async () => {
    composeCandidate.mockResolvedValueOnce({
      filePath: "/tmp/composer-assets/tenant/content-1/preview-post-content-1.png",
      fileUrl: "/composer-assets/tenant/content-1/preview-post-content-1.png",
      templateId: "ig-post-square",
      width: 1080,
      height: 1080,
      bytes: 2048,
      generatedOutputId: "output-1",
      contentStateId: "state-1",
      sortOrder: 0,
      metadata: {
        candidateContentId: "content-1",
      },
    });

    const response = await POST(
      createRequest({ templateId: "ig-post-square", sortOrder: 1 }, "tenant-1"),
      { params: { id: "content-1" } },
    );
    const payload = (await response.json()) as {
      ok: boolean;
      candidateContentId: string;
      generatedOutputId: string;
      contentStateId: string;
      sortOrder: number;
    };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.generatedOutputId).toBe("output-1");
    expect(payload.contentStateId).toBe("state-1");
    expect(payload.sortOrder).toBe(0);
    expect(composeCandidate).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant-1",
        candidateContentId: "content-1",
        templateId: "ig-post-square",
        sortOrder: 1,
      }),
    );
  });

  it("maps resolution errors to 400", async () => {
    composeCandidate.mockRejectedValueOnce(new MockComposerPhotoResolutionError(1, 1, 720));

    const response = await POST(createRequest({}, "tenant-1"), { params: { id: "content-1" } });
    const payload = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(400);
    expect(payload.code).toBe("COMPOSER_PHOTO_RESOLUTION_TOO_LOW");
    expect(payload.error).toContain("resolution");
  });
});
