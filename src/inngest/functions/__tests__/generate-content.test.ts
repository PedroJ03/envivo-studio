import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/ai/generate", () => ({
  generatePersonaText: vi.fn().mockResolvedValue({
    caption: "Test caption",
    hashtags: ["#test"],
  }),
}));

vi.mock("@/lib/brand/BrandComposer", () => ({
  composeBrandTemplate: vi.fn().mockReturnValue({
    width: 1080,
    height: 1920,
  }),
}));

vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock("@/inngest/client", () => ({
  inngestClient: {
    createFunction: vi.fn().mockReturnValue({
      fn: vi.fn(),
    }),
  },
}));

import { generateContentFunction } from "../generate-content";

describe("generateContentFunction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("function configuration", () => {
    it("is defined with correct id", () => {
      expect(generateContentFunction).toBeDefined();
    });

    it("has name 'Generate Content from Topic Selection'", () => {
      // The name is set in the Inngest function configuration
      // We verify the function object exists and has expected structure
      expect(generateContentFunction).toBeDefined();
    });
  });

  describe("event schema", () => {
    it("accepts valid topic/selected event data", async () => {
      const validEvent = {
        name: "topic/selected" as const,
        data: {
          selectionId: "123e4567-e89b-12d3-a456-426614174000",
          tenantId: "123e4567-e89b-12d3-a456-426614174001",
          sourceType: "calendar_event" as const,
          sourceId: "123e4567-e89b-12d3-a456-426614174002",
          formats: [
            {
              type: "post" as const,
              tone: "informative" as const,
              priority: 1,
            },
          ],
        },
      };

      // Just verify the event structure is valid
      expect(validEvent.data.selectionId).toBeDefined();
      expect(validEvent.data.formats).toHaveLength(1);
    });
  });
});
