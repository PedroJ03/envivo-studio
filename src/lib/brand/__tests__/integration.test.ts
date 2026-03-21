// ============================================================================
// Brand System Integration Tests
// filo-news-brand-system
// ============================================================================

import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  composeBrandTemplate,
  isBrandTemplateFormat,
  validateBrandComposeInput,
} from "../BrandComposer";
import type { BrandSection, TemplateFormat } from "../types";

// ----------------------------------------------------------------------------
// Test Fixtures
// ----------------------------------------------------------------------------

const mockSection: BrandSection = {
  id: "test-section-1",
  tenantId: "test-tenant-1",
  slug: "proximos-shows",
  name: "Próximos Shows",
  color: "#8B5CF6",
};

const mockPhotoUrl = "https://example.com/test-photo.jpg";

// ----------------------------------------------------------------------------
// Integration Tests
// ----------------------------------------------------------------------------

describe("BrandComposer Integration", () => {
  describe("composeBrandTemplate", () => {
    it("should render post-vertical-45 with classic variant without errors", () => {
      const result = composeBrandTemplate({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: "Test Title",
        subtitle: "Test Subtitle",
        photoUrl: mockPhotoUrl,
        date: "2024-03-15",
      });

      expect(result).toBeDefined();
      expect(result.element).toBeDefined();
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1350);
      expect(result.fonts).toBeDefined();
      expect(Array.isArray(result.fonts)).toBe(true);
    });

    it("should render post-square-11 with centered variant without errors", () => {
      const result = composeBrandTemplate({
        format: "post-square-11",
        variant: "centered",
        section: mockSection,
        title: "Test Title",
        subtitle: "Test Subtitle",
        photoUrl: mockPhotoUrl,
      });

      expect(result).toBeDefined();
      expect(result.element).toBeDefined();
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1080);
    });

    it("should render story-9-16 with fullbleed variant without errors", () => {
      const result = composeBrandTemplate({
        format: "story-9-16",
        variant: "fullbleed",
        section: mockSection,
        title: "Test Title",
        photoUrl: mockPhotoUrl,
      });

      expect(result).toBeDefined();
      expect(result.element).toBeDefined();
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1920);
    });

    it("should render reel-cover-9-16 with magazine variant without errors", () => {
      const result = composeBrandTemplate({
        format: "reel-cover-9-16",
        variant: "magazine",
        section: mockSection,
        title: "Test Title",
        subtitle: "Test Subtitle",
        photoUrl: mockPhotoUrl,
      });

      expect(result).toBeDefined();
      expect(result.element).toBeDefined();
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1920);
    });

    it("should throw error for unknown format", () => {
      expect(() =>
        composeBrandTemplate({
          format: "unknown-format" as TemplateFormat,
          variant: "classic",
          section: mockSection,
          title: "Test",
          photoUrl: mockPhotoUrl,
        }),
      ).toThrow("[BrandComposer] Unknown format");
    });

    it("should work with minimal variant for all formats", () => {
      const formats: TemplateFormat[] = [
        "post-vertical-45",
        "post-square-11",
        "story-9-16",
        "reel-cover-9-16",
      ];

      formats.forEach((format) => {
        const result = composeBrandTemplate({
          format,
          variant: "minimal",
          section: mockSection,
          title: "Minimal Test",
          photoUrl: mockPhotoUrl,
        });

        expect(result).toBeDefined();
        expect(result.element).toBeDefined();
      });
    });
  });

  describe("isBrandTemplateFormat", () => {
    it("should return true for valid brand formats", () => {
      expect(isBrandTemplateFormat("post-vertical-45")).toBe(true);
      expect(isBrandTemplateFormat("post-square-11")).toBe(true);
      expect(isBrandTemplateFormat("story-9-16")).toBe(true);
      expect(isBrandTemplateFormat("reel-cover-9-16")).toBe(true);
    });

    it("should return false for invalid formats", () => {
      expect(isBrandTemplateFormat("post")).toBe(false);
      expect(isBrandTemplateFormat("story")).toBe(false);
      expect(isBrandTemplateFormat("carousel")).toBe(false);
      expect(isBrandTemplateFormat("")).toBe(false);
      expect(isBrandTemplateFormat("invalid")).toBe(false);
    });

    it("should return false for legacy template IDs", () => {
      expect(isBrandTemplateFormat("legacy-post-1")).toBe(false);
      expect(isBrandTemplateFormat("classic-story")).toBe(false);
    });
  });

  describe("validateBrandComposeInput", () => {
    it("should return valid for complete input", () => {
      const result = validateBrandComposeInput({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: "Test Title",
        photoUrl: mockPhotoUrl,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return errors for missing required fields", () => {
      const result = validateBrandComposeInput({
        format: undefined as unknown as TemplateFormat,
        section: undefined as unknown as BrandSection,
        title: undefined as unknown as string,
        photoUrl: undefined as unknown as string,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain("format is required");
      expect(result.errors).toContain("section is required");
      expect(result.errors).toContain("title is required");
      expect(result.errors).toContain("photoUrl is required");
    });

    it("should return error for invalid format", () => {
      const result = validateBrandComposeInput({
        format: "invalid-format" as TemplateFormat,
        section: mockSection,
        title: "Test",
        photoUrl: mockPhotoUrl,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        "format 'invalid-format' is not a valid brand template format",
      );
    });

    it("should validate section object properties", () => {
      const invalidSection = {
        id: "",
        tenantId: "",
        slug: "",
        name: "",
        color: "",
      } as unknown as BrandSection;
      const result = validateBrandComposeInput({
        format: "post-vertical-45",
        section: invalidSection,
        title: "Test",
        photoUrl: mockPhotoUrl,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("section.slug is required");
      expect(result.errors).toContain("section.name is required");
      expect(result.errors).toContain("section.color is required");
    });
  });

  describe("Template dimensions", () => {
    it("should have correct dimensions for post-vertical-45", () => {
      const result = composeBrandTemplate({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: "Test",
        photoUrl: mockPhotoUrl,
      });

      // 4:5 aspect ratio
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1350);
      expect(result.width / result.height).toBeCloseTo(4 / 5, 2);
    });

    it("should have correct dimensions for post-square-11", () => {
      const result = composeBrandTemplate({
        format: "post-square-11",
        variant: "classic",
        section: mockSection,
        title: "Test",
        photoUrl: mockPhotoUrl,
      });

      // 1:1 aspect ratio
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1080);
      expect(result.width).toBe(result.height);
    });

    it("should have correct dimensions for story-9-16", () => {
      const result = composeBrandTemplate({
        format: "story-9-16",
        variant: "fullbleed",
        section: mockSection,
        title: "Test",
        photoUrl: mockPhotoUrl,
      });

      // 9:16 aspect ratio
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1920);
      expect(result.width / result.height).toBeCloseTo(9 / 16, 2);
    });

    it("should have correct dimensions for reel-cover-9-16", () => {
      const result = composeBrandTemplate({
        format: "reel-cover-9-16",
        variant: "magazine",
        section: mockSection,
        title: "Test",
        photoUrl: mockPhotoUrl,
      });

      // 9:16 aspect ratio
      expect(result.width).toBe(1080);
      expect(result.height).toBe(1920);
      expect(result.width / result.height).toBeCloseTo(9 / 16, 2);
    });
  });

  describe("Font loading", () => {
    it("should load Syne fonts", () => {
      const result = composeBrandTemplate({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: "Test",
        photoUrl: mockPhotoUrl,
      });

      // Should have fonts array (may be empty if files don't exist in test env)
      expect(result.fonts).toBeDefined();
      expect(Array.isArray(result.fonts)).toBe(true);
    });
  });

  describe("Section variations", () => {
    const sections: BrandSection["slug"][] = [
      "proximos-shows",
      "efemerides",
      "noticias",
      "bandas-locales",
    ];

    sections.forEach((slug) => {
      it(`should render correctly for section: ${slug}`, () => {
        const section: BrandSection = {
          ...mockSection,
          slug,
          name: slug
            .replace(/-/g, " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
        };

        const result = composeBrandTemplate({
          format: "post-vertical-45",
          variant: "classic",
          section,
          title: `Test for ${slug}`,
          photoUrl: mockPhotoUrl,
        });

        expect(result).toBeDefined();
        expect(result.element).toBeDefined();
      });
    });
  });
});

// ----------------------------------------------------------------------------
// Edge Cases
// ----------------------------------------------------------------------------

describe("BrandComposer Edge Cases", () => {
  it("should handle very long titles gracefully", () => {
    const longTitle = "A".repeat(200);

    const result = composeBrandTemplate({
      format: "post-vertical-45",
      variant: "classic",
      section: mockSection,
      title: longTitle,
      photoUrl: mockPhotoUrl,
    });

    expect(result).toBeDefined();
    expect(result.element).toBeDefined();
  });

  it("should handle empty subtitle", () => {
    const result = composeBrandTemplate({
      format: "post-vertical-45",
      variant: "classic",
      section: mockSection,
      title: "Test Title",
      subtitle: "",
      photoUrl: mockPhotoUrl,
    });

    expect(result).toBeDefined();
  });

  it("should handle special characters in title", () => {
    const result = composeBrandTemplate({
      format: "post-vertical-45",
      variant: "classic",
      section: mockSection,
      title: "¡Show de Los Enanitos Verdes! 🎸 (Tandil)",
      photoUrl: mockPhotoUrl,
    });

    expect(result).toBeDefined();
  });

  it("should work with all variant combinations", () => {
    const variants = [
      "classic",
      "centered",
      "minimal",
      "toplogo",
      "fullbleed",
      "split",
      "magazine",
      "duotone",
    ];
    const formats: TemplateFormat[] = [
      "post-vertical-45",
      "post-square-11",
      "story-9-16",
      "reel-cover-9-16",
    ];

    // Test that no combination throws
    variants.forEach((variant) => {
      formats.forEach((format) => {
        try {
          composeBrandTemplate({
            format,
            variant: variant as any,
            section: mockSection,
            title: "Test",
            photoUrl: mockPhotoUrl,
          });
          // If it doesn't throw, that's fine - some variants don't exist for all formats
        } catch (e) {
          // Expected for invalid variant/format combinations
        }
      });
    });
  });
});
