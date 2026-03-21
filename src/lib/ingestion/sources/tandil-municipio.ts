/**
 * Tandil Municipalidad Scraper - System A
 *
 * Scrapes local events from the Municipality of Tandil website.
 * This is a tenant-local source (not shared) - only for tandil tenant.
 *
 * @module ingestion/sources/tandil-municipio
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

interface ScrapedEvent {
  title: string;
  date: string;
  description?: string;
  location?: string;
  url?: string;
  imageUrl?: string;
}

// ============================================================================
// Constants
// ============================================================================

const SOURCE_NAME = "tandil_municipio";
const SOURCE_TYPE: SourceType = "scraper";

/**
 * Base URL for Tandil municipal agenda.
 */
const BASE_URL = "https://www.tandil.gov.ar/agenda";

/**
 * CSS selectors for extracting event data.
 */
const SELECTORS = {
  eventContainer:
    ".evento, .event-item, article.evento, .agenda-item, [class*='event']",
  title: ".titulo, .evento-titulo, h2, h3, .event-title, [class*='title']",
  date: ".fecha, .evento-fecha, time[datetime], .date, [class*='date']",
  description:
    ".descripcion, .evento-descripcion, .extracto, p, [class*='description']",
  location: ".lugar, .evento-lugar, .venue, [class*='location']",
  link: "a[href]",
  image: "img[src]",
} as const;

/**
 * Date format patterns.
 */
const DATE_PATTERNS = [
  {
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
    regex: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    parse: (match: RegExpMatchArray): Date => {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      return new Date(year, month, day);
    },
  },
  {
    regex: /(\d{4})-(\d{2})-(\d{2})/,
    parse: (match: RegExpMatchArray): Date => {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new Date(year, month, day);
    },
  },
  {
    regex: /(\w+)\s+(\d{1,2}),?\s+(\d{4})/i,
    parse: (match: RegExpMatchArray): Date => {
      const monthStr = match[1].toLowerCase();
      const month = MONTH_MAP[monthStr] ?? 0;
      const day = parseInt(match[2], 10);
      const year = parseInt(match[3], 10);
      return new Date(year, month, day);
    },
  },
] as const;

/**
 * Month name mappings.
 */
const MONTH_MAP: Record<string, number> = {
  enero: 0,
  february: 1,
  febrero: 1,
  march: 2,
  marzo: 2,
  april: 3,
  abril: 3,
  may: 4,
  mayo: 4,
  june: 5,
  junio: 5,
  july: 6,
  julio: 6,
  august: 7,
  agosto: 7,
  september: 8,
  septiembre: 8,
  october: 9,
  octubre: 9,
  november: 10,
  noviembre: 10,
  december: 11,
  diciembre: 11,
};

/**
 * Get Tandil tenant ID.
 */
function getTandilTenantId(): string {
  return process.env.TANDIL_TENANT_ID || "00000000-0000-0000-0000-000000000000";
}

// ============================================================================
// Connector Implementation
// ============================================================================

export class TandilMunicipioConnector extends BaseConnector<NormalizedEvent> {
  readonly name = SOURCE_NAME;
  readonly sourceType = SOURCE_TYPE;

