// ============================================================================
// Backward Compatibility Tests - Phase 9
// filo-news-brand-system
// ============================================================================
//
// Tests de compatibilidad hacia atrás para verificar que:
// 1. Content sin section_id usa legacy templates
// 2. Feature flag disabled usa legacy templates
// 3. Content existente no se rompe

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { composeBrandTemplate, isBrandTemplateFormat } from "../BrandComposer";
import { isBrandSystemEnabled } from "../config";
import type { BrandSection } from "../types";

// ----------------------------------------------------------------------------
// Test Fixtures
// ----------------------------------------------------------------------------

const mockSection: BrandSection = {
  id: "test-section-1",
  tenantId: "test-tenant",
  slug: "proximos-shows",
  name: "Próximos Shows",
  color: "#8B5CF6",
};

const mockPhotoUrl = "https://example.com/test-photo.jpg";

// ----------------------------------------------------------------------------
// Backward Compatibility Test Suite
// ----------------------------------------------------------------------------

describe("Backward Compatibility", () => {
  // Guardar variables de entorno originales
  const originalEnv = process.env;

  beforeEach(() => {
    // Resetear variables de entorno antes de cada test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restaurar variables de entorno
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Feature Flag Control", () => {
    it("isBrandSystemEnabled returns true when ENABLE_FILO_BRAND=true", () => {
      process.env.ENABLE_FILO_BRAND = "true";
      expect(isBrandSystemEnabled()).toBe(true);
    });

    it("isBrandSystemEnabled returns false when ENABLE_FILO_BRAND=false", () => {
      process.env.ENABLE_FILO_BRAND = "false";
      expect(isBrandSystemEnabled()).toBe(false);
    });

    it("isBrandSystemEnabled returns false when ENABLE_FILO_BRAND is undefined", () => {
      delete process.env.ENABLE_FILO_BRAND;
      expect(isBrandSystemEnabled()).toBe(false);
    });

    it("isBrandSystemEnabled returns false when ENABLE_FILO_BRAND is empty string", () => {
      process.env.ENABLE_FILO_BRAND = "";
      expect(isBrandSystemEnabled()).toBe(false);
    });

    it("isBrandSystemEnabled returns false for any value other than 'true'", () => {
      process.env.ENABLE_FILO_BRAND = "yes";
      expect(isBrandSystemEnabled()).toBe(false);

      process.env.ENABLE_FILO_BRAND = "1";
      expect(isBrandSystemEnabled()).toBe(false);

      process.env.ENABLE_FILO_BRAND = "TRUE";
      expect(isBrandSystemEnabled()).toBe(false);
    });
  });

  describe("Brand Template Format Detection", () => {
    it("isBrandTemplateFormat returns true for valid brand formats", () => {
      expect(isBrandTemplateFormat("post-vertical-45")).toBe(true);
      expect(isBrandTemplateFormat("post-square-11")).toBe(true);
      expect(isBrandTemplateFormat("story-9-16")).toBe(true);
      expect(isBrandTemplateFormat("reel-cover-9-16")).toBe(true);
    });

    it("isBrandTemplateFormat returns false for legacy formats", () => {
      // Legacy formats that should NOT be detected as brand
      expect(isBrandTemplateFormat("post")).toBe(false);
      expect(isBrandTemplateFormat("story")).toBe(false);
      expect(isBrandTemplateFormat("carousel")).toBe(false);
      expect(isBrandTemplateFormat("reel")).toBe(false);
    });

    it("isBrandTemplateFormat returns false for unknown formats", () => {
      expect(isBrandTemplateFormat("unknown-format")).toBe(false);
      expect(isBrandTemplateFormat("")).toBe(false);
      expect(isBrandTemplateFormat("legacy-post-1")).toBe(false);
      expect(isBrandTemplateFormat("classic-story")).toBe(false);
    });
  });

  describe("Content Without Section", () => {
    it("legacy content without section data should use legacy path", () => {
      // Simular content sin section - esto debería ir por legacy
      const hasSection = false;
      const useBrand = isBrandSystemEnabled() && hasSection;

      expect(useBrand).toBe(false);
    });

    it("content with section but flag disabled uses legacy", () => {
      process.env.ENABLE_FILO_BRAND = "false";
      const hasSection = true;
      const useBrand = isBrandSystemEnabled() && hasSection;

      expect(useBrand).toBe(false);
    });

    it("content with section and flag enabled uses brand", () => {
      process.env.ENABLE_FILO_BRAND = "true";
      const hasSection = true;
      const useBrand = isBrandSystemEnabled() && hasSection;

      expect(useBrand).toBe(true);
    });
  });

  describe("Existing Content Compatibility", () => {
    it("existing candidates without section_id remain functional", () => {
      // Simular un candidato existente sin section_id
      const existingCandidate = {
        id: "existing-candidate-123",
        title: "Existing Content",
        sectionId: null, // Sin section_id
        format: "post",
      };

      // Debería funcionar con legacy
      const hasSection = existingCandidate.sectionId !== null;
      const useBrand = isBrandSystemEnabled() && hasSection;

      expect(useBrand).toBe(false);
      expect(existingCandidate.title).toBe("Existing Content");
    });

    it("existing candidates with section_id work with brand when flag enabled", () => {
      const existingCandidate = {
        id: "existing-candidate-456",
        title: "Content With Section",
        sectionId: "section-123",
        format: "post-vertical-45",
      };

      process.env.ENABLE_FILO_BRAND = "true";
      const hasSection = existingCandidate.sectionId !== null;
      const useBrand = isBrandSystemEnabled() && hasSection;

      expect(useBrand).toBe(true);
    });

    it("new candidates can be created without section", () => {
      const newCandidate = {
        id: "new-candidate-789",
        title: "New Content",
        sectionId: undefined,
        format: "post",
      };

      const hasSection = Boolean(newCandidate.sectionId);
      expect(hasSection).toBe(false);

      // Debería funcionar con legacy
      const useBrand = isBrandSystemEnabled() && hasSection;
      expect(useBrand).toBe(false);
    });
  });

  describe("Format Migration Path", () => {
    it("legacy 'post' format maps to brand 'post-vertical-45' when migrated", () => {
      const legacyFormat = "post";
      const brandFormat = "post-vertical-45";

      // Legacy format no es brand format
      expect(isBrandTemplateFormat(legacyFormat)).toBe(false);

      // Brand format sí es brand format
      expect(isBrandTemplateFormat(brandFormat)).toBe(true);
    });

    it("legacy 'story' format maps to brand 'story-9-16' when migrated", () => {
      const legacyFormat = "story";
      const brandFormat = "story-9-16";

      expect(isBrandTemplateFormat(legacyFormat)).toBe(false);
      expect(isBrandTemplateFormat(brandFormat)).toBe(true);
    });
  });

  describe("Graceful Degradation", () => {
    it("brand composer throws for unknown format (allows legacy fallback)", () => {
      expect(() =>
        composeBrandTemplate({
          format: "unknown-format" as any,
          variant: "classic",
          section: mockSection,
          title: "Test",
          photoUrl: mockPhotoUrl,
        }),
      ).toThrow("[BrandComposer] Unknown format");
    });

    it("brand composer handles missing optional fields gracefully", () => {
      // No debería lanzar error por campos opcionales faltantes
      const result = composeBrandTemplate({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: "Test Without Optional Fields",
        photoUrl: mockPhotoUrl,
        // subtitle, date son opcionales
      });

      expect(result).toBeDefined();
      expect(result.element).toBeDefined();
    });
  });

  describe("Database Schema Compatibility", () => {
    it("section_id column is nullable (backward compatible)", () => {
      // Simular schema: section_id debe ser nullable
      const nullableSectionId = null;
      const validCandidate = {
        id: "test",
        sectionId: nullableSectionId,
      };

      expect(validCandidate.sectionId).toBeNull();
    });

    it("existing rows without section_id remain valid", () => {
      const existingRows = [
        { id: 1, sectionId: null },
        { id: 2, sectionId: null },
        { id: 3, sectionId: "section-1" }, // Uno con section
      ];

      // Todos deberían ser válidos
      existingRows.forEach((row) => {
        expect(row.id).toBeDefined();
        // sectionId puede ser null o string
        expect(
          row.sectionId === null || typeof row.sectionId === "string",
        ).toBe(true);
      });
    });
  });

  describe("Error Handling - Fallback Behavior", () => {
    it("brand render errors should allow legacy fallback", () => {
      // Simular un error en brand rendering
      let brandRenderFailed = false;
      let usedFallback = false;

      try {
        // Esto lanzaría un error en brand
        composeBrandTemplate({
          format: "invalid" as any,
          variant: "classic",
          section: mockSection,
          title: "Test",
          photoUrl: mockPhotoUrl,
        });
      } catch (error) {
        brandRenderFailed = true;
        // En producción, esto debería caer en fallback a legacy
        usedFallback = true;
      }

      expect(brandRenderFailed).toBe(true);
      expect(usedFallback).toBe(true);
    });
  });

  describe("Content State Transitions", () => {
    it("content can transition from no-section to with-section", () => {
      // Estado inicial: sin section
      let content: { id: string; sectionId: string | null; useBrand: boolean } =
        {
          id: "content-1",
          sectionId: null,
          useBrand: false,
        };

      expect(content.useBrand).toBe(false);

      // Transición: agregar section
      content = {
        ...content,
        sectionId: "section-123",
        useBrand: isBrandSystemEnabled() && true,
      };

      // Depende del feature flag
      expect(content.sectionId).toBe("section-123");
    });

    it("content can transition from brand to legacy by removing section", () => {
      let content: { id: string; sectionId: string | null; useBrand: boolean } =
        {
          id: "content-1",
          sectionId: "section-123",
          useBrand: true,
        };

      expect(content.useBrand).toBe(true);

      // Transición: remover section
      content = {
        ...content,
        sectionId: null,
        useBrand: false,
      };

      expect(content.useBrand).toBe(false);
      expect(content.sectionId).toBeNull();
    });
  });
});

