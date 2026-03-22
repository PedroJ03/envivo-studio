/**
 * La Nación RSS Connector - System B
 *
 * Scraper for La Nación RSS feed.
 * Simple approach: include all items from entertainment categories.
 * Let the user/content system filter what's truly relevant.
 *
 * Categories included: Espectáculos, Cultura, Celebridades, Cine, Teatro, Música
 *
 * @module ingestion/sources/lanacion-rss
 */

import { BaseConnector } from "../base-connector";
import type {
  ConnectorContext,
  ContentFeedItem,
  ContentFeedType,
  Fact,
  HealthStatus,
  Image,
  RawFeedItem,
  SourceConnectorConfig,
} from "../types";
import { generateContentHash, normalizeForHash } from "../deduplication";
import type { IngestionCache } from "../cache";
import { EXPIRY, VIRAL_SCORE } from "../types";

// ============================================================================
// Constants
// ============================================================================

const RSS_URL =
  "https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml";
const BASE_URL = "https://www.lanacion.com.ar";

// High-value keywords (2 points) - directly indicate music/shows
const HIGH_VALUE_KEYWORDS = [
  // Shows and concerts
  "show",
  "recital",
  "concierto",
  "conciertos",
  "gira",
  "giras",
  "tour",
  "festival",
  "festivales",
  "showcase",
  "en vivo",
  "escenario",
  "escenarios",
  "presentación",
  "presentación en",
  "agotado",
  "agotados",
  "entradas",
  // Music releases
  "nuevo disco",
  "nuevo álbum",
  "nuevo single",
  "lanzamiento",
  "estreno",
  "colaboración",
  // Death/important news
  "falleció",
  "murió",
  "muere",
  "mueren",
  // Return/reunion
  "vuelve",
  "regresa",
  "regresan",
  "reunión",
];

// Medium-value keywords (1 point) - contextually relevant
const MEDIUM_VALUE_KEYWORDS = [
  // Music-related
  "banda",
  "bandas",
  "grupo",
  "grupos",
  "artista",
  "artistas",
  "músico",
  "músicos",
  "cantante",
  "cantantes",
  "baterista",
  "bateristas",
  "guitarrista",
  "guitarristas",
  "vocalista",
  "vocalistas",
  // Music terms
  "canción",
  "canciones",
  "tema",
  "temas",
  "single",
  "sencillo",
  "disco",
  "álbum",
  "ep",
  "cover",
  "remix",
  "feat",
  "featuring",
  // Locations (when combined with music context)
  "llega",
  "llegan",
  "llegó",
  "presenta",
  "presentan",
  "se presenta",
  "se presentan",
  // General entertainment
  "concert",
  "live",
  "performance",
  "acústico",
  "unplugged",
  "sold out",
];

// Keywords for show/concert detection
const SHOW_KEYWORDS = [
  "show",
  "recital",
  "concierto",
  "conciertos",
  "gira",
  "giras",
  "tour",
  "presentará",
  "presentan",
  "presenta",
  "festival",
  "festivales",
  "en vivo",
  "llega a",
  "llegan a",
  "agotado",
  "agotados",
  "entradas",
  "showcase",
  "live",
  "concert",
  "performance",
  "escenario",
  "escenarios",
];

// Keywords for relevant news detection
const RELEVANT_NEWS_KEYWORDS = [
  "falleció",
  "murió",
  "muere",
  "nuevo disco",
  "nuevo álbum",
  "lanzamiento",
  "estreno",
  "vuelve",
  "regresa",
  "vuelta",
  "colaboración",
  "feat",
  "single",
  "canción",
  "tema",
  "banda",
  "grupo",
  "artista",
  "músico",
  "cantante",
];

