/**
 * El Eco de Tandil - Espectáculos Scraper
 *
 * Scrapes entertainment news from El Eco de Tandil's Espectáculos section.
 * This is a tenant-local source (not shared) - only for envivo-tandil tenant.
 *
 * Intelligent event detection:
 * - Type A: Shows/Concerts (HIGH priority) - "se presentará", "show", "recital", "gira"
 * - Type B: Cultural Agenda (MEDIUM priority) - "agenda cultural", "fin de semana"
 * - Type C: Music News (LOW priority) - "falleció", "nuevo disco", "lanzamiento"
 *
 * Uses DOMParser for robust HTML parsing with regex fallback.
 *
 * @module ingestion/sources/el-eco-tandil
 */

import { BaseConnector } from "../base-connector";
import { PRIORITY } from "../types";
import type {
  ConnectorContext,
  HealthStatus,
  NormalizedEvent,
  RawEvent,
  SourceType,
} from "../types";

// ============================================================================
// Types
// ============================================================================

interface ScrapedNews {
  title: string;
  url: string;
  date: string;
  description?: string;
  imageUrl?: string;
  /** Detected event type based on keywords */
  eventType?: "show" | "agenda" | "news" | null;
  /** Extracted artists/bands from title or content */
  artists?: string[];
  /** Extracted venue/location if mentioned */
  venue?: string;
  /** Keywords that matched for event type detection */
  matchedKeywords?: string[];
}

// ============================================================================
// Constants
// ============================================================================

const SOURCE_NAME = "el_eco_tandil";
const SOURCE_TYPE: SourceType = "scraper";

/**
 * Base URL for El Eco Espectáculos section.
 */
const BASE_URL = "https://www.eleco.com.ar/espectaculos/";

/**
 * Pagination pattern for Espectáculos section.
 */
const PAGINATION_URL = (page: number) =>
  page === 1 ? BASE_URL : `${BASE_URL}page/${page}/`;

/**
 * CSS selectors for extracting news data from El Eco.
 * First matching selector in each array wins.
 */
const SELECTORS = {
  /** Article containers in the news listing */
  articleContainer: [
    "article.post",
    "article[class*='post']",
    "article",
    "div[class*='post-item']",
    "div[class*='entry']",
    "[class*='noticia']",
    ".post",
  ],
  /** Title within article */
  title: [
    "h2[class*='title']",
    "h3[class*='title']",
    "h2[class*='entry-title']",
    ".post-title",
    "[class*='title'] h2",
    "[class*='title'] h3",
    "h2",
    "h3",
  ],
  /** Date publication */
  date: [
    "time[datetime]",
    ".post-date",
    ".entry-date",
    "[class*='date']",
    "[class*='publicado']",
    "span[class*='fecha']",
  ],
  /** Excerpt/description */
  description: [
    ".post-excerpt",
    ".entry-excerpt",
    ".extracto",
    "[class*='excerpt']",
    "[class*='description']",
    "p",
  ],
  /** Link to full article */
  link: "a[href]",
  /** Featured image */
  image: "img[src]",
  /** Container for image (optional wrapper) */
  imageContainer: [
    "[class*='featured'] img",
    "[class*='thumbnail'] img",
    ".post-thumbnail img",
    ".wp-post-image",
  ],
} as const;

/**
 * Keywords for detecting show/concert events (HIGH priority).
 */
const SHOW_KEYWORDS = [
  "se presentará",
  "se presentara",
  "show",
  "recital",
  "concierto",
  "gira",
  "en vivo",
  "tour",
  "presentación",
  "presentacion",
  "fecha",
  "tickets",
  "entradas",
  "lugar del evento",
  "venue",
];

/**
 * Keywords for detecting cultural agenda content (MEDIUM priority).
 */
const AGENDA_KEYWORDS = [
  "agenda cultural",
  "fin de semana",
  "actividades",
  "eventos",
  "qué hacer",
  "que hacer",
  "programación",
  "programacion",
  "cultural",
  "actividades para",
];

/**
 * Keywords for detecting music news (LOW priority).
 */
const NEWS_KEYWORDS = [
  "falleció",
  "fallecio",
  "murió",
  "murio",
  "nuevo disco",
  "lanzamiento",
  "entrevista",
  "anuncio",
  "confirmó",
  "confirma",
  "nueva canción",
  "nueva cancion",
  "álbum",
  "album",
];

