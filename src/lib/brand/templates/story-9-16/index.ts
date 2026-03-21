// ============================================================================
// Story 9:16 Templates - Index
// filo-news-brand-system
// ============================================================================

export { FullBleed } from "./FullBleed";
export { Split } from "./Split";
export { Minimal } from "./Minimal";

// Re-export types
export type { StoryProps, StoryVariant } from "../../types";

// Variant selector helper
import type { StoryProps, StoryVariant } from "../../types";
import { FullBleed } from "./FullBleed";
import { Split } from "./Split";
import { Minimal } from "./Minimal";

/**
 * Get the Story 9:16 template component based on variant name
 */
export function getStoryTemplate(variant: StoryVariant) {
  switch (variant) {
    case "fullbleed":
      return FullBleed;
    case "split":
      return Split;
    case "minimal":
      return Minimal;
    default:
      return FullBleed;
  }
}

// Available variants for reference
export const STORY_VARIANTS: StoryVariant[] = ["fullbleed", "split", "minimal"];

// Default export
export default {
  FullBleed,
  Split,
  Minimal,
  getStoryTemplate,
  STORY_VARIANTS,
};
