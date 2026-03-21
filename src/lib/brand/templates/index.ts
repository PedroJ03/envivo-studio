// ============================================================================
// Brand Templates - Index
// filo-news-brand-system
// ============================================================================

export const TEMPLATE_FORMATS = {
  POST_VERTICAL_45: "post-vertical-45",
  POST_SQUARE_11: "post-square-11",
  STORY_9_16: "story-9-16",
  REEL_COVER_9_16: "reel-cover-9-16",
} as const;

// Post Square 1:1 Templates (1080x1080)
export {
  PostSquare11,
  Classic as PostSquare11Classic,
  Centered as PostSquare11Centered,
  Minimal as PostSquare11Minimal,
} from "./post-square-11/PostSquare11";

// Post Vertical 4:5 Templates (1080x1350)
export {
  PostVertical45,
  Classic as PostVertical45Classic,
  Centered as PostVertical45Centered,
  TopLogo as PostVertical45TopLogo,
  Minimal as PostVertical45Minimal,
} from "./post-vertical-45/PostVertical45";

// Reel Cover 9:16 Templates (1080x1920)
export {
  ReelCover,
  Magazine as ReelCoverMagazine,
  Duotone as ReelCoverDuotone,
  Minimal as ReelCoverMinimal,
} from "./reel-cover-9-16/ReelCover";

// Story 9:16 Templates (1080x1920)
export {
  FullBleed as StoryFullBleed,
  Split as StorySplit,
  Minimal as StoryMinimal,
  getStoryTemplate,
  STORY_VARIANTS,
} from "./story-9-16";

// Re-export types
export type {
  PostSquare11Props,
  PostSquare11Variant,
  PostVertical45Props,
  PostVertical45Variant,
  ReelCoverProps,
  ReelCoverVariant,
  StoryProps,
  StoryVariant,
} from "../types";
