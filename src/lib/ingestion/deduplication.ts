/**
 * Deduplication Engine - Phase 4 Enhancement
 *
 * Provides 3-tier deduplication for calendar events and content feed items:
 * - Tier 1: Exact match by (source, sourceId)
 * - Tier 2: Hash match by content_hash
 * - Tier 3: Fuzzy match by title/artist/venue similarity
 *
 * Plus conflict resolution and system-specific deduplication configs.
 */

import type {
  NormalizedEvent,
  ContentFeedItem,
  MatchType,
  DedupeResult,
  EventType,
  Location,
  Artist,
} from "./types";

// Re-export all base functions from deduplication-base
export {
  normalizeForHash,
  normalizeForDisplay,
  normalizeArtistName,
  normalizeVenueName,
  normalizeDate,
  normalizeToYear,
  isSameDay,
  isWithinWindow,
  levenshteinDistance,
  jaroWinklerSimilarity,
  exactMatch,
  hashMatch,
  generateContentHash,
  generateShortHash,
  generateEventDedupeKey,
  artistsMatch,
  venuesMatch,
  type EventDedupeKey,
} from "./deduplication-base";

import {
  normalizeForHash,
  normalizeForDisplay,
  normalizeArtistName,
  normalizeVenueName,
  normalizeDate,
  normalizeToYear,
  isSameDay,
  isWithinWindow,
  levenshteinDistance,
  jaroWinklerSimilarity,
  exactMatch,
  hashMatch,
  generateContentHash,
  generateShortHash,
  generateEventDedupeKey,
  artistsMatch,
  venuesMatch,
} from "./deduplication-base";

// ============================================================================
// Deduplication Windows (in days)
// ============================================================================

export const DEDUP_WINDOWS = {
  // System A: Calendar Events
  CALENDAR_CONCERT: 30,
  CALENDAR_LOCAL_EVENT: 30,
  CALENDAR_FESTIVAL: 30,
  CALENDAR_HISTORICAL: Infinity, // Historical events don't expire

  // System B: Content Feed
  FEED_BREAKING_NEWS: 1, // 1 day for breaking news
  FEED_TRENDING: 7, // 7 days for trending
  FEED_CURIOSITY: 90, // 90 days for curiosities
  FEED_TRIVIA: 365, // 1 year for trivia (almost evergreen)
} as const;

// ============================================================================
// Fuzzy Match Thresholds
// ============================================================================

export const FUZZY_THRESHOLDS = {
  TITLE_SIMILARITY: 0.85, // 85% title similarity
  ARTIST_SIMILARITY: 0.85, // 85% artist similarity
  VENUE_SIMILARITY: 0.8, // 80% venue similarity
  DATE_PROXIMITY_DAYS: 3, // Within 3 days
  CONCERT_DATE_WINDOW: 7, // 7 days for concert date matching
} as const;

// ============================================================================
// Phase 4.1: Exact Match Deduplication
// ============================================================================

export interface ExactMatchResult {
  found: boolean;
  existingEvent?: NormalizedEvent;
  matchType: "exact";
}

/**
 * Check for exact match by source + sourceId combination.
 * This is the first tier of deduplication - fastest and most reliable.
 *
 * @param events - Array of existing events to check against
 * @param newEvent - The new event to check
 * @param windowDays - Optional deduplication window by event type
 * @returns Existing event if found, null if new
 */
export function checkExactMatch(
  events: NormalizedEvent[],
  newEvent: { source: string; sourceId: string; eventDate?: Date | string },
  windowDays?: number,
): ExactMatchResult | null {
  // Fast lookup using source + sourceId
  const match = events.find((existing) =>
    exactMatch(
      { source: newEvent.source, sourceId: newEvent.sourceId },
      { source: existing.source, sourceId: existing.sourceId },
    ),
  );

  if (!match) {
    return null;
  }

  // Check if within deduplication window
  if (
    windowDays !== undefined &&
    windowDays !== Infinity &&
    newEvent.eventDate
  ) {
    const existingDate = normalizeDate(match.eventDate);
    const newDate = normalizeDate(newEvent.eventDate);

    if (
      existingDate &&
      newDate &&
      !isWithinWindow(newDate, existingDate, windowDays)
    ) {
      // Outside window - not a duplicate
      return null;
    }
  }

  return {
    found: true,
    existingEvent: match,
    matchType: "exact",
  };
}

