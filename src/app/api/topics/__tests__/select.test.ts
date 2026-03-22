import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock dependencies before importing
vi.mock("@/lib/topics/queries", () => ({
  createTopicSelection: vi.fn(),
}));

vi.mock("@/lib/generation", () => ({
  isGenerationEnabled: vi.fn(),
  generateContentFromSelection: vi.fn(),
}));

vi.mock("@/lib/db/tenant", () => ({
  getTenantIdBySlug: vi.fn(),
}));

vi.mock("@/proxy", () => ({
  TENANT_HEADER: "x-tenant-id",
}));

import { POST } from "../select/route";
import { createTopicSelection } from "@/lib/topics/queries";
import {
  isGenerationEnabled,
  generateContentFromSelection,
} from "@/lib/generation";
import { getTenantIdBySlug } from "@/lib/db/tenant";

describe("POST /api/topics/select", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tenant resolution", () => {
    it("returns 401 when no tenant context is provided", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/topics/select",
        {
          method: "POST",
          body: JSON.stringify({
            sourceType: "calendar_event",
            sourceId: "123e4567-e89b-12d3-a456-426614174000",
            formats: [{ type: "post", tone: "informative", priority: 1 }],
          }),
        },
      );

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it("uses tenant from x-tenant-id header when provided", async () => {
      vi.mocked(getTenantIdBySlug).mockResolvedValue(null);
      vi.mocked(createTopicSelection).mockResolvedValue({
        selectionId: "selection-1",
        status: "pending",
      } as any);

      const request = new NextRequest(
        "http://localhost:3000/api/topics/select",
        {
          method: "POST",
          headers: {
            "x-tenant-id": "123e4567-e89b-12d3-a456-426614174000",
          },
          body: JSON.stringify({
            sourceType: "calendar_event",
            sourceId: "123e4567-e89b-12d3-a456-426614174000",
            formats: [{ type: "post", tone: "informative", priority: 1 }],
          }),
        },
      );

      const response = await POST(request);
      // Should not be 401 since tenant header is provided
      expect(response.status).not.toBe(401);
    });
  });

  describe("request validation", () => {
    it("returns 400 when sourceType is missing", async () => {
      vi.mocked(getTenantIdBySlug).mockResolvedValue("tenant-1");

      const request = new NextRequest(
        "http://localhost:3000/api/topics/select",
        {
          method: "POST",
          headers: {
            "x-tenant-id": "tenant-1",
          },
          body: JSON.stringify({
            sourceId: "123e4567-e89b-12d3-a456-426614174000",
            formats: [{ type: "post", tone: "informative", priority: 1 }],
          }),
        },
      );

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("returns 400 when formats array is empty", async () => {
      vi.mocked(getTenantIdBySlug).mockResolvedValue("tenant-1");

      const request = new NextRequest(
        "http://localhost:3000/api/topics/select",
        {
          method: "POST",
          headers: {
            "x-tenant-id": "tenant-1",
          },
          body: JSON.stringify({
            sourceType: "calendar_event",
            sourceId: "123e4567-e89b-12d3-a456-426614174000",
            formats: [],
          }),
        },
      );

      const response = await POST(request);
      expect(response.status).toBe(400);
    });

    it("returns 400 when formats contains invalid tone", async () => {
      vi.mocked(getTenantIdBySlug).mockResolvedValue("tenant-1");

      const request = new NextRequest(
        "http://localhost:3000/api/topics/select",
        {
          method: "POST",
          headers: {
            "x-tenant-id": "tenant-1",
          },
          body: JSON.stringify({
            sourceType: "calendar_event",
            sourceId: "123e4567-e89b-12d3-a456-426614174000",
            formats: [{ type: "post", tone: "invalid_tone", priority: 1 }],
          }),
        },
      );

      const response = await POST(request);
      expect(response.status).toBe(400);
    });
  });

  describe("topic selection creation", () => {
    it("creates topic selection successfully", async () => {
      vi.mocked(getTenantIdBySlug).mockResolvedValue("tenant-1");
      vi.mocked(createTopicSelection).mockResolvedValue({
        selectionId: "selection-1",
        status: "pending",
      } as any);
      vi.mocked(isGenerationEnabled).mockReturnValue(false);

      const request = new NextRequest(
        "http://localhost:3000/api/topics/select",
        {
          method: "POST",
          headers: {
            "x-tenant-id": "tenant-1",
          },
          body: JSON.stringify({
            sourceType: "calendar_event",
            sourceId: "123e4567-e89b-12d3-a456-426614174000",
            formats: [{ type: "post", tone: "informative", priority: 1 }],
          }),
        },
      );

      const response = await POST(request);
      expect(response.status).toBe(201);
      expect(createTopicSelection).toHaveBeenCalledWith(
        "tenant-1",
        expect.any(String), // MOCK_USER_ID
        expect.objectContaining({
          sourceType: "calendar_event",
          sourceId: "123e4567-e89b-12d3-a456-426614174000",
          formats: expect.any(Array),
        }),
      );
    });

    it("returns 409 when topic already selected", async () => {
      vi.mocked(getTenantIdBySlug).mockResolvedValue("tenant-1");
      vi.mocked(createTopicSelection).mockRejectedValue(
        new Error("Topic already selected"),
      );

      const request = new NextRequest(
        "http://localhost:3000/api/topics/select",
        {
          method: "POST",
          headers: {
            "x-tenant-id": "tenant-1",
          },
          body: JSON.stringify({
            sourceType: "calendar_event",
            sourceId: "123e4567-e89b-12d3-a456-426614174000",
            formats: [{ type: "post", tone: "informative", priority: 1 }],
          }),
        },
      );

      const response = await POST(request);
      expect(response.status).toBe(409);
    });
  });

  describe("generation trigger", () => {
    it("calls generateContentFromSelection when feature flag is enabled", async () => {
      vi.mocked(getTenantIdBySlug).mockResolvedValue("tenant-1");
      vi.mocked(createTopicSelection).mockResolvedValue({
        selectionId: "selection-1",
        status: "pending",
      } as any);
      vi.mocked(isGenerationEnabled).mockReturnValue(true);
      vi.mocked(generateContentFromSelection).mockResolvedValue({
        selectionId: "selection-1",
        status: "generating",
        candidates: [{ candidateId: "c1", format: "post", status: "created" }],
      });

      const request = new NextRequest(
        "http://localhost:3000/api/topics/select",
        {
          method: "POST",
          headers: {
            "x-tenant-id": "tenant-1",
          },
          body: JSON.stringify({
            sourceType: "calendar_event",
            sourceId: "123e4567-e89b-12d3-a456-426614174000",
            formats: [{ type: "post", tone: "informative", priority: 1 }],
          }),
        },
      );

      const response = await POST(request);
      expect(response.status).toBe(201);
      expect(generateContentFromSelection).toHaveBeenCalledWith("selection-1", {
        emitEvent: true,
      });
    });

    it("does not call generateContentFromSelection when feature flag is disabled", async () => {
      vi.mocked(getTenantIdBySlug).mockResolvedValue("tenant-1");
      vi.mocked(createTopicSelection).mockResolvedValue({
        selectionId: "selection-1",
        status: "pending",
      } as any);
      vi.mocked(isGenerationEnabled).mockReturnValue(false);

      const request = new NextRequest(
        "http://localhost:3000/api/topics/select",
        {
          method: "POST",
          headers: {
            "x-tenant-id": "tenant-1",
          },
          body: JSON.stringify({
            sourceType: "calendar_event",
            sourceId: "123e4567-e89b-12d3-a456-426614174000",
            formats: [{ type: "post", tone: "informative", priority: 1 }],
          }),
        },
      );

      await POST(request);
      expect(generateContentFromSelection).not.toHaveBeenCalled();
    });

    it("returns 201 even if generation trigger fails", async () => {
      vi.mocked(getTenantIdBySlug).mockResolvedValue("tenant-1");
      vi.mocked(createTopicSelection).mockResolvedValue({
        selectionId: "selection-1",
        status: "pending",
      } as any);
      vi.mocked(isGenerationEnabled).mockReturnValue(true);
      vi.mocked(generateContentFromSelection).mockRejectedValue(
        new Error("Generation failed"),
      );

      const request = new NextRequest(
        "http://localhost:3000/api/topics/select",
        {
          method: "POST",
          headers: {
            "x-tenant-id": "tenant-1",
          },
          body: JSON.stringify({
            sourceType: "calendar_event",
            sourceId: "123e4567-e89b-12d3-a456-426614174000",
            formats: [{ type: "post", tone: "informative", priority: 1 }],
          }),
        },
      );

      const response = await POST(request);
      // Should still return 201 because selection was created successfully
      expect(response.status).toBe(201);
    });

    it("includes generation status in response when enabled", async () => {
      vi.mocked(getTenantIdBySlug).mockResolvedValue("tenant-1");
      vi.mocked(createTopicSelection).mockResolvedValue({
        selectionId: "selection-1",
        status: "pending",
      } as any);
      vi.mocked(isGenerationEnabled).mockReturnValue(true);
      vi.mocked(generateContentFromSelection).mockResolvedValue({
        selectionId: "selection-1",
        status: "generating",
        candidates: [
          { candidateId: "c1", format: "post", status: "created" },
          { candidateId: "c2", format: "story", status: "created" },
        ],
      });

      const request = new NextRequest(
        "http://localhost:3000/api/topics/select",
        {
          method: "POST",
          headers: {
            "x-tenant-id": "tenant-1",
          },
          body: JSON.stringify({
            sourceType: "calendar_event",
            sourceId: "123e4567-e89b-12d3-a456-426614174000",
            formats: [
              { type: "post", tone: "informative", priority: 1 },
              { type: "story", tone: "humorous", priority: 2 },
            ],
          }),
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(data.generation).toEqual({
        status: "generating",
        candidatesCount: 2,
      });
    });

    it("includes null generation in response when disabled", async () => {
      vi.mocked(getTenantIdBySlug).mockResolvedValue("tenant-1");
      vi.mocked(createTopicSelection).mockResolvedValue({
        selectionId: "selection-1",
        status: "pending",
      } as any);
      vi.mocked(isGenerationEnabled).mockReturnValue(false);

      const request = new NextRequest(
        "http://localhost:3000/api/topics/select",
        {
          method: "POST",
          headers: {
            "x-tenant-id": "tenant-1",
          },
          body: JSON.stringify({
            sourceType: "calendar_event",
            sourceId: "123e4567-e89b-12d3-a456-426614174000",
            formats: [{ type: "post", tone: "informative", priority: 1 }],
          }),
        },
      );

      const response = await POST(request);
      const data = await response.json();

      expect(data.generation).toBeNull();
    });
  });
});