  private tenantId: string;

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
   * Fetch events from Tandil municipal website.
   */
  async fetch(ctx: ConnectorContext): Promise<RawEvent[]> {
    const url = this.config.baseUrl || BASE_URL;

    this.log("info", `Fetching Tandil municipal agenda from ${url}`);

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "EnvivoStudio/1.0 (content-ingestion)",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();

      const events = this.parseHtml(html);

      this.log("info", `Extracted ${events.length} events from municipal site`);

      return events.map((event) => this.toRawEvent(event));
    } catch (error) {
      this.log("error", "Failed to fetch municipal agenda", {
        error: this.getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * Normalize a scraped event to NormalizedEvent format.
   */
  async normalize(raw: RawEvent): Promise<NormalizedEvent> {
    const event = raw.rawData as ScrapedEvent;

    const parsedDate = this.parseDate(event.date);

    return {
      source: SOURCE_NAME,
      sourceId: raw.externalId,
      sourceUrl: event.url || BASE_URL,
      title: event.title,
      contentHash: this.calculateHashFromEvent(event, parsedDate),
      tenantId: this.tenantId,
      isShared: false,
      metadata: {
        originalDateRaw: event.date,
        originalDescriptionRaw: event.description,
        scrapedAt: raw.fetchedAt,
      },
      eventType: "local_event",
      eventDate: parsedDate,
      year: parsedDate.getFullYear(),
      location: this.extractLocation(event.location),
      artists: undefined,
      images: event.imageUrl
        ? [
            {
              url: event.imageUrl,
              source: "tandil_municipio",
              caption: event.title,
              license: undefined,
            },
          ]
        : undefined,
      tags: ["tandil", "evento-local", "municipalidad"],
      description: event.description,
      priority: PRIORITY.MEDIUM,
    };
  }

  /**
   * Calculate content hash for deduplication.
   */
  calculateHash(item: NormalizedEvent): string {
    return this.hashString(
      `${item.title}|${item.eventDate.toISOString().split("T")[0]}|${item.location?.venue || ""}`,
    );
  }

  /**
   * Health check for municipal website.
   */
  async health(_ctx: ConnectorContext): Promise<HealthStatus> {
    return this.defaultHealthCheck(BASE_URL, 10000);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Parse HTML to extract event data.
   */
  private parseHtml(html: string): ScrapedEvent[] {
    const events: ScrapedEvent[] = [];

    const eventMatches = html.match(
      /<article[^>]*class="[^"]*event[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
    );

    if (!eventMatches) {
      const divMatches = html.match(
        /<div[^>]*class="[^"]*agenda[^"]*"[^>]*>([\s\S]*?)<\/div>/gi,
      );

      if (!divMatches) {
        this.log("warn", "Could not find event containers in HTML");
        return events;
      }

      for (const div of divMatches) {
        const event = this.extractEventFromHtml(div);
        if (event) {
          events.push(event);
        }
      }
    } else {
      for (const article of eventMatches) {
        const event = this.extractEventFromHtml(article);
        if (event) {
          events.push(event);
        }
      }
    }

    return events;
  }

  /**
   * Extract event data from HTML element string.
   */
  private extractEventFromHtml(html: string): ScrapedEvent | null {
    const titleMatch = html.match(/<h[23][^>]*>([^<]+)<\/h[23]>/i);
    const title = titleMatch?.[1]?.trim();

    if (!title) {
      return null;
    }

    const dateMatch =
      html.match(/datetime="([^"]+)"/) ||
      html.match(/(\d{1,2}\s+de\s+\w+\s+de\s+\d{4})/i) ||
      html.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);
    const date = dateMatch?.[1]?.trim() || "";

    const descMatch = html.match(/<p[^>]*>([^<]+)<\/p>/i);
    const description = descMatch?.[1]?.trim();

    const locMatch = html.match(
      /<span[^>]*class="[^"]*lugar[^"]*"[^>]*>([^<]+)<\/span>/i,
    );
    const location = locMatch?.[1]?.trim();

    const linkMatch = html.match(/<a[^>]+href="([^"]+)"[^>]*>/i);
    const url = linkMatch?.[1]?.trim();

    const imgMatch = html.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
    const imageUrl = imgMatch?.[1]?.trim();

    return {
      title,
      date: date || new Date().toISOString().split("T")[0],
      description,
      location,
      url: url?.startsWith("http") ? url : `${BASE_URL}${url}`,
      imageUrl: imageUrl?.startsWith("http") ? imageUrl : undefined,
    };
  }

  /**
   * Convert scraped event to RawEvent format.
   */
  private toRawEvent(event: ScrapedEvent): RawEvent {
    return {
      sourceId: SOURCE_NAME,
      externalId: this.generateExternalId(event),
      rawData: event,
      fetchedAt: new Date(),
    };
  }

  /**
   * Generate unique external ID.
   */
  private generateExternalId(event: ScrapedEvent): string {
    const key = `${event.title}|${event.date}`;
    return `tandil-${this.shortHash(key)}`;
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
          // Continue
        }
      }
    }

    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }

    this.log("warn", `Could not parse date: ${dateStr}, using today`);
    return new Date();
  }

  /**
   * Extract location.
   */
  private extractLocation(locationStr?: string): NormalizedEvent["location"] {
    if (!locationStr) {
      return {
        city: "Tandil",
        region: "Buenos Aires",
        country: "Argentina",
      };
    }

    return {
      city: "Tandil",
      region: "Buenos Aires",
      country: "Argentina",
      venue: locationStr,
    };
  }

  /**
   * Calculate hash.
   */
  private calculateHashFromEvent(event: ScrapedEvent, date: Date): string {
    return this.hashString(
      `${event.title}|${date.toISOString().split("T")[0]}|${event.location || ""}`,
    );
  }
}

// ============================================================================
// Export
// ============================================================================

export default TandilMunicipioConnector;
