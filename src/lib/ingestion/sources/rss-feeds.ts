/**
 * RSS Feed Connectors - System A
 *
 * Generic RSS/Atom feed parser for local news sources.
 * Filters for music/culture related items and extracts event data.
 *
 * @module ingestion/sources/rss-feeds
 */

import { BaseConnector } from "../base-connector";
import type {
  ConnectorContext,
  HealthStatus,
  NormalizedEvent,
  RawEvent,
  SourceType,
} from "../types";
import { PRIORITY } from "../types";

// ============================================================================
// Types
// ============================================================================

interface FeedItem {
  title?: string;
  link?: string;
  description?: string;
  pubDate?: string;
  guid?: string;
  author?: string;
  category?: string | string[];
  enclosure?: {
    url?: string;
    type?: string;
    length?: number;
  };
  "media:content"?: {
    url?: string;
    medium?: string;
    type?: string;
  };
  "media:thumbnail"?: {
    url?: string;
  };
}

interface Feed {
  title?: string;
  link?: string;
  description?: string;
  items: FeedItem[];
}

// ============================================================================
// Constants
// ============================================================================

const SOURCE_TYPE: SourceType = "rss";

/**
 * RSS feed configurations.
 */
export const RSS_FEEDS = {
  eldiario: {
    name: "eldiario_rss",
    url: "https://eldiaodotandil.com/feed",
    tenantLocal: true,
    language: "es",
  },
} as const;

/**
 * Music/culture keywords for filtering.
 */
const MUSIC_KEYWORDS = [
  "música",
  "musica",
  "concert",
  "concierto",
  "festival",
  "banda",
  "cantante",
  "artista",
  "show",
  "vivo",
  "presentación",
  "presentacion",
  "lanzamiento",
  "album",
  "álbum",
  "single",
  "gira",
  "tour",
  "recital",
  "espectáculo",
  "espectaculo",
  "tango",
  "salsa",
  "jazz",
  "rock",
  "pop",
  "indie",
  "reggaeton",
  "trap",
  "urbano",
] as const;

/**
 * Get Tandil tenant ID.
 */
function getTandilTenantId(): string {
  return process.env.TANDIL_TENANT_ID || "00000000-0000-0000-0000-000000000000";
}

// ============================================================================
// RSS Connector Class
// ============================================================================

export class RSSFeedConnector extends BaseConnector<NormalizedEvent> {
  readonly name: string;
  readonly sourceType = SOURCE_TYPE;
  private tenantId: string;
  private feedUrl: string;
  private isTenantLocal: boolean;

  constructor(
    feedName: keyof typeof RSS_FEEDS,
    config?: Partial<ConstructorParameters<typeof BaseConnector>[0]> & {
      feedUrl?: string;
      tenantId?: string;
      tenantLocal?: boolean;
    },
  ) {
    const feedConfig = RSS_FEEDS[feedName];

    if (!feedConfig && !config?.feedUrl) {
      throw new Error(
        `Unknown RSS feed: ${feedName}. Add it to RSS_FEEDS config.`,
      );
    }

    const resolvedName = feedName;
    const url = config?.feedUrl || feedConfig?.url || "";
    const tenantLocal = config?.tenantLocal ?? feedConfig?.tenantLocal ?? false;

    super({
      sourceId: resolvedName,
      sourceType: SOURCE_TYPE,
      isShared: !tenantLocal,
      tenantId: tenantLocal
        ? config?.tenantId || getTandilTenantId()
        : undefined,
      retryConfig: {
        maxRetries: 3,
        backoffMs: 2000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeoutMs: 300000,
      },
      ...config,
    });

    this.name = resolvedName;
    this.feedUrl = url;
    this.isTenantLocal = tenantLocal;
    this.tenantId = config?.tenantId || getTandilTenantId();
  }

  // ============================================================================
  // BaseConnector Abstract Methods
  // ============================================================================