/**
 * Check exact match for content feed items.
 */
export function checkExactMatchFeed(
  items: ContentFeedItem[],
  newItem: { source: string; sourceId: string },
): { found: boolean; existingItem?: ContentFeedItem } | null {
  const match = items.find((existing) =>
    exactMatch(
      { source: newItem.source, sourceId: newItem.sourceId },
      { source: existing.source, sourceId: existing.sourceId },
    ),
  );

  if (!match) {
    return null;
  }

  return {
    found: true,
    existingItem: match,
  };
}

// ============================================================================
// Phase 4.2: Hash Match Deduplication
// ============================================================================

export interface HashMatchResult {
  found: boolean;
  existingEvent?: NormalizedEvent;
  matchType: "hash";
  confidence: number;
}

/**
 * Check for content hash match within a deduplication window.
 * Uses content_hash field for comparison with fuzzy field normalization.
 *
 * @param events - Array of existing events to check against
 * @param newEvent - The new event to check
 * @param windowDays - Deduplication window in days (use Infinity for no window)
 * @returns Existing event if hash matches, null if no match
 */
export function checkHashMatch(
  events: NormalizedEvent[],
  newEvent: {
    contentHash: string;
    eventDate?: Date | string;
    artists?: Artist[];
    location?: Location;
  },
  windowDays: number = 30,
): HashMatchResult | null {
  // Find events with matching content hash
  const hashMatchEvent = events.find((existing) =>
    hashMatch(newEvent.contentHash, existing.contentHash),
  );

  if (!hashMatchEvent) {
    return null;
  }

  // Check window for non-historical events
  if (windowDays !== Infinity && newEvent.eventDate) {
    const existingDate = normalizeDate(hashMatchEvent.eventDate);
    const newDate = normalizeDate(newEvent.eventDate);

    if (
      existingDate &&
      newDate &&
      !isWithinWindow(newDate, existingDate, windowDays)
    ) {
      return null;
    }
  }

  return {
    found: true,
    existingEvent: hashMatchEvent,
    matchType: "hash",
    confidence: 0.95, // Hash match is high confidence
  };
}

/**
 * Check hash match for content feed items.
 */
export function checkHashMatchFeed(
  items: ContentFeedItem[],
  newItem: { contentHash: string; publishAt?: Date | string },
  windowDays: number = 7,
): {
  found: boolean;
  existingItem?: ContentFeedItem;
  confidence: number;
} | null {
  const match = items.find((existing) =>
    hashMatch(newItem.contentHash, existing.contentHash),
  );

  if (!match) {
    return null;
  }

  // Check window
  if (windowDays !== Infinity && newItem.publishAt) {
    const existingDate = normalizeDate(match.publishAt);
    const newDate = normalizeDate(newItem.publishAt);

    if (
      existingDate &&
      newDate &&
      !isWithinWindow(newDate, existingDate, windowDays)
    ) {
      return null;
    }
  }

  return {
    found: true,
    existingItem: match,
    confidence: 0.95,
  };
}

/**
 * Generate enhanced content hash with fuzzy normalization.
 * This is used when the standard hash might differ due to minor variations.
 */
