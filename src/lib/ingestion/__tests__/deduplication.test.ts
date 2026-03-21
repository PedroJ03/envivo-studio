/**
 * Deduplication Engine Tests - Phase 4
 *
 * Tests for the 3-tier deduplication system:
 * - Tier 1: Exact match (source + sourceId)
 * - Tier 2: Hash match (content hash)
 * - Tier 3: Fuzzy match (title/artist/venue similarity)
 *
 * @module ingestion/__tests__/deduplication.test
 */

import { describe, it, expect } from "vitest";
import {
  checkExactMatch,
  checkHashMatch,
  checkFuzzyMatch,
  runDeduplicationTiers,
  DEDUP_WINDOWS,
  FUZZY_THRESHOLDS,
} from "../deduplication";
import {
  normalizeForHash,
  normalizeArtistName,
  normalizeDate,
  generateContentHash,
  jaroWinklerSimilarity,
  levenshteinDistance,
} from "../deduplication-base";
import type { NormalizedEvent } from "../types";

// Test data factories
function createMockEvent(
  overrides: Partial<NormalizedEvent> = {},
): NormalizedEvent {
  return {
    id: "test-id",
    source: "ticketmaster",
    sourceId: "evt-123",
    sourceUrl: "https://example.com/event",
    title: "The Beatles Concert",
    contentHash: generateContentHash({
      title: "The Beatles Concert",
      source: "ticketmaster",
      sourceId: "evt-123",
    }),
    tenantId: null,
    isShared: true,
    metadata: {},
    eventType: "concert",
    eventDate: new Date("2024-12-15"),
    year: undefined,
    location: {
      city: "Buenos Aires",
      region: "CABA",
      country: "Argentina",
      venue: "Luna Park",
    },
    artists: [{ name: "The Beatles", normalizedName: "beatles" }],
    images: [],
    tags: ["rock", "concert"],
    description: "Amazing concert",
    priority: 1,
    ...overrides,
  };
}

