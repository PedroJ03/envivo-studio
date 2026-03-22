// ============================================================================
// BrandComposer - Adapter para integrar templates de brand con el composer
// filo-news-brand-system
// ============================================================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";

import type { BrandSection, TemplateFormat } from "./types";
import { TEMPLATE_SIZES, PRIMARY_FONT } from "./config";
import { PostVertical45 } from "./templates/post-vertical-45/PostVertical45";
import { PostSquare11 } from "./templates/post-square-11/PostSquare11";
import { getStoryTemplate } from "./templates/story-9-16";
import { ReelCover } from "./templates/reel-cover-9-16/ReelCover";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type TemplateVariant =
  | "classic"
  | "centered"
  | "toplogo"
  | "minimal"
  | "fullbleed"
  | "split"
  | "magazine"
  | "duotone";

export interface BrandComposeInput {
  format: TemplateFormat;
  variant: TemplateVariant;
  section: BrandSection;
  title: string;
  subtitle?: string;
  photoUrl: string;
  date?: string;
}

export interface BrandComposeOutput {
  element: React.ReactNode;
  width: number;
  height: number;
  fonts: Array<{
    name: string;
    data: Buffer;
    weight: number;
    style: string;
  }>;
}

// ----------------------------------------------------------------------------
// Font Loading
// ----------------------------------------------------------------------------

// Ruta a las fuentes (en carpeta public para evitar problemas con Turbopack)
const FONTS_DIR = join(process.cwd(), "public", "fonts");

// Cache para las fuentes cargadas
let fontCache: {
  syneBold?: Buffer;
  syneRegular?: Buffer;
} = {};

/**
 * Carga las fuentes Syne para Satori.
 * Usa cache para evitar lecturas repetidas.
 * NOTA: Esta función solo debe llamarse en runtime (server-side), no en build time.
 */
function loadFonts(): BrandComposeOutput["fonts"] {
  // Devolver desde cache si ya está cargado
  if (fontCache.syneBold && fontCache.syneRegular) {
    return [
      {
        name: PRIMARY_FONT,
        data: fontCache.syneBold,
        weight: 700,
        style: "normal",
      },
      {
        name: PRIMARY_FONT,
        data: fontCache.syneRegular,
        weight: 400,
        style: "normal",
      },
    ];
  }

  try {
    fontCache.syneBold = readFileSync(join(FONTS_DIR, "Syne-Bold.ttf"));
    fontCache.syneRegular = readFileSync(join(FONTS_DIR, "Syne-Regular.ttf"));

    return [
      {
        name: PRIMARY_FONT,
        data: fontCache.syneBold,
        weight: 700,
        style: "normal",
      },
      {
        name: PRIMARY_FONT,
        data: fontCache.syneRegular,
        weight: 400,
        style: "normal",
      },
    ];
  } catch (error) {
    console.warn("[BrandComposer] Failed to load Syne fonts:", error);
    // Retornar array vacío si no se pueden cargar las fuentes
    // Satori usará fuentes fallback
    return [];
  }
}

// ----------------------------------------------------------------------------
// Template Renderers
// ----------------------------------------------------------------------------

/**
 * Renderiza el template Post Vertical 4:5 (1080x1350)
 */
function renderPostVertical45(input: BrandComposeInput): React.ReactNode {
  const { section, title, subtitle, photoUrl, date, variant } = input;

  // Mapear variant a las props del componente
  const templateVariant = variant as
    | "classic"
    | "centered"
    | "toplogo"
    | "minimal";

  return (
    <PostVertical45
      section={section}
      title={title}
      subtitle={subtitle}
      photoUrl={photoUrl}
      date={date}
      template={templateVariant}
    />
  );
}

/**
 * Renderiza el template Post Square 1:1 (1080x1080)
 */
function renderPostSquare11(input: BrandComposeInput): React.ReactNode {
  const { section, title, subtitle, photoUrl, date, variant } = input;

  const templateVariant = variant as "classic" | "centered" | "minimal";

  return (
    <PostSquare11
      sectionSlug={section.slug}
      sectionName={section.name}
      title={title}
      subtitle={subtitle}
      photoUrl={photoUrl}
      date={date}
      template={templateVariant}
    />
  );
}

