// ============================================================================
// Brand System Configuration - filo-news-brand-system
// ============================================================================

import type { BrandSectionSlug } from "./types";

// ----------------------------------------------------------------------------
// Feature Flag
// ----------------------------------------------------------------------------

/**
 * Check if the brand system is enabled via environment variable
 */
export function isBrandSystemEnabled(): boolean {
  return process.env.ENABLE_FILO_BRAND === "true";
}

// ----------------------------------------------------------------------------
// Section Colors (Default palette for envivo-tandil)
// ----------------------------------------------------------------------------

export type DefaultSectionColor = {
  slug: BrandSectionSlug;
  name: string;
  color: string; // HEX
};

/**
 * Default section definitions with their brand colors.
 * These are the Filo.news-inspired colors for envivo-tandil.
 */
export const DEFAULT_SECTIONS: DefaultSectionColor[] = [
  {
    slug: "proximos-shows",
    name: "Próximos Shows",
    color: "#7C3AED", // Violet (WCAG AA compliant - oscuro)
  },
  {
    slug: "efemerides",
    name: "Efemérides",
    color: "#D97706", // Amber (WCAG AA compliant - oscuro)
  },
  {
    slug: "noticias",
    name: "Noticias",
    color: "#0891B2", // Cyan (WCAG AA compliant - oscuro)
  },
  {
    slug: "bandas-locales",
    name: "Bandas Locales",
    color: "#059669", // Emerald (WCAG AA compliant - oscuro)
  },
] as const;

/**
 * Get section color by slug
 */
export function getSectionColor(slug: BrandSectionSlug): string {
  const section = DEFAULT_SECTIONS.find((s) => s.slug === slug);
  return section?.color ?? "#6B7280"; // Default gray
}

/**
 * Get section name by slug
 */
export function getSectionName(slug: BrandSectionSlug): string {
  const section = DEFAULT_SECTIONS.find((s) => s.slug === slug);
  return section?.name ?? "General";
}

// ----------------------------------------------------------------------------
// Template Sizes (Satori dimensions)
// ----------------------------------------------------------------------------

export const TEMPLATE_SIZES = {
  "post-vertical-45": { width: 1080, height: 1350 },
  "post-square-11": { width: 1080, height: 1080 },
  "story-9-16": { width: 1080, height: 1920 },
  "reel-cover-9-16": { width: 1080, height: 1920 },
} as const;

// ----------------------------------------------------------------------------
// Typography
// ----------------------------------------------------------------------------

/**
 * Primary font family for brand system
 */
export const PRIMARY_FONT = "Syne";

/**
 * Fallback fonts for Satori rendering
 */
export const FALLBACK_FONTS = ["Arial", "Helvetica", "sans-serif"] as const;

/**
 * Font weights
 */
export const FONT_WEIGHTS = {
  regular: 400,
  bold: 700,
} as const;

// ----------------------------------------------------------------------------
// Spacing Scale (consistent with 40px base padding)
// ----------------------------------------------------------------------------

export const SPACING = {
  xs: 8,
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
  xxl: 48,
} as const;

// ----------------------------------------------------------------------------
// Border Radius
// ----------------------------------------------------------------------------

export const BORDER_RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
} as const;

// ----------------------------------------------------------------------------
// Logo SVG - "envivo." inline (editorial minimalista estilo Filo.news)
// ----------------------------------------------------------------------------

/**
 * Logo "envivo." estilo editorial minimalista.
 * El punto final es el sello característico de Filo.news.
 *
 * Diseño:
 * - Texto "envivo" en Syne Bold (sin serifas, editorial)
 * - Punto final "." en position de emphasis
 * - Color negro #000000 para contraste máximo
 */
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 30" fill="none">
  <text
    x="0"
    y="24"
    font-family="Syne, Arial, sans-serif"
    font-weight="700"
    font-size="24"
    fill="#000000"
    letter-spacing="-0.5"
  >envivo</text>
  <circle cx="116" cy="22" r="4" fill="#000000"/>
</svg>`;

/**
 * Logo for dark backgrounds (white version)
 */
export const LOGO_SVG_LIGHT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 30" fill="none">
  <text
    x="0"
    y="24"
    font-family="Syne, Arial, sans-serif"
    font-weight="700"
    font-size="24"
    fill="#FFFFFF"
    letter-spacing="-0.5"
  >envivo</text>
  <circle cx="116" cy="22" r="4" fill="#FFFFFF"/>
</svg>`;

// ----------------------------------------------------------------------------
// Font Loading Helper
// ----------------------------------------------------------------------------

/**
 * Font files that need to be loaded for the brand system.
 * These should be placed in src/lib/brand/fonts/ and loaded at build time.
 * Using TTF format for maximum compatibility with Satori.
 */
export const BRAND_FONTS = {
  Syne: {
    regular: {
      path: "Syne-Regular.ttf",
      weight: 400 as const,
      style: "normal" as const,
    },
    bold: {
      path: "Syne-Bold.ttf",
      weight: 700 as const,
      style: "normal" as const,
    },
  },
} as const;

// ----------------------------------------------------------------------------
// Color Utilities
// ----------------------------------------------------------------------------

/**
 * Default badge text color (white for contrast on colored backgrounds)
 */
export const BADGE_TEXT_COLOR = "#FFFFFF";

/**
 * Default title color
 */
export const TITLE_COLOR = "#000000";

/**
 * Validate HEX color format
 */
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Get contrasting text color (black or white) based on background
 * Uses simple luminance calculation
 */
export function getContrastColor(hexColor: string): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}
