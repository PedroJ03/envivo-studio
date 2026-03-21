/**
 * Topic Selection Module (Stage 2 Pipeline)
 *
 * Exports all types, query functions, and constants for the topic selection
 * feature that bridges ingestion (Stage 1) and content generation (Stage 3).
 */

// Types
export {
  type SourceType,
  type Urgency,
  type SelectionStatus,
  type Tone,
  type FormatType,
  type FormatConfig,
  type PendingTopic,
  type TopicSelection,
  type CreateSelectionInput,
  type FilterOptions,
  type PaginationOptions,
  type PendingTopicsParams,
  type PendingTopicsResponse,
  type SelectionResponse,
  type SelectionsResponse,
  // Constants
  TONES,
  FORMAT_TYPES,
  URGENCY_LEVELS,
  SELECTION_STATUSES,
} from "./types";

// Queries
export {
  getPendingTopics,
  createTopicSelection,
  discardTopicSelection,
  getTopicSelections,
  checkDuplicateSelection,
  restoreTopicSelection,
} from "./queries";
