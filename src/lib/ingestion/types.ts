/**
 * Content Ingestion Types - Phase 1 Foundation
 *
 * This module defines all shared types for the dual-system content ingestion
 * architecture. System A handles calendar events; System B handles viral/evergreen content.
 */

// ============================================================================
// Enums
// ============================================================================

export type EventType = "historical" | "concert" | "festival" | "local_event";

export type ContentFeedType =
  | "breaking_news"
  | "trending"
  | "curiosity"
  | "trivia";

export type SourceSystem = "A" | "B";

export type SourceType = "api" | "scraper" | "rss";

export type SourceStatus = "active" | "paused" | "error";

// ============================================================================
// Source Configuration
// ============================================================================

export interface SourceConnectorConfig {
  sourceId: string;
  sourceType: SourceType;
  tenantId?: string; // null = shared source
  isShared: boolean;
  apiKey?: string;
  baseUrl?: string;
  rateLimitRps?: number;
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
  };
  circuitBreaker?: {
    failureThreshold: number;
    resetTimeoutMs: number;
  };
}

// ============================================================================
// Raw Items (from external sources)
// ============================================================================

export interface RawEvent {
  sourceId: string;
  externalId: string;
  rawData: unknown;
  fetchedAt: Date;
}

export interface RawFeedItem {
  sourceId: string;
  externalId: string;
  rawData: unknown;
  fetchedAt: Date;
}

// ============================================================================
// Base Normalized Item
// ============================================================================

export interface NormalizedItem {
  id?: string; // Database ID (assigned on insert)
  source: string;
  sourceId: string;
  sourceUrl: string;
  title: string;
  contentHash: string;
  tenantId: string | null;
  isShared: boolean;
  metadata: Record<string, unknown>;
}

// ============================================================================
// System A: Calendar Events
// ============================================================================

export interface Location {
  city?: string;
  region?: string;
  country?: string;
  venue?: string;
}

export interface Artist {
  name: string;
  normalizedName: string;
  externalUrls?: Record<string, string>;
}

export interface Image {
  url: string;
  source?: string;
  caption?: string;
  license?: string;
}

export interface NormalizedEvent extends NormalizedItem {
  eventType: EventType;
  eventDate: Date;
  year?: number;
  location?: Location;
  artists?: Artist[];
  images?: Image[];
  tags?: string[];
  description?: string;
  priority: number;
  updatedAt?: Date;
}

// ============================================================================
// System B: Content Feed Items
// ============================================================================

export interface Fact {
  fact: string;
  source?: string;
  verifiedAt?: Date;
}

export interface ContentFeedItem extends NormalizedItem {
  contentType: ContentFeedType;
  body: string;
  hook: string;
  facts: Fact[];
  images?: Image[];
  tags: string[];
  publishAt: Date;
  expiresAt?: Date;
  viralScore: number;
  updatedAt?: Date;
}

// ============================================================================
// Connector Interface
// ============================================================================

export interface ConnectorContext {
  tenantId?: string;
  date?: Date; // For date-based sources (System A)
  cursor?: string; // For pagination
}

export interface ConnectorResult<T> {
  items: T[];
  cursor?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Base interface for all source connectors.
 * Connectors fetch raw data from external sources and normalize it.
 */
export interface SourceConnector<T extends NormalizedItem> {
  readonly name: string;
  readonly sourceType: SourceType;

  /**
   * Fetch raw items from the source.
   * Must handle pagination, rate limiting, and errors internally.
   */
  fetch(ctx: ConnectorContext): Promise<RawEvent[] | RawFeedItem[]>;

  /**
   * Normalize a raw item to the internal format.
   */
  normalize(raw: RawEvent | RawFeedItem): Promise<T>;

  /**
   * Calculate content hash for deduplication.
   */
  calculateHash(item: T): string;

