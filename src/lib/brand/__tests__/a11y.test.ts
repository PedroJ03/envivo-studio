// ============================================================================
// Accessibility (A11y) Tests - Phase 9
// filo-news-brand-system
// ============================================================================
//
// Tests de accesibilidad para validar contrast ratios WCAG AA.
//
// Requisitos:
// - Normal text: 4.5:1 contrast ratio minimum (WCAG AA)
// - Large text (18pt+ or 14pt+ bold): 3:1 contrast ratio minimum (WCAG AA)

import { describe, it, expect } from "vitest";
import { DEFAULT_SECTIONS, BADGE_TEXT_COLOR, TITLE_COLOR } from "../config";

// ----------------------------------------------------------------------------
// WCAG Contrast Ratio Calculation
// ----------------------------------------------------------------------------

/**
 * Calculate relative luminance of a color per WCAG 2.1
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function getRelativeLuminance(hexColor: string): number {
  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Calculate luminance for each channel
  const luminance = (channel: number): number => {
    return channel <= 0.03928
      ? channel / 12.92
      : Math.pow((channel + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * luminance(r) + 0.7152 * luminance(g) + 0.0722 * luminance(b);
}

/**
 * Calculate contrast ratio between two colors
 * WCAG formula: (L1 + 0.05) / (L2 + 0.05)
 * where L1 is the lighter color and L2 is the darker color
 */
function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getRelativeLuminance(color1);
  const lum2 = getRelativeLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG AA thresholds
 */
const WCAG_AA = {
  normalText: 4.5,
  largeText: 3.0,
};

/**
 * WCAG AAA thresholds
 */
const WCAG_AAA = {
  normalText: 7.0,
  largeText: 4.5,
};

// ----------------------------------------------------------------------------
// Test Fixtures
// ----------------------------------------------------------------------------

const sectionColors = DEFAULT_SECTIONS.map((s) => s.color);

// ----------------------------------------------------------------------------
// A11y Test Suite
// ----------------------------------------------------------------------------

