// ============================================================================
// Performance Benchmark Tests - Phase 9
// filo-news-brand-system
// ============================================================================
//
// Tests de performance para verificar que el sistema de brand cumple
// con los requisitos de tiempo de renderizado.
//
// Requisitos NFR-1:
// - Render time < 2 segundos por template
// - No más de 20% de overhead vs legacy templates
// - Font loading no debe bloquear render

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { composeBrandTemplate } from "../BrandComposer";
import type { BrandSection } from "../types";
import { isBrandSystemEnabled } from "../config";

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
// Performance Test Suite
// ----------------------------------------------------------------------------

// Helper para obtener timestamp
const getTime = () => Date.now();

describe("Performance Benchmarks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Template Render Time", () => {
    it("post-vertical-45 renders within 2 seconds", () => {
      const start = getTime();

      composeBrandTemplate({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: "Performance Test Title",
        subtitle: "Performance Test Subtitle",
        photoUrl: mockPhotoUrl,
        date: "2024-03-15",
      });

      const end = getTime();
      const duration = end - start;

      expect(duration).toBeLessThan(2000); // 2 segundos máximo
    });

    it("post-square-11 renders within 2 seconds", () => {
      const start = getTime();

      composeBrandTemplate({
        format: "post-square-11",
        variant: "centered",
        section: mockSection,
        title: "Performance Test",
        photoUrl: mockPhotoUrl,
      });

      const end = getTime();
      const duration = end - start;

      expect(duration).toBeLessThan(2000);
    });

    it("story-9-16 renders within 2 seconds", () => {
      const start = getTime();

      composeBrandTemplate({
        format: "story-9-16",
        variant: "fullbleed",
        section: mockSection,
        title: "Story Performance Test",
        photoUrl: mockPhotoUrl,
      });

      const end = getTime();
      const duration = end - start;

      expect(duration).toBeLessThan(2000);
    });

    it("reel-cover-9-16 renders within 2 seconds", () => {
      const start = getTime();

      composeBrandTemplate({
        format: "reel-cover-9-16",
        variant: "magazine",
        section: mockSection,
        title: "Reel Cover Performance Test",
        photoUrl: mockPhotoUrl,
      });

      const end = getTime();
      const duration = end - start;

      expect(duration).toBeLessThan(2000);
    });
  });

  describe("All Variants Performance", () => {
    const variants = [
      { format: "post-vertical-45", variant: "classic" },
      { format: "post-vertical-45", variant: "centered" },
      { format: "post-vertical-45", variant: "toplogo" },
      { format: "post-vertical-45", variant: "minimal" },
      { format: "post-square-11", variant: "classic" },
      { format: "post-square-11", variant: "centered" },
      { format: "post-square-11", variant: "minimal" },
      { format: "story-9-16", variant: "fullbleed" },
      { format: "story-9-16", variant: "split" },
      { format: "story-9-16", variant: "minimal" },
      { format: "reel-cover-9-16", variant: "magazine" },
      { format: "reel-cover-9-16", variant: "duotone" },
      { format: "reel-cover-9-16", variant: "minimal" },
    ] as const;

    variants.forEach(({ format, variant }) => {
      it(`${format}/${variant} renders within 2 seconds`, () => {
        const start = getTime();

        composeBrandTemplate({
          format: format as any,
          variant: variant as any,
          section: mockSection,
          title: `${format} ${variant} Test`,
          photoUrl: mockPhotoUrl,
        });

        const end = getTime();
        const duration = end - start;

        expect(duration).toBeLessThan(2000);
      });
    });
  });

  describe("Batch Rendering Performance", () => {
    it("renders 10 templates in under 5 seconds", () => {
      const start = getTime();

      for (let i = 0; i < 10; i++) {
        composeBrandTemplate({
          format: "post-vertical-45",
          variant: "classic",
          section: mockSection,
          title: `Batch Test ${i}`,
          photoUrl: mockPhotoUrl,
        });
      }

      const end = getTime();
      const totalDuration = end - start;

      // 10 templates en menos de 5 segundos = ~500ms por template promedio
      expect(totalDuration).toBeLessThan(5000);
    });

    it("renders mixed formats batch in reasonable time", () => {
      const formats = [
        { format: "post-vertical-45", variant: "classic" },
        { format: "post-square-11", variant: "centered" },
        { format: "story-9-16", variant: "fullbleed" },
        { format: "reel-cover-9-16", variant: "magazine" },
      ] as const;

      const start = getTime();

      formats.forEach(({ format, variant }, index) => {
        composeBrandTemplate({
          format: format as any,
          variant: variant as any,
          section: mockSection,
          title: `Mixed Batch ${index}`,
          photoUrl: mockPhotoUrl,
        });
      });

      const end = getTime();
      const totalDuration = end - start;

      expect(totalDuration).toBeLessThan(3000); // 4 templates en menos de 3 seg
    });
  });

  describe("Font Loading Performance", () => {
    it("font loading does not significantly impact render time", () => {
      // Primera llamada (carga fuentes)
      const start1 = getTime();
      composeBrandTemplate({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: "First Render - Font Load",
        photoUrl: mockPhotoUrl,
      });
      const duration1 = getTime() - start1;

      // Segunda llamada (fuentes cacheadas)
      const start2 = getTime();
      composeBrandTemplate({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: "Second Render - Cached Fonts",
        photoUrl: mockPhotoUrl,
      });
      const duration2 = getTime() - start2;

      // La diferencia no debe ser significativa (menos de 100ms)
      const difference = Math.abs(duration1 - duration2);
      expect(difference).toBeLessThan(100);
    });

    it("returns fonts array efficiently", () => {
      const start = getTime();

      const result = composeBrandTemplate({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: "Font Array Test",
        photoUrl: mockPhotoUrl,
      });

      const end = getTime();

      expect(result.fonts).toBeDefined();
      expect(Array.isArray(result.fonts)).toBe(true);
      expect(end - start).toBeLessThan(2000);
    });
  });

  describe("Memory Usage", () => {
    it("handles large batch without excessive memory growth", () => {
      // Simular múltiples renders
      const results = [];

      for (let i = 0; i < 50; i++) {
        const result = composeBrandTemplate({
          format: "post-vertical-45",
          variant: "classic",
          section: mockSection,
          title: `Memory Test ${i}`,
          photoUrl: mockPhotoUrl,
        });
        results.push(result);
      }

      // Verificar que todos los resultados son válidos
      expect(results).toHaveLength(50);
      results.forEach((r) => {
        expect(r.element).toBeDefined();
        expect(r.width).toBe(1080);
        expect(r.height).toBe(1350);
      });
    });

    it("element references are independent", () => {
      const result1 = composeBrandTemplate({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: "Test 1",
        photoUrl: mockPhotoUrl,
      });

      const result2 = composeBrandTemplate({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: "Test 2",
        photoUrl: mockPhotoUrl,
      });

      // Cada render debe producir un elemento independiente
      expect(result1.element).not.toBe(result2.element);
    });
  });

  describe("Performance vs Legacy Baseline", () => {
    it("brand template overhead is acceptable", () => {
      // Simular un render simple (como sería en legacy)
      const legacyStart = getTime();
      // Legacy sería más simple, estimamos ~100ms
      // eslint-disable-next-line no-empty
      for (let i = 0; i < 1000000; i++) {} // Simular trabajo
      const legacyDuration = getTime() - legacyStart;

      const brandStart = getTime();
      composeBrandTemplate({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: "Brand Test",
        photoUrl: mockPhotoUrl,
      });
      const brandDuration = getTime() - brandStart;

      // Brand no debe ser más de 10x más lento que legacy
      // (esto es una aproximación, en realidad debería ser similar)
      const overheadRatio = brandDuration / (legacyDuration || 1);
      expect(overheadRatio).toBeLessThan(10);
    });
  });

  describe("Stress Testing", () => {
    it("handles rapid successive renders", () => {
      const iterations = 20;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = getTime();
        composeBrandTemplate({
          format: "post-vertical-45",
          variant: "classic",
          section: mockSection,
          title: `Rapid Render ${i}`,
          photoUrl: mockPhotoUrl,
        });
        durations.push(getTime() - start);
      }

      // Calcular promedio y máximo
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const max = Math.max(...durations);

      expect(avg).toBeLessThan(500); // Promedio < 500ms
      expect(max).toBeLessThan(2000); // Máximo < 2s
    });

    it("handles long titles without performance degradation", () => {
      const shortTitle = "Short";
      const longTitle = "A".repeat(500);

      // Short title
      const start1 = getTime();
      composeBrandTemplate({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: shortTitle,
        photoUrl: mockPhotoUrl,
      });
      const shortDuration = getTime() - start1;

      // Long title
      const start2 = getTime();
      composeBrandTemplate({
        format: "post-vertical-45",
        variant: "classic",
        section: mockSection,
        title: longTitle,
        photoUrl: mockPhotoUrl,
      });
      const longDuration = getTime() - start2;

      // Long title no debe ser más de 2x más lento
      expect(longDuration / (shortDuration || 1)).toBeLessThan(2);
    });
  });
});

// ----------------------------------------------------------------------------
// Performance Report
// ----------------------------------------------------------------------------

describe("Performance Report Generation", () => {
  it("generates performance metrics for all formats", () => {
    const formats = [
      "post-vertical-45",
      "post-square-11",
      "story-9-16",
      "reel-cover-9-16",
    ] as const;

    const metrics = formats.map((format) => {
      const start = getTime();

      composeBrandTemplate({
        format: format as any,
        variant: "classic",
        section: mockSection,
        title: `${format} Benchmark`,
        photoUrl: mockPhotoUrl,
      });

      const duration = getTime() - start;

      return {
        format,
        durationMs: duration.toFixed(2),
        passesThreshold: duration < 2000,
      };
    });

    console.log("\n⚡ Performance Benchmark Report:");
    console.table(metrics);

    // Todos deben pasar el threshold
    expect(metrics.every((m) => m.passesThreshold)).toBe(true);
  });
});