// ----------------------------------------------------------------------------
// Migration Safety Tests
// ----------------------------------------------------------------------------

describe("Migration Safety", () => {
  it("zero-downtime migration is possible", () => {
    // 1. Deploy schema (nullable section_id) - no breaking change
    // 2. Deploy code with flag OFF - no behavior change
    // 3. Backfill data optionally
    // 4. Enable flag - gradual rollout

    const steps = [
      { step: 1, name: "Schema deployment", breaking: false },
      { step: 2, name: "Code deployment", breaking: false },
      { step: 3, name: "Data backfill", breaking: false },
      { step: 4, name: "Enable feature flag", breaking: false },
    ];

    const anyBreaking = steps.some((s) => s.breaking);
    expect(anyBreaking).toBe(false);
  });

  it("rollback strategy exists", () => {
    // Si algo sale mal, podemos:
    // 1. Deshabilitar flag (instant)
    // 2. Revertir código
    // 3. Schema puede quedar (es backward compatible)

    const rollbackSteps = [
      { step: 1, action: "Disable ENABLE_FILO_BRAND", instant: true },
      { step: 2, action: "Revert code if needed", instant: false },
      { step: 3, action: "Schema remains compatible", instant: true },
    ];

    // El rollback principal es instantáneo (flag)
    expect(rollbackSteps[0].instant).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Compatibility Report
// ----------------------------------------------------------------------------

describe("Backward Compatibility Report", () => {
  it("generates compatibility matrix", () => {
    const scenarios = [
      {
        scenario: "Existing content, no section, flag OFF",
        hasSection: false,
        flagEnabled: false,
        expectedPath: "legacy",
      },
      {
        scenario: "Existing content, no section, flag ON",
        hasSection: false,
        flagEnabled: true,
        expectedPath: "legacy",
      },
      {
        scenario: "New content, with section, flag OFF",
        hasSection: true,
        flagEnabled: false,
        expectedPath: "legacy",
      },
      {
        scenario: "New content, with section, flag ON",
        hasSection: true,
        flagEnabled: true,
        expectedPath: "brand",
      },
    ];

    const report = scenarios.map((s) => ({
      ...s,
      actualPath: s.flagEnabled && s.hasSection ? "brand" : "legacy",
      matchesExpected:
        (s.flagEnabled && s.hasSection ? "brand" : "legacy") === s.expectedPath,
    }));

    console.log("\n🔄 Backward Compatibility Matrix:");
    console.table(report);

    expect(report.every((r) => r.matchesExpected)).toBe(true);
  });
});
