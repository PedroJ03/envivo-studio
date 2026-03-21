/**
 * Content Ingestion Module - Phase 1 Foundation
 *
 * This module provides the foundation for the dual-system content ingestion:
 * - System A: Calendar Events (concerts, festivals, historical events)
 * - System B: Content Feed (breaking news, trending, curiosities, trivia)
 */

// Re-export all types
export * from "./types";

// Re-export base connector
export { BaseConnector } from "./base-connector";
export type {
  ConnectorContext,
  HealthStatus,
  NormalizedItem,
  RawEvent,
  RawFeedItem,
} from "./base-connector";

// Re-export cache utilities
export {
  IngestionCache,
  getRedisClient,
  closeRedis,
  getApiResponseTtl,
  TTL,
} from "./cache";
export type { CircuitState, RateLimitResult } from "./cache";

// Re-export deduplication utilities (Phase 1 base + Phase 4 engine)
export {
  generateContentHash,
  generateShortHash,
  normalizeForHash,
  normalizeForDisplay,
  normalizeArtistName,
  normalizeVenueName,
  normalizeDate,
  normalizeToYear,
  isSameDay,
  isWithinWindow,
  exactMatch,
  hashMatch,
  levenshteinDistance,
  jaroWinklerSimilarity,
  generateEventDedupeKey,
  artistsMatch,
  venuesMatch,
  // Phase 4 deduplication functions
  checkExactMatch,
  checkHashMatch,
  checkFuzzyMatch,
  checkExactMatchFeed,
  checkHashMatchFeed,
  checkFuzzyMatchFeed,
  runDeduplicationTiers,
  generateFuzzyContentHash,
  DEDUP_WINDOWS,
  FUZZY_THRESHOLDS,
  type ExactMatchResult,
  type HashMatchResult,
  type FuzzyMatchResult,
} from "./deduplication";

// Re-export deduplication-base (Phase 1 foundation)
export {
  generateContentHash as genHash,
  normalizeForHash as normHash,
  normalizeArtistName as normArtist,
  normalizeVenueName as normVenue,
  normalizeDate as normDate,
  levenshteinDistance as levDistance,
  jaroWinklerSimilarity as jwSimilarity,
} from "./deduplication-base";

// Re-export conflict resolution (Phase 4.4)
export {
  resolveConflict,
  resolveFeedItemConflict,
  getSourcePriority,
  hasHigherPriority,
  mergeImages,
  mergeUniqueStrings,
  SOURCE_PRIORITY,
  type MergeHistory,
  type MergeHistoryEntry,
  type ConflictResolutionOptions,
} from "./conflict-resolution";

// Re-export deduplication service (Phase 4.5)
export {
  DeduplicationService,
  FeedDeduplicationService,
  DedupLogger,
  type DedupServiceResult,
  type DedupServiceOptions,
  type DuplicateRecord,
  type DedupError,
  type FeedDedupResult,
  type DedupLogEntry,
} from "./dedup-service";

// Re-export system-specific configs (Phase 4.6)
export {
  SYSTEM_A_CONFIGS,
  SYSTEM_B_CONFIGS,
  SOURCE_DEDUP_OVERRIDES,
  TENANT_DEDUP_CONFIGS,
  getSystemAConfig,
  getSystemBConfig,
  getSourceOverrides,
  applySourceOverrides,
  getTenantConfig,
  buildCompositeConfig,
  createEmptyMetrics,
  recordMatch,
  recordNew,
  type SystemADedupConfig,
  type SystemBDedupConfig,
  type SourceDedupOverride,
  type TenantDedupConfig,
  type CompositeDedupConfig,
  type DedupMetrics,
} from "./system-dedup";

// Re-export multi-tenancy utilities
export {
  isShared,
  isTenantLocal,
  getEffectiveTenantId,
  filterByTenant,
  filterByTenantOnly,
  partitionByTenancy,
  validateSourceForTenant,
  getAllowedSources,
  isSharedEventType,
  isTenantLocalEventType,
  defaultTenantQuery,
  sharedOnlyQuery,
  tenantLocalOnlyQuery,
  filterCalendarEvents,
  filterContentFeedItems,
  SHARED_EVENT_TYPES,
  TENANT_LOCAL_EVENT_TYPES,
} from "./multi-tenancy";

// ============================================================================
// System B: Content Feed Connectors (Phase 3)
// ============================================================================

export { NewsAPIConnector, createNewsAPIConnector } from "./sources/newsapi";
export { GNewsConnector, createGNewsConnector } from "./sources/gnews";
export { WikidataConnector, createWikidataConnector } from "./sources/wikidata";
export {
  RollingStoneConnector,
  createRollingStoneConnector,
} from "./sources/rolling-stone";

// System B Orchestrators
export { systemBBreakingFunction } from "./system-b-breaking-orchestrator";
export { systemBDailyFunction } from "./system-b-daily-orchestrator";
