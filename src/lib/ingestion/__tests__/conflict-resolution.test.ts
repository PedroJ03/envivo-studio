/**
 * Conflict Resolution Tests - Phase 4
 *
 * Tests for source priority and field-level merge strategies.
 *
 * @module ingestion/__tests__/conflict-resolution.test
 */

import { describe, it, expect } from "vitest";
import {
  resolveConflict,
  resolveFeedItemConflict,
  getSourcePriority,
  hasHigherPriority,
  mergeImages,
  mergeUniqueStrings,
  SOURCE_PRIORITY,
} from "../conflict-resolution";
import type { NormalizedEvent, ContentFeedItem, Image } from "../types";

describe("Conflict Resolution", () => {
  describe("Source Priority", () => {
    it("should return correct priority for known sources", () => {
      expect(getSourcePriority("ticketmaster")).toBe(1);
      expect(getSourcePriority("eventbrite")).toBe(2);
      expect(getSourcePriority("wikimedia")).toBe(3);
    });

    it("should return lower priority (higher number) for unknown sources", () => {
      expect(getSourcePriority("unknown-source")).toBeGreaterThan(
        getSourcePriority("ticketmaster"),
      );
    });

    it("should be case insensitive", () => {
      expect(getSourcePriority("TICKETMASTER")).toBe(
        getSourcePriority("ticketmaster"),
      );
    });

    it("should correctly compare priorities", () => {
      expect(hasHigherPriority("ticketmaster", "eventbrite")).toBe(true);
      expect(hasHigherPriority("eventbrite", "ticketmaster")).toBe(false);
      expect(hasHigherPriority("ticketmaster", "ticketmaster")).toBe(false);
    });
  });

  describe("Event Conflict Resolution", () => {
    it("should prefer higher priority source for title", () => {
      const existing: NormalizedEvent = {
        id: "existing-id",
        source: "wikimedia",
        sourceId: "wik-123",
        sourceUrl: "https://wikipedia.org/article",
        title: "Old Title",
        contentHash: "hash1",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "historical",
        eventDate: "2024-03-21",
        priority: 3,
        updatedAt: new Date(),
      };

      const incoming: NormalizedEvent = {
        source: "ticketmaster",
        sourceId: "tm-456",
        sourceUrl: "https://ticketmaster.com/event",
        title: "Better Title From Ticketmaster",
        contentHash: "hash2",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-12-15",
        priority: 1,
      };

      const resolved = resolveConflict(existing, incoming);

      expect(resolved.title).toBe("Better Title From Ticketmaster");
    });

    it("should keep existing title when incoming has same priority", () => {
      const existing: NormalizedEvent = {
        id: "existing-id",
        source: "eventbrite",
        sourceId: "eb-123",
        sourceUrl: "https://eventbrite.com/event",
        title: "Existing Title",
        contentHash: "hash1",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-12-15",
        priority: 2,
        updatedAt: new Date(),
      };

      const incoming: NormalizedEvent = {
        source: "eventbrite",
        sourceId: "eb-456",
        sourceUrl: "https://eventbrite.com/event2",
        title: "Incoming Title",
        contentHash: "hash2",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-12-15",
        priority: 2,
      };

      const resolved = resolveConflict(existing, incoming);

      expect(resolved.title).toBe("Existing Title");
    });

    it("should prefer longer description", () => {
      const existing: NormalizedEvent = {
        id: "existing-id",
        source: "wikimedia",
        sourceId: "wik-123",
        sourceUrl: "https://wikipedia.org",
        title: "Title",
        contentHash: "hash1",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "historical",
        eventDate: "2024-03-15",
        description: "Short",
        priority: 3,
        updatedAt: new Date(),
      };

      const incoming: NormalizedEvent = {
        source: "ticketmaster",
        sourceId: "tm-456",
        sourceUrl: "https://ticketmaster.com",
        title: "Title",
        contentHash: "hash2",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-03-15",
        description: "This is a much longer and more detailed description",
        priority: 1,
      };

      const resolved = resolveConflict(existing, incoming);

      expect(resolved.description).toBe(
        "This is a much longer and more detailed description",
      );
    });

    it("should merge artists from both sources", () => {
      const existing: NormalizedEvent = {
        id: "existing-id",
        source: "ticketmaster",
        sourceId: "tm-123",
        sourceUrl: "https://ticketmaster.com",
        title: "Concert",
        contentHash: "hash1",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-12-15",
        artists: [{ name: "Artist 1", normalizedName: "artist-1" }],
        priority: 1,
        updatedAt: new Date(),
      };

      const incoming: NormalizedEvent = {
        source: "eventbrite",
        sourceId: "eb-456",
        sourceUrl: "https://eventbrite.com",
        title: "Concert",
        contentHash: "hash2",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-12-15",
        artists: [{ name: "Artist 2", normalizedName: "artist-2" }],
        priority: 2,
      };

      const resolved = resolveConflict(existing, incoming);

      expect(resolved.artists).toHaveLength(2);
      expect(resolved.artists?.map((a) => a.name)).toContain("Artist 1");
      expect(resolved.artists?.map((a) => a.name)).toContain("Artist 2");
    });

    it("should merge location fields", () => {
      const existing: NormalizedEvent = {
        id: "existing-id",
        source: "wikimedia",
        sourceId: "wik-123",
        sourceUrl: "https://wikipedia.org",
        title: "Title",
        contentHash: "hash1",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "historical",
        eventDate: "2024-03-15",
        location: { city: "Buenos Aires" },
        priority: 3,
        updatedAt: new Date(),
      };

      const incoming: NormalizedEvent = {
        source: "ticketmaster",
        sourceId: "tm-456",
        sourceUrl: "https://ticketmaster.com",
        title: "Title",
        contentHash: "hash2",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-12-15",
        location: {
          city: "CABA",
          region: "CABA",
          country: "Argentina",
          venue: "Luna Park",
        },
        priority: 1,
      };

      const resolved = resolveConflict(existing, incoming);

      expect(resolved.location?.city).toBe("Buenos Aires");
      expect(resolved.location?.venue).toBe("Luna Park");
      expect(resolved.location?.country).toBe("Argentina");
    });

    it("should merge images with priority ordering", () => {
      const existing: NormalizedEvent = {
        id: "existing-id",
        source: "wikimedia",
        sourceId: "wik-123",
        sourceUrl: "https://wikipedia.org",
        title: "Title",
        contentHash: "hash1",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "historical",
        eventDate: "2024-03-15",
        images: [{ url: "http://existing-image.jpg", source: "wikimedia" }],
        priority: 3,
        updatedAt: new Date(),
      };

      const incoming: NormalizedEvent = {
        source: "ticketmaster",
        sourceId: "tm-456",
        sourceUrl: "https://ticketmaster.com",
        title: "Title",
        contentHash: "hash2",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-03-15",
        images: [{ url: "http://incoming-image.jpg", source: "ticketmaster" }],
        priority: 1,
      };

      const resolved = resolveConflict(existing, incoming);

      // Higher priority (ticketmaster) images should come first
      expect(resolved.images?.[0].url).toBe("http://incoming-image.jpg");
      expect(resolved.images?.[1].url).toBe("http://existing-image.jpg");
    });

    it("should merge tags uniquely", () => {
      const existing: NormalizedEvent = {
        id: "existing-id",
        source: "ticketmaster",
        sourceId: "tm-123",
        sourceUrl: "https://ticketmaster.com",
        title: "Concert",
        contentHash: "hash1",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-03-15",
        tags: ["rock", "concert"],
        priority: 1,
        updatedAt: new Date(),
      };

      const incoming: NormalizedEvent = {
        source: "eventbrite",
        sourceId: "eb-456",
        sourceUrl: "https://eventbrite.com",
        title: "Concert",
        contentHash: "hash2",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-03-15",
        tags: ["rock", "festival", "buenos-aires"],
        priority: 2,
      };

      const resolved = resolveConflict(existing, incoming);

      expect(resolved.tags).toContain("rock");
      expect(resolved.tags).toContain("concert");
      expect(resolved.tags).toContain("festival");
      expect(resolved.tags).toContain("buenos-aires");
      // Should not have duplicates
      expect(resolved.tags?.filter((t) => t === "rock").length).toBe(1);
    });

    it("should keep lower priority number for higher priority source", () => {
      const existing: NormalizedEvent = {
        id: "existing-id",
        source: "wikimedia",
        sourceId: "wik-123",
        sourceUrl: "https://wikipedia.org",
        title: "Title",
        contentHash: "hash1",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "historical",
        eventDate: "2024-03-15",
        priority: 3,
        updatedAt: new Date(),
      };

      const incoming: NormalizedEvent = {
        source: "ticketmaster",
        sourceId: "tm-456",
        sourceUrl: "https://ticketmaster.com",
        title: "Title",
        contentHash: "hash2",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-03-15",
        priority: 2,
      };

      const resolved = resolveConflict(existing, incoming);

      expect(resolved.priority).toBe(2); // Lower number = higher priority
    });

    it("should track merge history", () => {
      const existing: NormalizedEvent = {
        id: "existing-id",
        source: "ticketmaster",
        sourceId: "tm-123",
        sourceUrl: "https://ticketmaster.com",
        title: "Old Title",
        contentHash: "hash1",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-03-15",
        priority: 1,
        updatedAt: new Date(),
      };

      const incoming: NormalizedEvent = {
        source: "eventbrite",
        sourceId: "eb-456",
        sourceUrl: "https://eventbrite.com",
        title: "New Title",
        contentHash: "hash2",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-03-15",
        priority: 2,
      };

      const resolved = resolveConflict(existing, incoming, {
        trackMergeHistory: true,
      });

      expect(resolved.metadata?.mergeHistory).toBeDefined();
      const mergeHistory = resolved.metadata?.mergeHistory as any;
      expect(mergeHistory.mergeCount).toBe(1);
      expect(mergeHistory.entries[0].action).toBe("merged");
      expect(mergeHistory.entries[0].mergedFrom).toContain("ticketmaster");
      expect(mergeHistory.entries[0].mergedFrom).toContain("eventbrite");
    });

    it("should update timestamp on merge", () => {
      const existing: NormalizedEvent = {
        id: "existing-id",
        source: "ticketmaster",
        sourceId: "tm-123",
        sourceUrl: "https://ticketmaster.com",
        title: "Title",
        contentHash: "hash1",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-03-15",
        priority: 1,
        updatedAt: new Date("2024-01-01"),
      };

      const incoming: NormalizedEvent = {
        source: "eventbrite",
        sourceId: "eb-456",
        sourceUrl: "https://eventbrite.com",
        title: "New Title",
        contentHash: "hash2",
        tenantId: null,
        isShared: true,
        metadata: {},
        eventType: "concert",
        eventDate: "2024-03-15",
        priority: 2,
      };

      const resolved = resolveConflict(existing, incoming);

      expect(resolved.updatedAt?.getTime()).toBeGreaterThan(
        new Date("2024-01-01").getTime(),
      );
    });
  });

  describe("Content Feed Item Conflict Resolution", () => {
    it("should prefer higher viral score", () => {
      const existing: ContentFeedItem = {
        id: "existing-id",
        source: "newsapi",
        sourceId: "news-123",
        sourceUrl: "https://newsapi.com/article",
        title: "Title",
        contentHash: "hash1",
        tenantId: null,
        isShared: true,
        metadata: {},
        contentType: "trending",
        body: "Body content",
        hook: "Hook",
        facts: [],
        tags: [],
        publishAt: new Date(),
        viralScore: 70,
        updatedAt: new Date(),
      };

      const incoming: ContentFeedItem = {
        source: "gnews",
        sourceId: "gnews-456",
        sourceUrl: "https://gnews.com/article",
        title: "Title",
        contentHash: "hash2",
        tenantId: null,
        isShared: true,
        metadata: {},
        contentType: "breaking_news",
        body: "Body content",
        hook: "Hook",
        facts: [],
        tags: [],
        publishAt: new Date(),
        viralScore: 95,
      };

      const resolved = resolveFeedItemConflict(existing, incoming);

      expect(resolved.viralScore).toBe(95);
    });

    it("should prefer earlier publish date", () => {
      const existing: ContentFeedItem = {
        id: "existing-id",
        source: "newsapi",
        sourceId: "news-123",
        sourceUrl: "https://newsapi.com/article",
        title: "Title",
        contentHash: "hash1",
        tenantId: null,
        isShared: true,
        metadata: {},
        contentType: "breaking_news",
        body: "Body",
        hook: "Hook",
        facts: [],
        tags: [],
        publishAt: new Date("2024-03-21T15:00:00Z"),
        viralScore: 90,
        updatedAt: new Date(),
      };

      const incoming: ContentFeedItem = {
        source: "gnews",
        sourceId: "gnews-456",
        sourceUrl: "https://gnews.com/article",
        title: "Title",
        contentHash: "hash2",
        tenantId: null,
        isShared: true,
        metadata: {},
        contentType: "breaking_news",
        body: "Body",
        hook: "Hook",
        facts: [],
        tags: [],
        publishAt: new Date("2024-03-21T10:00:00Z"), // Earlier
        viralScore: 90,
      };

      const resolved = resolveFeedItemConflict(existing, incoming);

      expect(resolved.publishAt).toEqual(new Date("2024-03-21T10:00:00Z"));
    });

    it("should extend expiry when incoming is later", () => {
      const existing: ContentFeedItem = {
        id: "existing-id",
        source: "newsapi",
        sourceId: "news-123",
        sourceUrl: "https://newsapi.com/article",
        title: "Title",
        contentHash: "hash1",
        tenantId: null,
        isShared: true,
        metadata: {},
        contentType: "trending",
        body: "Body",
        hook: "Hook",
        facts: [],
        tags: [],
        publishAt: new Date(),
        expiresAt: new Date("2024-03-25T00:00:00Z"),
        viralScore: 70,
        updatedAt: new Date(),
      };

      const incoming: ContentFeedItem = {
        source: "gnews",
        sourceId: "gnews-456",
        sourceUrl: "https://gnews.com/article",
        title: "Title",
        contentHash: "hash2",
        tenantId: null,
        isShared: true,
        metadata: {},
        contentType: "trending",
        body: "Body",
        hook: "Hook",
        facts: [],
        tags: [],
        publishAt: new Date(),
        expiresAt: new Date("2024-03-30T00:00:00Z"), // Later
        viralScore: 70,
      };

      const resolved = resolveFeedItemConflict(existing, incoming);

      expect(resolved.expiresAt).toEqual(new Date("2024-03-30T00:00:00Z"));
    });
  });

  describe("Helper Functions", () => {
    describe("mergeImages", () => {
      it("should merge images without duplicates", () => {
        const existing: Image[] = [
          { url: "http://img1.jpg" },
          { url: "http://img2.jpg" },
        ];
        const incoming: Image[] = [
          { url: "http://img3.jpg" },
          { url: "http://img1.jpg" }, // Duplicate
        ];

        const result = mergeImages(existing, incoming, true);

        expect(result).toHaveLength(3);
      });

      it("should prepend incoming when preferIncoming is true", () => {
        const existing: Image[] = [{ url: "http://existing.jpg" }];
        const incoming: Image[] = [{ url: "http://incoming.jpg" }];

        const result = mergeImages(existing, incoming, true);

        expect(result[0].url).toBe("http://incoming.jpg");
      });

      it("should append incoming when preferIncoming is false", () => {
        const existing: Image[] = [{ url: "http://existing.jpg" }];
        const incoming: Image[] = [{ url: "http://incoming.jpg" }];

        const result = mergeImages(existing, incoming, false);

        expect(result[0].url).toBe("http://existing.jpg");
        expect(result[1].url).toBe("http://incoming.jpg");
      });
    });

    describe("mergeUniqueStrings", () => {
      it("should merge arrays removing duplicates", () => {
        const existing = ["rock", "jazz"];
        const incoming = ["rock", "pop", "blues"];

        const result = mergeUniqueStrings(existing, incoming);

        expect(result).toEqual(["rock", "jazz", "pop", "blues"]);
      });

      it("should handle empty arrays", () => {
        expect(mergeUniqueStrings([], ["rock"])).toEqual(["rock"]);
        expect(mergeUniqueStrings(["rock"], [])).toEqual(["rock"]);
        expect(mergeUniqueStrings([], [])).toEqual([]);
      });
    });
  });

  describe("Source Priority Constants", () => {
    it("should have ticketmaster as highest priority for System A", () => {
      expect(SOURCE_PRIORITY.ticketmaster).toBe(1);
    });

    it("should have eventbrite as second priority for System A", () => {
      expect(SOURCE_PRIORITY.eventbrite).toBe(2);
    });

    it("should have wikimedia as third priority for System A", () => {
      expect(SOURCE_PRIORITY.wikimedia).toBe(3);
    });

    it("should have newsapi as highest priority for System B", () => {
      expect(SOURCE_PRIORITY.newsapi).toBe(1);
    });

    it("should have scraper as lowest generic priority", () => {
      expect(SOURCE_PRIORITY.scraper).toBe(10);
    });
  });
});