// Known artist/band names
const ARTIST_NAMES = [
  "Soda Stereo",
  "Los Piojos",
  "Divididos",
  "Enanitos Verdes",
  "Babasónicos",
  "Tan Biónica",
  "No Te Va Gustar",
  "La Vela Puerca",
  "Bersuit",
  "Fito Páez",
  "Charly García",
  "Lali",
  "Tini",
  "Emilia Mernes",
  "Duki",
  "Bizarrap",
  "Wos",
  "Los Auténticos Decadentes",
  "Los Caligaris",
  "Los Pericos",
  "Molotov",
  "Café Tacvba",
  "Zoé",
  "Mon Laferte",
  "Rosalía",
  "Bad Bunny",
  "Karol G",
  "Shakira",
  "Beyoncé",
  "Taylor Swift",
  "The Weeknd",
  "Bruno Mars",
  "Coldplay",
  "U2",
  "Rolling Stones",
  "AC/DC",
  "Metallica",
  "Nirvana",
  "Queen",
  "Pink Floyd",
  "Indio Solari",
  "Ciro",
  "Andrés Calamaro",
  "Fito",
  "Charly",
];

// Scoring weights for different keyword types
const SCORING_WEIGHTS = {
  artistName: 3, // Artist names are high value
  showKeyword: 2, // Show/concert keywords are medium-high
  city: 2, // Cities are medium-high (location relevance)
  newsKeyword: 1, // News keywords are lower value alone
};

// Minimum score required to pass filter
const MINIMUM_SCORE = 3;

// Argentinian cities for location-based filtering
const ARGENTINIAN_CITIES = [
  "Tandil",
  "Mar del Plata",
  "Buenos Aires",
  "Córdoba",
  "Rosario",
  "Mendoza",
  "La Plata",
  "San Juan",
  "Salta",
  "Neuquén",
  "Bariloche",
  "Mardel",
  "MDQ",
  "BsAs",
  "CABA",
];

// ============================================================================
// Types
// ============================================================================

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  category?: string | string[];
  "dc:creator"?: string;
  "content:encoded"?: string;
  "media:content"?: {
    url: string;
    width?: string;
    height?: string;
    medium?: string;
  };
  enclosure?: {
    url: string;
    type: string;
  };
}

interface RSSChannel {
  title: string;
  link: string;
  description: string;
  item: RSSItem[];
}

interface RSSFeed {
  rss: {
    channel: RSSChannel;
  };
}

interface FilterResult {
  passes: boolean;
  reasons: string[];
  matchedKeywords: string[];
}

// ============================================================================
// Connector Class
// ============================================================================

export class LaNacionRSSConnector extends BaseConnector<ContentFeedItem> {
  readonly name = "lanacion";
  readonly sourceType = "rss" as const;

  constructor(config: SourceConnectorConfig, cache?: IngestionCache) {
    super(config, cache);
  }