  /**
   * Fetch and parse RSS/Atom feed.
   */
  async fetch(ctx: ConnectorContext): Promise<RawEvent[]> {
    if (!this.feedUrl) {
      throw new Error("RSS feed URL not configured");
    }

    this.log("info", `Fetching RSS feed: ${this.feedUrl}`);

    try {
      const response = await fetch(this.feedUrl, {
        method: "GET",
        headers: {
          Accept: "application/rss+xml, application/xml, text/xml, */*",
          "User-Agent": "EnvivoStudio/1.0 (content-ingestion)",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xml = await response.text();

      const feed = this.parseXml(xml);
      const items = this.filterMusicItems(feed.items);

      this.log(
        "info",
        `Found ${items.length} music-related items out of ${feed.items.length} total`,
      );

      return items.map((item) => this.toRawEvent(item));
    } catch (error) {
      this.log("error", "Failed to fetch RSS feed", {
        error: this.getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Normalize an RSS item to NormalizedEvent format.
   */
  async normalize(raw: RawEvent): Promise<NormalizedEvent> {
    const item = raw.rawData as FeedItem;

    const eventDate = this.parseDate(item.pubDate);
    const location = this.extractLocation(item.description);
    const title = this.cleanText(item.title || "Untitled");
    const description = this.extractDescription(item.description);
    const imageUrl = this.extractImageUrl(item);

    return {
      source: this.name,
      sourceId: raw.externalId,
      sourceUrl: item.link || "",
      title,
      contentHash: this.calculateHashFromItem(item, title, eventDate),
      tenantId: this.isTenantLocal ? this.tenantId : null,
      isShared: !this.isTenantLocal,
      metadata: {
        originalGuid: item.guid,
        originalPubDate: item.pubDate,
        originalAuthor: item.author,
        originalCategory: item.category,
        feedUrl: this.feedUrl,
      },
      eventType: this.guessEventType(item),
      eventDate,
      year: new Date(eventDate).getFullYear(),
      location,
      artists: undefined,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              source: this.name,
              caption: title,
              license: undefined,
            },
          ]
        : undefined,
      tags: this.extractTags(item),
      description,
      priority: PRIORITY.LOW,
    };
  }

  /**
   * Calculate content hash for deduplication.
   */
  calculateHash(item: NormalizedEvent): string {
    return this.hashString(`${item.title}|${item.eventDate}`);
  }

  /**
   * Health check for RSS feed.
   */
  async health(_ctx: ConnectorContext): Promise<HealthStatus> {
    return this.defaultHealthCheck(this.feedUrl, 10000);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Parse XML to extract RSS/Atom feed data.
   */
  private parseXml(xml: string): Feed {
    const isAtom =
      xml.includes("<feed") ||
      xml.includes('xmlns="http://www.w3.org/2005/Atom"');

    if (isAtom) {
      return this.parseAtom(xml);
    }

    return this.parseRSS(xml);
  }

  /**
   * Parse RSS 2.0 feed.
   */
  private parseRSS(xml: string): Feed {
    const items: FeedItem[] = [];

    const titleMatch = xml.match(/<channel>[\s\S]*?<title>([^<]+)<\/title>/i);
    const linkMatch = xml.match(/<channel>[\s\S]*?<link>([^<]+)<\/link>/i);
    const descMatch = xml.match(
      /<channel>[\s\S]*?<description>([^<]+)<\/description>/i,
    );

    const itemMatches = xml.match(/<item>([\s\S]*?)<\/item>/gi);

    if (itemMatches) {
      for (const itemXml of itemMatches) {
        const item = this.parseRSSItem(itemXml);
        if (item) {
          items.push(item);
        }
      }
    }

    return {
      title: titleMatch?.[1]?.trim(),
      link: linkMatch?.[1]?.trim(),
      description: descMatch?.[1]?.trim(),
      items,
    };
  }

  /**
   * Parse a single RSS item.
   */
  private parseRSSItem(itemXml: string): FeedItem | null {
    const title = this.extractTag(itemXml, "title");
    const link = this.extractTag(itemXml, "link");
    const description =
      this.extractTag(itemXml, "description") ||
      this.extractTag(itemXml, "content:encoded");
    const pubDate = this.extractTag(itemXml, "pubDate");
    const guid = this.extractTag(itemXml, "guid");
    const author =
      this.extractTag(itemXml, "author") ||
      this.extractTag(itemXml, "dc:creator");
    const category = this.extractCategories(itemXml);

    const enclosureMatch = itemXml.match(/<enclosure[^>]+>/i);
    let enclosure: FeedItem["enclosure"] | undefined;
    if (enclosureMatch) {
      const urlMatch = enclosureMatch[0].match(/url="([^"]+)"/i);
      const typeMatch = enclosureMatch[0].match(/type="([^"]+)"/i);
      const lengthMatch = enclosureMatch[0].match(/length="([^"]+)"/i);
      enclosure = {
        url: urlMatch?.[1],
        type: typeMatch?.[1],
        length: lengthMatch?.[1] ? parseInt(lengthMatch[1], 10) : undefined,
      };
    }

    const mediaContentMatch = itemXml.match(/<media:content[^>]+>/i);
    let mediaContent: FeedItem["media:content"] | undefined;
    if (mediaContentMatch) {
      const urlMatch = mediaContentMatch[0].match(/url="([^"]+)"/i);
      const mediumMatch = mediaContentMatch[0].match(/medium="([^"]+)"/i);
      const typeMatch = mediaContentMatch[0].match(/type="([^"]+)"/i);
      mediaContent = {
        url: urlMatch?.[1],
        medium: mediumMatch?.[1],
        type: typeMatch?.[1],
      };
    }

    const mediaThumbMatch = itemXml.match(/<media:thumbnail[^>]+>/i);
    let mediaThumbnail: FeedItem["media:thumbnail"] | undefined;
    if (mediaThumbMatch) {
      const urlMatch = mediaThumbMatch[0].match(/url="([^"]+)"/i);
      mediaThumbnail = {
        url: urlMatch?.[1],
      };
    }