/**
 * Date format patterns for parsing various date string formats.
 */
const DATE_PATTERNS: ReadonlyArray<{
  readonly regex: RegExp;
  readonly parse: (match: RegExpMatchArray) => Date;
}> = [
  {
    // "15 de marzo de 2024" - Spanish format
    regex: /(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
    parse: (match: RegExpMatchArray): Date => {
      const day = parseInt(match[1], 10);
      const monthStr = match[2].toLowerCase();
      const year = parseInt(match[3], 10);
      const month = MONTH_MAP[monthStr] ?? 0;
      return new Date(year, month, day);
    },
  },
  {
    // "15/03/2024" or "15-03-2024" - DD/MM/YYYY
    regex: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    parse: (match: RegExpMatchArray): Date => {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      return new Date(year, month, day);
    },
  },
  {
    // "2024-03-15" - ISO format
    regex: /(\d{4})-(\d{2})-(\d{2})/,
    parse: (match: RegExpMatchArray): Date => {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new Date(year, month, day);
    },
  },
  {
    // "March 15, 2024" - English format
    regex: /(\w+)\s+(\d{1,2}),?\s+(\d{4})/i,
    parse: (match: RegExpMatchArray): Date => {
      const monthStr = match[1].toLowerCase();
      const month = MONTH_MAP[monthStr] ?? 0;
      const day = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      return new Date(year, month, day);
    },
  },
];

/**
 * Month name mappings (Spanish and English).
 */
const MONTH_MAP: Record<string, number> = {
  enero: 0,
  january: 0,
  feb: 1,
  february: 1,
  febrero: 1,
  mar: 2,
  march: 2,
  marzo: 2,
  abr: 3,
  april: 3,
  abril: 3,
  may: 4,
  mayo: 4,
  jun: 5,
  june: 5,
  junio: 5,
  jul: 6,
  july: 6,
  julio: 6,
  ago: 7,
  aug: 7,
  august: 7,
  agosto: 7,
  sep: 8,
  september: 8,
  septiembre: 8,
  oct: 9,
  october: 9,
  octubre: 9,
  nov: 10,
  november: 10,
  noviembre: 10,
  dic: 11,
  dec: 11,
  december: 11,
  diciembre: 11,
};

/**
 * Common Argentine music venues in Tandil for location extraction.
 */
const TANDIL_VENUES = [
  "teatro del fuerte",
  "teatro de la ciudad",
  "plaza central",
  "plaza independence",
  "anfiteatro",
  "centro cultural",
  "sede social",
  "club",
  "estadio",
  "salón",
  "salon",
  " venue",
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get envivo-tandil tenant ID from environment.
 */
function getTandilTenantId(): string {
  return (
    process.env.TENVIVO_TANDIL_TENANT_ID ||
    process.env.TANDIL_TENANT_ID ||
    "00000000-0000-0000-0000-000000000000"
  );
}

/**
 * DOMParser factory - uses native implementation in Node.js 19+.
 */
function createDOMParser(): DOMParser {
  if (typeof DOMParser !== "undefined") {
    return new DOMParser();
  }
  throw new Error("DOMParser not available");
}

/**
 * Query first matching element from an array of selectors.
 */
function queryFirst(
  parent: Element | Document,
  selectors: readonly string[],
): Element | null {
  for (const selector of selectors) {
    try {
      const element = parent.querySelector(selector);
      if (element) {
        return element;
      }
    } catch {
      // Invalid selector, skip
      continue;
    }
  }
  return null;
}

/**
 * Query all matching elements from an array of selectors.
 */
function queryAll(
  parent: Element | Document,
  selectors: readonly string[],
): Element[] {
  const results: Element[] = [];
  for (const selector of selectors) {
    try {
      const elements = parent.querySelectorAll(selector);
      results.push(...Array.from(elements));
    } catch {
      // Invalid selector, skip
      continue;
    }
  }
  return results;
}

/**
 * Detect event type based on keywords in text.
 * Returns the highest priority match (shows > agenda > news).
 */
function detectEventType(text: string): {
  type: "show" | "agenda" | "news" | null;
  matchedKeywords: string[];
} {
  const lowerText = text.toLowerCase();

  // Check for show/recital keywords first (HIGH priority)
  const showMatches = SHOW_KEYWORDS.filter((kw) => lowerText.includes(kw));
  if (showMatches.length > 0) {
    return { type: "show", matchedKeywords: showMatches };
  }

  // Check for agenda keywords (MEDIUM priority)
  const agendaMatches = AGENDA_KEYWORDS.filter((kw) => lowerText.includes(kw));
  if (agendaMatches.length > 0) {
    return { type: "agenda", matchedKeywords: agendaMatches };
  }

  // Check for news keywords (LOW priority)
  const newsMatches = NEWS_KEYWORDS.filter((kw) => lowerText.includes(kw));
  if (newsMatches.length > 0) {
    return { type: "news", matchedKeywords: newsMatches };
  }

  return { type: null, matchedKeywords: [] };
}

/**
 * Extract potential artist/band names from text.
 * This is a simple heuristic-based extraction.
 */
function extractArtists(text: string): string[] {
  const artists: string[] = [];
  const lowerText = text.toLowerCase();

  // Known bands that might appear in Argentine music news
  const knownBands = [
    "las pastillas del abuelo",
    "pastillas del abuelo",
    "los piojos",
    "enanos verdes",
    "la renga",
    "ciro",
    "ciro y los persas",
    "los rodatos",
    "fito paez",
    "charly garcia",
    "soda stereo",
    "gustavo cerati",
    "andrés calamonte",
    "babasonicos",
    "divididos",
    "callejeros",
    "pelusón",
    "miranda",
    "tan biónica",
    "litto nebbia",
    "la mafia",
    "los fabulosos cadillacs",
    "marciano",
    "ciro",
  ];

  for (const band of knownBands) {
    if (lowerText.includes(band)) {
      // Capitalize properly for the matched band
      const match = text.match(new RegExp(band, "i"));
      if (match) {
        artists.push(match[0]);
      }
    }
  }

  // Remove duplicates
  return [...new Set(artists)];
}

/**
 * Extract venue/location from text.
 */
function extractVenue(text: string): string | undefined {
  const lowerText = text.toLowerCase();

  for (const venue of TANDIL_VENUES) {
    if (lowerText.includes(venue)) {
      // Find the venue phrase in original text
      const match = text.match(new RegExp(`.{0,20}${venue}.{0,20}`, "i"));
      if (match) {
        return match[0].trim();
      }
    }
  }

  return undefined;
}

// ============================================================================
// Connector Implementation
// ============================================================================

export class ElEcoTandilConnector extends BaseConnector<NormalizedEvent> {
  readonly name = SOURCE_NAME;
  readonly sourceType = SOURCE_TYPE;

  private tenantId: string;
  private domParser: DOMParser | null = null;

  constructor(
    config?: Partial<ConstructorParameters<typeof BaseConnector>[0]> & {
      tenantId?: string;
      baseUrl?: string;
    },
  ) {
    const resolvedTenantId = config?.tenantId || getTandilTenantId();

    super({
      sourceId: SOURCE_NAME,
      sourceType: SOURCE_TYPE,
      isShared: false,
      tenantId: resolvedTenantId,
      retryConfig: {
        maxRetries: 3,
        backoffMs: 2000,
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeoutMs: 600000,
      },
      ...config,
    });

    this.tenantId = resolvedTenantId;
  }

  // ============================================================================
  // BaseConnector Abstract Methods
  // ============================================================================

  /**
   * Fetch news articles from El Eco Espectáculos section.
   * Fetches from first page and can paginate if configured.
   */
  async fetch(ctx: ConnectorContext): Promise<RawEvent[]> {
    const url = this.config.baseUrl || BASE_URL;
    const maxPages = ctx.cursor ? parseInt(ctx.cursor, 10) : 1;

    this.log("info", `Fetching El Eco Espectáculos from ${url}`);

    try {
      const allNews: ScrapedNews[] = [];

      // Fetch first page (and subsequent pages if needed)
      for (let page = 1; page <= maxPages; page++) {
        const pageUrl = page === 1 ? url : PAGINATION_URL(page);

        this.log("debug", `Fetching page ${page}: ${pageUrl}`);

        const response = await fetch(pageUrl, {
          method: "GET",
          headers: {
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
            "User-Agent":
              "Mozilla/5.0 (compatible; EnvivoStudio/1.0; content-ingestion)",
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const pageNews = this.parseHtml(html);

        this.log(
          "debug",
          `Extracted ${pageNews.length} articles from page ${page}`,
        );

        allNews.push(...pageNews);

        // Rate limiting - be respectful to the source
        if (page < maxPages) {
          await this.delay(1000);
        }
      }

      this.log("info", `Extracted ${allNews.length} total articles`);

      return allNews.map((news) => this.toRawEvent(news));
    } catch (error) {
      this.log("error", "Failed to fetch El Eco Espectáculos", {
        error: this.getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Normalize a scraped news article to NormalizedEvent format.
   */
  async normalize(raw: RawEvent): Promise<NormalizedEvent> {
    const news = raw.rawData as ScrapedNews;

    const parsedDate = this.parseDate(news.date);
    const dateStr = parsedDate.toISOString().split("T")[0];

    // Determine priority based on event type detection
    const priority = this.determinePriority(news.eventType);

    // Build tags based on event type and matched keywords
    const tags = this.buildTags(news);

    // Extract artists if found
    const artists = news.artists?.length
      ? news.artists.map((name) => ({
          name,
          normalizedName: name.toLowerCase().trim(),
        }))
      : undefined;

    return {
      source: SOURCE_NAME,
      sourceId: raw.externalId,
      sourceUrl: news.url || BASE_URL,
      title: news.title,
      contentHash: this.calculateHashFromNews(news, dateStr),
      tenantId: this.tenantId,
      isShared: false,
      metadata: {
        originalDateRaw: news.date,
        originalDescriptionRaw: news.description,
        scrapedAt: raw.fetchedAt,
        eventType: news.eventType,
        matchedKeywords: news.matchedKeywords,
      },
      eventType: this.mapEventType(news.eventType),
      eventDate: dateStr,
      year: parsedDate.getFullYear(),
      location: this.extractLocation(news.venue),
      artists,
      images: news.imageUrl
        ? [
            {
              url: news.imageUrl,
              source: SOURCE_NAME,
              caption: news.title,
              license: undefined,
            },
          ]
        : undefined,
      tags,
      description: news.description,
      priority,
    };
  }

  /**
   * Calculate content hash for deduplication.
   */
  calculateHash(item: NormalizedEvent): string {
    return this.hashString(
      `${item.title}|${item.eventDate}|${item.location?.venue || ""}`,
    );
  }

  /**
   * Health check for El Eco website.
   */
  async health(_ctx: ConnectorContext): Promise<HealthStatus> {
    return this.defaultHealthCheck(BASE_URL, 10000);
  }

  // ============================================================================
  // Private Methods - HTML Parsing
  // ============================================================================

  /**
   * Parse HTML to extract news articles.
   */
  private parseHtml(html: string): ScrapedNews[] {
    // Try DOMParser first (Node.js 19+)
    try {
      if (!this.domParser) {
        this.domParser = createDOMParser();
      }

      const doc = this.domParser.parseFromString(html, "text/html");
      const articles = this.extractArticlesFromDocument(doc);

      if (articles.length > 0) {
        return articles;
      }
    } catch {
      this.log("debug", "DOMParser not available, using regex fallback");
    }

    // Fallback to regex-based parsing
    return this.parseHtmlWithRegex(html);
  }

  /**
   * Extract articles from a parsed DOM document.
   */
  private extractArticlesFromDocument(doc: Document): ScrapedNews[] {
    const articles: ScrapedNews[] = [];

    // Find article containers
    const containers = queryAll(doc, SELECTORS.articleContainer);

    if (containers.length === 0) {
      this.log("warn", "No article containers found in DOM");
      return articles;
    }

    for (const container of containers) {
      const article = this.extractArticleFromElement(container);
      if (article) {
        articles.push(article);
      }
    }

    return articles;
  }

  /**
   * Extract article data from a DOM element.
   */
  private extractArticleFromElement(container: Element): ScrapedNews | null {
    // Extract title
    const titleEl = queryFirst(container, SELECTORS.title);
    const title = titleEl?.textContent?.trim() || "";

    if (!title) {
      return null;
    }

    // Extract date
    const dateEl = queryFirst(container, SELECTORS.date);
    let dateStr = "";

    if (dateEl) {
      if (dateEl.tagName === "TIME" && dateEl.hasAttribute("datetime")) {
        dateStr = dateEl.getAttribute("datetime") || "";
      } else {
        dateStr = dateEl.textContent?.trim() || "";
      }
    }

    // Extract description
    const descEl = queryFirst(container, SELECTORS.description);
    const description = descEl?.textContent?.trim();

    // Extract link to full article
    const linkEl = container.querySelector(SELECTORS.link);
    let url = "";
    if (linkEl) {
      const href = linkEl.getAttribute("href") || "";
      // Get the href from the link, preferring the first valid one
      if (href && !href.startsWith("#") && !href.startsWith("javascript")) {
        url = href;
      }
    }

    // Try to find image
    let imageUrl: string | undefined;
    const imgContainer = queryFirst(container, SELECTORS.imageContainer);
    if (imgContainer) {
      imageUrl = imgContainer.getAttribute("src") || undefined;
    }
    if (!imageUrl) {
      const imgEl = container.querySelector(SELECTORS.image);
      imageUrl = imgEl?.getAttribute("src") || undefined;
    }

    // Detect event type and matched keywords
    const combinedText = `${title} ${description || ""}`;
    const eventDetection = detectEventType(combinedText);

    // Extract artists
    const artists = extractArtists(combinedText);

    // Extract venue
    const venue = extractVenue(combinedText);

    const resolvedUrl = this.resolveUrl(url);

    return {
      title,
      url: resolvedUrl,
      date: dateStr || new Date().toISOString().split("T")[0],
      description: description || undefined,
      imageUrl: this.resolveImageUrl(imageUrl),
      eventType: eventDetection.type,
      artists: artists.length > 0 ? artists : undefined,
      venue,
      matchedKeywords:
        eventDetection.matchedKeywords.length > 0
          ? eventDetection.matchedKeywords
          : undefined,
    };
  }

  /**
   * Regex-based HTML parsing fallback.
   */
  private parseHtmlWithRegex(html: string): ScrapedNews[] {
    const articles: ScrapedNews[] = [];

    // Try article tags
    const articleMatches = html.matchAll(
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
    );

    for (const match of articleMatches) {
      const article = this.extractArticleFromHtml(match[1]);
      if (article) {
        articles.push(article);
      }
    }

    if (articles.length === 0) {
      this.log("warn", "Could not find article containers in HTML");
    }

    return articles;
  }

  /**
   * Extract article data from HTML string (regex fallback).
   */
  private extractArticleFromHtml(html: string): ScrapedNews | null {
    // Extract title - look for h2 or h3
    const titleMatch = html.match(/<h[23][^>]*>([^<]+)<\/h[23]>/i);
    const title = titleMatch?.[1]?.trim();

    if (!title) {
      return null;
    }

    // Extract date
    const dateMatch =
      html.match(/datetime="([^"]+)"/) ||
      html.match(/(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i) ||
      html.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/) ||
      html.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch?.[1]?.trim() || "";

    // Extract description - first paragraph
    const descMatch = html.match(/<p[^>]*>([^<]+)<\/p>/i);
    const description = descMatch?.[1]?.trim();

    // Extract link
    const linkMatch = html.match(/<a[^>]+href="([^"]+)"[^>]*>/i);
    const url = linkMatch?.[1]?.trim() || "";

    // Extract image
    const imgMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
    const imageUrl = imgMatch?.[1]?.trim();

    // Detect event type
    const combinedText = `${title} ${description || ""}`;
    const eventDetection = detectEventType(combinedText);

    // Extract artists and venue
    const artists = extractArtists(combinedText);
    const venue = extractVenue(combinedText);

    return {
      title,
      url: this.resolveUrl(url),
      date: date || new Date().toISOString().split("T")[0],
      description: description || undefined,
      imageUrl: this.resolveImageUrl(imageUrl),
      eventType: eventDetection.type,
      artists: artists.length > 0 ? artists : undefined,
      venue,
      matchedKeywords:
        eventDetection.matchedKeywords.length > 0
          ? eventDetection.matchedKeywords
          : undefined,
    };
  }

  // ============================================================================
  // Private Methods - URL Resolution
  // ============================================================================

  /**
   * Resolve a potentially relative URL to an absolute URL.
   */
  private resolveUrl(url: string): string {
    if (!url) {
      return BASE_URL;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    if (url.startsWith("/")) {
      const origin = new URL(BASE_URL).origin;
      return `${origin}${url}`;
    }
    return `${BASE_URL}${url}`;
  }

  /**
   * Resolve a potentially relative image URL.
   */
  private resolveImageUrl(url: string | undefined): string | undefined {
    if (!url) {
      return undefined;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    if (url.startsWith("//")) {
      return `https:${url}`;
    }
    if (url.startsWith("/")) {
      const origin = new URL(BASE_URL).origin;
      return `${origin}${url}`;
    }
    return undefined;
  }

  // ============================================================================
  // Private Methods - Data Transformation
  // ============================================================================

  /**
   * Convert scraped news to RawEvent format.
   */
  private toRawEvent(news: ScrapedNews): RawEvent {
    return {
      sourceId: SOURCE_NAME,
      externalId: this.generateExternalId(news),
      rawData: news,
      fetchedAt: new Date(),
    };
  }

  /**
   * Generate unique external ID.
   */
  private generateExternalId(news: ScrapedNews): string {
    const key = `${news.title}|${news.date}`;
    return `eleco-${this.shortHash(key)}`;
  }

  /**
   * Parse date string to Date object.
   */
  private parseDate(dateStr: string): Date {
    for (const pattern of DATE_PATTERNS) {
      const match = dateStr.match(pattern.regex);
      if (match) {
        try {
          return pattern.parse(match);
        } catch {
          // Continue to next pattern
        }
      }
    }

    // Try native Date parsing as fallback
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    this.log("warn", `Could not parse date: ${dateStr}, using today`);
    return new Date();
  }

  /**
   * Determine priority based on detected event type.
   */
  private determinePriority(
    eventType: "show" | "agenda" | "news" | null | undefined,
  ): number {
    switch (eventType) {
      case "show":
        return PRIORITY.HIGH;
      case "agenda":
        return PRIORITY.MEDIUM;
      case "news":
        return PRIORITY.LOW;
      default:
        return PRIORITY.MEDIUM;
    }
  }

  /**
   * Map internal event type to system event type.
   */
  private mapEventType(
    eventType: "show" | "agenda" | "news" | null | undefined,
  ): "concert" | "festival" | "local_event" {
    switch (eventType) {
      case "show":
        return "concert";
      case "agenda":
        return "festival";
      default:
        return "local_event";
    }
  }

  /**
   * Build tags array based on detected content.
   */
  private buildTags(news: ScrapedNews): string[] {
    const tags = ["tandil", "el-eco", "espectaculos"];

    // Add event type tag
    if (news.eventType) {
      tags.push(news.eventType);
    }

    // Add music tag if artists detected or keywords suggest music
    if (
      news.artists?.length ||
      news.matchedKeywords?.some((kw) => SHOW_KEYWORDS.includes(kw))
    ) {
      tags.push("musica");
    }

    // Add specific tag for shows
    if (news.eventType === "show") {
      tags.push("show", "recital");
    }

    // Add cultural tag for agenda
    if (news.eventType === "agenda") {
      tags.push("cultural", "agenda");
    }

    return tags;
  }

  /**
   * Extract location structure from venue string.
   */
  private extractLocation(venueStr?: string): NormalizedEvent["location"] {
    const base: NormalizedEvent["location"] = {
      city: "Tandil",
      region: "Buenos Aires",
      country: "Argentina",
    };

    if (venueStr) {
      return {
        ...base,
        venue: venueStr,
      };
    }

    return base;
  }

  /**
   * Calculate hash for deduplication.
   */
  private calculateHashFromNews(news: ScrapedNews, dateStr: string): string {
    return this.hashString(`${news.title}|${dateStr}|${news.venue || ""}`);
  }

  /**
   * Simple delay for rate limiting.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Export
// ============================================================================

export default ElEcoTandilConnector;
