/**
 * Types for Topic Selection feature (Stage 2 of content pipeline)
 * These types define the data structures for pending topics, selections, and API contracts
 */

export type SourceType = "calendar_event" | "content_feed_item";

export type Urgency = "low" | "medium" | "high" | "breaking";

export type SelectionStatus = "pending" | "generating" | "ready" | "discarded";

export type Tone =
  | "informative"
  | "opinion"
  | "nostalgic"
  | "humorous"
  | "urgent";

export type FormatType = "post" | "story" | "reel";

/**
 * Format configuration for content generation
 * Each selection can specify multiple formats (post, story, reel) with different tones
 */
export interface FormatConfig {
  type: FormatType;
  tone: Tone;
  priority: number;
}

/**
 * A pending topic from either calendar_events (System A) or content_feed_items (System B)
 * that hasn't been selected yet by the current tenant
 */
export interface PendingTopic {
  id: string; // source_id (UUID from source table)
  sourceType: SourceType;
  source: string; // e.g., "ticketmaster", "newsapi"
  title: string;
  description?: string;
  date: string; // ISO 8601
  type: string; // event_type or content_type
  priority: number;
  image?: string; // First image URL
  tags: string[];
  isShared: boolean;
}

/**
 * Database record for a topic selection
 */
export interface TopicSelection {
  id: string;
  tenantId: string;
  sourceType: SourceType;
  sourceId: string;
  formats: FormatConfig[];
  targetPublishAt?: string;
  urgency: Urgency;
  status: SelectionStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Input for creating a new topic selection
 */
export interface CreateSelectionInput {
  sourceType: SourceType;
  sourceId: string;
  formats: FormatConfig[];
  targetPublishAt?: string;
  urgency?: Urgency;
  metadata?: Record<string, unknown>;
}

/**
 * Filter options for querying pending topics
 */
export interface FilterOptions {
  source?: string;
  type?: SourceType | "all";
  dateFrom?: string;
  dateTo?: string;
  status?: SelectionStatus;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Combined filters with pagination for getPendingTopics query
 */
export interface PendingTopicsParams extends FilterOptions, PaginationOptions {}

/**
 * Response from GET /api/topics/pending
 */
export interface PendingTopicsResponse {
  topics: PendingTopic[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Response from POST /api/topics/select and POST /api/topics/discard
 */
export interface SelectionResponse {
  selectionId: string;
  status: SelectionStatus;
}

/**
 * Response from GET /api/topics/selections
 */
export interface SelectionsResponse {
  selections: TopicSelection[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Valid tone values for content generation
 */
export const TONES: Tone[] = [
  "informative",
  "opinion",
  "nostalgic",
  "humorous",
  "urgent",
];

/**
 * Valid format types
 */
export const FORMAT_TYPES: FormatType[] = ["post", "story", "reel"];

/**
 * Valid urgency levels
 */
export const URGENCY_LEVELS: Urgency[] = ["low", "medium", "high", "breaking"];

/**
 * Valid selection statuses
 */
export const SELECTION_STATUSES: SelectionStatus[] = [
  "pending",
  "generating",
  "ready",
  "discarded",
];
