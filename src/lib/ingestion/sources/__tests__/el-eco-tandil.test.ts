/**
 * El Eco de Tandil Connector Tests - System A
 *
 * Tests for the El Eco de Tandil Espectáculos scraper including:
 * - HTML parsing with DOMParser
 * - Event type detection (shows, agenda, news)
 * - Date parsing (Spanish and English formats)
 * - Artist extraction
 * - News normalization
 * - URL resolution
 *
 * @module ingestion/sources/__tests__/el-eco-tandil.test
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ElEcoTandilConnector } from "../el-eco-tandil";
import type { RawEvent } from "../../types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("ElEcoTandilConnector", () => {
  let connector: ElEcoTandilConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    connector = new ElEcoTandilConnector();
  });

  describe("detectEventType (via parseHtml)", () => {
    it("should detect show/concert events from title", () => {
      const html = `
        <html>
          <body>
            <article class="post">
              <h2 class="entry-title">Las Pastillas del Abuelo se presentará en Tandil</h2>
              <time datetime="2026-04-15">15 de Abril</time>
              <p class="excerpt">La banda de rock nacional arrive a la ciudad.</p>
              <a href="/espectaculos/pastillas-del-abuelo/">Leer más</a>
            </article>
          </body>
        </html>
      `;

      const articles = (connector as any).parseHtml(html);

      expect(articles).toHaveLength(1);
      expect(articles[0].eventType).toBe("show");
      expect(articles[0].matchedKeywords).toContain("se presentará");
    });

    it("should detect cultural agenda content", () => {
      const html = `
        <html>
          <body>
            <article class="post">
              <h2 class="entry-title">Agenda cultural: todo para hacer este fin de semana</h2>
              <time datetime="2026-03-21">21 de Marzo</time>
              <p class="excerpt">Actividades culturales para toda la familia.</p>
              <a href="/espectaculos/agenda-cultural/">Leer más</a>
            </article>
          </body>
        </html>
      `;

      const articles = (connector as any).parseHtml(html);

      expect(articles).toHaveLength(1);
      expect(articles[0].eventType).toBe("agenda");
      expect(articles[0].matchedKeywords).toContain("agenda cultural");
    });

    it("should detect music news (falleció, nuevo disco)", () => {
      const html = `
        <html>
          <body>
            <article class="post">
              <h2 class="entry-title">Falleció Daniel Buira, baterista de Los Piojos</h2>
              <time datetime="2026-03-20">20 de Marzo</time>
              <p class="excerpt">Triste noticia para los amantes del rock.</p>
              <a href="/espectaculos/fallecio-buira/">Leer más</a>
            </article>
          </body>
        </html>
      `;

      const articles = (connector as any).parseHtml(html);

      expect(articles).toHaveLength(1);
      expect(articles[0].eventType).toBe("news");
      expect(articles[0].matchedKeywords).toContain("falleció");
    });

    it("should return null eventType for generic content", () => {
      const html = `
        <html>
          <body>
            <article class="post">
              <h2 class="entry-title">El artista local presenta su nueva colección</h2>
              <time datetime="2026-03-19">19 de Marzo</time>
              <p class="excerpt">Hablamos sobre el trabajo del autor.</p>
              <a href="/espectaculos/articulo-generico/">Leer más</a>
            </article>
          </body>
        </html>
      `;

      const articles = (connector as any).parseHtml(html);

      expect(articles).toHaveLength(1);
      expect(articles[0].eventType).toBeNull();
    });
  });

  describe("extractArtists", () => {
    it("should extract band names from content", () => {
      const html = `
        <html>
          <body>
            <article class="post">
              <h2 class="entry-title">Las Pastillas del Abuelo se presentará en Tandil</h2>
              <p class="excerpt">La banda de rock nacional se prepara para el show.</p>
              <a href="/espectaculos/pastillas/">Leer más</a>
            </article>
          </body>
        </html>
      `;

      const articles = (connector as any).parseHtml(html);

      expect(articles).toHaveLength(1);
      expect(articles[0].artists).toContain("Las Pastillas del Abuelo");
    });

    it("should extract multiple bands if mentioned", () => {
      const html = `
        <html>
          <body>
            <article class="post">
              <h2 class="entry-title">Los Piojos y Divididos juntos en Tandil</h2>
              <p class="excerpt">Dos bandas icónicas del rock nacional.</p>
              <a href="/espectaculos/rock-nacional/">Leer más</a>
            </article>
          </body>
        </html>
      `;

      const articles = (connector as any).parseHtml(html);

      expect(articles).toHaveLength(1);
      expect(articles[0].artists).toContain("Los Piojos");
      expect(articles[0].artists).toContain("Divididos");
    });

    it("should return undefined if no known bands found", () => {
      const html = `
        <html>
          <body>
            <article class="post">
              <h2 class="entry-title">Nuevo show en el teatro</h2>
              <p class="excerpt">No hay bandas específicas mencionadas.</p>
              <a href="/espectaculos/teatro/">Leer más</a>
            </article>
          </body>
        </html>
      `;

      const articles = (connector as any).parseHtml(html);

      expect(articles).toHaveLength(1);
      expect(articles[0].artists).toBeUndefined();
    });
  });

  describe("extractVenue", () => {
    it("should extract venue from content", () => {
      const html = `
        <html>
          <body>
            <article class="post">
              <h2 class="entry-title">Show en el Teatro del Fuerte</h2>
              <p class="excerpt">El evento será en el Teatro del Fuerte.</p>
              <a href="/espectaculos/show/">Leer más</a>
            </article>
          </body>
        </html>
      `;

      const articles = (connector as any).parseHtml(html);

      expect(articles).toHaveLength(1);
      expect(articles[0].venue).toBeTruthy();
      expect(articles[0].venue?.toLowerCase()).toContain("teatro del fuerte");
    });
  });

  describe("parseDate", () => {
    it("should parse Spanish date format '15 de marzo de 2024'", () => {
      const date = (connector as any).parseDate("15 de marzo de 2024");
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(2); // March is 2
      expect(date.getDate()).toBe(15);
    });

    it("should parse DD/MM/YYYY format", () => {
      const date = (connector as any).parseDate("15/03/2024");
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(2);
      expect(date.getDate()).toBe(15);
    });

    it("should parse ISO format YYYY-MM-DD", () => {
      const date = (connector as any).parseDate("2024-03-15");
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(2);
      expect(date.getDate()).toBe(15);
    });

    it("should fallback to current date on unparseable string", () => {
      const before = new Date();
      const date = (connector as any).parseDate("not-a-date");
      const after = new Date();

      expect(date.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(date.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("resolveUrl", () => {
    it("should return BASE_URL for empty string", () => {
      const url = (connector as any).resolveUrl("");
      expect(url).toBe("https://www.eleco.com.ar/espectaculos/");
    });

    it("should pass through absolute URLs", () => {
      const url = (connector as any).resolveUrl("https://example.com/article");
      expect(url).toBe("https://example.com/article");
    });

    it("should resolve relative paths starting with /", () => {
      const url = (connector as any).resolveUrl("/espectaculos/article/123");
      expect(url).toBe("https://www.eleco.com.ar/espectaculos/article/123");
    });
  });

  describe("resolveImageUrl", () => {
    it("should return undefined for empty string", () => {
      const url = (connector as any).resolveImageUrl("");
      expect(url).toBeUndefined();
    });

    it("should pass through absolute URLs", () => {
      const url = (connector as any).resolveImageUrl(
        "https://cdn.example.com/image.jpg",
      );
      expect(url).toBe("https://cdn.example.com/image.jpg");
    });

    it("should resolve protocol-relative URLs", () => {
      const url = (connector as any).resolveImageUrl(
        "//cdn.example.com/img.jpg",
      );
      expect(url).toBe("https://cdn.example.com/img.jpg");
    });

    it("should resolve root-relative URLs", () => {
      const url = (connector as any).resolveImageUrl("/images/article.jpg");
      expect(url).toBe("https://www.eleco.com.ar/images/article.jpg");
    });
  });

  describe("extractLocation", () => {
    it("should return default Tandil location for undefined input", () => {
      const location = (connector as any).extractLocation(undefined);
      expect(location.city).toBe("Tandil");
      expect(location.region).toBe("Buenos Aires");
      expect(location.country).toBe("Argentina");
      expect(location.venue).toBeUndefined();
    });

    it("should include venue when provided", () => {
      const location = (connector as any).extractLocation("Teatro del Fuerte");
      expect(location.city).toBe("Tandil");
      expect(location.venue).toBe("Teatro del Fuerte");
    });
  });

  describe("parseHtml with regex fallback", () => {
    it("should extract events from article tags", () => {
      const html = `
        <html>
          <body>
            <article class="post">
              <h2>Concierto en Tandil</h2>
              <time datetime="2024-03-15">15 de Marzo</time>
              <p>Gran concierto de rock</p>
              <a href="/espectaculos/concierto/">Ver más</a>
              <img src="/images/concierto.jpg" />
            </article>
          </body>
        </html>
      `;

      const articles = (connector as any).parseHtml(html);

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe("Concierto en Tandil");
      expect(articles[0].date).toBe("2024-03-15");
      expect(articles[0].description).toBe("Gran concierto de rock");
    });

    it("should extract multiple articles", () => {
      const html = `
        <html>
          <body>
            <article class="post">
              <h2>Artículo 1</h2>
              <p>Descripción 1</p>
              <a href="/1">Leer</a>
            </article>
            <article class="post">
              <h2>Artículo 2</h2>
              <p>Descripción 2</p>
              <a href="/2">Leer</a>
            </article>
          </body>
        </html>
      `;

      const articles = (connector as any).parseHtml(html);

      expect(articles).toHaveLength(2);
      expect(articles[0].title).toBe("Artículo 1");
      expect(articles[1].title).toBe("Artículo 2");
    });

    it("should return empty array when no article containers found", () => {
      const html = `
        <html>
          <body>
            <div class="random-content">
              <p>No articles here</p>
            </div>
          </body>
        </html>
      `;

      const articles = (connector as any).parseHtml(html);

      expect(articles).toHaveLength(0);
    });

    it("should skip elements without title", () => {
      const html = `
        <html>
          <body>
            <article class="post">
              <p>Solo descripción, sin título</p>
            </article>
          </body>
        </html>
      `;

      const articles = (connector as any).parseHtml(html);

      expect(articles).toHaveLength(0);
    });
  });

  describe("fetch and normalize integration", () => {
    it("should fetch HTML and normalize events", async () => {
      const mockHtml = `
        <html>
          <body>
            <article class="post">
              <h2>Las Pastillas del Abuelo en Tandil</h2>
              <time datetime="2026-04-15">15 de Abril de 2026</time>
              <p class="excerpt">La banda se presentará en la ciudad.</p>
              <a href="/espectaculos/pastillas-tandil/">Más info</a>
              <img src="/images/pastillas.jpg" />
            </article>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(mockHtml),
      } as Response);

      const events = await connector.fetch({});

      expect(events).toHaveLength(1);
      expect((events[0].rawData as any).title).toBe(
        "Las Pastillas del Abuelo en Tandil",
      );
    });

    it("should throw on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      await expect(connector.fetch({})).rejects.toThrow("HTTP 404: Not Found");
    });
  });

  describe("normalize", () => {
    it("should normalize show article to HIGH priority", async () => {
      const rawEvent: RawEvent = {
        sourceId: "el_eco_tandil",
        externalId: "eleco-abc123",
        rawData: {
          title: "Las Pastillas del Abuelo se presentará en Tandil",
          url: "https://www.eleco.com.ar/espectaculos/pastillas/",
          date: "2026-04-15",
          description: "La banda de rock nacional arrive a la ciudad.",
          imageUrl: "https://www.eleco.com.ar/images/pastillas.jpg",
          eventType: "show",
          artists: ["Las Pastillas del Abuelo"],
          venue: "Teatro del Fuerte",
          matchedKeywords: ["se presentará"],
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(rawEvent);

      expect(normalized.source).toBe("el_eco_tandil");
      expect(normalized.title).toBe(
        "Las Pastillas del Abuelo se presentará en Tandil",
      );
      expect(normalized.eventDate).toBe("2026-04-15");
      expect(normalized.year).toBe(2026);
      expect(normalized.eventType).toBe("concert");
      expect(normalized.priority).toBe(1); // PRIORITY.HIGH
      expect(normalized.tags).toContain("musica");
      expect(normalized.tags).toContain("show");
      expect(normalized.location?.venue).toBe("Teatro del Fuerte");
      expect(normalized.artists).toHaveLength(1);
      expect(normalized.artists?.[0].name).toBe("Las Pastillas del Abuelo");
    });

    it("should normalize agenda article to MEDIUM priority", async () => {
      const rawEvent: RawEvent = {
        sourceId: "el_eco_tandil",
        externalId: "eleco-def456",
        rawData: {
          title: "Agenda cultural: fin de semana en Tandil",
          url: "https://www.eleco.com.ar/espectaculos/agenda/",
          date: "2026-03-21",
          description: "Muchas actividades para el fin de semana.",
          eventType: "agenda",
          matchedKeywords: ["agenda cultural", "fin de semana"],
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(rawEvent);

      expect(normalized.eventType).toBe("festival");
      expect(normalized.priority).toBe(2); // PRIORITY.MEDIUM
      expect(normalized.tags).toContain("agenda");
      expect(normalized.tags).toContain("cultural");
    });

    it("should normalize news article to LOW priority", async () => {
      const rawEvent: RawEvent = {
        sourceId: "el_eco_tandil",
        externalId: "eleco-ghi789",
        rawData: {
          title: "Falleció Daniel Buira, baterista de Los Piojos",
          url: "https://www.eleco.com.ar/espectaculos/fallecio-buira/",
          date: "2026-03-20",
          description: "Triste noticia para el rock nacional.",
          eventType: "news",
          artists: ["Los Piojos"],
          matchedKeywords: ["falleció"],
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(rawEvent);

      expect(normalized.eventType).toBe("local_event");
      expect(normalized.priority).toBe(3); // PRIORITY.LOW
    });

    it("should use BASE_URL when article has no URL", async () => {
      const rawEvent: RawEvent = {
        sourceId: "el_eco_tandil",
        externalId: "eleco-abc123",
        rawData: {
          title: "Artículo sin URL",
          date: "2026-03-15",
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(rawEvent);

      expect(normalized.sourceUrl).toBe(
        "https://www.eleco.com.ar/espectaculos/",
      );
    });

    it("should not include images when imageUrl is empty", async () => {
      const rawEvent: RawEvent = {
        sourceId: "el_eco_tandil",
        externalId: "eleco-abc123",
        rawData: {
          title: "Artículo",
          date: "2026-03-15",
          imageUrl: "",
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(rawEvent);

      expect(normalized.images).toBeUndefined();
    });

    it("should include images when imageUrl is provided", async () => {
      const rawEvent: RawEvent = {
        sourceId: "el_eco_tandil",
        externalId: "eleco-abc123",
        rawData: {
          title: "Artículo",
          date: "2026-03-15",
          imageUrl: "https://www.eleco.com.ar/images/article.jpg",
        },
        fetchedAt: new Date(),
      };

      const normalized = await connector.normalize(rawEvent);

      expect(normalized.images).toHaveLength(1);
      expect(normalized.images?.[0].url).toBe(
        "https://www.eleco.com.ar/images/article.jpg",
      );
    });
  });

  describe("calculateHash", () => {
    it("should generate consistent hash for same event", () => {
      const event1 = {
        title: "Concert",
        eventDate: new Date("2026-04-15"),
        location: { venue: "Teatro del Fuerte" },
      };

      const event2 = {
        title: "Concert",
        eventDate: new Date("2026-04-15"),
        location: { venue: "Teatro del Fuerte" },
      };

      const hash1 = connector.calculateHash(event1 as any);
      const hash2 = connector.calculateHash(event2 as any);

      expect(hash1).toBe(hash2);
    });

    it("should generate different hash for different events", () => {
      const event1 = {
        title: "Concert 1",
        eventDate: new Date("2026-04-15"),
        location: { venue: "Venue" },
      };

      const event2 = {
        title: "Concert 2",
        eventDate: new Date("2026-04-15"),
        location: { venue: "Venue" },
      };

      const hash1 = connector.calculateHash(event1 as any);
      const hash2 = connector.calculateHash(event2 as any);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe("health", () => {
    it("should perform health check", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      const health = await connector.health({});

      expect(health.healthy).toBe(true);
    });

    it("should report unhealthy on fetch failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const health = await connector.health({});

      expect(health.healthy).toBe(false);
      expect(health.error).toBe("Network error");
    });
  });

  describe("generateExternalId", () => {
    it("should generate consistent external ID for same article", () => {
      const article1 = { title: "Article", date: "2026-03-15" };
      const article2 = { title: "Article", date: "2026-03-15" };

      const id1 = (connector as any).generateExternalId(article1);
      const id2 = (connector as any).generateExternalId(article2);

      expect(id1).toBe(id2);
    });

    it("should generate different IDs for different articles", () => {
      const article1 = { title: "Article 1", date: "2026-03-15" };
      const article2 = { title: "Article 2", date: "2026-03-15" };

      const id1 = (connector as any).generateExternalId(article1);
      const id2 = (connector as any).generateExternalId(article2);

      expect(id1).not.toBe(id2);
    });

    it("should prefix ID with 'eleco-'", () => {
      const article = { title: "Test Article", date: "2026-03-15" };
      const id = (connector as any).generateExternalId(article);
      expect(id.startsWith("eleco-")).toBe(true);
    });
  });
});
