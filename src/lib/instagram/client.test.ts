import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

import {
  uploadMedia,
  createCarouselContainer,
  publishMedia,
  type InstagramMediaUploadResult,
  type InstagramPublishResult,
  type InstagramDryRunResult,
} from "./client";

// ─── MSW Setup ────────────────────────────────────────────────────────────────

const GRAPH_API_VERSION = "v19.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Track requests for assertion
const issuedRequests: Array<{ url: string; method: string; body?: unknown }> = [];

const mswServer = setupServer(
  // Mock token validation
  http.get(`${GRAPH_API_BASE}/me/accounts`, ({ request }) => {
    const url = new URL(request.url);
    const accessToken = url.searchParams.get("access_token");

    issuedRequests.push({
      url: request.url,
      method: "GET",
    });

    if (accessToken === "valid-token") {
      return HttpResponse.json({
        data: [{ id: "ig-account-123", name: "Test IG Account" }],
      });
    }

    if (accessToken === "expired-token") {
      return HttpResponse.json(
        {
          error: {
            code: 190,
            message: "The access token has expired.",
            error_user_msg: "Access token expired",
          },
        },
        { status: 401 },
      );
    }

    return HttpResponse.json(
      {
        error: {
          code: 190,
          message: "Invalid access token.",
        },
      },
      { status: 401 },
    );
  }),

  // Mock media upload
  http.post(`${GRAPH_API_BASE}/:igAccountId/media`, async ({ request, params }) => {
    const url = new URL(request.url);
    const igAccountId = (params as { igAccountId: string }).igAccountId;

    issuedRequests.push({
      url: request.url,
      method: "POST",
      body: Object.fromEntries(url.searchParams),
    });

    const imageUrl = url.searchParams.get("image_url");
    const creationId = `container-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    return HttpResponse.json({
      id: creationId,
      status: imageUrl?.includes("error") ? "ERROR" : "FINISHED",
    });
  }),

  // Mock carousel container creation
  http.post(`${GRAPH_API_BASE}/:igAccountId/media_creation`, async ({ request, params }) => {
    issuedRequests.push({
      url: request.url,
      method: "POST",
    });

    return HttpResponse.json({
      id: `carousel-container-${Date.now()}`,
      status: "FINISHED",
    });
  }),

  // Mock media publish
  http.post(`${GRAPH_API_BASE}/:igAccountId/media_publish`, async ({ request, params }) => {
    const url = new URL(request.url);
    const accessToken = url.searchParams.get("access_token");

    issuedRequests.push({
      url: request.url,
      method: "POST",
      body: Object.fromEntries(url.searchParams),
    });

    if (accessToken === "expired-token") {
      return HttpResponse.json(
        {
          error: {
            code: 190,
            message: "The access token has expired.",
          },
        },
        { status: 401 },
      );
    }

    return HttpResponse.json({
      id: `ig-post-${Date.now()}`,
      status: "published",
    });
  }),

  // Mock container status check
  http.get(`${GRAPH_API_BASE}/:containerId`, ({ request, params }) => {
    issuedRequests.push({
      url: request.url,
      method: "GET",
    });

    const containerId = (params as { containerId: string }).containerId;

    if (containerId.includes("error")) {
      return HttpResponse.json({
        id: containerId,
        status: "ERROR",
        error_message: "Container creation failed",
      });
    }

    return HttpResponse.json({
      id: containerId,
      status: "FINISHED",
    });
  }),
);

beforeAll(() => {
  mswServer.listen({ onUnhandledRequest: "warn" });
});

beforeEach(() => {
  issuedRequests.length = 0;
  mswServer.resetHandlers();
});

afterAll(() => {
  mswServer.close();
});

// ─── Test Helpers ─────────────────────────────────────────────────────────────

function setInstagramEnv(accessToken: string, igAccountId: string) {
  process.env.INSTAGRAM_ACCESS_TOKEN = accessToken;
  process.env.INSTAGRAM_IG_ACCOUNT_ID = igAccountId;
  process.env.INSTAGRAM_DRY_RUN = "false";
}

function setDryRunEnv() {
  process.env.INSTAGRAM_ACCESS_TOKEN = "dry-run-token";
  process.env.INSTAGRAM_IG_ACCOUNT_ID = "dry-run-account";
  process.env.INSTAGRAM_DRY_RUN = "true";
}

function clearInstagramEnv() {
  delete process.env.INSTAGRAM_ACCESS_TOKEN;
  delete process.env.INSTAGRAM_IG_ACCOUNT_ID;
  delete process.env.INSTAGRAM_DRY_RUN;
}

function isDryRunResult(result: unknown): result is InstagramDryRunResult {
  return typeof result === "object" && result !== null && "dryRun" in result;
}

// ─── Client Tests ─────────────────────────────────────────────────────────────

describe("Instagram client", () => {
  describe("uploadMedia", () => {
    beforeEach(() => {
      clearInstagramEnv();
    });

    it("returns dry-run result when INSTAGRAM_DRY_RUN=true", async () => {
      setDryRunEnv();

      const result = await uploadMedia("https://example.com/image.jpg", "Test caption");

      expect(result).toMatchObject({
        dryRun: true,
        action: "uploadMedia",
        payload: {
          imageUrl: "https://example.com/image.jpg",
          caption: "Test caption",
        },
      });

      // Should not have made any HTTP requests
      expect(issuedRequests).toHaveLength(0);
    });

    it("uploads media successfully with valid credentials", async () => {
      setInstagramEnv("valid-token", "ig-account-123");

      const result = await uploadMedia("https://example.com/image.jpg", "My caption");

      // When not in dry-run mode, result should be InstagramMediaUploadResult
      expect(isDryRunResult(result)).toBe(false);
      const mediaResult = result as InstagramMediaUploadResult;
      expect(mediaResult.containerId).toContain("container-");
      expect(mediaResult.status).toBe("FINISHED");
    });
  });

  describe("createCarouselContainer", () => {
    beforeEach(() => {
      clearInstagramEnv();
    });

    it("returns dry-run result when INSTAGRAM_DRY_RUN=true", async () => {
      setDryRunEnv();

      const result = await createCarouselContainer(
        ["container-1", "container-2", "container-3"],
        "Carousel caption",
      );

      expect(result).toMatchObject({
        dryRun: true,
        action: "createCarouselContainer",
        payload: {
          mediaContainerIds: ["container-1", "container-2", "container-3"],
          caption: "Carousel caption",
        },
      });
    });
  });

  describe("publishMedia", () => {
    beforeEach(() => {
      clearInstagramEnv();
    });

    it("returns dry-run result when INSTAGRAM_DRY_RUN=true", async () => {
      setDryRunEnv();

      const result = await publishMedia("container-123");

      expect(result).toMatchObject({
        dryRun: true,
        action: "publishMedia",
        payload: {
          containerId: "container-123",
        },
      });
    });

    it("publishes media successfully with valid credentials", async () => {
      setInstagramEnv("valid-token", "ig-account-123");

      const result = await publishMedia("container-valid-123");

      // When not in dry-run mode, result should be InstagramPublishResult
      expect(isDryRunResult(result)).toBe(false);
      const publishResult = result as InstagramPublishResult;
      expect(publishResult.instagramPostId).toContain("ig-post-");
      expect(publishResult.status).toBe("published");
    });
  });
});

// ─── Dry Run Mode Tests ───────────────────────────────────────────────────────

describe("dry-run mode", () => {
  beforeEach(() => {
    clearInstagramEnv();
  });

  it("INSTAGRAM_DRY_RUN=true is the default safe behavior", () => {
    // Ensure no env var is set
    delete process.env.INSTAGRAM_DRY_RUN;

    // The isDryRun function should return true by default
    // This is verified by checking that when env is not set, dry run is true
    const result = uploadMedia("https://example.com/test.jpg");
    expect(result).resolves.toMatchObject({ dryRun: true });
  });

  it("INSTAGRAM_DRY_RUN=false actually calls the API", async () => {
    process.env.INSTAGRAM_DRY_RUN = "false";
    setInstagramEnv("valid-token", "ig-account-123");

    const result = await uploadMedia("https://example.com/image.jpg");

    expect(isDryRunResult(result)).toBe(false);
    expect(issuedRequests.length).toBeGreaterThan(0);
  });

  it("logs publish payload without calling Graph API in dry-run mode", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    setDryRunEnv();

    await publishMedia("test-container-id");

    expect(consoleSpy).toHaveBeenCalledWith(
      "[Instagram Dry Run] publishMedia",
      { containerId: "test-container-id" },
    );

    consoleSpy.mockRestore();
  });
});
