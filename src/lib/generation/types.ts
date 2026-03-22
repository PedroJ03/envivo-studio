export type SourceType = "calendar_event" | "content_feed_item";
export type FormatType = "post" | "story" | "carousel";
// NOTE: These values match the database enum in schema.ts
// tone enum values: "informative" | "opinion" | "nostalgic" | "humorous" | "urgent"
export type ToneType =
  | "informative"
  | "opinion"
  | "nostalgic"
  | "humorous"
  | "urgent";
export type SectionSlug =
  | "proximos-shows"
  | "efemerides"
  | "noticias"
  | "bandas-locales";
export type TemplateFormat =
  | "post-vertical-45"
  | "story-9-16"
  | "reel-cover-9-16";

export interface GenerationFormat {
  type: FormatType;
  tone: ToneType;
  priority: number;
}

export interface MappingResult {
  section: SectionSlug;
  template: TemplateFormat;
  toneFile: string;
}

export interface GenerationResult {
  selectionId: string;
  candidates: Array<{
    candidateId: string;
    format: FormatType;
    status: "created" | "existing" | "failed";
  }>;
  status: "generating" | "ready" | "failed";
}

export interface SourceData {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  eventDate?: string;
  venue?: string;
  artists?: string[];
  sourceType: SourceType;
  sourceSlug?: string; // For looking up the source record in the sources table
}
