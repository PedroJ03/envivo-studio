/**
 * System-Specific Deduplication Configuration - Phase 4.6
 *
 * Defines deduplication configurations specific to System A and System B.
 * Different content types have different windows and thresholds.
 */

import type { EventType, ContentFeedType } from "./types";
import { DEDUP_WINDOWS, FUZZY_THRESHOLDS } from "./deduplication";

// ============================================================================
// System A: Calendar Events Configuration
// ============================================================================

export interface SystemADedupConfig {
  /** Deduplication window in days */
  exactWindowDays: number;
  hashWindowDays: number;
  fuzzyWindowDays: number;
  /** Fuzzy match threshold (0-1) */
  fuzzyThreshold: number;
  /** Fields to use for matching */
  matchFields: Array<"title" | "artist" | "venue" | "date">;
  /** Weights for fuzzy matching */
  weights: {
    title: number;
    artist: number;
    venue: number;
    date: number;
  };
}

/**
 * System A deduplication configs by event type.
 * Different event types have different deduplication strategies.
 */
export const SYSTEM_A_CONFIGS: Record<EventType, SystemADedupConfig> = {
  historical: {
    exactWindowDays: Infinity,
    hashWindowDays: Infinity,
    fuzzyWindowDays: 365 * 10, // 10 years for historical (same day in history)
    fuzzyThreshold: 0.9, // Higher threshold for historical
    matchFields: ["title", "date"],
    weights: {
      title: 0.6,
      artist: 0.2,
      venue: 0.1,
      date: 0.1,
    },
  },
  concert: {
    exactWindowDays: DEDUP_WINDOWS.CALENDAR_CONCERT,
    hashWindowDays: DEDUP_WINDOWS.CALENDAR_CONCERT,
    fuzzyWindowDays: FUZZY_THRESHOLDS.CONCERT_DATE_WINDOW,
    fuzzyThreshold: FUZZY_THRESHOLDS.TITLE_SIMILARITY,
    matchFields: ["title", "artist", "venue", "date"],
    weights: {
      title: 0.25,
      artist: 0.4,
      venue: 0.25,
      date: 0.1,
    },
  },
  festival: {
    exactWindowDays: DEDUP_WINDOWS.CALENDAR_FESTIVAL,
    hashWindowDays: DEDUP_WINDOWS.CALENDAR_FESTIVAL,
    fuzzyWindowDays: 14, // 2 weeks for festivals
    fuzzyThreshold: 0.8, // Lower threshold for festivals (names can vary)
    matchFields: ["title", "date"],
    weights: {
      title: 0.5,
      artist: 0.2,
      venue: 0.15,
      date: 0.15,
    },
  },
  local_event: {
    exactWindowDays: DEDUP_WINDOWS.CALENDAR_LOCAL_EVENT,
    hashWindowDays: DEDUP_WINDOWS.CALENDAR_LOCAL_EVENT,
    fuzzyWindowDays: 3, // 3 days for local events
    fuzzyThreshold: 0.85,
    matchFields: ["title", "date"],
    weights: {
      title: 0.5,
      artist: 0.1,
      venue: 0.2,
      date: 0.2,
    },
  },
};

/**
 * Get the deduplication config for a specific event type.
 */
export function getSystemAConfig(eventType: EventType): SystemADedupConfig {
  return SYSTEM_A_CONFIGS[eventType];
}

// ============================================================================
// System B: Content Feed Configuration
// ============================================================================

export interface SystemBDedupConfig {
  /** Deduplication window in days */
  hashWindowDays: number;
  fuzzyWindowDays: number;
  /** Fuzzy match threshold (0-1) */
  fuzzyThreshold: number;
  /** Fields to use for matching */
  matchFields: Array<"title" | "body">;
  /** Weights for fuzzy matching */
  weights: {
    title: number;
    body: number;
  };
  /** Whether to use trigram similarity */
  useTrigram: boolean;
}

/**
 * System B deduplication configs by content type.
 * Different content types have different freshness requirements.
 */
