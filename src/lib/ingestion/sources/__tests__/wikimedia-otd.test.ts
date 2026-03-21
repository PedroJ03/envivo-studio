/**
 * Wikimedia On This Day Connector Tests - System A
 *
 * Tests for the Wikimedia connector including:
 * - Music filtering logic
 * - Date formatting
 * - Normalization to NormalizedEvent
 *
 * @module ingestion/sources/__tests__/wikimedia-otd.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { WikimediaOnThisDayConnector } from "../wikimedia-otd";
import type { RawEvent } from "../../types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("WikimediaOnThisDayConnector", () => {
  let connector: WikimediaOnThisDayConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new WikimediaOnThisDayConnector();
  });

  describe("music filtering", () => {
    it("should filter events by music keywords", async () => {
      const mockResponse = {
        events: [
          {
            text: "In 1969, The Beatles released Abbey Road",
            year: 1969,
            pages: [
              { title: "Abbey Road", thumbnail: { source: "http://img.jpg" } },
            ],
          },
          {
            text: "Political election happened in 1969",
            year: 1969,
            pages: [{ title: "Election" }],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const items = await connector.fetch({ date: new Date("2024-03-20") });

      // Should only include music event
      expect(items).toHaveLength(1);
      expect(mockResponse.events[0].text).toContain("Beatles");
    });

    it("should filter events by music category in page title", async () => {
      const mockResponse = {
        events: [
          {
            text: "Something happened",
            year: 1990,
            pages: [{ title: "Rock music" }],
          },
          {
            text: "Something else happened",
            year: 1990,
            pages: [{ title: "History book" }],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const items = await connector.fetch({ date: new Date("2024-03-20") });

      expect(items).toHaveLength(1);
    });

    it("should include multiple music keyword matches", async () => {
      const mockResponse = {
        events: [
          {
            text: "The Beatles released a new album",
            year: 1969,
            pages: [{ title: "Abbey Road" }],
          },
          {
            text: "Jazz festival started",
            year: 1970,
            pages: [{ title: "Jazz" }],
          },
          {
            text: "Rock concert announced",
            year: 1971,
            pages: [{ title: "Rock" }],
          },
          {
            text: "Classical music premiere",
            year: 1972,
            pages: [{ title: "Classical" }],
          },
          {
            text: "Non-music event",
            year: 1973,
            pages: [{ title: "Weather" }],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const items = await connector.fetch({ date: new Date("2024-03-20") });

      expect(items).toHaveLength(4);
    });

    it("should handle events with no year (ongoing)", async () => {
      const mockResponse = {
        events: [
          { text: "Music festival ongoing", pages: [{ title: "Festival" }] },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const items = await connector.fetch({ date: new Date("2024-03-20") });

      expect(items).toHaveLength(1);
      expect(items[0].rawData).toHaveProperty("event");
    });
  });

  describe("date formatting", () => {
    it("should build correct URL for date", async () => {
      const mockResponse = { events: [] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await connector.fetch({ date: new Date("2024-07-15") });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("07/15"),
        expect.any(Object),
      );
    });

    it("should pad single digit months and days", async () => {
      const mockResponse = { events: [] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await connector.fetch({ date: new Date("2024-01-05") });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("01/05"),
        expect.any(Object),
      );
    });

    it("should use current date when no date provided", async () => {
      const mockResponse = { events: [] };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const now = new Date();
      await connector.fetch({});

      const expectedMonth = String(now.getMonth() + 1).padStart(2, "0");
      const expectedDay = String(now.getDate()).padStart(2, "0");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`${expectedMonth}/${expectedDay}`),
        expect.any(Object),
      );
    });
  });

  describe("normalization to NormalizedEvent", () => {
    it("should normalize event correctly", async () => {
      const rawEvent = {
        text: "In 1969, The Beatles released Abbey Road",
        year: 1969,
        pages: [
          {
            title: "Abbey Road",
            extract:
              "Abbey Road is the 11th studio album by the English rock band the Beatles.",
            thumbnail: {
              source: "http://example.com/abbey-road.jpg",
              width: 320,
            },
            content_urls: {
              desktop: { page: "https://en.wikipedia.org/wiki/Abbey_Road" },
            },
          },
        ],
      };

      const raw: RawEvent = {
        sourceId: "wikimedia",
        externalId: "wikimedia-03-21-1969-abc123",
        rawData: {
          event: rawEvent,
          _context: {
            eventDate: new Date("2024-03-21"),
            category: "selected",
          },
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.source).toBe("wikimedia");
      expect(normalized.sourceId).toBe("wikimedia-03-21-1969-abc123");
      expect(normalized.eventType).toBe("historical");
      expect(normalized.year).toBe(1969);
      expect(normalized.title).toBeTruthy();
      expect(normalized.description).toContain("Abbey Road");
      expect(normalized.images).toHaveLength(1);
      expect(normalized.images?.[0].url).toBe(
        "http://example.com/abbey-road.jpg",
      );
    });

    it("should extract artists from event text", async () => {
      const rawEvent = {
        text: "In 1965, The Beatles performed at Shea Stadium",
        year: 1965,
        pages: [{ title: "Shea Stadium" }],
      };

      const raw: RawEvent = {
        sourceId: "wikimedia",
        externalId: "test-id",
        rawData: {
          event: rawEvent,
          _context: { eventDate: new Date("2024-03-21"), category: "selected" },
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.artists).toBeDefined();
      expect(normalized.artists?.length).toBeGreaterThan(0);
      expect(normalized.artists?.[0].name).toBe("The Beatles");
      expect(normalized.artists?.[0].normalizedName).toBe("beatles");
    });

    it("should handle events without artists", async () => {
      const rawEvent = {
        text: "A classical music piece was premiered",
        year: 1950,
        pages: [{ title: "Classical Music" }],
      };

      const raw: RawEvent = {
        sourceId: "wikimedia",
        externalId: "test-id",
        rawData: {
          event: rawEvent,
          _context: { eventDate: new Date("2024-03-21"), category: "selected" },
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.artists).toBeUndefined();
    });

    it("should extract images from pages", async () => {
      const rawEvent = {
        text: "Concert happened",
        year: 1980,
        pages: [
          { title: "Concert 1" },
          { title: "Concert 2", thumbnail: { source: "http://img1.jpg" } },
          { title: "Concert 3", thumbnail: { source: "http://img2.jpg" } },
        ],
      };

      const raw: RawEvent = {
        sourceId: "wikimedia",
        externalId: "test-id",
        rawData: {
          event: rawEvent,
          _context: { eventDate: new Date("2024-03-21"), category: "selected" },
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.images).toHaveLength(2);
      expect(normalized.images?.[0].url).toBe("http://img1.jpg");
    });

    it("should limit images to 5", async () => {
      const pages = Array.from({ length: 10 }, (_, i) => ({
        title: `Event ${i}`,
        thumbnail: { source: `http://img${i}.jpg` },
      }));

      const rawEvent = {
        text: "Many events happened",
        year: 2000,
        pages,
      };

      const raw: RawEvent = {
        sourceId: "wikimedia",
        externalId: "test-id",
        rawData: {
          event: rawEvent,
          _context: { eventDate: new Date("2024-03-21"), category: "selected" },
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.images?.length).toBeLessThanOrEqual(5);
    });

    it("should generate correct content hash", async () => {
      const rawEvent = {
        text: "The Beatles released Abbey Road",
        year: 1969,
        pages: [{ title: "Abbey Road" }],
      };

      const raw: RawEvent = {
        sourceId: "wikimedia",
        externalId: "test-id",
        rawData: {
          event: rawEvent,
          _context: { eventDate: new Date("2024-03-21"), category: "selected" },
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.contentHash).toBeTruthy();
      expect(normalized.contentHash.length).toBe(64); // SHA256 hex
    });

    it("should set isShared true and tenantId null", async () => {
      const rawEvent = {
        text: "Music event",
        year: 2000,
        pages: [{ title: "Music" }],
      };

      const raw: RawEvent = {
        sourceId: "wikimedia",
        externalId: "test-id",
        rawData: {
          event: rawEvent,
          _context: { eventDate: new Date("2024-03-21"), category: "selected" },
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.isShared).toBe(true);
      expect(normalized.tenantId).toBeNull();
    });

    it("should extract tags from text and year", async () => {
      const rawEvent = {
        text: "Rock concert with jazz elements",
        year: 1975,
        pages: [{ title: "Concert" }],
      };

      const raw: RawEvent = {
        sourceId: "wikimedia",
        externalId: "test-id",
        rawData: {
          event: rawEvent,
          _context: { eventDate: new Date("2024-03-21"), category: "selected" },
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.tags).toContain("rock");
      expect(normalized.tags).toContain("jazz");
      expect(normalized.tags).toContain("efeméride");
      expect(normalized.tags).toContain("historia");
      expect(normalized.tags).toContain("música");
      expect(normalized.tags).toContain("año-1975");
    });
  });

  describe("API error handling", () => {
    it("should throw error on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      await expect(
        connector.fetch({ date: new Date("2024-03-20") }),
      ).rejects.toThrow("Wikimedia API error: 500 Internal Server Error");
    });

    it("should throw error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network failure"));

      await expect(
        connector.fetch({ date: new Date("2024-03-20") }),
      ).rejects.toThrow("Network failure");
    });
  });

  describe("calculateHash", () => {
    it("should generate consistent hash for same event", () => {
      const event = {
        title: "The Beatles",
        eventDate: new Date("2024-03-21"),
        year: 1969,
        artists: [{ name: "The Beatles", normalizedName: "beatles" }],
      };

      const hash1 = connector.calculateHash(event as any);
      const hash2 = connector.calculateHash(event as any);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hash for different artists", () => {
      const event1 = {
        title: "Concert",
        eventDate: new Date("2024-03-21"),
        year: 1969,
        artists: [{ name: "The Beatles", normalizedName: "beatles" }],
      };

      const event2 = {
        title: "Concert",
        eventDate: new Date("2024-03-21"),
        year: 1969,
        artists: [{ name: "Led Zeppelin", normalizedName: "led-zeppelin" }],
      };

      const hash1 = connector.calculateHash(event1 as any);
      const hash2 = connector.calculateHash(event2 as any);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("health check", () => {
    it("should call defaultHealthCheck with correct URL", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      const health = await connector.health({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("wikimedia.org"),
        expect.any(Object),
      );
      expect(health.healthy).toBe(true);
    });
  });
});
