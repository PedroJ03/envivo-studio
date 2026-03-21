/**
 * GNews Connector - System B
 *
 * Fetches music news from GNews API.
 * API docs: https://gnews.io/docs/v4
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

// GNews response types
interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  publishedAt: string;
  source: {
    name: string;
    url: string;
  };
}

interface GNewsResponse {
  totalArticles: number;
  articles: GNewsArticle[];
}

// Music-related search terms
const MUSIC_TERMS = [
  "music",
  "concert",
  "album release",
  "musician",
  "band",
  "festival",
];

export class GNewsConnector extends BaseConnector<ContentFeedItem> {
  readonly name = "gnews";
  readonly sourceType = "api" as const;

  private readonly baseUrl = "https://gnews.io/api/v4";
  private readonly defaultMax = 10;

  constructor(config: SourceConnectorConfig, cache?: IngestionCache) {
    super(config, cache);
  }

  /**
   * Fetch raw items from GNews.
   */
  async fetch(ctx: ConnectorContext): Promise<RawFeedItem[]> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error("GNews API key is required");
    }

    // Build search query
    const query = MUSIC_TERMS.join(" OR ");
    const params = new URLSearchParams({
      q: query,
      lang: "en,es",
      country: "AR,US,MX",
      max: this.defaultMax.toString(),
      apikey: apiKey,
    });

    const url = `${this.baseUrl}/search?${params}`;

    this.log("info", "Fetching from GNews", { query });

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.text();

      if (response.status === 401) {
        throw new Error(`GNews authentication failed: ${error}`);
      }

      if (response.status === 429) {
        throw new Error(`GNews rate limit exceeded: ${error}`);
      }

      throw new Error(`GNews request failed (${response.status}): ${error}`);
    }

    const data: GNewsResponse = await response.json();

    this.log("info", `Received ${data.articles.length} articles from GNews`);

    const items: RawFeedItem[] = [];

    for (const article of data.articles) {
      if (!article.title || article.title === "[Removed]") {
        continue;
      }

      // GNews tends to have more trending content
      const contentType = this.detectContentType(article);

      items.push({
        sourceId: this.name,
        externalId: this.generateExternalId(article),
        rawData: {
          article,
          contentType,
          fetchedAt: new Date().toISOString(),
        },
        fetchedAt: new Date(),
      });
    }

    return items;
  }

  /**
   * Normalize GNews article to ContentFeedItem.
   */
  async normalize(raw: RawFeedItem): Promise<ContentFeedItem> {
    const data = raw.rawData as {
      article: GNewsArticle;
      contentType: ContentFeedType;
    };
    const article = data.article;
    const contentType = data.contentType;

    // Extract facts
    const facts: Fact[] = [];
    if (article.description) {
      facts.push({
        fact: article.description,
        source: article.url,
        verifiedAt: new Date(article.publishedAt),
      });
    }

    // Extract images
    const images: Image[] = [];
    if (article.image) {
      images.push({
        url: article.image,
        source: "gnews",
        caption: article.title,
      });
    }

    // Generate hook
    const hook = this.extractHook(article.description || article.title);

    // Calculate viral score
    const viralScore = this.calculateViralScore(article, contentType);

    // Calculate expiry
    const expiresAt =
      contentType === "breaking_news"
        ? new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
        : contentType === "trending"
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          : undefined;

    // Normalize body
    const body = this.normalizeBody(article);

    const item: ContentFeedItem = {
      source: this.name,
      sourceId: raw.externalId,
      sourceUrl: article.url,
      title: this.truncateTitle(article.title),
      contentHash: "",
      tenantId: null,
      isShared: true,
      metadata: {
        sourceName: article.source.name,
        sourceUrl: article.source.url,
        publishedAt: article.publishedAt,
        description: article.description,
      },
      contentType,
      body,
      hook,
      facts,
      images,
      tags: this.extractTags(article),
      publishAt: new Date(article.publishedAt),
      expiresAt,
      viralScore,
    };

    item.contentHash = this.calculateHash(item);

    return item;
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
   * Health check for GNews.
   */
  async health(ctx: ConnectorContext): Promise<HealthStatus> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      return {
        healthy: false,
        error: "API key not configured",
      };
    }

    // GNews doesn't have a dedicated health endpoint, use search with minimal params
    const url = `${this.baseUrl}/search?q=test&apikey=${apiKey}`;
    return this.defaultHealthCheck(url, 5000);
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  /**
   * Generate unique external ID.
   */
  private generateExternalId(article: GNewsArticle): string {
    const normalizedUrl = normalizeForHash(article.url);
    return this.shortHash(normalizedUrl);
  }

  /**
   * Detect content type.
   */
  private detectContentType(article: GNewsArticle): ContentFeedType {
    const text = `${article.title} ${article.description || ""}`.toLowerCase();

    // Breaking news keywords
    const breakingKeywords = [
      "dies",
      "passed away",
      "fallece",
      "murió",
      "anuncia",
      "cancels",
      "breaking",
      "urgent",
    ];

    const isBreaking = breakingKeywords.some((kw) =>
      text.includes(kw.toLowerCase()),
    );

    if (isBreaking) {
      return "breaking_news";
    }

    // Trending keywords
    const trendingKeywords = [
      "announces",
      "releases",
      "drops",
      "new album",
      "first look",
      "exclusive",
      "reunion",
    ];

    const isTrending = trendingKeywords.some((kw) =>
      text.includes(kw.toLowerCase()),
    );

    return isTrending ? "trending" : "trending";
  }

  /**
   * Extract hook from text.
   */
  private extractHook(text: string): string {
    if (!text) return "";

    const match = text.match(/^[^.!?]+[.!?]/);
    const hook = match ? match[0] : text.slice(0, 100);

    return this.truncate(hook, 100);
  }

  /**
   * Normalize body text.
   */
  private normalizeBody(article: GNewsArticle): string {
    let body = article.content || article.description || "";
    body = body.replace(/\s+/g, " ").trim();
    return body;
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

  /**
   * Extract tags from article.
   */
  private extractTags(article: GNewsArticle): string[] {
    const tags: string[] = ["music", "news"];

    // Detect language
    if (
      article.title.includes("ía") ||
      article.title.includes("ñ") ||
      article.title.includes("ción")
    ) {
      tags.push("spanish", "latam");
    } else {
      tags.push("english");
    }

    // Detect genre
    const text = `${article.title} ${article.description || ""}`.toLowerCase();

    if (text.includes("rock")) tags.push("rock");
    if (text.includes("pop")) tags.push("pop");
    if (text.includes("reggaeton") || text.includes("latin"))
      tags.push("latin");

    return [...new Set(tags)];
  }

  /**
   * Calculate viral score.
   */
  private calculateViralScore(
    article: GNewsArticle,
    contentType: ContentFeedType,
  ): number {
    let score = 50;

    switch (contentType) {
      case "breaking_news":
        score = 85;
        break;
      case "trending":
        score = 65;
        break;
    }

    if (article.image) {
      score += 10;
    }

    return Math.min(score, 100);
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createGNewsConnector(
  apiKey: string,
  cache?: IngestionCache,
): GNewsConnector {
  return new GNewsConnector(
    {
      sourceId: "gnews",
      sourceType: "api",
      isShared: true,
      apiKey,
      rateLimitRps: 0.167, // ~10 requests per minute
      retryConfig: {
        maxRetries: 3,
        backoffMs: 2000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeoutMs: 300000,
      },
    },
    cache,
  );
}