export const SYSTEM_B_CONFIGS: Record<ContentFeedType, SystemBDedupConfig> = {
  breaking_news: {
    hashWindowDays: DEDUP_WINDOWS.FEED_BREAKING_NEWS,
    fuzzyWindowDays: 1,
    fuzzyThreshold: 0.95, // High threshold for breaking news
    matchFields: ["title"],
    weights: {
      title: 0.7,
      body: 0.3,
    },
    useTrigram: false,
  },
  trending: {
    hashWindowDays: DEDUP_WINDOWS.FEED_TRENDING,
    fuzzyWindowDays: DEDUP_WINDOWS.FEED_TRENDING,
    fuzzyThreshold: 0.85,
    matchFields: ["title", "body"],
    weights: {
      title: 0.6,
      body: 0.4,
    },
    useTrigram: true,
  },
  curiosity: {
    hashWindowDays: DEDUP_WINDOWS.FEED_CURIOSITY,
    fuzzyWindowDays: DEDUP_WINDOWS.FEED_CURIOSITY,
    fuzzyThreshold: 0.8, // Lower threshold - curiosities can have similar titles
    matchFields: ["title", "body"],
    weights: {
      title: 0.5,
      body: 0.5,
    },
    useTrigram: true,
  },
  trivia: {
    hashWindowDays: DEDUP_WINDOWS.FEED_TRIVIA,
    fuzzyWindowDays: DEDUP_WINDOWS.FEED_TRIVIA,
    fuzzyThreshold: 0.75, // Even lower - trivia can have generic titles
    matchFields: ["body"], // Body/facts are more important for trivia
    weights: {
      title: 0.3,
      body: 0.7,
    },
    useTrigram: true,
  },
};

/**
 * Get the deduplication config for a specific content type.
 */
export function getSystemBConfig(
  contentType: ContentFeedType,
): SystemBDedupConfig {
  return SYSTEM_B_CONFIGS[contentType];
}

// ============================================================================
// Source-Specific Overrides
// ============================================================================

export interface SourceDedupOverride {
  /** Override exact window days */
  exactWindowDays?: number;
  /** Override hash window days */
  hashWindowDays?: number;
  /** Override fuzzy window days */
  fuzzyWindowDays?: number;
  /** Override fuzzy threshold */
  fuzzyThreshold?: number;
}

/**
 * Source-specific deduplication overrides.
 * Higher priority sources may have longer windows.
 */
export const SOURCE_DEDUP_OVERRIDES: Record<string, SourceDedupOverride> = {
  // System A sources
  ticketmaster: {
    exactWindowDays: 60, // 2 months for ticketmaster
    hashWindowDays: 60,
  },
  eventbrite: {
    exactWindowDays: 45, // 1.5 months for eventbrite
    hashWindowDays: 45,
  },
  wikimedia: {
    exactWindowDays: Infinity, // No window for historical
    hashWindowDays: Infinity,
    fuzzyThreshold: 0.95, // Higher threshold for wikimedia
  },

  // System B sources
  newsapi: {
    exactWindowDays: 1,
    hashWindowDays: 1,
    fuzzyThreshold: 0.95,
  },
  gnews: {
    exactWindowDays: 2,
    hashWindowDays: 2,
    fuzzyThreshold: 0.9,
  },
  billboard: {
    exactWindowDays: 7,
    hashWindowDays: 7,
  },
};

/**
 * Get source-specific overrides.
 */
export function getSourceOverrides(source: string): SourceDedupOverride {
  return SOURCE_DEDUP_OVERRIDES[source.toLowerCase()] || {};
}

/**
 * Apply source overrides to a config.
 */
export function applySourceOverrides<
  T extends {
    exactWindowDays?: number;
    hashWindowDays?: number;
    fuzzyWindowDays?: number;
    fuzzyThreshold?: number;
  },
>(config: T, source: string): T {
  const overrides = getSourceOverrides(source);
  return {
    ...config,
    exactWindowDays: overrides.exactWindowDays ?? config.exactWindowDays,
    hashWindowDays: overrides.hashWindowDays ?? config.hashWindowDays,
    fuzzyWindowDays: overrides.fuzzyWindowDays ?? config.fuzzyWindowDays,
    fuzzyThreshold: overrides.fuzzyThreshold ?? config.fuzzyThreshold,
  };
}

// ============================================================================
// Tenant-Specific Configuration
// ============================================================================

export interface TenantDedupConfig {
  /** Enable/disable fuzzy matching */
  enableFuzzyMatching: boolean;
  /** Custom thresholds per event type */
  eventTypeThresholds?: Partial<Record<EventType, number>>;
  /** Custom windows per event type */
  eventTypeWindows?: Partial<Record<EventType, number>>;
  /** Maximum events to compare against (for performance) */
  maxComparisonSetSize: number;
}

/**
 * Tenant-specific deduplication configurations.
 * Tenants can customize their deduplication behavior.
 */
export const TENANT_DEDUP_CONFIGS: Record<string, TenantDedupConfig> = {
  default: {
    enableFuzzyMatching: true,
    maxComparisonSetSize: 1000,
  },
};

/**
 * Get tenant deduplication config.
 */
