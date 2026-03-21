// ============================================================================
// Brand System - Index
// filo-news-brand-system
// ============================================================================

// Types
export * from "./types";

// Config
export {
  DEFAULT_SECTIONS,
  TEMPLATE_SIZES,
  PRIMARY_FONT,
  FALLBACK_FONTS,
  FONT_WEIGHTS,
  SPACING,
  BORDER_RADIUS,
  LOGO_SVG,
  LOGO_SVG_LIGHT,
  isBrandSystemEnabled,
  getSectionColor,
  getSectionName,
  isValidHexColor,
  getContrastColor,
} from "./config";

// Utils
export * from "./utils";

// Components
export * from "./components";

// Templates
export * from "./templates";

// Brand Composer (Satori integration)
export {
  composeBrandTemplate,
  isBrandTemplateFormat,
  validateBrandComposeInput,
  type BrandComposeInput,
  type BrandComposeOutput,
  type TemplateVariant,
} from "./BrandComposer";