  /**
   * Check health of the source.
   */
  health(ctx: ConnectorContext): Promise<HealthStatus>;
}

// ============================================================================
// Inngest Integration Types
// ============================================================================

export interface IngestInput {
  sourceId: string;
  tenantId?: string;
  date?: string;
  cursor?: string;
}

export interface IngestResult {
  sourceId: string;
  itemsCreated: number;
  duplicatesSkipped: number;
  errors: string[];
  cursor?: string;
  durationMs: number;
}

export interface SystemAIngestResult extends IngestResult {
  eventsCreated: number;
}

export interface SystemBIngestResult extends IngestResult {
  feedItemsCreated: number;
  breakingNewsCount: number;
}

// ============================================================================
// Deduplication Types
// ============================================================================

export type MatchType = "exact" | "hash" | "fuzzy";

export interface DedupeResult {
  isDuplicate: boolean;
  existingId?: string;
  matchType?: MatchType;
  confidence?: number;
}

// ============================================================================
// Multi-tenancy Query Helpers
// ============================================================================

export interface TenantQueryOptions {
  includeShared: boolean;
  activeOnly?: boolean;
  limit?: number;
}

/**
 * Builds a query filter for calendar events that respects tenant boundaries.
 * Returns events where:
 * - tenant_id matches the provided tenant, OR
 * - is_shared is true (shared across all tenants)
 */
export interface CalendarEventQueryFilters {
  tenantId: string;
  eventDateFrom?: Date;
  eventDateTo?: Date;
  eventTypes?: EventType[];
  sources?: string[];
  includeShared?: boolean;
}

/**
 * Builds a query filter for content feed items that respects tenant boundaries.
 * Returns items where:
 * - tenant_id matches the provided tenant, OR
 * - is_shared is true (shared across all tenants)
 * - publish_at <= now
 * - (expires_at is null OR expires_at > now)
 */
export interface ContentFeedQueryFilters {
  tenantId: string;
  contentTypes?: ContentFeedType[];
  sources?: string[];
  includeShared?: boolean;
  publishedOnly?: boolean;
}

// ============================================================================
// Source Registry Types
// ============================================================================

export interface IngestionSource {
  id: string;
  slug: string;
  name: string;
  system: SourceSystem;
  connectorType: string;
  tenantId: string | null;
  isShared: boolean;
  config: Record<string, unknown>;
  scheduleCron?: string;
  priority: number;
  rateLimitRps?: number;
  status: SourceStatus;
  lastIngestedAt?: Date;
  lastError?: string;
  errorCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Shared Sources Constants
// ============================================================================

/**
 * Sources that are shared across all tenants.
 * These sources provide content available to everyone.
 */
export const SHARED_SOURCES = [
  "wikimedia",
  "ticketmaster",
  "eventbrite",
  "newsapi",
  "gnews",
  "wikidata",
  "rollingstone",
  "billboard",
] as const;

/**
 * Sources that are tenant-local (not shared).
 * These sources only provide content for specific tenants.
 */
export const TENANT_LOCAL_SOURCES = [
  "tandil_municipio",
  "eldiario_rss",
  "indiehoy",
] as const;

export type SharedSourceName = (typeof SHARED_SOURCES)[number];
export type TenantLocalSourceName = (typeof TENANT_LOCAL_SOURCES)[number];

/**
 * Check if a source is a shared source.
 */
export function isSharedSource(sourceName: string): boolean {
  return (SHARED_SOURCES as readonly string[]).includes(sourceName);
}

// ============================================================================
// Priority Constants
// ============================================================================

export const PRIORITY = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
} as const;

// ============================================================================
// Viral Score Constants
// ============================================================================

export const VIRAL_SCORE = {
  BREAKING_NEWS: 100,
  TRENDING: 75,
  CURIOSITY: 50,
  TRIVIA: 25,
} as const;

// ============================================================================
// Expiry Constants (in days)
// ============================================================================

export const EXPIRY = {
  BREAKING_NEWS_HOURS: 48,
  TRENDING_DAYS: 7,
  CURIOSITY_DAYS: 90,
  // Trivia is evergreen (null expiry)
} as const;