/**
 * Renderiza el template Story 9:16 (1080x1920)
 */
function renderStory916(input: BrandComposeInput): React.ReactNode {
  const { section, title, subtitle, photoUrl, date, variant } = input;

  const templateVariant = variant as "fullbleed" | "split" | "minimal";
  const StoryTemplate = getStoryTemplate(templateVariant);

  return (
    <StoryTemplate
      section={section}
      title={title}
      subtitle={subtitle}
      photoUrl={photoUrl}
      date={date}
      template={templateVariant}
    />
  );
}

/**
 * Renderiza el template Reel Cover 9:16 (1080x1920)
 */
function renderReelCover916(input: BrandComposeInput): React.ReactNode {
  const { section, title, subtitle, photoUrl, variant } = input;

  const templateVariant = variant as "magazine" | "duotone" | "minimal";

  return (
    <ReelCover
      section={section}
      title={title}
      subtitle={subtitle}
      photoUrl={photoUrl}
      template={templateVariant}
    />
  );
}

// ----------------------------------------------------------------------------
// Main Composer Function
// ----------------------------------------------------------------------------

/**
 * Composes a brand template for rendering with Satori.
 *
 * @param input - Brand composition input
 * @returns React element, dimensions, and fonts for Satori rendering
 *
 * @example
 * ```typescript
 * const { element, width, height, fonts } = composeBrandTemplate({
 *   format: 'post-vertical-45',
 *   variant: 'classic',
 *   section: { id: '1', slug: 'proximos-shows', name: 'Próximos Shows', color: '#8B5CF6' },
 *   title: 'Show de Los Enanitos Verdes',
 *   subtitle: 'Sábado 15 de Marzo',
 *   photoUrl: 'https://example.com/photo.jpg',
 *   date: '2024-03-15'
 * });
 *
 * // Usar con Satori
 * const svg = await satori(element, { width, height, fonts });
 * ```
 */
export function composeBrandTemplate(
  input: BrandComposeInput,
): BrandComposeOutput {
  const { format } = input;
  const dimensions = TEMPLATE_SIZES[format];

  let element: React.ReactNode;

  switch (format) {
    case "post-vertical-45":
      element = renderPostVertical45(input);
      break;
    case "post-square-11":
      element = renderPostSquare11(input);
      break;
    case "story-9-16":
      element = renderStory916(input);
      break;
    case "reel-cover-9-16":
      element = renderReelCover916(input);
      break;
    default:
      // Exhaustiveness check
      const _exhaustiveCheck: never = format;
      throw new Error(
        `[BrandComposer] Unknown format: ${String(_exhaustiveCheck)}`,
      );
  }

  return {
    element,
    width: dimensions.width,
    height: dimensions.height,
    fonts: loadFonts(),
  };
}

/**
 * Type guard para verificar si un formato es un template de brand
 */
export function isBrandTemplateFormat(
  format: string,
): format is TemplateFormat {
  const brandFormats: TemplateFormat[] = [
    "post-vertical-45",
    "post-square-11",
    "story-9-16",
    "reel-cover-9-16",
  ];
  return brandFormats.includes(format as TemplateFormat);
}

/**
 * Valida que el input tenga todos los campos requeridos
 */
export function validateBrandComposeInput(input: Partial<BrandComposeInput>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!input.format) {
    errors.push("format is required");
  } else if (!isBrandTemplateFormat(input.format)) {
    errors.push(
      `format '${input.format}' is not a valid brand template format`,
    );
  }

  if (!input.section) {
    errors.push("section is required");
  } else {
    if (!input.section.id) errors.push("section.id is required");
    if (!input.section.slug) errors.push("section.slug is required");
    if (!input.section.name) errors.push("section.name is required");
    if (!input.section.color) errors.push("section.color is required");
  }

  if (!input.title) errors.push("title is required");
  if (!input.photoUrl) errors.push("photoUrl is required");

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ----------------------------------------------------------------------------
// Default Export
// ----------------------------------------------------------------------------

export default composeBrandTemplate;