export function generateFuzzyContentHash(event: {
  title: string;
  eventDate?: Date | string;
  artists?: Artist[];
  location?: Location;
}): string {
  const normalizedFields = {
    title: normalizeForHash(event.title),
    date: event.eventDate ? normalizeDate(event.eventDate) : undefined,
    artists: event.artists
      ?.map((a) => normalizeArtistName(a.name))
      .sort()
      .join("|"),
    venue: event.location?.venue
      ? normalizeVenueName(event.location.venue)
      : undefined,
    city: event.location?.city
      ? normalizeForHash(event.location.city)
      : undefined,
  };

  const hashInput = Object.entries(normalizedFields)
    .filter(([_, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}:${v}`)
    .join("||");

  return generateShortHash(hashInput);
}

// ============================================================================
// Phase 4.3: Fuzzy Match Deduplication
// ============================================================================

export interface FuzzyMatchResult {
  found: boolean;
  existingEvent?: NormalizedEvent;
  matchType: "fuzzy";
  confidence: number;
  matchDetails?: {
    titleSimilarity?: number;
    artistSimilarity?: number;
    venueSimilarity?: number;
    dateDistance?: number;
  };
}

/**
 * Check for fuzzy match based on title, artist, date, and venue similarity.
 * This is the third tier - used when exact and hash matches fail.
 *
 * @param events - Array of existing events to check against
 * @param newEvent - The new event to check
 * @param threshold - Minimum confidence threshold (0-1), default 0.85
 * @param windowDays - Days window for date proximity
 * @returns Best match above threshold, null if no good match
 */
export function checkFuzzyMatch(
  events: NormalizedEvent[],
  newEvent: {
    title: string;
    eventDate?: Date | string;
    artists?: Artist[];
    location?: Location;
    eventType?: EventType;
  },
  threshold: number = FUZZY_THRESHOLDS.TITLE_SIMILARITY,
  windowDays: number = FUZZY_THRESHOLDS.CONCERT_DATE_WINDOW,
): FuzzyMatchResult | null {
  let bestMatch: {
    event: NormalizedEvent;
    confidence: number;
    details: FuzzyMatchResult["matchDetails"];
  } | null = null;

  const newTitleNorm = normalizeForHash(newEvent.title);
  const newDateNorm = normalizeDate(newEvent.eventDate);
  const newArtistNames = newEvent.artists?.map((a) => a.name) || [];
  const newVenueNorm = newEvent.location?.venue
    ? normalizeVenueName(newEvent.location.venue)
    : null;

  for (const existing of events) {
    // Skip if no date to compare
    if (!newDateNorm || !existing.eventDate) continue;

    const existingDateNorm = normalizeDate(existing.eventDate);
    if (!existingDateNorm) continue;

    // Check date proximity first (fast filter)
    if (!isWithinWindow(newDateNorm, existingDateNorm, windowDays)) {
      continue;
    }

    // Calculate individual similarities
    const titleSimilarity = jaroWinklerSimilarity(
      newTitleNorm,
      normalizeForHash(existing.title),
    );

    // Artist similarity
    let artistSimilarity = 0;
    if (
      newArtistNames.length > 0 &&
      existing.artists &&
      existing.artists.length > 0
    ) {
      const maxArtistMatch = Math.max(
        ...newArtistNames.map((newName) =>
          Math.max(
            ...existing.artists!.map((existingArtist) =>
              artistsMatch(newName, existingArtist.name)
                ? 1
                : jaroWinklerSimilarity(
                    normalizeArtistName(newName),
                    normalizeArtistName(existingArtist.name),
                  ),
            ),
          ),
        ),
      );
      artistSimilarity = maxArtistMatch;
    }

    // Venue similarity
    let venueSimilarity = 0;
    if (newVenueNorm && existing.location?.venue) {
      venueSimilarity = jaroWinklerSimilarity(
        newVenueNorm,
        normalizeVenueName(existing.location.venue),
      );
    }

    // Date distance score (closer = higher)
    const date1 = new Date(newDateNorm);
    const date2 = new Date(existingDateNorm);
    const dateDistanceDays =
      Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
    const dateScore = Math.max(0, 1 - dateDistanceDays / windowDays);

    // Weighted confidence score
    // For concerts: artist and venue matter more
    // For festivals: title and date matter more
    // For historical: title and year matter more
    let confidence: number;
    const eventType = newEvent.eventType || existing.eventType;

    switch (eventType) {
      case "concert":
        confidence =
          titleSimilarity * 0.25 +
          artistSimilarity * 0.4 +
          venueSimilarity * 0.25 +
          dateScore * 0.1;
        break;
      case "festival":
        confidence =
          titleSimilarity * 0.4 +
          artistSimilarity * 0.2 +
          venueSimilarity * 0.2 +
          dateScore * 0.2;
        break;
      case "historical":
        confidence =
          titleSimilarity * 0.5 +
          dateScore * 0.3 +
          (newEvent.artists?.[0]?.name === existing.artists?.[0]?.name
            ? 0.2
            : artistSimilarity * 0.2);
        break;
      default:
        confidence =
          titleSimilarity * 0.35 +
          artistSimilarity * 0.25 +
          venueSimilarity * 0.2 +
          dateScore * 0.2;
    }

    if (
      confidence >= threshold &&
      (!bestMatch || confidence > bestMatch.confidence)
    ) {
      bestMatch = {
        event: existing,
        confidence,
        details: {
          titleSimilarity,
          artistSimilarity,
          venueSimilarity,
          dateDistance: dateDistanceDays,
        },
      };
    }
  }

  if (!bestMatch) {
    return null;
  }

  return {
    found: true,
    existingEvent: bestMatch.event,
    matchType: "fuzzy",
    confidence: bestMatch.confidence,
    matchDetails: bestMatch.details,
  };
}

/**
 * Check fuzzy match for content feed items (System B).
 * Compares title and body similarity.
 */
export function checkFuzzyMatchFeed(
  items: ContentFeedItem[],
  newItem: {
    title: string;
    body?: string;
    publishAt?: Date | string;
  },
  threshold: number = 0.85,
  windowDays: number = 7,
): {
  found: boolean;
  existingItem?: ContentFeedItem;
  confidence: number;
} | null {
  let bestMatch: {
    item: ContentFeedItem;
    confidence: number;
  } | null = null;

  const newTitleNorm = normalizeForHash(newItem.title);
  const newBodyNorm = newItem.body ? normalizeForHash(newItem.body) : "";
  const newDateNorm = normalizeDate(newItem.publishAt);

  for (const existing of items) {
    // Check date window
    if (newDateNorm && existing.publishAt) {
      const existingDateNorm = normalizeDate(existing.publishAt);
      if (
        existingDateNorm &&
        !isWithinWindow(newDateNorm, existingDateNorm, windowDays)
      ) {
        continue;
      }
    }

    // Title similarity
    const titleSimilarity = jaroWinklerSimilarity(
      newTitleNorm,
      normalizeForHash(existing.title),
    );

    // Body similarity (if both have body)
    let bodySimilarity = 0;
    if (newBodyNorm && existing.body) {
      bodySimilarity = jaroWinklerSimilarity(
        newBodyNorm,
        normalizeForHash(existing.body),
      );
    }

    // Combined confidence
    const confidence = titleSimilarity * 0.6 + bodySimilarity * 0.4;

    if (
      confidence >= threshold &&
      (!bestMatch || confidence > bestMatch.confidence)
    ) {
      bestMatch = {
        item: existing,
        confidence,
      };
    }
  }

  if (!bestMatch) {
    return null;
  }

  return {
    found: true,
    existingItem: bestMatch.item,
    confidence: bestMatch.confidence,
  };
}

// ============================================================================
// Combined Deduplication Check
// ============================================================================

/**
 * Run all 3 tiers of deduplication in sequence.
 * Returns immediately on first match.
 */
export function runDeduplicationTiers(
  events: NormalizedEvent[],
  newEvent: {
    source: string;
    sourceId: string;
    contentHash: string;
    title: string;
    eventDate?: Date | string;
    artists?: Artist[];
    location?: Location;
    eventType?: EventType;
  },
  options: {
    exactWindowDays?: number;
    hashWindowDays?: number;
    fuzzyThreshold?: number;
    fuzzyWindowDays?: number;
  } = {},
): DedupeResult {
  const {
    exactWindowDays = 30,
    hashWindowDays = 30,
    fuzzyThreshold = FUZZY_THRESHOLDS.TITLE_SIMILARITY,
    fuzzyWindowDays = FUZZY_THRESHOLDS.CONCERT_DATE_WINDOW,
  } = options;

  // Tier 1: Exact match
  const exactResult = checkExactMatch(events, newEvent, exactWindowDays);
  if (exactResult?.found && exactResult.existingEvent) {
    return {
      isDuplicate: true,
      existingId: exactResult.existingEvent.id as unknown as string,
      matchType: "exact",
      confidence: 1.0,
    };
  }

  // Tier 2: Hash match
  const hashResult = checkHashMatch(events, newEvent, hashWindowDays);
  if (hashResult?.found && hashResult.existingEvent) {
    return {
      isDuplicate: true,
      existingId: hashResult.existingEvent.id as unknown as string,
      matchType: "hash",
      confidence: hashResult.confidence,
    };
  }

  // Tier 3: Fuzzy match
  const fuzzyResult = checkFuzzyMatch(
    events,
    newEvent,
    fuzzyThreshold,
    fuzzyWindowDays,
  );
  if (fuzzyResult?.found && fuzzyResult.existingEvent) {
    return {
      isDuplicate: true,
      existingId: fuzzyResult.existingEvent.id as unknown as string,
      matchType: "fuzzy",
      confidence: fuzzyResult.confidence,
    };
  }

  // No match found - new event
  return {
    isDuplicate: false,
  };
}