describe("Accessibility Contrast", () => {
  describe("WCAG AA Compliance - Badge Text", () => {
    sectionColors.forEach((bgColor) => {
      const sectionName =
        DEFAULT_SECTIONS.find((s) => s.color === bgColor)?.name || bgColor;

      it(`badge on ${sectionName} (${bgColor}) meets WCAG AA for text`, () => {
        // Badge: texto blanco sobre fondo de color de sección
        const ratio = getContrastRatio(BADGE_TEXT_COLOR, bgColor);

        // Badge text is typically 14px bold (large text), so 3:1 is minimum
        // But we target 4.5:1 for all text to be safe
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA.normalText);
      });

      it(`badge on ${sectionName} (${bgColor}) contrast ratio is ${getContrastRatio(
        BADGE_TEXT_COLOR,
        bgColor,
      ).toFixed(2)}:1`, () => {
        const ratio = getContrastRatio(BADGE_TEXT_COLOR, bgColor);

        // Log the actual ratio for reporting
        expect(ratio).toBeGreaterThan(0);
      });
    });
  });

  describe("WCAG AA Compliance - Section Colors vs White", () => {
    it("all section colors have sufficient contrast with white", () => {
      const results = sectionColors.map((color) => ({
        color,
        ratio: getContrastRatio("#FFFFFF", color),
        section: DEFAULT_SECTIONS.find((s) => s.color === color)?.name,
      }));

      results.forEach(({ color, ratio, section }) => {
        expect({
          section,
          color,
          ratio: ratio.toFixed(2),
          passesAA: ratio >= WCAG_AA.normalText,
        }).toEqual(
          expect.objectContaining({
            passesAA: true,
          }),
        );
      });
    });
  });

  describe("WCAG AA Compliance - Title on White Background", () => {
    it("title in black on white background has excellent contrast", () => {
      const ratio = getContrastRatio(TITLE_COLOR, "#FFFFFF");

      // Black (#000000) on white (#FFFFFF) should be 21:1
      expect(ratio).toBeGreaterThanOrEqual(21);
    });

    it("title color meets WCAG AAA (enhanced)", () => {
      const ratio = getContrastRatio(TITLE_COLOR, "#FFFFFF");

      // 21:1 exceeds both AA (4.5:1) and AAA (7:1)
      expect(ratio).toBeGreaterThanOrEqual(WCAG_AAA.normalText);
    });
  });

  describe("WCAG AA Compliance - Section Colors on White", () => {
    sectionColors.forEach((color) => {
      const sectionName =
        DEFAULT_SECTIONS.find((s) => s.color === color)?.name || color;

      it(`${sectionName} (${color}) on white background meets AA`, () => {
        const ratio = getContrastRatio(color, "#FFFFFF");

        // Section colors used as title accents on white background
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA.normalText);
      });
    });
  });

  describe("Contrast Ratio Calculations", () => {
    it("calculates correct ratio for black on white", () => {
      const ratio = getContrastRatio("#000000", "#FFFFFF");
      expect(ratio).toBeCloseTo(21, 0);
    });

    it("calculates correct ratio for white on black", () => {
      const ratio = getContrastRatio("#FFFFFF", "#000000");
      expect(ratio).toBeCloseTo(21, 0);
    });

    it("calculates correct ratio for identical colors", () => {
      const ratio = getContrastRatio("#8B5CF6", "#8B5CF6");
      expect(ratio).toBeCloseTo(1, 0);
    });

    it("calculates correct ratio for gray on white", () => {
      const ratio = getContrastRatio("#808080", "#FFFFFF");
      // #808080 is exactly middle gray
      expect(ratio).toBeGreaterThan(3);
      expect(ratio).toBeLessThan(5);
    });
  });

  describe("Section Color Accessibility Matrix", () => {
    const testCases = [
      {
        section: "proximos-shows",
        color: "#8B5CF6",
        expectedRatio: 4.5, // Should pass AA
      },
      {
        section: "efemerides",
        color: "#F59E0B",
        expectedRatio: 4.5, // Should pass AA
      },
      {
        section: "noticias",
        color: "#06B6D4",
        expectedRatio: 4.5, // Should pass AA
      },
      {
        section: "bandas-locales",
        color: "#10B981",
        expectedRatio: 4.5, // Should pass AA
      },
    ];

    testCases.forEach(({ section, color, expectedRatio }) => {
      it(`${section}: white text on ${color} >= ${expectedRatio}:1`, () => {
        const ratio = getContrastRatio("#FFFFFF", color);
        expect(ratio).toBeGreaterThanOrEqual(expectedRatio);
      });
    });
  });

  describe("Edge Cases and Boundary Values", () => {
    it("handles lowercase hex colors", () => {
      const ratio1 = getContrastRatio("#ffffff", "#000000");
      const ratio2 = getContrastRatio("#FFFFFF", "#000000");
      expect(ratio1).toBe(ratio2);
    });

    it("handles mixed case hex colors", () => {
      const ratio = getContrastRatio("#FfFfFf", "#8B5CF6");
      expect(ratio).toBeGreaterThan(0);
    });
  });

  describe("Detailed Contrast Report", () => {
    it("generates contrast report for all section colors", () => {
      const report = DEFAULT_SECTIONS.map((section) => ({
        section: section.name,
        slug: section.slug,
        color: section.color,
        whiteTextRatio: getContrastRatio("#FFFFFF", section.color).toFixed(2),
        blackTextRatio: getContrastRatio("#000000", section.color).toFixed(2),
        passesAAWhite: getContrastRatio("#FFFFFF", section.color) >= 4.5,
        passesAABlack: getContrastRatio("#000000", section.color) >= 4.5,
      }));

      // All sections should pass AA with at least one text color
      report.forEach((r) => {
        expect(r.passesAAWhite || r.passesAABlack).toBe(true);
      });

      // Log the report for visibility
      console.log("\n📊 A11y Contrast Report:");
      console.table(report);
    });
  });
});

// ----------------------------------------------------------------------------
// Compliance Summary
// ----------------------------------------------------------------------------

describe("A11y Compliance Summary", () => {
  it("all section colors pass WCAG AA with white text", () => {
    const allPass = DEFAULT_SECTIONS.every((section) => {
      const ratio = getContrastRatio("#FFFFFF", section.color);
      return ratio >= WCAG_AA.normalText;
    });

    expect(allPass).toBe(true);
  });

  it("all section colors pass WCAG AA for badge usage", () => {
    const badgeResults = DEFAULT_SECTIONS.map((section) => ({
      section: section.name,
      bgColor: section.color,
      textColor: BADGE_TEXT_COLOR,
      ratio: getContrastRatio(BADGE_TEXT_COLOR, section.color),
      passesAA: getContrastRatio(BADGE_TEXT_COLOR, section.color) >= 4.5,
    }));

    const allPass = badgeResults.every((r) => r.passesAA);
    expect(allPass).toBe(true);
  });

  it("title on white background exceeds WCAG AAA", () => {
    const ratio = getContrastRatio(TITLE_COLOR, "#FFFFFF");
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AAA.normalText);
  });
});
