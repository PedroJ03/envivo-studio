import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing the module
vi.mock("@/lib/db/client", () => ({
  db: {
    select: vi.fn(),
    transaction: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/inngest/client", () => ({
  inngestClient: {
    send: vi.fn(),
  },
}));

vi.mock("@/lib/generation/config", () => ({
  isGenerationEnabled: vi.fn(),
  FORMAT_GENERATION_TIMEOUT_MS: 30000,
  RETRY_CONFIG: { maxAttempts: 3, backoffMs: [1000, 2000, 4000] },
  MAX_PARALLEL_FORMATS: 3,
}));

import { db } from "@/lib/db/client";
import { inngestClient } from "@/inngest/client";
import { isGenerationEnabled } from "@/lib/generation/config";
import { generateContentFromSelection } from "../content-generator";

describe("generateContentFromSelection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("feature flag", () => {
    it("returns failed status when feature flag is disabled", async () => {
      vi.mocked(isGenerationEnabled).mockReturnValue(false);

      const result = await generateContentFromSelection("selection-1");

      expect(result.status).toBe("failed");
      expect(result.candidates).toEqual([]);
      expect(result.selectionId).toBe("selection-1");
    });

    it("does not query database when feature flag is disabled", async () => {
      vi.mocked(isGenerationEnabled).mockReturnValue(false);

      await generateContentFromSelection("selection-1");

      expect(db.select).not.toHaveBeenCalled();
    });

    it("does not emit event to Inngest when feature flag is disabled", async () => {
      vi.mocked(isGenerationEnabled).mockReturnValue(false);

      await generateContentFromSelection("selection-1");

      expect(inngestClient.send).not.toHaveBeenCalled();
    });
  });

  describe("topic selection not found", () => {
    it("throws error when topic selection does not exist", async () => {
      vi.mocked(isGenerationEnabled).mockReturnValue(true);

      // Mock empty selection result
      const mockLimit = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      vi.mocked(db.select).mockReturnValue({ from: mockFrom } as any);

      await expect(
        generateContentFromSelection("non-existent-id"),
      ).rejects.toThrow("Topic selection not found");
    });
  });
});