  /**
   * Fetch and parse La Nación RSS feed.
   */
  async fetch(ctx: ConnectorContext): Promise<RawFeedItem[]> {
    const response = await fetch(RSS_URL, {
      headers: {
        "User-Agent": "EnvivoStudio/1.0 (content-ingestion)",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
    });

    if (!response.ok) {
      throw new Error(`La Nación RSS request failed: ${response.status}`);
    }

    const xmlText = await response.text();
    const feed = this.parseRSS(xmlText);

    if (!feed.rss?.channel?.item) {
      this.log("warn", "No items found in La Nación RSS feed");
      return [];
    }

    const allItems = feed.rss.channel.item;
    this.log("info", `Received ${allItems.length} items from La Nación`);

    const filteredItems: RawFeedItem[] = [];

    for (const item of allItems) {
      if (!item.title || !item.link) {
        continue;
      }

      // Apply relevance filter
      const filterResult = this.applyRelevanceFilter(item);

      if (!filterResult.passes) {
        this.log("debug", `Filtered out: "${item.title}"`, {
          reasons: filterResult.reasons,
        });
        continue;
      }

      // Detect content type
      const contentType = this.detectContentType(item, filterResult);

      filteredItems.push({
        sourceId: this.name,
        externalId: this.generateExternalId(item),
        rawData: {
          item,
          contentType,
          filterResult,
          fetchedAt: new Date().toISOString(),
        },
        fetchedAt: new Date(),
      });
    }

    this.log(
      "info",
      `Filtered ${filteredItems.length} items from ${allItems.length} total`,
    );

    return filteredItems;
  }

  /**
   * Normalize RSS item to ContentFeedItem.
   */
  async normalize(raw: RawFeedItem): Promise<ContentFeedItem> {
    const data = raw.rawData as {
      item: RSSItem;
      contentType: ContentFeedType;
      filterResult: FilterResult;
    };
    const item = data.item;
    const contentType = data.contentType;
    const filterResult = data.filterResult;

    // Extract facts from description
    const facts: Fact[] = [];
    if (item.description) {
      const cleanDescription = this.stripHtml(item.description);
      if (cleanDescription) {
        facts.push({
          fact: cleanDescription,
          source: item.link,
          verifiedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        });
      }
    }

    // Extract images
    const images: Image[] = [];
    const imageUrl = this.extractImageUrl(item);
    if (imageUrl) {
      images.push({
        url: imageUrl,
        source: "lanacion",
        caption: item.title,
      });
    }

    // Generate hook
    const hook = this.extractHook(item.description || item.title);

    // Calculate viral score
    const viralScore = this.calculateViralScore(
      item,
      contentType,
      filterResult,
    );

    // Calculate expiry based on content type
    const expiresAt = this.calculateExpiry(contentType);

    // Normalize body
    const body = this.normalizeBody(item);

    // Extract tags
    const tags = this.extractTags(item, filterResult);

    const normalized: ContentFeedItem = {
      source: this.name,
      sourceId: raw.externalId,
      sourceUrl: item.link,
      title: this.truncateTitle(item.title),
      contentHash: "",
      tenantId: null, // Shared source
      isShared: true,
      metadata: {
        pubDate: item.pubDate,
        categories: item.category,
        author: item["dc:creator"],
        filterReasons: filterResult.reasons,
      },
      contentType,
      body,
      hook,
      facts,
      images,
      tags,
      publishAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      expiresAt,
      viralScore,
    };

    normalized.contentHash = this.calculateHash(normalized);

    return normalized;
  }

  /**
   * Calculate content hash for deduplication.
   */
  calculateHash(item: ContentFeedItem): string {
    return generateContentHash({
      title: item.title,
      body: item.body,
      source: item.source,
      sourceId: item.sourceId,
    });
  }

  /**
   * Health check for La Nación RSS.
   */
  async health(ctx: ConnectorContext): Promise<HealthStatus> {
    return this.defaultHealthCheck(RSS_URL, 5000);
  }

  // ============================================================================
  // Private Methods - Filtering
  // ============================================================================

  /**
   * Score-based filtering system.
   *
   * High-value keywords: 2 points (shows, concerts, new albums, deaths, returns)
   * Medium-value keywords: 1 point (music context, band/artist terms, general music words)
   *
   * All items with score > 0 are included and ranked by score.
   */
  private calculateRelevanceScore(item: RSSItem): {
    score: number;
    matchedKeywords: string[];
    reasons: string[];
  } {
    const title = item.title.toLowerCase();
    const description = (item.description || "").toLowerCase();
    const combined = `${title} ${description}`;

    let score = 0;
    const matchedKeywords: string[] = [];
    const reasons: string[] = [];

    // Check high-value keywords (2 points each)
    const highMatches: string[] = [];
    for (const keyword of HIGH_VALUE_KEYWORDS) {
      if (combined.includes(keyword.toLowerCase())) {
        score += 2;
        highMatches.push(keyword);
      }
    }
    if (highMatches.length > 0) {
      matchedKeywords.push(...highMatches);
      reasons.push(
        `High-value keywords (+${highMatches.length * 2}): ${highMatches.join(", ")}`,
      );
    }

    // Check medium-value keywords (1 point each)
    const mediumMatches: string[] = [];
    for (const keyword of MEDIUM_VALUE_KEYWORDS) {
      if (combined.includes(keyword.toLowerCase())) {
        score += 1;
        mediumMatches.push(keyword);
      }
    }
    if (mediumMatches.length > 0) {
      matchedKeywords.push(...mediumMatches);
      reasons.push(
        `Medium-value keywords (+${mediumMatches.length}): ${mediumMatches.join(", ")}`,
      );
    }

    return { score, matchedKeywords, reasons };
  }

  /**
   * Filter items based on relevance score.
   * Include all items with score > 0, sorted by score.
   */
  private applyRelevanceFilter(item: RSSItem): FilterResult {
    const { score, matchedKeywords, reasons } =
      this.calculateRelevanceScore(item);

    const result: FilterResult = {
      passes: score > 0,
      reasons: [...reasons, `Total score: ${score}`],
      matchedKeywords,
    };

    if (score === 0) {
      result.reasons.push("No relevant music/show keywords found");
    }

    return result;
  }

  /**
   * Normalize categories to array.
   */
  private normalizeCategories(
    category: string | string[] | undefined,
  ): string[] {
    if (!category) return [];
    return Array.isArray(category) ? category : [category];
  }

  /**
   * Detect content type based on item content.
   */
  private detectContentType(
    item: RSSItem,
    filterResult: FilterResult,
  ): ContentFeedType {
    const title = item.title.toLowerCase();
    const description = (item.description || "").toLowerCase();
    const combined = `${title} ${description}`;

    // Breaking news detection (highest priority)
    const breakingKeywords = [
      "falleció",
      "murió",
      "muere",
      "breaking",
      "urgente",
      "último momento",
      "ultimo momento",
      "tragedia",
      "accidente",
    ];

    if (breakingKeywords.some((kw) => combined.includes(kw))) {
      return "breaking_news";
    }

    // Check for artist mentions (trending)
    if (filterResult.matchedKeywords.some((kw) => ARTIST_NAMES.includes(kw))) {
      return "trending";
    }

    // Check for show/concert keywords (trending)
    if (filterResult.matchedKeywords.some((kw) => SHOW_KEYWORDS.includes(kw))) {
      return "trending";
    }

    // Default to trending for entertainment news
    return "trending";
  }

  // ============================================================================
  // Private Methods - RSS Parsing
  // ============================================================================

  /**
   * Parse RSS XML to structured format.
   */
  private parseRSS(xmlText: string): RSSFeed {
    const feed: RSSFeed = {
      rss: {
        channel: {
          title: this.extractTag(xmlText, "<title>"),
          link: this.extractTag(xmlText, "<link>"),
          description: this.extractTag(xmlText, "<description>"),
          item: [],
        },
      },
    };

    // Extract all items
    const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/gi);
    if (!itemMatches) return feed;

    for (const itemXml of itemMatches) {
      const item = this.parseRSSItem(itemXml);
      if (item) {
        feed.rss.channel.item.push(item);
      }
    }

    return feed;
  }

