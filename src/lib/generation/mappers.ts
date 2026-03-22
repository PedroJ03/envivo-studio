import type {
  SourceType,
  FormatType,
  ToneType,
  SectionSlug,
  TemplateFormat,
  MappingResult,
} from "./types";
import { MappingError } from "./errors";

/**
 * Maps source_type to section slug.
 * - calendar_event → "proximos-shows" (events/shows)
 * - content_feed_item → "noticias" (news)
 */
export const SOURCE_TO_SECTION: Record<SourceType, SectionSlug> = {
  calendar_event: "proximos-shows",
  content_feed_item: "noticias",
};

/**
 * Maps format type to template format for BrandComposer.
 * Note: DB enum uses "carousel" not "reel"
 */
export const FORMAT_TO_TEMPLATE: Record<FormatType, TemplateFormat> = {
  post: "post-vertical-45",
  story: "story-9-16",
  carousel: "reel-cover-9-16",
};

/**
 * Maps tone type (DB enum value) to persona file name (without .md extension).
 * Persona files are stored in /personas/ directory.
 * DB enum: "informative" | "opinion" | "nostalgic" | "humorous" | "urgent"
 * Persona files: "informative.md", "opinion.md", etc.
 */
export const TONE_TO_TONE_FILE: Record<ToneType, string> = {
  informative: "informative",
  opinion: "opinion",
  nostalgic: "nostalgic",
  humorous: "humorous",
  urgent: "urgent",
};

/**
 * Validates and returns the mapping result for a source type.
 * @throws MappingError if sourceType is invalid
 */
export function mapSourceToSection(sourceType: SourceType): SectionSlug {
  const section = SOURCE_TO_SECTION[sourceType];
  if (!section) {
    throw new MappingError("sourceType", sourceType);
  }
  return section;
}

/**
 * Validates and returns the template format for a format type.
 * @throws MappingError if formatType is invalid
 */
export function mapFormatToTemplate(formatType: FormatType): TemplateFormat {
  const template = FORMAT_TO_TEMPLATE[formatType];
  if (!template) {
    throw new MappingError("formatType", formatType);
  }
  return template;
}

/**
 * Returns the tone file name for a tone type.
 * @throws MappingError if toneType is invalid
 */
export function mapToneToFile(toneType: ToneType): string {
  const file = TONE_TO_TONE_FILE[toneType];
  if (!file) {
    throw new MappingError("toneType", toneType);
  }
  return file;
}

/**
 * Creates a complete mapping result for a generation format.
 */
export function createMappingResult(
  sourceType: SourceType,
  formatType: FormatType,
  toneType: ToneType,
): MappingResult {
  return {
    section: mapSourceToSection(sourceType),
    template: mapFormatToTemplate(formatType),
    toneFile: mapToneToFile(toneType),
  };
}
