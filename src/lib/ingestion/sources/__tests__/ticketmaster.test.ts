/**
 * Ticketmaster Connector Tests - System A
 *
 * Tests for the Ticketmaster connector including:
 * - API query construction
 * - Rate limiting logic
 * - Normalization to NormalizedEvent
 *
 * @module ingestion/sources/__tests__/ticketmaster.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TicketmasterConnector } from "../ticketmaster";
import type { RawEvent } from "../../types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("TicketmasterConnector", () => {
  const validApiKey = "test-api-key";

  let connector: TicketmasterConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variable
    process.env.TICKETMASTER_API_KEY = validApiKey;
    connector = new TicketmasterConnector({ apiKey: validApiKey });
  });

  afterEach(() => {
    delete process.env.TICKETMASTER_API_KEY;
  });

  describe("API query construction", () => {
    it("should build correct base URL with API key", async () => {
      const mockResponse = {
        _embedded: { events: [] },
        page: { totalPages: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await connector.fetch({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`apikey=${validApiKey}`),
        expect.any(Object),
      );
    });

    it("should include classificationName=music in query", async () => {
      const mockResponse = {
        _embedded: { events: [] },
        page: { totalPages: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await connector.fetch({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("classificationName=music"),
        expect.any(Object),
      );
    });

    it("should search multiple markets", async () => {
      const mockResponse = {
        _embedded: { events: [] },
        page: { totalPages: 0 },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await connector.fetch({});

      // Should call for AR, US, MX, ES markets
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(4);
    });

    it("should construct date range correctly", async () => {
      const mockResponse = {
        _embedded: { events: [] },
        page: { totalPages: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 90);

      await connector.fetch({});

      const expectedStart = startDate.toISOString().slice(0, 19) + "Z";
      const expectedEnd = endDate.toISOString().slice(0, 19) + "Z";

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`startDateTime=${expectedStart}`),
        expect.any(Object),
      );
    });
  });

  describe("rate limiting logic", () => {
    it("should stop pagination on 429 response", async () => {
      const mockEvents = Array(200)
        .fill(null)
        .map((_, i) => ({
          id: `evt-${i}`,
          name: `Event ${i}`,
          dates: { start: { localDate: "2024-12-01" } },
        }));

      // First page succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            _embedded: { events: mockEvents },
            page: { totalPages: 2, number: 0 },
          }),
      } as Response);

      // Second page rate limited
      mockFetch.mockResolvedValueOnce({
        status: 429,
      } as Response);

      const items = await connector.fetch({});

      // Should have fetched first page but stopped on rate limit
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should throw on 401 unauthorized", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
      } as Response);

      await expect(connector.fetch({})).rejects.toThrow(
        "Ticketmaster API key is invalid",
      );
    });
  });

  describe("normalization to NormalizedEvent", () => {
    it("should normalize event correctly", async () => {
      const mockEvent = {
        id: "evt-123",
        name: "The Beatles Concert",
        url: "https://ticketmaster.com/event/123",
        dates: {
          start: { localDate: "2024-12-15", localTime: "20:00:00" },
        },
        _embedded: {
          venues: [
            {
              name: "Luna Park",
              city: { name: "Buenos Aires" },
              country: { name: "Argentina" },
            },
          ],
          attractions: [
            { name: "The Beatles", url: "https://ticketmaster.com/beatles" },
          ],
        },
        images: [
          { url: "http://img1.jpg", width: 100 },
          { url: "http://img2.jpg", width: 500 },
        ],
        pleaseNote: "Concert announcement",
      };

      const raw: RawEvent = {
        sourceId: "ticketmaster",
        externalId: "evt-123",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.source).toBe("ticketmaster");
      expect(normalized.sourceId).toBe("evt-123");
      expect(normalized.title).toBe("The Beatles Concert");
      expect(normalized.eventType).toBe("concert");
      expect(normalized.eventDate).toBeInstanceOf(Date);
      expect(normalized.location?.city).toBe("Buenos Aires");
      expect(normalized.location?.country).toBe("Argentina");
      expect(normalized.location?.venue).toBe("Luna Park");
      expect(normalized.artists).toHaveLength(1);
      expect(normalized.artists?.[0].name).toBe("The Beatles");
      expect(normalized.images).toHaveLength(2);
      expect(normalized.priority).toBe(1); // HIGH
    });

    it("should detect festival events by name", async () => {
      const mockEvent = {
        id: "fest-123",
        name: "Rock in Rio Festival",
        url: "https://ticketmaster.com/festival/123",
        dates: { start: { localDate: "2024-12-20" } },
        _embedded: {
          venues: [{ name: "Rio de Janeiro" }],
          attractions: [],
        },
        images: [],
      };

      const raw: RawEvent = {
        sourceId: "ticketmaster",
        externalId: "fest-123",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.eventType).toBe("festival");
    });

    it("should extract multiple artists from attractions", async () => {
      const mockEvent = {
        id: "evt-456",
        name: "Music Festival",
        url: "https://ticketmaster.com/event/456",
        dates: { start: { localDate: "2024-12-20" } },
        _embedded: {
          venues: [{ name: "Stadium" }],
          attractions: [{ name: "Artist 1" }, { name: "Artist 2" }],
        },
        images: [],
      };

      const raw: RawEvent = {
        sourceId: "ticketmaster",
        externalId: "evt-456",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.artists).toHaveLength(2);
    });

    it("should filter music attractions only", async () => {
      const mockEvent = {
        id: "evt-789",
        name: "Mixed Event",
        url: "https://ticketmaster.com/event/789",
        dates: { start: { localDate: "2024-12-20" } },
        _embedded: {
          venues: [{ name: "Venue" }],
          attractions: [
            {
              name: "Music Artist",
              classifications: [{ genre: { name: "Music" } }],
            },
            {
              name: "Sports Team",
              classifications: [{ genre: { name: "Sports" } }],
            },
          ],
        },
        images: [],
      };

      const raw: RawEvent = {
        sourceId: "ticketmaster",
        externalId: "evt-789",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.artists).toHaveLength(1);
      expect(normalized.artists?.[0].name).toBe("Music Artist");
    });

    it("should sort images by width descending", async () => {
      const mockEvent = {
        id: "evt-img",
        name: "Image Test",
        url: "https://ticketmaster.com/event/img",
        dates: { start: { localDate: "2024-12-20" } },
        _embedded: { venues: [], attractions: [] },
        images: [
          { url: "http://small.jpg", width: 100 },
          { url: "http://large.jpg", width: 1000 },
          { url: "http://medium.jpg", width: 500 },
        ],
      };

      const raw: RawEvent = {
        sourceId: "ticketmaster",
        externalId: "evt-img",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.images?.[0].url).toBe("http://large.jpg");
      expect(normalized.images?.[1].url).toBe("http://medium.jpg");
      expect(normalized.images?.[2].url).toBe("http://small.jpg");
    });

    it("should limit images to 5", async () => {
      const mockEvent = {
        id: "evt-many-img",
        name: "Many Images",
        url: "https://ticketmaster.com/event/many-img",
        dates: { start: { localDate: "2024-12-20" } },
        _embedded: { venues: [], attractions: [] },
        images: Array.from({ length: 10 }, (_, i) => ({
          url: `http://img${i}.jpg`,
          width: 100 * (10 - i),
        })),
      };

      const raw: RawEvent = {
        sourceId: "ticketmaster",
        externalId: "evt-many-img",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.images?.length).toBe(5);
    });

    it("should extract tags from genres and country", async () => {
      const mockEvent = {
        id: "evt-tags",
        name: "Tag Test",
        url: "https://ticketmaster.com/event/tags",
        dates: { start: { localDate: "2024-12-20" } },
        _embedded: {
          venues: [{ name: "Venue", country: { countryCode: "AR" } }],
          attractions: [
            {
              classifications: [
                {
                  genre: { name: "Rock" },
                  subGenre: { name: "Alternative Rock" },
                },
              ],
            },
          ],
        },
        images: [],
      };

      const raw: RawEvent = {
        sourceId: "ticketmaster",
        externalId: "evt-tags",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.tags).toContain("rock");
      expect(normalized.tags).toContain("alternative rock");
      expect(normalized.tags).toContain("ar");
      expect(normalized.tags).toContain("concierto");
      expect(normalized.tags).toContain("ticketmaster");
    });

    it("should use pleaseNote for description", async () => {
      const mockEvent = {
        id: "evt-desc",
        name: "Desc Test",
        url: "https://ticketmaster.com/event/desc",
        dates: { start: { localDate: "2024-12-20" } },
        _embedded: { venues: [], attractions: [] },
        images: [],
        pleaseNote: "This is an important notice about the event.",
      };

      const raw: RawEvent = {
        sourceId: "ticketmaster",
        externalId: "evt-desc",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.description).toBe(
        "This is an important notice about the event.",
      );
    });

    it("should truncate long descriptions", async () => {
      const longDescription = "A".repeat(1000);
      const mockEvent = {
        id: "evt-long-desc",
        name: "Long Desc Test",
        url: "https://ticketmaster.com/event/long-desc",
        dates: { start: { localDate: "2024-12-20" } },
        _embedded: { venues: [], attractions: [] },
        images: [],
        pleaseNote: longDescription,
      };

      const raw: RawEvent = {
        sourceId: "ticketmaster",
        externalId: "evt-long-desc",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.description?.length).toBeLessThan(600);
    });
  });

  describe("calculateHash", () => {
    it("should generate consistent hash", () => {
      const event = {
        title: "Concert",
        eventDate: new Date("2024-12-15"),
        artists: [{ name: "Artist", normalizedName: "artist" }],
        location: { venue: "Luna Park" },
      };

      const hash1 = connector.calculateHash(event as any);
      const hash2 = connector.calculateHash(event as any);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hash for different dates", () => {
      const baseEvent = {
        title: "Concert",
        artists: [{ name: "Artist", normalizedName: "artist" }],
        location: { venue: "Luna Park" },
      };

      const event1 = { ...baseEvent, eventDate: new Date("2024-12-15") };
      const event2 = { ...baseEvent, eventDate: new Date("2024-12-16") };

      const hash1 = connector.calculateHash(event1 as any);
      const hash2 = connector.calculateHash(event2 as any);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("constructor validation", () => {
    it("should throw if no API key provided", () => {
      delete process.env.TICKETMASTER_API_KEY;

      expect(() => new TicketmasterConnector()).toThrow(
        "Ticketmaster API key is required",
      );
    });

    it("should accept API key from constructor", () => {
      const connectorWithKey = new TicketmasterConnector({ apiKey: "my-key" });
      expect(connectorWithKey).toBeInstanceOf(TicketmasterConnector);
    });
  });

  describe("health check", () => {
    it("should call defaultHealthCheck", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      const health = await connector.health({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("ticketmaster.com"),
        expect.any(Object),
      );
      expect(health.healthy).toBe(true);
    });
  });
});