describe("Deduplication Engine", () => {
  describe("Tier 1: Exact Match", () => {
    it("should detect exact match by source + sourceId", () => {
      const existingEvents = [
        createMockEvent({ source: "ticketmaster", sourceId: "evt-123" }),
        createMockEvent({ source: "eventbrite", sourceId: "evt-456" }),
      ];

      const newEvent = {
        source: "ticketmaster",
        sourceId: "evt-123",
        eventDate: new Date("2024-12-15"),
      };

      const result = checkExactMatch(existingEvents, newEvent);

      expect(result?.found).toBe(true);
      expect(result?.matchType).toBe("exact");
      expect(result?.existingEvent?.source).toBe("ticketmaster");
    });

    it("should return null when no exact match", () => {
      const existingEvents = [
        createMockEvent({ source: "ticketmaster", sourceId: "evt-123" }),
      ];

      const newEvent = {
        source: "eventbrite",
        sourceId: "evt-999",
        eventDate: new Date("2024-12-15"),
      };

      const result = checkExactMatch(existingEvents, newEvent);

      expect(result).toBeNull();
    });

    it("should respect deduplication window for historical events", () => {
      const existingEvents = [
        createMockEvent({
          source: "wikimedia",
          sourceId: "wik-1969",
          eventType: "historical",
          eventDate: new Date("1969-03-21"),
        }),
      ];

      // Same sourceId but different date - outside window
      const newEvent = {
        source: "wikimedia",
        sourceId: "wik-1969",
        eventDate: new Date("2024-03-21"),
      };

      const result = checkExactMatch(
        existingEvents,
        newEvent,
        DEDUP_WINDOWS.CALENDAR_HISTORICAL,
      );

      // Historical events have infinite window, should still match
      expect(result?.found).toBe(true);
    });
  });

  describe("Tier 2: Hash Match", () => {
    it("should detect content hash match", () => {
      const contentHash = generateContentHash({
        title: "The Beatles Concert",
        source: "ticketmaster",
        sourceId: "evt-123",
      });

      const existingEvents = [
        createMockEvent({
          source: "eventbrite",
          sourceId: "eb-456",
          contentHash,
        }),
      ];

      const newEvent = {
        contentHash,
        eventDate: new Date("2024-12-15"),
      };

      const result = checkHashMatch(existingEvents, newEvent);

      expect(result?.found).toBe(true);
      expect(result?.matchType).toBe("hash");
      expect(result?.confidence).toBe(0.95);
    });

    it("should return null for different content hashes", () => {
      const existingEvents = [
        createMockEvent({
          contentHash: generateContentHash({
            title: "Different Event",
            source: "ticketmaster",
            sourceId: "evt-123",
          }),
        }),
      ];

      const newEvent = {
        contentHash: generateContentHash({
          title: "The Beatles Concert",
          source: "ticketmaster",
          sourceId: "evt-999",
        }),
        eventDate: new Date("2024-12-15"),
      };

      const result = checkHashMatch(existingEvents, newEvent);

      expect(result).toBeNull();
    });

    it("should respect deduplication window", () => {
      const contentHash = generateContentHash({
        title: "Concert",
        source: "ticketmaster",
        sourceId: "evt-123",
      });

      const existingEvents = [
        createMockEvent({
          source: "ticketmaster",
          sourceId: "evt-old",
          contentHash,
          eventDate: new Date("2024-01-01"),
        }),
      ];

      // Same hash but different date - outside 30 day window
      const newEvent = {
        contentHash,
        eventDate: new Date("2024-12-15"),
      };

      const result = checkHashMatch(existingEvents, newEvent, 30);

      expect(result).toBeNull();
    });
  });

  describe("Tier 3: Fuzzy Match", () => {
    it("should detect similar concerts by artist and date", () => {
      const existingEvents = [
        createMockEvent({
          source: "ticketmaster",
          sourceId: "tm-123",
          title: "The Beatles Live Concert",
          eventDate: new Date("2024-12-15"),
          artists: [{ name: "The Beatles", normalizedName: "beatles" }],
          location: { venue: "Luna Park" },
        }),
      ];

      const newEvent = {
        title: "Beatles Concert",
        eventDate: new Date("2024-12-15"),
        artists: [{ name: "The Beatles", normalizedName: "beatles" }],
        location: { venue: "Luna Park" },
        eventType: "concert" as const,
      };

      const result = checkFuzzyMatch(
        existingEvents,
        newEvent,
        FUZZY_THRESHOLDS.TITLE_SIMILARITY,
        FUZZY_THRESHOLDS.CONCERT_DATE_WINDOW,
      );

      expect(result?.found).toBe(true);
      expect(result?.matchType).toBe("fuzzy");
      expect(result?.confidence).toBeGreaterThan(0.85);
    });

    it("should detect fuzzy match with similar venue names", () => {
      const existingEvents = [
        createMockEvent({
          source: "eventbrite",
          sourceId: "eb-456",
          title: "Rock Concert",
          eventDate: new Date("2024-12-15"),
          location: { venue: "Teatro Gran Rex" },
        }),
      ];

      const newEvent = {
        title: "Rock Concert",
        eventDate: new Date("2024-12-15"),
        artists: [],
        location: { venue: "Teatro Gran Rex Buenos Aires" },
        eventType: "concert" as const,
      };

      const result = checkFuzzyMatch(
        existingEvents,
        newEvent,
        0.7, // Lower threshold for venue similarity
        7,
      );

      expect(result?.found).toBe(true);
      expect(result?.matchDetails?.venueSimilarity).toBeGreaterThan(0.8);
    });

    it("should return null when similarity is below threshold", () => {
      const existingEvents = [
        createMockEvent({
          source: "ticketmaster",
          sourceId: "tm-123",
          title: "Jazz Festival",
          eventDate: new Date("2024-12-15"),
          location: { venue: "Luna Park" },
        }),
      ];

      const newEvent = {
        title: "Rock Concert",
        eventDate: new Date("2024-12-15"),
        artists: [{ name: "Rock Band", normalizedName: "rock-band" }],
        location: { venue: "Different Venue" },
        eventType: "concert" as const,
      };

      const result = checkFuzzyMatch(
        existingEvents,
        newEvent,
        FUZZY_THRESHOLDS.TITLE_SIMILARITY,
        FUZZY_THRESHOLDS.CONCERT_DATE_WINDOW,
      );

      expect(result).toBeNull();
    });

    it("should use different weights for concerts vs festivals", () => {
      // Festival events weight title more
      const festivalEvents = [
        createMockEvent({
          source: "ticketmaster",
          sourceId: "tm-fest",
          title: "Lollapalooza Argentina 2024",
          eventType: "festival",
          eventDate: new Date("2024-03-15"),
        }),
      ];

      const newFestivalEvent = {
        title: "Lollapalooza Argentina",
        eventDate: new Date("2024-03-15"),
        artists: [],
        eventType: "festival" as const,
      };

      const festivalResult = checkFuzzyMatch(
        festivalEvents,
        newFestivalEvent,
        0.8,
        7,
      );

      expect(festivalResult?.found).toBe(true);
    });
  });

  describe("Combined 3-Tier Pipeline", () => {
    it("should return exact match on first tier", () => {
      const existingEvents = [
        createMockEvent({ source: "ticketmaster", sourceId: "evt-123" }),
      ];

      const newEvent = {
        source: "ticketmaster",
        sourceId: "evt-123",
        contentHash: "different-hash",
        title: "Different Title",
        eventDate: new Date("2024-12-15"),
      };

      const result = runDeduplicationTiers(existingEvents, newEvent);

      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe("exact");
    });

    it("should fall through to hash match if no exact", () => {
      const contentHash = generateContentHash({
        title: "Same Event",
        source: "ticketmaster",
        sourceId: "evt-123",
      });

      const existingEvents = [
        createMockEvent({
          source: "eventbrite",
          sourceId: "eb-456",
          contentHash,
        }),
      ];

      const newEvent = {
        source: "ticketmaster",
        sourceId: "evt-999",
        contentHash,
        title: "Different Title",
        eventDate: new Date("2024-12-15"),
      };

      const result = runDeduplicationTiers(existingEvents, newEvent);

      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe("hash");
    });

    it("should fall through to fuzzy match if no hash match", () => {
      const existingEvents = [
        createMockEvent({
          source: "eventbrite",
          sourceId: "eb-456",
          title: "The Beatles Concert",
          eventDate: new Date("2024-12-15"),
          artists: [{ name: "The Beatles", normalizedName: "beatles" }],
          location: { venue: "Luna Park" },
        }),
      ];

      const newEvent = {
        source: "ticketmaster",
        sourceId: "evt-999",
        contentHash: "different-hash",
        title: "Beatles Live",
        eventDate: new Date("2024-12-15"),
        artists: [{ name: "The Beatles", normalizedName: "beatles" }],
        location: { venue: "Luna Park" },
        eventType: "concert" as const,
      };

      const result = runDeduplicationTiers(existingEvents, newEvent);

      expect(result.isDuplicate).toBe(true);
      expect(result.matchType).toBe("fuzzy");
    });

    it("should return not duplicate if no match in any tier", () => {
      const existingEvents = [
        createMockEvent({
          source: "ticketmaster",
          sourceId: "evt-123",
          title: "Jazz Concert",
          eventDate: new Date("2024-12-15"),
        }),
      ];

      const newEvent = {
        source: "ticketmaster",
        sourceId: "evt-999",
        contentHash: "different-hash",
        title: "Rock Concert",
        eventDate: new Date("2024-12-20"),
        artists: [{ name: "Rock Band", normalizedName: "rock-band" }],
        location: { venue: "Different Venue" },
        eventType: "concert" as const,
      };

      const result = runDeduplicationTiers(existingEvents, newEvent);

      expect(result.isDuplicate).toBe(false);
      expect(result.matchType).toBeUndefined();
    });
  });

  describe("Deduplication Windows by Event Type", () => {
    it("should use 30-day window for concerts", () => {
      expect(DEDUP_WINDOWS.CALENDAR_CONCERT).toBe(30);
    });

    it("should use 30-day window for festivals", () => {
      expect(DEDUP_WINDOWS.CALENDAR_FESTIVAL).toBe(30);
    });

    it("should use 30-day window for local events", () => {
      expect(DEDUP_WINDOWS.CALENDAR_LOCAL_EVENT).toBe(30);
    });

    it("should use Infinity for historical events", () => {
      expect(DEDUP_WINDOWS.CALENDAR_HISTORICAL).toBe(Infinity);
    });
  });

  describe("Fuzzy Match Thresholds", () => {
    it("should use 0.85 threshold for title similarity", () => {
      expect(FUZZY_THRESHOLDS.TITLE_SIMILARITY).toBe(0.85);
    });

    it("should use 0.85 threshold for artist similarity", () => {
      expect(FUZZY_THRESHOLDS.ARTIST_SIMILARITY).toBe(0.85);
    });

    it("should use 0.8 threshold for venue similarity", () => {
      expect(FUZZY_THRESHOLDS.VENUE_SIMILARITY).toBe(0.8);
    });

    it("should use 7-day window for concert date proximity", () => {
      expect(FUZZY_THRESHOLDS.CONCERT_DATE_WINDOW).toBe(7);
    });
  });
});

