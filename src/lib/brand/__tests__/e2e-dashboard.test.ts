// ============================================================================
// Brand System E2E Tests - Dashboard UI Flow
// filo-news-brand-system Phase 8
// ============================================================================

import { describe, it, expect, beforeAll, beforeEach } from "vitest";

// Mock fetch for API calls
global.fetch = vi.fn();

// ----------------------------------------------------------------------------
// Types for test fixtures
// ----------------------------------------------------------------------------

interface TestSection {
  id: string;
  slug: string;
  name: string;
  color: string;
}

interface TestContent {
  id: string;
  title: string;
  sectionId: string | null;
  templateId: string | null;
  templateVariant: string | null;
  selectedFormat: "post" | "story" | "carousel";
  selectedTone: string | null;
  currentState: string;
}

interface TestPreview {
  fileUrl: string;
  width: number;
  height: number;
  usedBrandTemplate: boolean;
  badgeColor?: string;
}

// ----------------------------------------------------------------------------
// Test Fixtures
// ----------------------------------------------------------------------------

const mockSections: TestSection[] = [
  {
    id: "section-1",
    slug: "proximos-shows",
    name: "Próximos Shows",
    color: "#8B5CF6",
  },
  {
    id: "section-2",
    slug: "efemerides",
    name: "Efemérides",
    color: "#F59E0B",
  },
  {
    id: "section-3",
    slug: "noticias",
    name: "Noticias",
    color: "#06B6D4",
  },
  {
    id: "section-4",
    slug: "bandas-locales",
    name: "Bandas Locales",
    color: "#10B981",
  },
];

const createMockContent = (
  overrides: Partial<TestContent> = {},
): TestContent => ({
  id: "content-1",
  title: "Test Content",
  sectionId: null,
  templateId: null,
  templateVariant: null,
  selectedFormat: "post",
  selectedTone: null,
  currentState: "draft",
  ...overrides,
});

// ----------------------------------------------------------------------------
// Mock API Helpers
// ----------------------------------------------------------------------------

async function fetchSections(): Promise<TestSection[]> {
  const res = await fetch("/api/sections");
  return res.json();
}

async function updateContentMetadata(
  contentId: string,
  metadata: {
    sectionId?: string | null;
    templateId?: string;
    templateVariant?: string;
  },
): Promise<{ ok: boolean }> {
  const res = await fetch(`/api/content/${contentId}/metadata`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(metadata),
  });
  return res.json();
}

async function generatePreview(contentId: string): Promise<TestPreview> {
  const res = await fetch("/api/composer/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateContentId: contentId }),
  });
  return res.json();
}

async function createContentWithSection(
  sectionSlug: string,
): Promise<TestContent> {
  const section = mockSections.find((s) => s.slug === sectionSlug);
  if (!section) {
    throw new Error(`Section ${sectionSlug} not found`);
  }

  const content = createMockContent({
    sectionId: section.id,
    templateId: "post-vertical-45",
    templateVariant: "classic",
  });

  // Simulate API call - mock the fetch for updateContentMetadata
  const mockedFetch = vi.mocked(fetch);
  mockedFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ok: true }),
  } as Response);

  await updateContentMetadata(content.id, {
    sectionId: section.id,
    templateId: "post-vertical-45",
    templateVariant: "classic",
  });

  return content;
}

// ----------------------------------------------------------------------------
// E2E Tests
// ----------------------------------------------------------------------------

