/**
 * Eventbrite Connector Tests - System A
 *
 * Tests for the Eventbrite connector including:
 * - API query construction
 * - Event normalization
 * - Artist extraction
 *
 * @module ingestion/sources/__tests__/eventbrite.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventbriteConnector } from "../eventbrite";
import type { RawEvent } from "../../types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("EventbriteConnector", () => {
  const validApiKey = "test-eventbrite-key";

  let connector: EventbriteConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EVENTBRITE_API_KEY = validApiKey;
    connector = new EventbriteConnector({ apiKey: validApiKey });
  });

  afterEach(() => {
    delete process.env.EVENTBRITE_API_KEY;
  });

  describe("API query construction", () => {
    it("should build correct search URL", async () => {
      const mockResponse = {
        events: [],
        pagination: { page_count: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await connector.fetch({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("eventbriteapi.com/v3/events/search"),
        expect.any(Object),
      );
    });

    it("should include token in query", async () => {
      const mockResponse = {
        events: [],
        pagination: { page_count: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await connector.fetch({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`token=${validApiKey}`),
        expect.any(Object),
      );
    });

    it("should search with music categories", async () => {
      const mockResponse = {
        events: [],
        pagination: { page_count: 0 },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await connector.fetch({});

      // Should call for categories 103 and 107
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("categories=103"),
        expect.any(Object),
      );
    });

    it("should filter for Buenos Aires location", async () => {
      const mockResponse = {
        events: [],
        pagination: { page_count: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await connector.fetch({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("location=Buenos+Aires"),
        expect.any(Object),
      );
    });
  });

  describe("normalization to NormalizedEvent", () => {
    it("should normalize event correctly", async () => {
      const mockEvent = {
        id: "eb-123",
        name: { text: "Rock Concert Live" },
        url: "https://eventbrite.com/e/123",
        description: { text: "Great rock concert" },
        start: {
          local: "2024-12-15T20:00:00",
          timezone: "America/Argentina/Buenos_Aires",
        },
        venue: {
          name: "Teatro Gran Rex",
          address: { city: "Buenos Aires", region: "CABA", country: "AR" },
        },
        organizer: { name: "The Rolling Stones" },
        logo: { url: "http://logo.jpg" },
        category: { name: "Music" },
        subcategory: { name: "Rock" },
        tags: ["rock", "concert"],
        status: "live",
      };

      const raw: RawEvent = {
        sourceId: "eventbrite",
        externalId: "eb-123",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.source).toBe("eventbrite");
      expect(normalized.sourceId).toBe("eb-123");
      expect(normalized.title).toBe("Rock Concert Live");
      expect(normalized.eventType).toBe("concert");
      expect(normalized.location?.city).toBe("Buenos Aires");
      expect(normalized.location?.venue).toBe("Teatro Gran Rex");
      expect(normalized.priority).toBe(2); // MEDIUM
    });

    it("should detect festival events by name", async () => {
      const mockEvent = {
        id: "eb-fest",
        name: { text: "Lollapalooza Festival Argentina" },
        url: "https://eventbrite.com/e/fest",
        start: { local: "2024-12-20" },
        tags: ["festival"],
        category: { name: "Music" },
      };

      const raw: RawEvent = {
        sourceId: "eventbrite",
        externalId: "eb-fest",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.eventType).toBe("festival");
    });

    it("should use organizer as artist when no artists in description", async () => {
      const mockEvent = {
        id: "eb-org",
        name: { text: " Concert" },
        url: "https://eventbrite.com/e/org",
        start: { local: "2024-12-20" },
        organizer: { name: "Charly García" },
        category: { name: "Music" },
      };

      const raw: RawEvent = {
        sourceId: "eventbrite",
        externalId: "eb-org",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.artists).toBeDefined();
      expect(normalized.artists?.length).toBeGreaterThan(0);
    });

    it("should not use venue names as artists", async () => {
      const mockEvent = {
        id: "eb-venue",
        name: { text: "Concert" },
        url: "https://eventbrite.com/e/venue",
        start: { local: "2024-12-20" },
        organizer: { name: "Teatro Colon" }, // Venue name, not artist
        category: { name: "Music" },
      };

      const raw: RawEvent = {
        sourceId: "eventbrite",
        externalId: "eb-venue",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      // Should not add venue name as artist
      expect(normalized.artists?.length).toBe(0);
    });

    it("should extract images from logo and image", async () => {
      const mockEvent = {
        id: "eb-img",
        name: { text: "Image Test" },
        url: "https://eventbrite.com/e/img",
        start: { local: "2024-12-20" },
        logo: { url: "http://logo.jpg" },
        image: { url: "http://hero.jpg" },
        category: { name: "Music" },
      };

      const raw: RawEvent = {
        sourceId: "eventbrite",
        externalId: "eb-img",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.images).toHaveLength(2);
    });

    it("should limit images to 5", async () => {
      const mockEvent = {
        id: "eb-many-img",
        name: { text: "Many Images" },
        url: "https://eventbrite.com/e/many-img",
        start: { local: "2024-12-20" },
        logo: { url: "http://logo.jpg" },
        image: { url: "http://hero1.jpg" },
        category: { name: "Music" },
      };

      // Add more images via tags that might have images
      for (let i = 0; i < 10; i++) {
        (mockEvent as any)[`img${i}`] = { url: `http://img${i}.jpg` };
      }

      const raw: RawEvent = {
        sourceId: "eventbrite",
        externalId: "eb-many-img",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.images?.length).toBeLessThanOrEqual(5);
    });

    it("should extract tags from category and subcategory", async () => {
      const mockEvent = {
        id: "eb-tags",
        name: { text: "Tag Test" },
        url: "https://eventbrite.com/e/tags",
        start: { local: "2024-12-20" },
        category: { name: "Music" },
        subcategory: { name: "Jazz" },
        tags: ["live", "performance"],
      };

      const raw: RawEvent = {
        sourceId: "eventbrite",
        externalId: "eb-tags",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.tags).toContain("music");
      expect(normalized.tags).toContain("jazz");
      expect(normalized.tags).toContain("argentina");
      expect(normalized.tags).toContain("eventbrite");
    });

    it("should strip HTML from description", async () => {
      const mockEvent = {
        id: "eb-html",
        name: { text: "HTML Test" },
        url: "https://eventbrite.com/e/html",
        start: { local: "2024-12-20" },
        description: {
          html: "<p>Great <strong>concert</strong> event!</p>",
          text: "",
        },
        category: { name: "Music" },
      };

      const raw: RawEvent = {
        sourceId: "eventbrite",
        externalId: "eb-html",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.description).not.toContain("<");
      expect(normalized.description).toContain("Great concert event!");
    });

    it("should use Buenos Aires as default location", async () => {
      const mockEvent = {
        id: "eb-no-venue",
        name: { text: "No Venue" },
        url: "https://eventbrite.com/e/no-venue",
        start: { local: "2024-12-20" },
        category: { name: "Music" },
      };

      const raw: RawEvent = {
        sourceId: "eventbrite",
        externalId: "eb-no-venue",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.location?.city).toBe("Buenos Aires");
      expect(normalized.location?.country).toBe("AR");
    });

    it("should handle online events", async () => {
      const mockEvent = {
        id: "eb-online",
        name: { text: "Online Concert" },
        url: "https://eventbrite.com/e/online",
        start: { local: "2024-12-20" },
        online_event: true,
        category: { name: "Music" },
      };

      const raw: RawEvent = {
        sourceId: "eventbrite",
        externalId: "eb-online",
        rawData: mockEvent,
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.metadata?.isOnline).toBe(true);
    });
  });

  describe("constructor validation", () => {
    it("should throw if no API key provided", () => {
      delete process.env.EVENTBRITE_API_KEY;

      expect(() => new EventbriteConnector()).toThrow(
        "Eventbrite API key is required",
      );
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
  });
});
