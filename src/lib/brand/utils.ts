// ============================================================================
// Brand System Utilities - filo-news-brand-system
// ============================================================================

import type { BrandSectionSlug, TemplateFormat } from "./types";
import {
  DEFAULT_SECTIONS,
  getSectionColor,
  isValidHexColor,
  getContrastColor,
  SPACING,
  BORDER_RADIUS,
} from "./config";

// ----------------------------------------------------------------------------
// Color Mapping
// ----------------------------------------------------------------------------

/**
 * Get the section color from a slug
 * Used by templates to dynamically color elements
 */
export function getColorForSection(slug: BrandSectionSlug): string {
  return getSectionColor(slug);
}

/**
 * Get contrasting text color for a section background
 * Ensures readable text on colored badges
 */
export function getTextColorForSection(slug: BrandSectionSlug): string {
  const bgColor = getSectionColor(slug);
  return getContrastColor(bgColor);
}

/**
 * Get all section colors as a map
 */
export function getAllSectionColors(): Record<BrandSectionSlug, string> {
  const colors: Partial<Record<BrandSectionSlug, string>> = {};
  for (const section of DEFAULT_SECTIONS) {
    colors[section.slug] = section.color;
  }
  return colors as Record<BrandSectionSlug, string>;
}

// ----------------------------------------------------------------------------
// Spacing Helpers
// ----------------------------------------------------------------------------

/**
 * Get spacing value by key
 */
export function spacing(key: keyof typeof SPACING): number {
  return SPACING[key];
}

/**
 * Generate CSS spacing string
 */
export function spacingString(key: keyof typeof SPACING): string {
  return `${SPACING[key]}px`;
}

// ----------------------------------------------------------------------------
// Border Radius Helpers
// ----------------------------------------------------------------------------

/**
 * Get border radius value by key
 */
export function borderRadius(key: keyof typeof BORDER_RADIUS): number {
  return BORDER_RADIUS[key];
}

/**
 * Generate CSS border-radius string
 */
export function borderRadiusString(key: keyof typeof BORDER_RADIUS): string {
  return `${BORDER_RADIUS[key]}px`;
}

// ----------------------------------------------------------------------------
// Template Dimension Helpers
// ----------------------------------------------------------------------------

/**
 * Get template dimensions for Satori rendering
 */
export function getTemplateDimensions(format: TemplateFormat): {
  width: number;
  height: number;
} {
  const dimensions: Record<TemplateFormat, { width: number; height: number }> =
    {
      "post-vertical-45": { width: 1080, height: 1350 },
      "post-square-11": { width: 1080, height: 1080 },
      "story-9-16": { width: 1080, height: 1920 },
      "reel-cover-9-16": { width: 1080, height: 1920 },
    };
  return dimensions[format];
}

// ----------------------------------------------------------------------------
// Font Loading
// ----------------------------------------------------------------------------

/**
 * Load font file as ArrayBuffer for Satori
 * Uses dynamic import to get the font file from src/lib/brand/fonts/
 */
export async function loadFont(fontPath: string): Promise<ArrayBuffer> {
  try {
    const fontModule = await import(`./fonts/${fontPath}`);
    // If the font is exported as default
    if (fontModule.default) {
      return fontModule.default;
    }
    throw new Error(`Font ${fontPath} not found`);
  } catch (error) {
    console.warn(`Failed to load font ${fontPath}, using fallback`);
    return new ArrayBuffer(0);
  }
}

// ----------------------------------------------------------------------------
// Validation
// ----------------------------------------------------------------------------

/**
 * Validate section slug
 */
export function isValidSectionSlug(slug: string): slug is BrandSectionSlug {
  const validSlugs: BrandSectionSlug[] = [
    "proximos-shows",
    "efemerides",
    "noticias",
    "bandas-locales",
  ];
  return validSlugs.includes(slug as BrandSectionSlug);
}

/**
 * Validate template format
 */
export function isValidTemplateFormat(
  format: string,
): format is TemplateFormat {
  const validFormats: TemplateFormat[] = [
    "post-vertical-45",
    "post-square-11",
    "story-9-16",
    "reel-cover-9-16",
  ];
  return validFormats.includes(format as TemplateFormat);
}

// ----------------------------------------------------------------------------
// Color Manipulation
// ----------------------------------------------------------------------------

/**
 * Lighten a HEX color by a percentage
 * Used for gradients and hover states
 */
export function lightenColor(hex: string, percent: number): string {
  if (!isValidHexColor(hex)) return hex;

  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.floor((num >> 16) + (255 * percent) / 100));
  const g = Math.min(
    255,
    Math.floor(((num >> 8) & 0x00ff) + (255 * percent) / 100),
  );
  const b = Math.min(255, Math.floor((num & 0x0000ff) + (255 * percent) / 100));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Darken a HEX color by a percentage
 * Used for overlays and emphasis
 */
export function darkenColor(hex: string, percent: number): string {
  if (!isValidHexColor(hex)) return hex;

  const num = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.floor((num >> 16) - (255 * percent) / 100));
  const g = Math.max(
    0,
    Math.floor(((num >> 8) & 0x00ff) - (255 * percent) / 100),
  );
  const b = Math.max(0, Math.floor((num & 0x0000ff) - (255 * percent) / 100));

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// ----------------------------------------------------------------------------
// String Helpers
// ----------------------------------------------------------------------------

/**
 * Truncate text to a maximum number of characters
 * Adds ellipsis if truncated
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