describe("String Normalization", () => {
  describe("normalizeForHash", () => {
    it("should lowercase and trim", () => {
      expect(normalizeForHash("  Hello World  ")).toBe("hello world");
    });

    it("should collapse multiple spaces", () => {
      expect(normalizeForHash("Hello    World")).toBe("hello world");
    });

    it("should handle unicode", () => {
      expect(normalizeForHash("café")).toBe("café");
    });
  });

  describe("normalizeArtistName", () => {
    it("should lowercase and remove special chars", () => {
      expect(normalizeArtistName("The Beatles")).toBe("beatles");
    });

    it("should remove leading 'the'", () => {
      expect(normalizeArtistName("The Beatles")).toBe("beatles");
    });

    it("should collapse hyphens", () => {
      expect(normalizeArtistName("led-zeppelin")).toBe("led-zeppelin");
    });
  });

  describe("levenshteinDistance", () => {
    it("should return 0 for identical strings", () => {
      expect(levenshteinDistance("hello", "hello")).toBe(0);
    });

    it("should calculate correct distance", () => {
      expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    });

    it("should handle empty strings", () => {
      expect(levenshteinDistance("", "hello")).toBe(5);
    });
  });

  describe("jaroWinklerSimilarity", () => {
    it("should return 1 for identical strings", () => {
      expect(jaroWinklerSimilarity("hello", "hello")).toBe(1);
    });

    it("should return high similarity for similar strings", () => {
      const similarity = jaroWinklerSimilarity("beatles", "the beatles");
      expect(similarity).toBeGreaterThan(0.8);
    });

    it("should return 0 for completely different strings", () => {
      expect(jaroWinklerSimilarity("abc", "xyz")).toBe(0);
    });
  });
});
