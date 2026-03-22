/**
 * La Nación RSS Connector Tests - System B
 *
 * Tests for the La Nación RSS connector including:
 * - Filtro B (Balanced Filter) category filtering
 * - Keyword detection (shows, artists, cities)
 * - RSS parsing and normalization
 * - Image extraction
 *
 * @module ingestion/sources/__tests__/lanacion-rss.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  LaNacionRSSConnector,
  FILTER_CONFIG,
  createLaNacionRSSConnector,
} from "../lanacion-rss";
import type { RawFeedItem, ContentFeedItem } from "../../types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("LaNacionRSSConnector", () => {
  let connector: LaNacionRSSConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = createLaNacionRSSConnector();
  });

  // ============================================================================
  // Filter Configuration Tests
  // ============================================================================

  describe("FILTER_CONFIG", () => {
    it("should export allowed categories", () => {
      expect(FILTER_CONFIG.allowedCategories).toContain("Espectáculos");
      expect(FILTER_CONFIG.allowedCategories).toContain("Música");
      expect(FILTER_CONFIG.allowedCategories).toContain("Celebridades");
      expect(FILTER_CONFIG.allowedCategories).toContain("Cine");
      expect(FILTER_CONFIG.allowedCategories).toContain("Teatro");
    });

    it("should export show keywords", () => {
      expect(FILTER_CONFIG.showKeywords).toContain("show");
      expect(FILTER_CONFIG.showKeywords).toContain("concierto");
      expect(FILTER_CONFIG.showKeywords).toContain("gira");
      expect(FILTER_CONFIG.showKeywords).toContain("festival");
    });

    it("should export artist names", () => {
      expect(FILTER_CONFIG.artistNames).toContain("Soda Stereo");
      expect(FILTER_CONFIG.artistNames).toContain("Fito Páez");
      expect(FILTER_CONFIG.artistNames).toContain("Charly García");
    });

    it("should export argentinian cities", () => {
      expect(FILTER_CONFIG.argentinianCities).toContain("Tandil");
      expect(FILTER_CONFIG.argentinianCities).toContain("Mar del Plata");
      expect(FILTER_CONFIG.argentinianCities).toContain("Buenos Aires");
    });
  });

  // ============================================================================
  // RSS Fetching and Parsing Tests
  // ============================================================================

  describe("fetch", () => {
    const createMockRSS = (
      items: string[],
    ) => `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" version="2.0">
  <channel>
    <title>La Nación - Espectáculos</title>
    <link>https://www.lanacion.com.ar/espectaculos/</link>
    <description>Noticias de espectáculos</description>
    ${items.join("\n")}
  </channel>
</rss>`;

    const createMockItem = (options: {
      title: string;
      link: string;
      category?: string;
      description?: string;
    }) => `<item>
  <title>${options.title}</title>
  <link>${options.link}</link>
  <description>${options.description || ""}</description>
  <pubDate>Mon, 20 Mar 2024 10:00:00 GMT</pubDate>
  <category>${options.category || "Espectáculos"}</category>
  <dc:creator>La Nación</dc:creator>
</item>`;

    it("should fetch and parse RSS feed", async () => {
      const mockRSS = createMockRSS([
        createMockItem({
          title: "Duki presenta su nuevo show en Tandil",
          link: "https://lanacion.com.ar/1",
          category: "Espectáculos",
          description: "El artista urbano llega a la ciudad",
        }),
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      } as Response);

      const items = await connector.fetch({});

      expect(items).toHaveLength(1);
      expect(items[0].externalId).toBeDefined();
      expect(items[0].rawData).toHaveProperty("item");
      expect(items[0].rawData).toHaveProperty("filterResult");
    });

    it("should filter items by allowed category", async () => {
      const mockRSS = createMockRSS([
        createMockItem({
          title: "Duki en concierto en Tandil",
          link: "https://lanacion.com.ar/1",
          category: "Espectáculos",
        }),
        createMockItem({
          title: "Noticia de política",
          link: "https://lanacion.com.ar/2",
          category: "Política",
        }),
        createMockItem({
          title: "Nuevo álbum de Bizarrap",
          link: "https://lanacion.com.ar/3",
          category: "Música",
        }),
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      } as Response);

      const items = await connector.fetch({});

      expect(items).toHaveLength(2);
      const item0 = items[0].rawData as { item: { title: string } };
      const item1 = items[1].rawData as { item: { title: string } };
      expect(item0.item.title).toContain("Duki");
      expect(item1.item.title).toContain("Bizarrap");
    });

    it("should filter items without additional keywords", async () => {
      const mockRSS = createMockRSS([
        createMockItem({
          title: "Duki en concierto en Tandil",
          link: "https://lanacion.com.ar/1",
          category: "Espectáculos",
        }),
        createMockItem({
          title: "Noticia genérica sin keywords",
          link: "https://lanacion.com.ar/2",
          category: "Espectáculos",
        }),
      ]);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      } as Response);

      const items = await connector.fetch({});

      expect(items).toHaveLength(1);
      const item0 = items[0].rawData as { item: { title: string } };
      expect(item0.item.title).toContain("Duki");
    });

    it("should throw on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(connector.fetch({})).rejects.toThrow(
        "La Nación RSS request failed: 500",
      );
    });
  });

  // ============================================================================
  // Show/Concert Keywords Detection Tests
  // ============================================================================

  describe("show keyword detection", () => {
    const createMockRSS = (
      title: string,
      category: string,
    ) => `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test</title>
    <item>
      <title>${title}</title>
      <link>https://lanacion.com.ar/test</link>
      <description>Test description</description>
      <pubDate>Mon, 20 Mar 2024 10:00:00 GMT</pubDate>
      <category>${category}</category>
    </item>
  </channel>
</rss>`;

    const testShowKeywords = [
      { keyword: "show", title: "Nuevo show de artista" },
      { keyword: "concierto", title: "Gran concierto en el Luna Park" },
      { keyword: "gira", title: "La gira mundial comienza" },
      { keyword: "festival", title: "Festival de música indie" },
      { keyword: "presenta", title: "Se presenta en Buenos Aires" },
      { keyword: "en vivo", title: "Show en vivo este finde" },
      { keyword: "entradas", title: "Ya a la venta las entradas" },
      { keyword: "tour", title: "Nuevo tour internacional" },
    ];

    testShowKeywords.forEach(({ keyword, title }) => {
      it(`should detect "${keyword}" keyword`, async () => {
        const mockRSS = createMockRSS(title, "Espectáculos");

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockRSS),
        } as Response);

        const items = await connector.fetch({});

        expect(items).toHaveLength(1);
        const item0 = items[0].rawData as {
          filterResult: { matchedKeywords: string[] };
        };
        expect(item0.filterResult.matchedKeywords).toContain(keyword);
      });
    });
  });

  // ============================================================================
  // Artist Detection Tests
  // ============================================================================

  describe("artist name detection", () => {
    const createMockRSS = (
      title: string,
      category: string,
    ) => `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test</title>
    <item>
      <title>${title}</title>
      <link>https://lanacion.com.ar/test</link>
      <description>Test description</description>
      <pubDate>Mon, 20 Mar 2024 10:00:00 GMT</pubDate>
      <category>${category}</category>
    </item>
  </channel>
</rss>`;

    const testArtists = [
      { artist: "Soda Stereo", title: "Soda Stereo: la gira del recuerdo" },
      { artist: "Fito Páez", title: "Fito Páez presenta nuevo disco" },
      { artist: "Charly García", title: "Charly García en concierto" },
      { artist: "Duki", title: "Duki rompe récords en Spotify" },
      { artist: "Tini", title: "Tini anuncia nuevo single" },
      { artist: "Wos", title: "Wos vuelve a los escenarios" },
    ];

    testArtists.forEach(({ artist, title }) => {
      it(`should detect artist "${artist}"`, async () => {
        const mockRSS = createMockRSS(title, "Música");

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockRSS),
        } as Response);

        const items = await connector.fetch({});

        expect(items).toHaveLength(1);
        const item0 = items[0].rawData as {
          filterResult: { matchedKeywords: string[] };
        };
        expect(item0.filterResult.matchedKeywords).toContain(artist);
      });
    });
  });

  // ============================================================================
  // Argentinian Cities Detection Tests
  // ============================================================================

  describe("argentinian city detection", () => {
    const createMockRSS = (
      title: string,
      category: string,
    ) => `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Test</title>
    <item>
      <title>${title}</title>
      <link>https://lanacion.com.ar/test</link>
      <description>Test description</description>
      <pubDate>Mon, 20 Mar 2024 10:00:00 GMT</pubDate>
      <category>${category}</category>
    </item>
  </channel>
</rss>`;

    const testCities = [
      { city: "Tandil", title: "Festival de música en Tandil" },
      { city: "Mar del Plata", title: "Show en Mar del Plata este verano" },
      { city: "Buenos Aires", title: "Concierto en Buenos Aires" },
      { city: "Córdoba", title: "Gira llega a Córdoba" },
      { city: "Rosario", title: "Artista presenta show en Rosario" },
    ];

    testCities.forEach(({ city, title }) => {
      it(`should detect city "${city}"`, async () => {
        const mockRSS = createMockRSS(title, "Espectáculos");

        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockRSS),
        } as Response);

        const items = await connector.fetch({});

        expect(items).toHaveLength(1);
        const item0 = items[0].rawData as {
          filterResult: { matchedKeywords: string[] };
        };
        expect(item0.filterResult.matchedKeywords).toContain(city);
      });
    });
  });

  // ============================================================================
  // Combined Filter Tests
  // ============================================================================

  describe("combined filter (category + keyword)", () => {
    it("should pass when category matches and has show keyword", async () => {
      const mockRSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Festival de música en Tandil</title>
      <link>https://lanacion.com.ar/1</link>
      <description>Gran festival</description>
      <pubDate>Mon, 20 Mar 2024 10:00:00 GMT</pubDate>
      <category>Espectáculos</category>
    </item>
  </channel>
</rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      } as Response);

      const items = await connector.fetch({});

      expect(items).toHaveLength(1);
      const item0 = items[0].rawData as {
        filterResult: { passes: boolean; matchedKeywords: string[] };
      };
      expect(item0.filterResult.passes).toBe(true);
      expect(item0.filterResult.matchedKeywords).toContain("festival");
      expect(item0.filterResult.matchedKeywords).toContain("Tandil");
    });

    it("should pass when category matches and has artist name", async () => {
      const mockRSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Soda Stereo: nuevo disco anunciado</title>
      <link>https://lanacion.com.ar/1</link>
      <description>Noticia musical</description>
      <pubDate>Mon, 20 Mar 2024 10:00:00 GMT</pubDate>
      <category>Música</category>
    </item>
  </channel>
</rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      } as Response);

      const items = await connector.fetch({});

      expect(items).toHaveLength(1);
      const item0 = items[0].rawData as {
        filterResult: { passes: boolean; matchedKeywords: string[] };
      };
      expect(item0.filterResult.passes).toBe(true);
      expect(item0.filterResult.matchedKeywords).toContain("Soda Stereo");
    });

    it("should fail when category matches but no additional criteria", async () => {
      const mockRSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Noticia genérica de espectáculos</title>
      <link>https://lanacion.com.ar/1</link>
      <description>Sin keywords relevantes</description>
      <pubDate>Mon, 20 Mar 2024 10:00:00 GMT</pubDate>
      <category>Espectáculos</category>
    </item>
  </channel>
</rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      } as Response);

      const items = await connector.fetch({});

      expect(items).toHaveLength(0);
    });

    it("should fail when category is not in allowed list", async () => {
      const mockRSS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Duki en concierto</title>
      <link>https://lanacion.com.ar/1</link>
      <description>Noticia</description>
      <pubDate>Mon, 20 Mar 2024 10:00:00 GMT</pubDate>
      <category>Política</category>
    </item>
  </channel>
</rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      } as Response);

      const items = await connector.fetch({});

      expect(items).toHaveLength(0);
    });
  });

  // ============================================================================
  // Image Extraction Tests
  // ============================================================================

  describe("image extraction", () => {
    const createMockRSSWithImage = (imageTag: string) => `<?xml version="1.0"?>
<rss xmlns:media="http://search.yahoo.com/mrss/" version="2.0">
  <channel>
    <item>
      <title>Duki presenta show en Tandil</title>
      <link>https://lanacion.com.ar/1</link>
      <description>Descripción del concierto</description>
      <pubDate>Mon, 20 Mar 2024 10:00:00 GMT</pubDate>
      <category>Espectáculos</category>
      ${imageTag}
    </item>
  </channel>
</rss>`;

    it("should extract image from media:content", async () => {
      const mockRSS = createMockRSSWithImage(
        '<media:content url="https://lanacion.com.ar/img.jpg" medium="image" width="800" height="600"/>',
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      } as Response);

      const items = await connector.fetch({});
      const normalized = await connector.normalize(items[0]);

      expect(normalized.images).toHaveLength(1);
      expect(normalized.images?.[0].url).toBe(
        "https://lanacion.com.ar/img.jpg",
      );
      expect(normalized.images?.[0].source).toBe("lanacion");
    });

    it("should extract image from enclosure", async () => {
      const mockRSS = createMockRSSWithImage(
        '<enclosure url="https://lanacion.com.ar/enc.jpg" type="image/jpeg" length="12345"/>',
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      } as Response);

      const items = await connector.fetch({});
      const normalized = await connector.normalize(items[0]);

      expect(normalized.images).toHaveLength(1);
      expect(normalized.images?.[0].url).toBe(
        "https://lanacion.com.ar/enc.jpg",
      );
    });

    it("should extract image from content:encoded", async () => {
      const mockRSS = `<?xml version="1.0"?>
<rss xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
  <channel>
    <item>
      <title>Duki presenta show en Tandil</title>
      <link>https://lanacion.com.ar/1</link>
      <description>Desc</description>
      <content:encoded><![CDATA[<p>Content</p><img src="https://lanacion.com.ar/content-img.jpg" alt="test"/>]]></content:encoded>
      <pubDate>Mon, 20 Mar 2024 10:00:00 GMT</pubDate>
      <category>Espectáculos</category>
    </item>
  </channel>
</rss>`;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockRSS),
      } as Response);

      const items = await connector.fetch({});
      const normalized = await connector.normalize(items[0]);

      expect(normalized.images).toHaveLength(1);
      expect(normalized.images?.[0].url).toBe(
        "https://lanacion.com.ar/content-img.jpg",
      );
    });
  });

  // ============================================================================
  // Normalization Tests
  // ============================================================================

  describe("normalization to ContentFeedItem", () => {
    const createMockRawItem = (
      overrides: Partial<RawFeedItem> = {},
    ): RawFeedItem => ({
      sourceId: "lanacion",
      externalId: "test-id-123",
      rawData: {
        item: {
          title: "Duki presenta show en Tandil",
          link: "https://lanacion.com.ar/1",
          description: "El artista urbano llega a la ciudad con su nuevo tour",
          pubDate: "Mon, 20 Mar 2024 10:00:00 GMT",
          category: "Espectáculos",
          "dc:creator": "Redacción La Nación",
        },
        contentType: "trending",
        filterResult: {
          passes: true,
          reasons: [
            "Category match: Espectáculos",
            "Artists: Duki",
            "Cities: Tandil",
          ],
          matchedKeywords: ["Duki", "Tandil"],
        },
        fetchedAt: new Date().toISOString(),
      },
      fetchedAt: new Date(),
      ...overrides,
    });

    it("should normalize basic fields correctly", async () => {
      const raw = createMockRawItem();
      const normalized = await connector.normalize(raw);

      expect(normalized.source).toBe("lanacion");
      expect(normalized.sourceId).toBe("test-id-123");
      expect(normalized.sourceUrl).toBe("https://lanacion.com.ar/1");
      expect(normalized.title).toBe("Duki presenta show en Tandil");
      expect(normalized.isShared).toBe(true);
      expect(normalized.tenantId).toBeNull();
    });

    it("should generate hook from description", async () => {
      const raw = createMockRawItem();
      const normalized = await connector.normalize(raw);

      expect(normalized.hook).toBeTruthy();
      expect(normalized.hook.length).toBeLessThanOrEqual(100);
    });

    it("should set content type", async () => {
      const raw = createMockRawItem();
      const normalized = await connector.normalize(raw);

      expect(normalized.contentType).toBe("trending");
    });

    it("should detect breaking news content type", async () => {
      const raw = createMockRawItem({
        rawData: {
          item: {
            title: "Falleció reconocido músico argentino",
            link: "https://lanacion.com.ar/1",
            description: "Triste noticia",
            pubDate: "Mon, 20 Mar 2024 10:00:00 GMT",
            category: "Música",
          },
          contentType: "breaking_news",
          filterResult: {
            passes: true,
            reasons: ["Category match: Música"],
            matchedKeywords: [],
          },
          fetchedAt: new Date().toISOString(),
        },
      });

      const normalized = await connector.normalize(raw);

      expect(normalized.contentType).toBe("breaking_news");
    });

    it("should calculate viral score", async () => {
      const raw = createMockRawItem();
      const normalized = await connector.normalize(raw);

      expect(normalized.viralScore).toBeGreaterThan(50);
      expect(normalized.viralScore).toBeLessThanOrEqual(100);
    });

    it("should extract tags", async () => {
      const raw = createMockRawItem();
      const normalized = await connector.normalize(raw);

      expect(normalized.tags).toContain("lanacion");
      expect(normalized.tags).toContain("espectaculos");
      expect(normalized.tags).toContain("duki");
      expect(normalized.tags).toContain("tandil");
    });

    it("should calculate content hash", async () => {
      const raw = createMockRawItem();
      const normalized = await connector.normalize(raw);

      expect(normalized.contentHash).toBeTruthy();
      expect(normalized.contentHash.length).toBe(64); // SHA256
    });

    it("should set metadata", async () => {
      const raw = createMockRawItem();
      const normalized = await connector.normalize(raw);

      expect(normalized.metadata.pubDate).toBe("Mon, 20 Mar 2024 10:00:00 GMT");
      expect(normalized.metadata.author).toBe("Redacción La Nación");
      expect(normalized.metadata.categories).toContain("Espectáculos");
    });

    it("should set expiry for breaking news", async () => {
      const raw = createMockRawItem({
        rawData: {
          item: {
            title: "Breaking news",
            link: "https://lanacion.com.ar/1",
            description: "Urgent",
            pubDate: "Mon, 20 Mar 2024 10:00:00 GMT",
            category: "Espectáculos",
          },
          contentType: "breaking_news",
          filterResult: {
            passes: true,
            reasons: ["Category match"],
            matchedKeywords: [],
          },
          fetchedAt: new Date().toISOString(),
        },
      });

      const normalized = await connector.normalize(raw);

      expect(normalized.expiresAt).toBeInstanceOf(Date);
      expect(normalized.expiresAt!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  // ============================================================================
  // Hash Calculation Tests
  // ============================================================================

  describe("calculateHash", () => {
    it("should generate consistent hash", () => {
      const item: ContentFeedItem = {
        source: "lanacion",
        sourceId: "test-123",
        sourceUrl: "https://lanacion.com.ar/1",
        title: "Test Title",
        body: "Test body content",
        contentHash: "",
        tenantId: null,
        isShared: true,
        metadata: {},
        contentType: "trending",
        hook: "Test hook",
        facts: [],
        tags: ["test"],
        publishAt: new Date(),
        viralScore: 50,
      };

      const hash1 = connector.calculateHash(item);
      const hash2 = connector.calculateHash(item);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hash for different content", () => {
      const item1: ContentFeedItem = {
        source: "lanacion",
        sourceId: "test-1",
        sourceUrl: "https://lanacion.com.ar/1",
        title: "Title 1",
        body: "Body 1",
        contentHash: "",
        tenantId: null,
        isShared: true,
        metadata: {},
        contentType: "trending",
        hook: "Hook 1",
        facts: [],
        tags: ["test"],
        publishAt: new Date(),
        viralScore: 50,
      };

      const item2: ContentFeedItem = {
        source: "lanacion",
        sourceId: "test-2",
        sourceUrl: "https://lanacion.com.ar/2",
        title: "Title 2",
        body: "Body 2",
        contentHash: "",
        tenantId: null,
        isShared: true,
        metadata: {},
        contentType: "trending",
        hook: "Hook 2",
        facts: [],
        tags: ["test"],
        publishAt: new Date(),
        viralScore: 50,
      };

      const hash1 = connector.calculateHash(item1);
      const hash2 = connector.calculateHash(item2);

      expect(hash1).not.toBe(hash2);
    });
  });

  // ============================================================================
  // Health Check Tests
  // ============================================================================

  describe("health check", () => {
    it("should return healthy when feed is accessible", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      const health = await connector.health({});

      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeDefined();
    });

    it("should return unhealthy when feed is down", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const health = await connector.health({});

      expect(health.healthy).toBe(false);
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const health = await connector.health({});

      expect(health.healthy).toBe(false);
      expect(health.error).toContain("Network error");
    });
  });
});
