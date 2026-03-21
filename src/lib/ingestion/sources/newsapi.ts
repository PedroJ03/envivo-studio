/**
 * NewsAPI Connector - System B
 *
 * Fetches breaking music news from NewsAPI.
 * API docs: https://newsapi.org/docs/endpoints/everything
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

// NewsAPI response types
interface NewsAPIArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

// Music-related keywords for filtering
const BREAKING_KEYWORDS = [
  "murio",
  "died",
  "anuncia",
  "anouncement",
  "reunion",
  "canceled",
  "cancelled",
  "fallecio",
  "breaking",
];

const MUSIC_KEYWORDS = [
  "music",
  "musica",
  "song",
  "album",
  "concert",
  "festival",
  "band",
  "singer",
  "artist",
  "rapper",
  "pop star",
  "rock band",
  "tour",
  "spotify",
  "billboard",
];

export class NewsAPIConnector extends BaseConnector<ContentFeedItem> {
  readonly name = "newsapi";
  readonly sourceType = "api" as const;

  private readonly baseUrl = "https://newsapi.org/v2";
  private readonly defaultPageSize = 50;

  constructor(config: SourceConnectorConfig, cache?: IngestionCache) {
    super(config, cache);
  }

  /**
   * Fetch raw items from NewsAPI.
   * This method is called by fetchWithRetry in the base class.
   */
  async fetch(ctx: ConnectorContext): Promise<RawFeedItem[]> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      throw new Error("NewsAPI API key is required");
    }

    // Build query for music-related content
    const query = this.buildQuery();
    const params = new URLSearchParams({
      q: query,
      language: "en,es",
      sortBy: "relevancy",
      pageSize: this.defaultPageSize.toString(),
      apiKey,
    });

    const url = `${this.baseUrl}/everything?${params}`;

    this.log("info", "Fetching news from NewsAPI", { query });

    // Make HTTP request directly (fetchWithRetry calls this method with retries)
    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.text();

      // Handle API key errors
      if (response.status === 401) {
        throw new Error(`NewsAPI authentication failed: ${error}`);
      }

      // Handle rate limit errors
      if (response.status === 429) {
        throw new Error(`NewsAPI rate limit exceeded: ${error}`);
      }

      throw new Error(`NewsAPI request failed (${response.status}): ${error}`);
    }

    const data: NewsAPIResponse = await response.json();

    if (data.status !== "ok") {
      throw new Error(`NewsAPI returned status: ${data.status}`);
    }

    this.log("info", `Received ${data.articles.length} articles from NewsAPI`);

    // Filter and transform articles
    const items: RawFeedItem[] = [];

    for (const article of data.articles) {
      // Skip articles without required fields
      if (!article.title || article.title === "[Removed]") {
        continue;
      }

      // Determine content type based on keywords and timing
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
   * Normalize a raw article to ContentFeedItem.
   */
  async normalize(raw: RawFeedItem): Promise<ContentFeedItem> {
    const data = raw.rawData as {
      article: NewsAPIArticle;
      contentType: ContentFeedType;
    };
    const article = data.article;
    const contentType = data.contentType;

    // Extract facts from article
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
    if (article.urlToImage) {
      images.push({
        url: article.urlToImage,
        source: "newsapi",
        caption: article.title,
      });
    }

    // Generate hook (first sentence of description or title)
    const hook = this.extractHook(article.description || article.title);

    // Calculate viral score based on content type and relevance
    const viralScore = this.calculateViralScore(article, contentType);

    // Calculate expiry based on content type
    const expiresAt =
      contentType === "breaking_news"
        ? new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
        : contentType === "trending"
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          : undefined;

    // Normalize body text
    const body = this.normalizeBody(article);

    const item: ContentFeedItem = {
      source: this.name,
      sourceId: raw.externalId,
      sourceUrl: article.url,
      title: this.truncateTitle(article.title),
      contentHash: "", // Will be calculated
      tenantId: null, // Shared source
      isShared: true,
      metadata: {
        author: article.author,
        sourceName: article.source.name,
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

    // Calculate content hash
    item.contentHash = this.calculateHash(item);

    return item;
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
   * Health check for NewsAPI.
   */
  async health(ctx: ConnectorContext): Promise<HealthStatus> {
    const apiKey = this.config.apiKey;
    if (!apiKey) {
      return {
        healthy: false,
        error: "API key not configured",
      };
    }

    const url = `${this.baseUrl}/top-headlines?category=entertainment&apiKey=${apiKey}`;
    return this.defaultHealthCheck(url, 5000);
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  /**
   * Build search query for music news.
   */
  private buildQuery(): string {
    // Combine music keywords for broad coverage
    const musicTerms = MUSIC_KEYWORDS.slice(0, 5).join(" OR ");
    return `(${musicTerms})`;
  }

  /**
   * Detect content type based on article content and keywords.
   */
  private detectContentType(article: NewsAPIArticle): ContentFeedType {
    const text = `${article.title} ${article.description || ""}`.toLowerCase();

    // Check for breaking news keywords
    const isBreaking = BREAKING_KEYWORDS.some((kw) =>
      text.includes(kw.toLowerCase()),
    );

    if (isBreaking) {
      return "breaking_news";
    }

    // Check for trending indicators (new releases, announcements)
    const trendingIndicators = [
      "announces",
      "release",
      "drops",
      "new album",
      "new song",
      "debut",
      "first look",
      "exclusive",
    ];

    const isTrending = trendingIndicators.some((ind) =>
      text.includes(ind.toLowerCase()),
    );

    return isTrending ? "trending" : "trending";
  }

  /**
   * Generate unique external ID for article.
   */
  private generateExternalId(article: NewsAPIArticle): string {
    // Use URL as unique identifier (normalize it)
    const normalizedUrl = normalizeForHash(article.url);
    return this.shortHash(normalizedUrl);
  }

  /**
   * Extract hook (first sentence) from text.
   */
  private extractHook(text: string): string {
    if (!text) return "";

    // Find first sentence (ends with . ! or ?)
    const match = text.match(/^[^.!?]+[.!?]/);
    const hook = match ? match[0] : text.slice(0, 100);

    return this.truncate(hook, 100);
  }

  /**
   * Normalize body text from article.
   */
  private normalizeBody(article: NewsAPIArticle): string {
    let body = article.content || article.description || "";

    // Remove [+] characters that NewsAPI adds
    body = body.replace(/\[\+\d+ chars\]/g, "");

    // Clean up whitespace
    body = body.replace(/\s+/g, " ").trim();

    return body;
  }

  /**
   * Truncate title to max 150 characters.
   */
  private truncateTitle(title: string): string {
    return this.truncate(title, 150);
  }

  /**
   * Truncate text to max length.
   */
  private truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + "...";
  }

  /**
   * Extract tags from article.
   */
  private extractTags(article: NewsAPIArticle): string[] {
    const tags: string[] = ["music", "news"];

    const text = `${article.title} ${article.description || ""}`.toLowerCase();

    // Add language tag
    if (article.title.includes("ia") || article.title.includes("ñ")) {
      tags.push("spanish", "latam");
    } else {
      tags.push("english");
    }

    // Detect genre/artist type
    if (text.includes("rock")) tags.push("rock");
    if (text.includes("pop")) tags.push("pop");
    if (text.includes("hip hop") || text.includes("rap")) tags.push("hip-hop");
    if (text.includes("latin") || text.includes("reggaeton"))
      tags.push("latin");

    return [...new Set(tags)];
  }

  /**
   * Calculate viral score based on content type and article features.
   */
  private calculateViralScore(
    article: NewsAPIArticle,
    contentType: ContentFeedType,
  ): number {
    let score = 50; // Base score

    switch (contentType) {
      case "breaking_news":
        score = 90;
        break;
      case "trending":
        score = 70;
        break;
      default:
        score = 50;
    }

    // Boost for having an image
    if (article.urlToImage) {
      score += 10;
    }

    // Boost for having a description
    if (article.description && article.description.length > 100) {
      score += 5;
    }

    return Math.min(score, 100);
  }
}

// ============================================================================
// Factory function for creating connector from config
// ============================================================================

export function createNewsAPIConnector(
  apiKey: string,
  cache?: IngestionCache,
): NewsAPIConnector {
  return new NewsAPIConnector(
    {
      sourceId: "newsapi",
      sourceType: "api",
      isShared: true,
      apiKey,
      rateLimitRps: 0.167, // ~10 requests per minute (free tier)
      retryConfig: {
        maxRetries: 3,
        backoffMs: 2000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeoutMs: 300000, // 5 minutes
      },
    },
    cache,
  );
}
