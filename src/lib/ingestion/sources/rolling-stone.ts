/**
 * Rolling Stone Connector - System B
 *
 * Scrapes music news from Rolling Stone Argentina.
 * Source: https://www.rollingstone.com.ar/feed
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
import { TTL } from "../cache";
import type { IngestionCache } from "../cache";

// RSS feed URL for Rolling Stone Argentina
const RSS_URL = "https://www.rollingstone.com.ar/feed";
const BASE_URL = "https://www.rollingstone.com";

interface RSSItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  category?: string | string[];
  contentEncoded?: string;
  mediaContent?: {
    url: string;
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
  channel: RSSChannel;
}

export class RollingStoneConnector extends BaseConnector<ContentFeedItem> {
  readonly name = "rollingstone";
  readonly sourceType = "scraper" as const;

  constructor(config: SourceConnectorConfig, cache?: IngestionCache) {
    super(config, cache);
  }

  /**
   * Fetch articles from Rolling Stone RSS feed.
   */
  async fetch(ctx: ConnectorContext): Promise<RawFeedItem[]> {
    const response = await fetch(RSS_URL);

    if (!response.ok) {
      throw new Error(`Rolling Stone RSS request failed: ${response.status}`);
    }

    const xmlText = await response.text();
    const feed = this.parseRSS(xmlText);

    if (!feed.channel?.item) {
      this.log("warn", "No items found in Rolling Stone RSS feed");
      return [];
    }

    this.log(
      "info",
      `Received ${feed.channel.item.length} items from Rolling Stone`,
    );

    const items: RawFeedItem[] = [];

    for (const item of feed.channel.item) {
      if (!item.title || !item.link) {
        continue;
      }

      // Detect content type from categories and keywords
      const contentType = this.detectContentType(item);

      // Skip non-music content
      if (!this.isMusicRelated(item)) {
        continue;
      }

      items.push({
        sourceId: this.name,
        externalId: this.generateExternalId(item),
        rawData: {
          item,
          contentType,
          fetchedAt: new Date().toISOString(),
        },
        fetchedAt: new Date(),
      });
    }

    return items;
  }

  /**
   * Normalize Rolling Stone article to ContentFeedItem.
   */
  async normalize(raw: RawFeedItem): Promise<ContentFeedItem> {
    const data = raw.rawData as {
      item: RSSItem;
      contentType: ContentFeedType;
    };
    const item = data.item;
    const contentType = data.contentType;

    // Extract facts from description
    const facts: Fact[] = [];
    if (item.description) {
      facts.push({
        fact: this.stripHtml(item.description),
        source: item.link,
        verifiedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      });
    }

    // Extract images from various RSS fields
    const images: Image[] = [];
    const imageUrl =
      item.mediaContent?.url ||
      item.enclosure?.url ||
      this.extractImageFromContent(item.contentEncoded);

    if (imageUrl) {
      images.push({
        url: imageUrl,
        source: "rollingstone",
        caption: item.title,
      });
    }

    // Generate hook from description
    const hook = this.extractHook(item.description || item.title);

    // Calculate viral score
    const viralScore = this.calculateViralScore(item, contentType);

    // Calculate expiry
    const expiresAt =
      contentType === "breaking_news"
        ? new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
        : contentType === "trending"
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          : undefined;

    // Clean body text
    const body = this.normalizeBody(item);

    const itemNormalized: ContentFeedItem = {
      source: this.name,
      sourceId: raw.externalId,
      sourceUrl: item.link,
      title: this.truncateTitle(item.title),
      contentHash: "",
      tenantId: null,
      isShared: true,
      metadata: {
        pubDate: item.pubDate,
        categories: item.category,
        sourceName: "Rolling Stone",
      },
      contentType,
      body,
      hook,
      facts,
      images,
      tags: this.extractTags(item),
      publishAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      expiresAt,
      viralScore,
    };

    itemNormalized.contentHash = this.calculateHash(itemNormalized);

    return itemNormalized;
  }

  /**
   * Calculate content hash.
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
   * Health check for Rolling Stone.
   */
  async health(ctx: ConnectorContext): Promise<HealthStatus> {
    return this.defaultHealthCheck(RSS_URL, 5000);
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  /**
   * Simple RSS parser (without external dependencies).
   */
  private parseRSS(xmlText: string): RSSFeed {
    const feed: RSSFeed = {
      channel: {
        title: this.extractTag(xmlText, "<title>"),
        link: this.extractTag(xmlText, "<link>"),
        description: this.extractTag(xmlText, "<description>"),
        item: [],
      },
    };

    // Extract all items
    const itemMatches = xmlText.match(/<item[^>]*>[\s\S]*?<\/item>/gi);
    if (!itemMatches) return feed;

    for (const itemXml of itemMatches) {
      const item: Partial<RSSItem> = {
        title: this.extractTag(itemXml, "<title>"),
        link: this.extractTag(itemXml, "<link>"),
        description: this.decodeHtml(this.extractTag(itemXml, "<description>")),
        pubDate: this.extractTag(itemXml, "<pubDate>"),
      };

      // Try to extract categories
      const categoryMatches = itemXml.match(
        /<category[^>]*>([^<]+)<\/category>/gi,
      );
      if (categoryMatches) {
        item.category = categoryMatches.map((c) =>
          this.decodeHtml(c.replace(/<[^>]+>/g, "")),
        );
      }

      // Extract media:content
      const mediaContentMatch = itemXml.match(
        /<media:content[^>]*url="([^"]+)"/,
      );
      if (mediaContentMatch) {
        item.mediaContent = { url: mediaContentMatch[1] };
      }

      // Extract enclosure
      const enclosureMatch = itemXml.match(
        /<enclosure[^>]*url="([^"]+)"[^>]*>/i,
      );
      if (enclosureMatch) {
        item.enclosure = { url: enclosureMatch[1], type: "image/jpeg" };
      }

      // Extract content:encoded
      const contentEncoded = this.extractTag(itemXml, "<content:encoded>");
      if (contentEncoded) {
        item.contentEncoded = contentEncoded;
      }

      if (item.title && item.link) {
        feed.channel.item.push(item as RSSItem);
      }
    }

    return feed;
  }

  /**
   * Extract content between tags.
   */
  private extractTag(xml: string, tag: string): string {
    const startTag = tag.toLowerCase();
    const endTag = `</${startTag.slice(1)}`;

    const startIndex = xml.toLowerCase().indexOf(startTag);
    if (startIndex === -1) return "";

    const contentStart = startIndex + startTag.length;
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
      .replace(/&nbsp;/g, " ");
  }

  /**
   * Strip HTML tags from text.
   */
  private stripHtml(html: string): string {
    if (!html) return "";
    return html
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Generate unique external ID.
   */
  private generateExternalId(item: RSSItem): string {
    const normalizedUrl = normalizeForHash(item.link);
    return this.shortHash(normalizedUrl);
  }

  /**
   * Detect content type from item.
   */
  private detectContentType(item: RSSItem): ContentFeedType {
    const categoryText = Array.isArray(item.category)
      ? item.category.join(" ")
      : item.category || "";
    const text =
      `${item.title} ${item.description || ""} ${categoryText}`.toLowerCase();

    // Breaking news keywords
    const breakingKeywords = [
      "murio",
      "fallecio",
      "breaking",
      "ultimo",
      "exclusivo",
      "triste",
    ];

    if (breakingKeywords.some((kw) => text.includes(kw))) {
      return "breaking_news";
    }

    // Trending keywords
    const trendingKeywords = [
      "anuncia",
      "nuevo",
      "album",
      "album",
      "gira",
      "tour",
      "show",
      "festival",
    ];

    if (trendingKeywords.some((kw) => text.includes(kw))) {
      return "trending";
    }

    return "trending";
  }

  /**
   * Check if item is music-related.
   */
  private isMusicRelated(item: RSSItem): boolean {
    const categoryText = Array.isArray(item.category)
      ? item.category.join(" ")
      : item.category || "";
    const text =
      `${item.title} ${item.description || ""} ${categoryText}`.toLowerCase();

    const musicKeywords = [
      "musica",
      "music",
      "cancion",
      "song",
      "album",
      "album",
      "banda",
      "band",
      "cantante",
      "singer",
      "artista",
      "artist",
      "rock",
      "pop",
      "reggaeton",
      "trap",
      "latin",
      "festival",
      "concierto",
      "concert",
      "gira",
      "tour",
    ];

    return musicKeywords.some((kw) => text.includes(kw));
  }

  /**
   * Extract hook from description.
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
    if (item.contentEncoded) {
      body = this.stripHtml(item.contentEncoded);
    }

    return this.truncate(body.replace(/\s+/g, " ").trim(), 500);
  }

  /**
   * Extract image URL from content:encoded HTML.
   */
  private extractImageFromContent(content: string | undefined): string | null {
    if (!content) return null;

    const imgMatch = content.match(/<img[^>]+src="([^"]+)"/i);
    return imgMatch ? imgMatch[1] : null;
  }

  /**
   * Extract tags from categories and text.
   */
  private extractTags(item: RSSItem): string[] {
    const tags: string[] = ["music", "rollingstone"];

    const categories = Array.isArray(item.category)
      ? item.category
      : item.category
        ? [item.category]
        : [];

    for (const cat of categories) {
      const normalized = cat.toLowerCase();
      if (normalized.includes("rock")) tags.push("rock");
      if (normalized.includes("pop")) tags.push("pop");
      if (normalized.includes("latin")) tags.push("latin");
      if (normalized.includes("argentina")) tags.push("argentina");
    }

    return [...new Set(tags)];
  }

  /**
   * Calculate viral score.
   */
  private calculateViralScore(
    item: RSSItem,
    contentType: ContentFeedType,
  ): number {
    let score = 55; // Base

    // Breaking news gets higher score
    if (contentType === "breaking_news") {
      score = 85;
    } else if (contentType === "trending") {
      score = 65;
    }

    // Image boost
    if (item.mediaContent?.url || item.enclosure?.url) {
      score += 10;
    }

    // Has categories
    if (
      item.category &&
      (Array.isArray(item.category) ? item.category.length > 0 : item.category)
    ) {
      score += 5;
    }

    return Math.min(score, 100);
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
// Factory function
// ============================================================================

export function createRollingStoneConnector(
  cache?: IngestionCache,
): RollingStoneConnector {
  return new RollingStoneConnector(
    {
      sourceId: "rollingstone",
      sourceType: "scraper",
      isShared: true,
      baseUrl: BASE_URL,
      rateLimitRps: 0.1, // 1 request per 10 seconds (polite scraping)
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