    if (!title && !description) {
      return null;
    }

    return {
      title,
      link,
      description,
      pubDate,
      guid,
      author,
      category,
      enclosure,
      "media:content": mediaContent,
      "media:thumbnail": mediaThumbnail,
    };
  }

  /**
   * Parse Atom feed.
   */
  private parseAtom(xml: string): Feed {
    const items: FeedItem[] = [];

    const titleMatch = xml.match(/<title[^>]*>([^<]+)<\/title>/i);
    const linkMatch = xml.match(/<link[^>]+href="([^"]+)"[^>]*>/i);
    const subtitleMatch = xml.match(/<subtitle[^>]*>([^<]+)<\/subtitle>/i);

    const entryMatches = xml.match(/<entry>([\s\S]*?)<\/entry>/gi);

    if (entryMatches) {
      for (const entryXml of entryMatches) {
        const item = this.parseAtomEntry(entryXml);
        if (item) {
          items.push(item);
        }
      }
    }

    return {
      title: titleMatch?.[1]?.trim(),
      link: linkMatch?.[1]?.trim(),
      description: subtitleMatch?.[1]?.trim(),
      items,
    };
  }

  /**
   * Parse a single Atom entry.
   */
  private parseAtomEntry(entryXml: string): FeedItem | null {
    const title = this.extractTag(entryXml, "title");
    const linkMatch = entryXml.match(/<link[^>]+href="([^"]+)"[^>]*>/i);
    const link = linkMatch?.[1];
    const summary =
      this.extractTag(entryXml, "summary") ||
      this.extractTag(entryXml, "content");
    const published =
      this.extractTag(entryXml, "published") ||
      this.extractTag(entryXml, "updated");
    const id = this.extractTag(entryXml, "id");
    const authorMatch = entryXml.match(
      /<author>[\s\S]*?<name>([^<]+)<\/name>/i,
    );
    const author = authorMatch?.[1];
    const category = this.extractCategories(entryXml);

    if (!title && !summary) {
      return null;
    }

    return {
      title,
      link,
      description: summary,
      pubDate: published,
      guid: id,
      author,
      category,
    };
  }

  /**
   * Extract a specific tag from XML.
   */
  private extractTag(xml: string, tag: string): string | undefined {
    const patterns = [
      new RegExp(
        `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`,
        "i",
      ),
      new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"),
    ];

    for (const pattern of patterns) {
      const match = xml.match(pattern);
      if (match?.[1]) {
        return this.cleanText(match[1].trim());
      }
    }

    return undefined;
  }

  /**
   * Extract categories from XML.
   */
  private extractCategories(xml: string): string[] | undefined {
    const categories: string[] = [];
    const catMatches = xml.match(/<category[^>]*>([^<]+)<\/category>/gi);

    if (catMatches) {
      for (const cat of catMatches) {
        const match = cat.match(/>([^<]+)</);
        if (match?.[1]) {
          categories.push(match[1].trim());
        }
      }
    }

    return categories.length > 0 ? categories : undefined;
  }

  /**
   * Clean text by removing HTML tags and extra whitespace.
   */
  private cleanText(text: string | undefined): string {
    if (!text) return "";

    return text
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Filter items for music/culture related content.
   */
  private filterMusicItems(items: FeedItem[]): FeedItem[] {
    return items.filter((item) => {
      const title = item.title?.toLowerCase() || "";
      const desc = item.description?.toLowerCase() || "";
      const cat = Array.isArray(item.category)
        ? item.category.join(" ").toLowerCase()
        : item.category?.toLowerCase() || "";

      const combined = `${title} ${desc} ${cat}`;

      return MUSIC_KEYWORDS.some((keyword) =>
        combined.includes(keyword.toLowerCase()),
      );
    });
  }

  /**
   * Convert feed item to RawEvent format.
   */
  private toRawEvent(item: FeedItem): RawEvent {
    const externalId =
      item.guid ||
      item.link ||
      this.shortHash(item.title || JSON.stringify(item));

    return {
      sourceId: this.name,
      externalId: `${this.name}-${this.shortHash(externalId)}`,
      rawData: item,
      fetchedAt: new Date(),
    };
  }

  /**
   * Parse date from pubDate string.
   */
  private parseDate(dateStr?: string): string {
    if (!dateStr) {
      return new Date().toISOString().split("T")[0];
    }

    try {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split("T")[0];
      }
    } catch {
      // Continue
    }

    return new Date().toISOString().split("T")[0];
  }

  /**
   * Extract location from description.
   */
  private extractLocation(description?: string): NormalizedEvent["location"] {
    if (!description) {
      return {
        city: "Tandil",
        region: "Buenos Aires",
        country: "Argentina",
      };
    }

    const locationPatterns = [
      /en\s+([^.!,]{2,50}?)(?:\s*[,.]|$)/i,
      /([A-Z][^.!,]{2,30}),?\s+Argentina/i,
    ];

    for (const pattern of locationPatterns) {
      const match = description.match(pattern);
      if (match?.[1]) {
        return {
          city: match[1].trim(),
          region: "Buenos Aires",
          country: "Argentina",
        };
      }
    }

    return {
      city: "Tandil",
      region: "Buenos Aires",
      country: "Argentina",
    };
  }

  /**
   * Extract description from HTML content.
   */
  private extractDescription(description?: string): string | undefined {
    if (!description) {
      return undefined;
    }

    const cleaned = this.cleanText(description);

    if (cleaned.length > 50) {
      return cleaned.slice(0, 500);
    }

    return cleaned || undefined;
  }

  /**
   * Extract image URL from item.
   */
  private extractImageUrl(item: FeedItem): string | undefined {
    if (
      item["media:content"]?.url &&
      item["media:content"]?.medium === "image"
    ) {
      return item["media:content"].url;
    }

    if (item["media:thumbnail"]?.url) {
      return item["media:thumbnail"].url;
    }

    if (item.enclosure?.url && item.enclosure?.type?.startsWith("image/")) {
      return item.enclosure.url;
    }

    if (item.description) {
      const imgMatch = item.description.match(/<img[^>]+src="([^"]+)"/i);
      if (imgMatch?.[1]) {
        return imgMatch[1];
      }
    }

    return undefined;
  }

  /**
   * Guess event type based on content.
   */
  private guessEventType(item: FeedItem): "local_event" | "historical" {
    const title = item.title?.toLowerCase() || "";
    const desc = item.description?.toLowerCase() || "";

    const datePatterns = [
      /\d{1,2}\s+de\s+\w+/,
      /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
      /\d{4}-\d{2}-\d{2}/,
    ];

    const hasDate = datePatterns.some(
      (p) => p.test(title) || p.test(desc || ""),
    );

    if (hasDate) {
      return "local_event";
    }

    return "historical";
  }

  /**
   * Extract tags from item.
   */
  private extractTags(item: FeedItem): string[] {
    const tags: string[] = ["noticia", "rss", this.name];

    if (item.category) {
      const categories = Array.isArray(item.category)
        ? item.category
        : [item.category];
      tags.push(...categories.slice(0, 3).map((c) => c.toLowerCase()));
    }

    return [...new Set(tags)];
  }

  /**
   * Calculate hash from item components.
   */
  private calculateHashFromItem(
    item: FeedItem,
    title: string,
    date: string,
  ): string {
    return this.hashString(`${title}|${date}|${item.guid || item.link || ""}`);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an RSS connector for a specific feed.
 */
export function createRSSConnector(
  feedName: keyof typeof RSS_FEEDS,
  config?: Partial<ConstructorParameters<typeof BaseConnector>[0]> & {
    feedUrl?: string;
    tenantId?: string;
    tenantLocal?: boolean;
  },
): RSSFeedConnector {
  return new RSSFeedConnector(feedName, config);
}

// ============================================================================
// Export
// ============================================================================

export default RSSFeedConnector;