export function getTenantConfig(tenantId: string): TenantDedupConfig {
  return TENANT_DEDUP_CONFIGS[tenantId] || TENANT_DEDUP_CONFIGS.default;
}

// ============================================================================
// Composite Config Builder
// ============================================================================

export interface CompositeDedupConfig {
  exactWindowDays: number;
  hashWindowDays: number;
  fuzzyWindowDays: number;
  fuzzyThreshold: number;
  enableFuzzyMatching: boolean;
  maxComparisonSetSize: number;
}

/**
 * Build a composite deduplication config from system config, source overrides, and tenant config.
 */
export function buildCompositeConfig(
  systemType: "A" | "B",
  eventType: EventType | ContentFeedType,
  source: string,
  tenantId: string,
): CompositeDedupConfig {
  // Get base system config
  let baseConfig: SystemADedupConfig | SystemBDedupConfig;
  if (systemType === "A") {
    baseConfig = getSystemAConfig(eventType as EventType);
  } else {
    baseConfig = getSystemBConfig(eventType as ContentFeedType);
  }

  // Apply source overrides
  const configWithOverrides = applySourceOverrides(
    baseConfig as SystemADedupConfig & SystemBDedupConfig,
    source,
  );

  // Get tenant config
  const tenantConfig = getTenantConfig(tenantId);

  // Build composite
  return {
    exactWindowDays:
      configWithOverrides.exactWindowDays ?? DEDUP_WINDOWS.CALENDAR_CONCERT,
    hashWindowDays:
      configWithOverrides.hashWindowDays ?? DEDUP_WINDOWS.CALENDAR_CONCERT,
    fuzzyWindowDays:
      configWithOverrides.fuzzyWindowDays ??
      FUZZY_THRESHOLDS.CONCERT_DATE_WINDOW,
    fuzzyThreshold:
      configWithOverrides.fuzzyThreshold ?? FUZZY_THRESHOLDS.TITLE_SIMILARITY,
    enableFuzzyMatching: tenantConfig.enableFuzzyMatching,
    maxComparisonSetSize: tenantConfig.maxComparisonSetSize,
  };
}

// ============================================================================
// Logging and Metrics
// ============================================================================

export interface DedupMetrics {
  totalChecked: number;
  exactMatches: number;
  hashMatches: number;
  fuzzyMatches: number;
  newEvents: number;
  conflictsResolved: number;
  bySource: Record<
    string,
    {
      checked: number;
      matches: number;
      new: number;
    }
  >;
  byEventType: Record<
    string,
    {
      checked: number;
      matches: number;
      new: number;
    }
  >;
}

/**
 * Create empty metrics structure.
 */
export function createEmptyMetrics(): DedupMetrics {
  return {
    totalChecked: 0,
    exactMatches: 0,
    hashMatches: 0,
    fuzzyMatches: 0,
    newEvents: 0,
    conflictsResolved: 0,
    bySource: {},
    byEventType: {},
  };
}

/**
 * Record a match in metrics.
 */
export function recordMatch(
  metrics: DedupMetrics,
  matchType: "exact" | "hash" | "fuzzy",
  source: string,
  eventType: string,
): void {
  metrics.totalChecked++;

  switch (matchType) {
    case "exact":
      metrics.exactMatches++;
      break;
    case "hash":
      metrics.hashMatches++;
      break;
    case "fuzzy":
      metrics.fuzzyMatches++;
      break;
  }

  // Source breakdown
  if (!metrics.bySource[source]) {
    metrics.bySource[source] = { checked: 0, matches: 0, new: 0 };
  }
  metrics.bySource[source].checked++;
  metrics.bySource[source].matches++;

  // Event type breakdown
  if (!metrics.byEventType[eventType]) {
    metrics.byEventType[eventType] = { checked: 0, matches: 0, new: 0 };
  }
  metrics.byEventType[eventType].checked++;
  metrics.byEventType[eventType].matches++;
}

/**
 * Record a new event in metrics.
 */
export function recordNew(
  metrics: DedupMetrics,
  source: string,
  eventType: string,
): void {
  metrics.totalChecked++;
  metrics.newEvents++;

  // Source breakdown
  if (!metrics.bySource[source]) {
    metrics.bySource[source] = { checked: 0, matches: 0, new: 0 };
  }
  metrics.bySource[source].checked++;
  metrics.bySource[source].new++;

  // Event type breakdown
  if (!metrics.byEventType[eventType]) {
    metrics.byEventType[eventType] = { checked: 0, matches: 0, new: 0 };
  }
  metrics.byEventType[eventType].checked++;
  metrics.byEventType[eventType].new++;
}
