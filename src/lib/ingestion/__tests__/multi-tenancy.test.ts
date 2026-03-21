/**
 * Multi-tenancy Tests - Phase 1 Foundation
 *
 * Tests for tenant isolation and source filtering utilities.
 *
 * @module ingestion/__tests__/multi-tenancy.test
 */

import { describe, it, expect } from "vitest";
import {
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
  matchesCalendarEventFilters,
  filterCalendarEvents,
  matchesContentFeedFilters,
  filterContentFeedItems,
} from "../multi-tenancy";
import type { EventType } from "../types";

describe("Multi-tenancy Utilities", () => {
  describe("isShared", () => {
    it("should return true for shared sources", () => {
      expect(isShared("ticketmaster")).toBe(true);
      expect(isShared("wikimedia")).toBe(true);
      expect(isShared("newsapi")).toBe(true);
    });

    it("should return false for tenant-local sources", () => {
      expect(isShared("tandil_municipio")).toBe(false);
      expect(isShared("eldiario_rss")).toBe(false);
    });
  });

  describe("isTenantLocal", () => {
    it("should return true for tenant-local sources", () => {
      expect(isTenantLocal("tandil_municipio")).toBe(true);
    });

    it("should return false for shared sources", () => {
      expect(isTenantLocal("ticketmaster")).toBe(false);
    });
  });

  describe("getEffectiveTenantId", () => {
    it("should return null for shared sources", () => {
      expect(getEffectiveTenantId("ticketmaster", "tenant-123")).toBeNull();
    });

    it("should return the tenant ID for tenant-local sources", () => {
      expect(getEffectiveTenantId("tandil_municipio", "tenant-123")).toBe(
        "tenant-123",
      );
    });
  });

  describe("filterByTenant", () => {
    const mockEvents = [
      { tenantId: "tenant-a", isShared: false, title: "Local Event A" },
      { tenantId: "tenant-b", isShared: false, title: "Local Event B" },
      { tenantId: null, isShared: true, title: "Shared Event" },
    ];

    it("should return shared events plus tenant-local events", () => {
      const result = filterByTenant(mockEvents, "tenant-a");

      expect(result).toHaveLength(2);
      expect(result.map((e: any) => e.title)).toContain("Local Event A");
      expect(result.map((e: any) => e.title)).toContain("Shared Event");
    });

    it("should not return other tenant's local events", () => {
      const result = filterByTenant(mockEvents, "tenant-a");

      expect(result.map((e: any) => e.title)).not.toContain("Local Event B");
    });

    it("should return empty array when no matching tenant events", () => {
      const localOnlyEvents = [{ tenantId: "tenant-b", isShared: false }];

      const result = filterByTenant(localOnlyEvents, "tenant-a");

      expect(result).toHaveLength(0);
    });
  });

  describe("filterByTenantOnly", () => {
    const mockEvents = [
      { tenantId: "tenant-a", isShared: false },
      { tenantId: "tenant-a", isShared: true }, // isShared doesn't matter here
      { tenantId: "tenant-b", isShared: false },
    ];

    it("should return only tenant-local events", () => {
      const result = filterByTenantOnly(mockEvents as any, "tenant-a");

      expect(result).toHaveLength(1);
      expect((result[0] as any).tenantId).toBe("tenant-a");
    });
  });

  describe("partitionByTenancy", () => {
    const mockEvents = [
      { isShared: true, title: "Shared 1" },
      { isShared: false, title: "Local 1" },
      { isShared: true, title: "Shared 2" },
      { isShared: false, title: "Local 2" },
    ];

    it("should partition events into shared and tenant-local", () => {
      const result = partitionByTenancy(mockEvents as any);

      expect(result.shared).toHaveLength(2);
      expect(result.tenantLocal).toHaveLength(2);
    });
  });

  describe("validateSourceForTenant", () => {
    it("should allow shared sources for any tenant", () => {
      expect(validateSourceForTenant("ticketmaster", "tenant-a", null)).toBe(
        true,
      );
      expect(validateSourceForTenant("wikimedia", "tenant-b", null)).toBe(true);
    });

    it("should allow tenant-local source for owning tenant", () => {
      expect(
        validateSourceForTenant(
          "tandil_municipio",
          "tandil-tenant",
          "tandil-tenant",
        ),
      ).toBe(true);
    });

    it("should deny tenant-local source for non-owning tenant", () => {
      expect(
        validateSourceForTenant(
          "tandil_municipio",
          "other-tenant",
          "tandil-tenant",
        ),
      ).toBe(false);
    });
  });

  describe("getAllowedSources", () => {
    const allSources = [
      { name: "ticketmaster", tenantId: null, isShared: true },
      { name: "tandil_municipio", tenantId: "tandil-uuid", isShared: false },
      { name: "eventbrite", tenantId: null, isShared: true },
    ];

    it("should return shared sources plus tenant-local sources", () => {
      const allowed = getAllowedSources("tandil-uuid", allSources as any);

      expect(allowed).toContain("ticketmaster");
      expect(allowed).toContain("tandil_municipio");
      expect(allowed).toContain("eventbrite");
      expect(allowed).toHaveLength(3);
    });

    it("should only return shared sources for unknown tenant", () => {
      const allowed = getAllowedSources("unknown-tenant", allSources as any);

      expect(allowed).toContain("ticketmaster");
      expect(allowed).toContain("eventbrite");
      expect(allowed).not.toContain("tandil_municipio");
    });
  });

  describe("Event Type Helpers", () => {
    it("should identify shared event types", () => {
      expect(isSharedEventType("historical")).toBe(true);
      expect(isSharedEventType("concert")).toBe(true);
      expect(isSharedEventType("festival")).toBe(true);
    });

    it("should identify tenant-local event types", () => {
      expect(isTenantLocalEventType("local_event")).toBe(true);
    });

    it("should return false for non-matching types", () => {
      expect(isSharedEventType("local_event")).toBe(false);
      expect(isTenantLocalEventType("concert")).toBe(false);
    });
  });

  describe("Calendar Event Filters", () => {
    const mockFilters = {
      tenantId: "tenant-a",
      includeShared: true,
      eventDateFrom: new Date("2024-01-01"),
      eventDateTo: new Date("2024-12-31"),
      eventTypes: ["concert", "festival"] as EventType[],
      sources: ["ticketmaster", "eventbrite"],
    };

    const mockEvents = [
      {
        tenantId: "tenant-a",
        isShared: false,
        eventDate: new Date("2024-06-15"),
        eventType: "concert" as EventType,
        source: "ticketmaster",
      },
      {
        tenantId: "tenant-a",
        isShared: false,
        eventDate: new Date("2024-07-01"),
        eventType: "festival" as EventType,
        source: "eventbrite",
      },
      {
        tenantId: "tenant-a",
        isShared: false,
        eventDate: new Date("2024-08-01"),
        eventType: "local_event" as EventType, // Not in eventTypes filter
        source: "tandil_municipio",
      },
      {
        tenantId: null,
        isShared: true,
        eventDate: new Date("2024-06-20"),
        eventType: "concert" as EventType,
        source: "ticketmaster",
      },
      {
        tenantId: "tenant-b",
        isShared: false,
        eventDate: new Date("2024-06-15"),
        eventType: "concert" as EventType,
        source: "ticketmaster",
      },
    ];

    describe("matchesCalendarEventFilters", () => {
      it("should match tenant's own events", () => {
        const event = mockEvents[0];
        expect(matchesCalendarEventFilters(event, mockFilters)).toBe(true);
      });

      it("should match shared events when includeShared is true", () => {
        const sharedEvent = mockEvents[3];
        expect(matchesCalendarEventFilters(sharedEvent, mockFilters)).toBe(
          true,
        );
      });

      it("should reject other tenant's events", () => {
        const otherTenantEvent = mockEvents[4];
        expect(matchesCalendarEventFilters(otherTenantEvent, mockFilters)).toBe(
          false,
        );
      });

      it("should filter by event type", () => {
        const localEvent = mockEvents[2];
        expect(matchesCalendarEventFilters(localEvent, mockFilters)).toBe(
          false,
        );
      });

      it("should filter by date range", () => {
        const filtersOutOfRange = {
          ...mockFilters,
          eventDateFrom: new Date("2024-07-01"),
          eventDateTo: new Date("2024-07-31"),
        };

        expect(
          matchesCalendarEventFilters(mockEvents[0], filtersOutOfRange),
        ).toBe(false);
        expect(
          matchesCalendarEventFilters(mockEvents[1], filtersOutOfRange),
        ).toBe(true);
      });

      it("should filter by sources", () => {
        const wikimediaEvent = {
          tenantId: "tenant-a",
          isShared: false,
          eventDate: new Date("2024-06-15"),
          eventType: "historical" as EventType,
          source: "wikimedia", // Not in sources filter
        };

        expect(matchesCalendarEventFilters(wikimediaEvent, mockFilters)).toBe(
          false,
        );
      });
    });

    describe("filterCalendarEvents", () => {
      it("should filter events by all criteria", () => {
        const result = filterCalendarEvents(mockEvents as any, mockFilters);

        expect(result).toHaveLength(3); // Event 0, 1, 3 match
      });
    });
  });

  describe("Content Feed Filters", () => {
    const mockFilters = {
      tenantId: "tenant-a",
      includeShared: true,
      publishedOnly: true,
      contentTypes: ["breaking_news", "trending"] as (
        | "breaking_news"
        | "trending"
      )[],
      sources: ["newsapi", "gnews"],
    };

    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const mockItems = [
      {
        tenantId: "tenant-a",
        isShared: false,
        publishAt: yesterday,
        expiresAt: null,
        contentType: "breaking_news",
        source: "newsapi",
      },
      {
        tenantId: "tenant-a",
        isShared: false,
        publishAt: yesterday,
        expiresAt: twoDaysAgo, // Expired
        contentType: "trending",
        source: "gnews",
      },
      {
        tenantId: null,
        isShared: true,
        publishAt: yesterday,
        expiresAt: null,
        contentType: "breaking_news",
        source: "newsapi",
      },
      {
        tenantId: "tenant-b",
        isShared: false,
        publishAt: yesterday,
        expiresAt: null,
        contentType: "breaking_news",
        source: "newsapi",
      },
      {
        tenantId: "tenant-a",
        isShared: false,
        publishAt: tomorrow, // Future publish
        expiresAt: null,
        contentType: "trending",
        source: "gnews",
      },
      {
        tenantId: "tenant-a",
        isShared: false,
        publishAt: yesterday,
        expiresAt: null,
        contentType: "curiosity", // Not in contentTypes filter
        source: "wikidata",
      },
    ];

    describe("matchesContentFeedFilters", () => {
      it("should match tenant's own items", () => {
        expect(
          matchesContentFeedFilters(mockItems[0] as any, mockFilters),
        ).toBe(true);
      });

      it("should match shared items", () => {
        expect(
          matchesContentFeedFilters(mockItems[2] as any, mockFilters),
        ).toBe(true);
      });

      it("should reject other tenant's items", () => {
        expect(
          matchesContentFeedFilters(mockItems[3] as any, mockFilters),
        ).toBe(false);
      });

      it("should filter out expired items", () => {
        expect(
          matchesContentFeedFilters(mockItems[1] as any, mockFilters),
        ).toBe(false);
      });

      it("should filter out future items when publishedOnly is true", () => {
        expect(
          matchesContentFeedFilters(mockItems[4] as any, mockFilters),
        ).toBe(false);
      });

      it("should filter by content type", () => {
        expect(
          matchesContentFeedFilters(mockItems[5] as any, mockFilters),
        ).toBe(false);
      });
    });

    describe("filterContentFeedItems", () => {
      it("should filter items by all criteria", () => {
        const result = filterContentFeedItems(mockItems as any, mockFilters);

        expect(result).toHaveLength(2); // Items 0 and 2 match
      });
    });
  });
});
