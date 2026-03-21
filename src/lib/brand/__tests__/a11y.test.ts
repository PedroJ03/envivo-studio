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
import {
  DEFAULT_SECTIONS,
  BADGE_TEXT_COLOR,
  TITLE_COLOR,
  getContrastColor,
} from "../config";

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
      const section = DEFAULT_SECTIONS.find((s) => s.color === bgColor);
      const sectionName = section?.name || bgColor;

      it(`badge on ${sectionName} (${bgColor}) meets WCAG AA with adaptive text color`, () => {
        // Badge now uses adaptive text color (black or white) based on background luminance
        const textColor = getContrastColor(bgColor);
        const ratio = getContrastRatio(textColor, bgColor);

        // With adaptive text color, ALL section colors should pass WCAG AA
        expect(ratio).toBeGreaterThanOrEqual(WCAG_AA.normalText);
      });

      it(`badge on ${sectionName} (${bgColor}) uses correct adaptive text color`, () => {
        const textColor = getContrastColor(bgColor);
        // The adaptive color should be either black or white
        expect(textColor === "#FFFFFF" || textColor === "#000000").toBe(true);
      });
    });
  });

  describe("WCAG AA Compliance - Section Colors with Adaptive Text", () => {
    it("all section colors pass WCAG AA with their adaptive text color", () => {
      const results = sectionColors.map((color) => {
        const textColor = getContrastColor(color);
        return {
          color,
          textColor,
          ratio: getContrastRatio(textColor, color),
          section: DEFAULT_SECTIONS.find((s) => s.color === color)?.name,
          passesAA: getContrastRatio(textColor, color) >= WCAG_AA.normalText,
        };
      });

      // All sections should pass with their adaptive text color
      results.forEach((r) => {
        expect({
          section: r.section,
          color: r.color,
          textColor: r.textColor,
          ratio: r.ratio.toFixed(2),
          passesAA: r.passesAA,
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
        color: "#7C3AED",
        expectedRatio: 4.5, // 5.70:1 with white ✅
      },
      {
        section: "efemerides",
        color: "#D97706",
        expectedRatio: 4.5, // 6.59:1 with black ✅
      },
      {
        section: "noticias",
        color: "#0E7490",
        expectedRatio: 4.5, // 4.82:1 with white ✅
      },
      {
        section: "bandas-locales",
        color: "#047857",
        expectedRatio: 4.5, // 4.72:1 with white ✅
      },
    ];

    testCases.forEach(({ section, color, expectedRatio }) => {
      it(`${section}: adaptive text on ${color} >= ${expectedRatio}:1`, () => {
        // Now tests the adaptive text color (black or white)
        const textColor = getContrastColor(color);
        const ratio = getContrastRatio(textColor, color);
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
      const report = DEFAULT_SECTIONS.map((section) => {
        const adaptiveTextColor = getContrastColor(section.color);
        return {
          section: section.name,
          slug: section.slug,
          color: section.color,
          adaptiveTextColor,
          adaptiveRatio: getContrastRatio(
            adaptiveTextColor,
            section.color,
          ).toFixed(2),
          whiteTextRatio: getContrastRatio("#FFFFFF", section.color).toFixed(2),
          blackTextRatio: getContrastRatio("#000000", section.color).toFixed(2),
          passesAAWithAdaptive:
            getContrastRatio(adaptiveTextColor, section.color) >= 4.5,
        };
      });

      // All sections should pass AA with adaptive text color
      report.forEach((r) => {
        expect(r.passesAAWithAdaptive).toBe(true);
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
  it("all section colors pass WCAG AA for badge usage with adaptive text color", () => {
    const badgeResults = DEFAULT_SECTIONS.map((section) => ({
      section: section.name,
      bgColor: section.color,
      textColor: getContrastColor(section.color),
      ratio: getContrastRatio(getContrastColor(section.color), section.color),
      passesAA:
        getContrastRatio(getContrastColor(section.color), section.color) >= 4.5,
    }));

    // All sections should pass with adaptive text color
    const allPass = badgeResults.every((r) => r.passesAA);
    expect(allPass).toBe(true);
  });

  it("title on white background exceeds WCAG AAA", () => {
    const ratio = getContrastRatio(TITLE_COLOR, "#FFFFFF");
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AAA.normalText);
  });
});
