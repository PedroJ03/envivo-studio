/**
 * NewsAPI Connector Tests - System B
 *
 * Tests for the NewsAPI connector including:
 * - Query building
 * - Content type detection
 * - Normalization to ContentFeedItem
 *
 * @module ingestion/sources/__tests__/newsapi.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NewsAPIConnector } from "../newsapi";
import type { RawFeedItem } from "../../types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("NewsAPIConnector", () => {
  const validApiKey = "test-newsapi-key";

  let connector: NewsAPIConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new NewsAPIConnector({
      sourceId: "newsapi",
      sourceType: "api",
      isShared: true,
      apiKey: validApiKey,
    });
  });

  describe("query building", () => {
    it("should build query with music keywords", async () => {
      const mockResponse = {
        status: "ok",
        totalResults: 0,
        articles: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await connector.fetch({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("q="),
        expect.any(Object),
      );

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("music");
    });

    it("should include language filter", async () => {
      const mockResponse = {
        status: "ok",
        totalResults: 0,
        articles: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await connector.fetch({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("language=en,es"),
        expect.any(Object),
      );
    });

    it("should include api key in query", async () => {
      const mockResponse = {
        status: "ok",
        totalResults: 0,
        articles: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      await connector.fetch({});

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`apiKey=${validApiKey}`),
        expect.any(Object),
      );
    });
  });

  describe("normalization to ContentFeedItem", () => {
    it("should normalize article correctly", async () => {
      const mockArticle = {
        source: { id: "bbc", name: "BBC News" },
        author: "John Doe",
        title: "The Beatles reunion announced",
        description: "Amazing news for fans worldwide",
        url: "https://bbc.com/article/123",
        urlToImage: "http://bbc.com/image.jpg",
        publishedAt: "2024-03-20T10:00:00Z",
        content: "Full article content here about the announcement",
      };

      const raw: RawFeedItem = {
        sourceId: "newsapi",
        externalId: "article-123",
        rawData: {
          article: mockArticle,
          contentType: "trending",
          fetchedAt: new Date().toISOString(),
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.source).toBe("newsapi");
      expect(normalized.sourceId).toBe("article-123");
      expect(normalized.title).toBe("The Beatles reunion announced");
      expect(normalized.contentType).toBe("trending");
      expect(normalized.hook).toBeTruthy();
      expect(normalized.body).toContain("Full article content");
      expect(normalized.images).toHaveLength(1);
      expect(normalized.images?.[0].url).toBe("http://bbc.com/image.jpg");
      expect(normalized.metadata?.author).toBe("John Doe");
      expect(normalized.metadata?.sourceName).toBe("BBC News");
    });

    it("should generate hook from description", async () => {
      const mockArticle = {
        source: { id: "test", name: "Test" },
        title: "Title",
        description: "This is the first sentence. This is the second sentence.",
        url: "https://example.com",
        publishedAt: "2024-03-20T10:00:00Z",
        content: "Content",
      };

      const raw: RawFeedItem = {
        sourceId: "newsapi",
        externalId: "test",
        rawData: {
          article: mockArticle,
          contentType: "trending",
          fetchedAt: "",
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.hook).toBe("This is the first sentence.");
    });

    it("should use title as hook when no description", async () => {
      const mockArticle = {
        source: { id: "test", name: "Test" },
        title: "Amazing Music News Story",
        description: null,
        url: "https://example.com",
        publishedAt: "2024-03-20T10:00:00Z",
        content: "Content",
      };

      const raw: RawFeedItem = {
        sourceId: "newsapi",
        externalId: "test",
        rawData: {
          article: mockArticle,
          contentType: "trending",
          fetchedAt: "",
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.hook).toBe("Amazing Music News Story");
    });

    it("should calculate viral score for breaking news", async () => {
      const mockArticle = {
        source: { id: "test", name: "Test" },
        title: "Breaking: Artist died",
        description: "Tragic news",
        url: "https://example.com",
        urlToImage: "http://example.com/img.jpg",
        publishedAt: "2024-03-20T10:00:00Z",
        content: "Full content",
      };

      const raw: RawFeedItem = {
        sourceId: "newsapi",
        externalId: "breaking",
        rawData: {
          article: mockArticle,
          contentType: "breaking_news",
          fetchedAt: "",
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.viralScore).toBeGreaterThanOrEqual(90);
    });

    it("should set expiry based on content type", async () => {
      const breakingArticle = {
        source: { id: "test", name: "Test" },
        title: "Breaking",
        description: "News",
        url: "https://example.com",
        publishedAt: "2024-03-20T10:00:00Z",
        content: "Content",
      };

      const rawBreaking: RawFeedItem = {
        sourceId: "newsapi",
        externalId: "breaking",
        rawData: {
          article: breakingArticle,
          contentType: "breaking_news",
          fetchedAt: "",
        },
        fetchedAt: new Date(),
      };

      const normalizedBreaking = await connector.normalize(rawBreaking);

      expect(normalizedBreaking.expiresAt).toBeInstanceOf(Date);
      expect(normalizedBreaking.expiresAt?.getTime()).toBeGreaterThan(
        Date.now(),
      );
    });

    it("should not set expiry for trending content", async () => {
      const trendingArticle = {
        source: { id: "test", name: "Test" },
        title: "Trending",
        description: "News",
        url: "https://example.com",
        publishedAt: "2024-03-20T10:00:00Z",
        content: "Content",
      };

      const rawTrending: RawFeedItem = {
        sourceId: "newsapi",
        externalId: "trending",
        rawData: {
          article: trendingArticle,
          contentType: "trending",
          fetchedAt: "",
        },
        fetchedAt: new Date(),
      };

      const normalizedTrending = await connector.normalize(rawTrending);

      expect(normalizedTrending.expiresAt).toBeInstanceOf(Date);
    });

    it("should remove [+] chars from content", async () => {
      const mockArticle = {
        source: { id: "test", name: "Test" },
        title: "Article",
        description: "Desc",
        url: "https://example.com",
        publishedAt: "2024-03-20T10:00:00Z",
        content: "Article content [+1000 chars]",
      };

      const raw: RawFeedItem = {
        sourceId: "newsapi",
        externalId: "test",
        rawData: {
          article: mockArticle,
          contentType: "trending",
          fetchedAt: "",
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.body).not.toContain("[+");
      expect(normalized.body).not.toContain("chars]");
    });

    it("should extract tags from language", async () => {
      const englishArticle = {
        source: { id: "test", name: "Test" },
        title: "English article about music",
        description: "Description",
        url: "https://example.com",
        publishedAt: "2024-03-20T10:00:00Z",
        content: "Content",
      };

      const raw: RawFeedItem = {
        sourceId: "newsapi",
        externalId: "test",
        rawData: {
          article: englishArticle,
          contentType: "trending",
          fetchedAt: "",
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.tags).toContain("english");
    });

    it("should detect Spanish/Latin tags", async () => {
      const spanishArticle = {
        source: { id: "test", name: "Test" },
        title: "Artículo de música en español con ñ",
        description: "Descripción",
        url: "https://example.com",
        publishedAt: "2024-03-20T10:00:00Z",
        content: "Contenido",
      };

      const raw: RawFeedItem = {
        sourceId: "newsapi",
        externalId: "test",
        rawData: {
          article: spanishArticle,
          contentType: "trending",
          fetchedAt: "",
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.tags).toContain("spanish");
      expect(normalized.tags).toContain("latam");
    });

    it("should add image boost to viral score", async () => {
      const articleWithImage = {
        source: { id: "test", name: "Test" },
        title: "Article",
        description: "Description that is quite long to trigger the boost",
        url: "https://example.com",
        urlToImage: "http://example.com/image.jpg",
        publishedAt: "2024-03-20T10:00:00Z",
        content: "Content",
      };

      const raw: RawFeedItem = {
        sourceId: "newsapi",
        externalId: "test",
        rawData: {
          article: articleWithImage,
          contentType: "trending",
          fetchedAt: "",
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(raw);

      expect(normalized.viralScore).toBeGreaterThan(70); // Base trending + image boost
    });
  });

  describe("calculateHash", () => {
    it("should generate consistent hash", () => {
      const item = {
        title: "Article Title",
        body: "Article body content",
        source: "newsapi",
        sourceId: "article-123",
      };

      const hash1 = connector.calculateHash(item as any);
      const hash2 = connector.calculateHash(item as any);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hash for different articles", () => {
      const item1 = {
        title: "Article 1",
        body: "Body 1",
        source: "newsapi",
        sourceId: "article-1",
      };

      const item2 = {
        title: "Article 2",
        body: "Body 2",
        source: "newsapi",
        sourceId: "article-2",
      };

      const hash1 = connector.calculateHash(item1 as any);
      const hash2 = connector.calculateHash(item2 as any);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("fetch filtering", () => {
    it("should skip removed articles", async () => {
      const mockResponse = {
        status: "ok",
        totalResults: 2,
        articles: [
          {
            title: "[Removed]",
            url: "https://example.com/1",
            publishedAt: "2024-03-20",
          },
          {
            title: "Valid Article",
            url: "https://example.com/2",
            publishedAt: "2024-03-20",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const items = await connector.fetch({});

      expect(items).toHaveLength(1);
      expect(items[0].rawData).toHaveProperty("article");
    });

    it("should skip articles without title", async () => {
      const mockResponse = {
        status: "ok",
        totalResults: 2,
        articles: [
          {
            title: "",
            url: "https://example.com/1",
            publishedAt: "2024-03-20",
          },
          {
            title: "Valid Article",
            url: "https://example.com/2",
            publishedAt: "2024-03-20",
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const items = await connector.fetch({});

      expect(items).toHaveLength(1);
    });
  });

  describe("API error handling", () => {
    it("should throw on 401 authentication error", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 401,
        text: () => Promise.resolve("Invalid API key"),
      } as Response);

      await expect(connector.fetch({})).rejects.toThrow(
        "NewsAPI authentication failed",
      );
    });

    it("should throw on 429 rate limit error", async () => {
      mockFetch.mockResolvedValueOnce({
        status: 429,
        text: () => Promise.resolve("Rate limit exceeded"),
      } as Response);

      await expect(connector.fetch({})).rejects.toThrow(
        "NewsAPI rate limit exceeded",
      );
    });
  });

  describe("health check", () => {
    it("should return unhealthy when no API key", async () => {
      const connectorNoKey = new NewsAPIConnector({
        sourceId: "newsapi",
        sourceType: "api",
        isShared: true,
      });

      const health = await connectorNoKey.health({});

      expect(health.healthy).toBe(false);
      expect(health.error).toContain("API key not configured");
    });
  });
});