  /**
   * Parse a single RSS item.
   */
  private parseRSSItem(itemXml: string): RSSItem | null {
    const title = this.extractTag(itemXml, "<title>");
    const link = this.extractTag(itemXml, "<link>");

    if (!title || !link) {
      return null;
    }

    const item: RSSItem = {
      title: this.decodeHtml(title),
      link: this.decodeHtml(link),
      description: this.decodeHtml(this.extractTag(itemXml, "<description>")),
      pubDate: this.extractTag(itemXml, "<pubDate>"),
    };

    // Extract categories
    const categoryMatches = itemXml.match(
      /<category[^>]*>([^<]+)<\/category>/gi,
    );
    if (categoryMatches) {
      item.category = categoryMatches.map((c) =>
        this.decodeHtml(c.replace(/<[^>]+>/g, "").trim()),
      );
    }

    // Extract dc:creator (author)
    const creatorMatch = itemXml.match(
      /<dc:creator[^>]*>([^<]+)<\/dc:creator>/i,
    );
    if (creatorMatch) {
      item["dc:creator"] = this.decodeHtml(creatorMatch[1].trim());
    }

    // Extract media:content
    const mediaMatch = itemXml.match(/<media:content[^>]*url="([^"]+)"[^>]*>/i);
    if (mediaMatch) {
      const widthMatch = itemXml.match(/<media:content[^>]*width="([^"]+)"/i);
      const heightMatch = itemXml.match(/<media:content[^>]*height="([^"]+)"/i);
      const mediumMatch = itemXml.match(/<media:content[^>]*medium="([^"]+)"/i);

      item["media:content"] = {
        url: mediaMatch[1],
        width: widthMatch?.[1],
        height: heightMatch?.[1],
        medium: mediumMatch?.[1],
      };
    }

    // Extract enclosure
    const enclosureMatch = itemXml.match(/<enclosure[^>]*url="([^"]+)"[^>]*>/i);
    if (enclosureMatch) {
      const typeMatch = itemXml.match(/<enclosure[^>]*type="([^"]+)"/i);
      item.enclosure = {
        url: enclosureMatch[1],
        type: typeMatch?.[1] || "image/jpeg",
      };
    }

    // Extract content:encoded
    const contentEncodedMatch = itemXml.match(
      /<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i,
    );
    if (contentEncodedMatch) {
      item["content:encoded"] = this.decodeHtml(contentEncodedMatch[1].trim());
    }

    return item;
  }

  /**
   * Extract content between tags.
   */
  private extractTag(xml: string, tag: string): string {
    const startTag = tag.toLowerCase();
    const endTag = tag
      .replace("<", "</")
      .replace(/\s+[^>]+>/g, ">")
      .toLowerCase();

    const startIndex = xml.toLowerCase().indexOf(startTag);
    if (startIndex === -1) return "";

    const contentStart = xml.indexOf(">", startIndex) + 1;
    const endIndex = xml.toLowerCase().indexOf(endTag, contentStart);

    if (endIndex === -1) return "";

    return xml.slice(contentStart, endIndex).trim();
  }

  /**
   * Decode HTML entities.
   */
  private decodeHtml(html: string): string {
    if (!html) return "";

    return html
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/")
      .replace(/&nbsp;/g, " ");
  }

  // ============================================================================
  // Private Methods - Content Extraction
  // ============================================================================

  /**
   * Extract image URL from item.
   */
  private extractImageUrl(item: RSSItem): string | null {
    // Try media:content first
    if (item["media:content"]?.url) {
      return item["media:content"].url;
    }

    // Try enclosure
    if (item.enclosure?.url) {
      return item.enclosure.url;
    }

    // Try to extract from content:encoded
    if (item["content:encoded"]) {
      const imgMatch = item["content:encoded"].match(/<img[^>]+src="([^"]+)"/i);
      if (imgMatch) {
        return imgMatch[1];
      }
    }

    return null;
  }

  /**
   * Extract hook from text.
   */
  private extractHook(text: string): string {
    if (!text) return "";

    const stripped = this.stripHtml(text);
    const match = stripped.match(/^[^.!?]+[.!?]/);
    const hook = match ? match[0] : stripped.slice(0, 100);

    return this.truncate(hook, 100);
  }

  /**
   * Normalize body text.
   */
  private normalizeBody(item: RSSItem): string {
    let body = item.description || "";

    // Try content:encoded for full content
    if (item["content:encoded"]) {
      body = this.stripHtml(item["content:encoded"]);
    }

    return this.truncate(body.replace(/\s+/g, " ").trim(), 500);
  }

  /**
   * Strip HTML tags.
   */
  private stripHtml(html: string): string {
    if (!html) return "";
    return html
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Extract tags from item.
   */
  private extractTags(item: RSSItem, filterResult: FilterResult): string[] {
    const tags: string[] = ["lanacion", "noticias"];

    // Add categories
    const categories = this.normalizeCategories(item.category);
    for (const cat of categories) {
      const normalized = cat.toLowerCase();
      if (normalized.includes("espectáculos")) tags.push("espectaculos");
      if (normalized.includes("música")) tags.push("musica");
      if (normalized.includes("cine")) tags.push("cine");
      if (normalized.includes("teatro")) tags.push("teatro");
      if (normalized.includes("celebridades")) tags.push("celebridades");
    }

    // Add matched keywords as tags
    for (const keyword of filterResult.matchedKeywords) {
      const normalizedTag = keyword.toLowerCase().replace(/\s+/g, "-");
      if (!tags.includes(normalizedTag)) {
        tags.push(normalizedTag);
      }
    }

    return [...new Set(tags)];
  }

  // ============================================================================
  // Private Methods - Scoring and Metadata
  // ============================================================================

  /**
   * Calculate viral score.
   */
  private calculateViralScore(
    item: RSSItem,
    contentType: ContentFeedType,
    filterResult: FilterResult,
  ): number {
    let score = 50; // Base score

    // Content type base scores
    if (contentType === "breaking_news") {
      score = VIRAL_SCORE.BREAKING_NEWS;
    } else if (contentType === "trending") {
      score = VIRAL_SCORE.TRENDING;
    }

    // Boost for images
    if (item["media:content"]?.url || item.enclosure?.url) {
      score += 10;
    }

    // Boost for artist mentions (high interest)
    const artistMatches = filterResult.matchedKeywords.filter((kw) =>
      ARTIST_NAMES.includes(kw),
    ).length;
    score += artistMatches * 5;

    // Boost for location mentions (local relevance)
    const cityMatches = filterResult.matchedKeywords.filter((kw) =>
      ARGENTINIAN_CITIES.includes(kw),
    ).length;
    score += cityMatches * 3;

    return Math.min(score, 100);
  }

  /**
   * Calculate expiry date based on content type.
   */
  private calculateExpiry(contentType: ContentFeedType): Date | undefined {
    const now = new Date();

    if (contentType === "breaking_news") {
      return new Date(
        now.getTime() + EXPIRY.BREAKING_NEWS_HOURS * 60 * 60 * 1000,
      );
    } else if (contentType === "trending") {
      return new Date(
        now.getTime() + EXPIRY.TRENDING_DAYS * 24 * 60 * 60 * 1000,
      );
    } else if (contentType === "curiosity") {
      return new Date(
        now.getTime() + EXPIRY.CURIOSITY_DAYS * 24 * 60 * 60 * 1000,
      );
    }

    // Trivia is evergreen (no expiry)
    return undefined;
  }

  /**
   * Generate external ID.
   */
  private generateExternalId(item: RSSItem): string {
    const normalizedUrl = normalizeForHash(item.link);
    return this.shortHash(normalizedUrl);
  }

  /**
   * Truncate title.
   */
  private truncateTitle(title: string): string {
    return this.truncate(title, 150);
  }

  /**
   * Truncate text.
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createLaNacionRSSConnector(
  cache?: IngestionCache,
): LaNacionRSSConnector {
  return new LaNacionRSSConnector(
    {
      sourceId: "lanacion",
      sourceType: "rss",
      isShared: true,
      baseUrl: BASE_URL,
      rateLimitRps: 0.1, // 1 request per 10 seconds
      retryConfig: {
        maxRetries: 3,
        backoffMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeoutMs: 300000,
      },
    },
    cache,
  );
}

// ============================================================================
// Export filter configuration for testing and documentation
// ============================================================================

export const FILTER_CONFIG = {
  highValueKeywords: HIGH_VALUE_KEYWORDS,
  mediumValueKeywords: MEDIUM_VALUE_KEYWORDS,
} as const;