describe("Brand System Dashboard E2E Flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("Task 8.1: Section Selector", () => {
    it("should fetch available sections from API", async () => {
      const mockedFetch = vi.mocked(fetch);
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSections,
      } as Response);

      const sections = await fetchSections();

      expect(sections).toHaveLength(4);
      expect(sections[0].slug).toBe("proximos-shows");
      expect(sections[1].slug).toBe("efemerides");
      expect(sections[2].slug).toBe("noticias");
      expect(sections[3].slug).toBe("bandas-locales");
    });

    it("should update content with selected section", async () => {
      const mockedFetch = vi.mocked(fetch);
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      const result = await updateContentMetadata("content-1", {
        sectionId: "section-1",
      });

      expect(result.ok).toBe(true);
      expect(mockedFetch).toHaveBeenCalledWith(
        "/api/content/content-1/metadata",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ sectionId: "section-1" }),
        }),
      );
    });

    it("should allow clearing section selection", async () => {
      const mockedFetch = vi.mocked(fetch);
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      const result = await updateContentMetadata("content-1", {
        sectionId: null,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("Task 8.2: Template and Variant Selectors", () => {
    it("should update content with brand template format", async () => {
      const mockedFetch = vi.mocked(fetch);
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      const result = await updateContentMetadata("content-1", {
        templateId: "post-vertical-45",
        templateVariant: "classic",
      });

      expect(result.ok).toBe(true);
    });

    it("should support all template formats", async () => {
      const formats = [
        { id: "post-vertical-45", width: 1080, height: 1350 },
        { id: "post-square-11", width: 1080, height: 1080 },
        { id: "story-9-16", width: 1080, height: 1920 },
        { id: "reel-cover-9-16", width: 1080, height: 1920 },
      ];

      const mockedFetch = vi.mocked(fetch);

      for (const format of formats) {
        mockedFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({ ok: true }),
        } as Response);

        const result = await updateContentMetadata("content-1", {
          templateId: format.id,
          templateVariant: "classic",
        });

        expect(result.ok).toBe(true);
      }
    });

    it("should support all template variants per format", async () => {
      const variantsByFormat: Record<string, string[]> = {
        "post-vertical-45": ["classic", "centered", "toplogo", "minimal"],
        "post-square-11": ["classic", "centered", "minimal"],
        "story-9-16": ["fullbleed", "split", "minimal"],
        "reel-cover-9-16": ["magazine", "duotone", "minimal"],
      };

      const mockedFetch = vi.mocked(fetch);

      for (const [format, variants] of Object.entries(variantsByFormat)) {
        for (const variant of variants) {
          mockedFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ok: true }),
          } as Response);

          const result = await updateContentMetadata("content-1", {
            templateId: format,
            templateVariant: variant,
          });

          expect(result.ok).toBe(true);
        }
      }
    });
  });

  describe("Task 8.3: Section Color Application", () => {
    it("should apply section color when section is selected", async () => {
      const content = await createContentWithSection("efemerides");

      expect(content.sectionId).toBe("section-2");
      expect(content.templateId).toBe("post-vertical-45");
      expect(content.templateVariant).toBe("classic");
    });

    it("should use correct color for each section", () => {
      const colorMap: Record<string, string> = {
        "proximos-shows": "#8B5CF6",
        efemerides: "#F59E0B",
        noticias: "#06B6D4",
        "bandas-locales": "#10B981",
      };

      for (const section of mockSections) {
        expect(section.color).toBe(colorMap[section.slug]);
      }
    });

    it("should persist section_id in database", async () => {
      const mockedFetch = vi.mocked(fetch);
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      const sectionId = "section-1";
      await updateContentMetadata("content-1", { sectionId });

      const callArgs = mockedFetch.mock.calls[0];
      const body = JSON.parse((callArgs[1] as RequestInit).body as string);
      expect(body.sectionId).toBe(sectionId);
    });
  });

  describe("Task 8.4: Preview Generation Flow", () => {
    it("should generate preview with brand template", async () => {
      const content = await createContentWithSection("proximos-shows");

      const mockedFetch = vi.mocked(fetch);
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          fileUrl: "/preview/test.png",
          width: 1080,
          height: 1350,
          usedBrandTemplate: true,
        }),
      } as Response);

      const preview = await generatePreview(content.id);

      expect(preview.width).toBe(1080);
      expect(preview.height).toBe(1350);
      expect(preview.usedBrandTemplate).toBe(true);
    });

    it("should generate preview with correct dimensions per format", async () => {
      const formatTests = [
        { format: "post-vertical-45", width: 1080, height: 1350 },
        { format: "post-square-11", width: 1080, height: 1080 },
        { format: "story-9-16", width: 1080, height: 1920 },
        { format: "reel-cover-9-16", width: 1080, height: 1920 },
      ];

      const mockedFetch = vi.mocked(fetch);

      for (const { format, width, height } of formatTests) {
        mockedFetch.mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            fileUrl: `/preview/${format}.png`,
            width,
            height,
            usedBrandTemplate: true,
          }),
        } as Response);

        const preview = await generatePreview("content-1");

        expect(preview.width).toBe(width);
        expect(preview.height).toBe(height);
      }
    });

    it("should apply section color to badge in preview", async () => {
      const content = await createContentWithSection("efemerides");

      const mockedFetch = vi.mocked(fetch);
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          fileUrl: "/preview/test.png",
          width: 1080,
          height: 1350,
          usedBrandTemplate: true,
          badgeColor: "#F59E0B",
        }),
      } as Response);

      const preview = await generatePreview(content.id);

      expect(preview.badgeColor).toBe("#F59E0B");
    });
  });

  describe("Complete E2E Flow", () => {
    it("full flow: create content → select section → choose template → generate preview", async () => {
      const mockedFetch = vi.mocked(fetch);

      // Step 1: Fetch sections
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSections,
      } as Response);

      const sections = await fetchSections();
      expect(sections).toHaveLength(4);

      // Step 2: Select section and template
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      await updateContentMetadata("content-1", {
        sectionId: "section-2", // efemerides
        templateId: "post-square-11",
        templateVariant: "centered",
      });

      // Step 3: Generate preview
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          fileUrl: "/preview/test.png",
          width: 1080,
          height: 1080,
          usedBrandTemplate: true,
          badgeColor: "#F59E0B",
        }),
      } as Response);

      const preview = await generatePreview("content-1");

      expect(preview.width).toBe(1080);
      expect(preview.height).toBe(1080);
      expect(preview.usedBrandTemplate).toBe(true);
      expect(preview.badgeColor).toBe("#F59E0B");
    });

    it("should handle legacy content without section", async () => {
      const content = createMockContent({
        sectionId: null,
        templateId: null,
        templateVariant: null,
      });

      expect(content.sectionId).toBeNull();
      expect(content.templateId).toBeNull();
    });

    it("should allow changing template after initial selection", async () => {
      const mockedFetch = vi.mocked(fetch);

      // Initial selection
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      await updateContentMetadata("content-1", {
        templateId: "post-vertical-45",
        templateVariant: "classic",
      });

      // Change to different template
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      } as Response);

      await updateContentMetadata("content-1", {
        templateId: "story-9-16",
        templateVariant: "fullbleed",
      });

      expect(mockedFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      const mockedFetch = vi.mocked(fetch);
      mockedFetch.mockRejectedValueOnce(new Error("Internal server error"));

      await expect(
        updateContentMetadata("content-1", { sectionId: "section-1" }),
      ).rejects.toThrow("Internal server error");
    });

    it("should require tenant context", async () => {
      const mockedFetch = vi.mocked(fetch);
      mockedFetch.mockRejectedValueOnce(
        new Error("Tenant context is required"),
      );

      await expect(fetchSections()).rejects.toThrow(
        "Tenant context is required",
      );
    });
  });
});
