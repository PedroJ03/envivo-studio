/**
 * Ticketmaster Discovery API Connector - System A
 *
 * Fetches concert and festival events from Ticketmaster Discovery API.
 * Filters for music events in Argentina, US, Mexico, and Spain.
 * Handles rate limiting (5000 requests/day) with aggressive caching.
 *
 * @module ingestion/sources/ticketmaster
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

interface TicketmasterImage {
  url: string;
  width?: number;
  height?: number;
  ratio?: string;
}

interface TicketmasterVenue {
  name?: string;
  city?: {
    name?: string;
  };
  state?: {
    name?: string;
    stateCode?: string;
  };
  country?: {
    name?: string;
    countryCode?: string;
  };
  location?: {
    latitude?: string;
    longitude?: string;
  };
}

interface TicketmasterAttraction {
  id?: string;
  name?: string;
  url?: string;
  images?: TicketmasterImage[];
  classifications?: Array<{
    primary?: boolean;
    segment?: {
      id?: string;
      name?: string;
    };
    genre?: {
      id?: string;
      name?: string;
    };
    subGenre?: {
      id?: string;
      name?: string;
    };
  }>;
}

interface TicketmasterEvent {
  id: string;
  name: string;
  type?: string;
  url?: string;
  images?: TicketmasterImage[];
  dates?: {
    start?: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
      approximate?: boolean;
    };
    end?: {
      localDate?: string;
      localTime?: string;
      dateTime?: string;
    };
    status?: {
      code?: string;
    };
  };
  priceRanges?: Array<{
    type?: string;
    currency?: string;
    min?: number;
    max?: number;
  }>;
  _embedded?: {
    venues?: TicketmasterVenue[];
    attractions?: TicketmasterAttraction[];
  };
  info?: string;
  pleaseNote?: string;
}

interface TicketmasterResponse {
  _embedded?: {
    events?: TicketmasterEvent[];
  };
  page?: {
    totalElements?: number;
    totalPages?: number;
    number?: number;
    size?: number;
  };
  _links?: {
    self?: {
      href?: string;
    };
    next?: {
      href?: string;
    };
  };
}

// ============================================================================
// Constants
// ============================================================================

const SOURCE_NAME = "ticketmaster";
const SOURCE_TYPE: SourceType = "api";

/**
 * Target markets for event search.
 */
const TARGET_MARKETS = ["AR", "US", "MX", "ES"] as const;

/**
 * 5000 requests/day rate limit.
 */
const RATE_LIMIT_RPS = 0.05;

/**
 * Maximum pages to fetch per market.
 */
const MAX_PAGES_PER_MARKET = 10;

/**
 * Page size (max 200 per Ticketmaster).
 */
const PAGE_SIZE = 200;

/**
 * Number of days to look ahead.
 */
const LOOK_AHEAD_DAYS = 90;

// ============================================================================
// Connector Implementation
// ============================================================================

export class TicketmasterConnector extends BaseConnector<NormalizedEvent> {
  readonly name = SOURCE_NAME;
  readonly sourceType = SOURCE_TYPE;

  private apiKey: string;

  constructor(
    config?: Partial<ConstructorParameters<typeof BaseConnector>[0]> & {
      apiKey?: string;
    },
  ) {
    const resolvedApiKey = config?.apiKey || process.env.TICKETMASTER_API_KEY;

    if (!resolvedApiKey) {
      throw new Error(
        "Ticketmaster API key is required. Set TICKETMASTER_API_KEY environment variable.",
      );
    }

    super({
      sourceId: SOURCE_NAME,
      sourceType: SOURCE_TYPE,
      isShared: true,
      apiKey: resolvedApiKey,
      rateLimitRps: RATE_LIMIT_RPS,
      retryConfig: {
        maxRetries: 3,
        backoffMs: 1000,
      },
      circuitBreaker: {
        failureThreshold: 5,
        resetTimeoutMs: 300000,
      },
      ...config,
    });

    this.apiKey = resolvedApiKey;
  }

  // ============================================================================
  // BaseConnector Abstract Methods
  // ============================================================================

  /**
   * Fetch events from Ticketmaster Discovery API.
   */
  async fetch(ctx: ConnectorContext): Promise<RawEvent[]> {
    const allEvents: RawEvent[] = [];

    for (const market of TARGET_MARKETS) {
      try {
        const marketEvents = await this.fetchMarketEvents(market, ctx);
        allEvents.push(...marketEvents);

        this.log(
          "info",
          `Fetched ${marketEvents.length} events from market ${market}`,
          {
            market,
            total: allEvents.length,
          },
        );
      } catch (error) {
        this.log("error", `Failed to fetch market ${market}`, {
          error: this.getErrorMessage(error),
        });
      }
    }

    this.log("info", `Total events fetched: ${allEvents.length}`);
    return allEvents;
  }

  /**
   * Normalize a Ticketmaster raw event to NormalizedEvent format.
   */
  async normalize(raw: RawEvent): Promise<NormalizedEvent> {
    const event = raw.rawData as TicketmasterEvent;

    const venue = event._embedded?.venues?.[0];
    const attractions = event._embedded?.attractions || [];

    const eventType = this.determineEventType(event);
    const eventDate = this.parseEventDate(event);
    const artists = this.extractArtists(attractions);

    return {
      source: SOURCE_NAME,
      sourceId: raw.externalId,
      sourceUrl: event.url || "",
      title: event.name,
      contentHash: this.calculateHashFromEvent(event, artists),
      tenantId: null,
      isShared: true,
      metadata: {
        ticketmasterId: event.id,
        marketId: event._embedded?.venues?.[0]?.state?.stateCode || "unknown",
        priceRanges: event.priceRanges,
        eventStatus: event.dates?.status?.code,
        eventUrl: event.url,
      },
      eventType,
      eventDate,
      year: undefined,
      location: this.extractLocation(venue),
      artists,
      images: this.extractImages(event.images),
      tags: this.extractTags(event, attractions),
      description: this.extractDescription(event),
      priority: PRIORITY.HIGH,
    };
  }

  /**
   * Calculate content hash for deduplication.
   */
  calculateHash(item: NormalizedEvent): string {
    const artistKey =
      item.artists
        ?.map((a) => a.normalizedName)
        .sort()
        .join("|") || "";
    const venueKey = item.location?.venue || "";
    return this.hashString(
      `${artistKey}|${item.eventDate.toISOString().split("T")[0]}|${venueKey}`,
    );
  }

  /**
   * Health check for Ticketmaster API.
   */
  async health(_ctx: ConnectorContext): Promise<HealthStatus> {
    return this.defaultHealthCheck(
      "https://app.ticketmaster.com/discovery/v2/events.json?apikey=test",
      5000,
    );
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Fetch events for a specific market.
   */
  private async fetchMarketEvents(
    market: string,
    ctx: ConnectorContext,
  ): Promise<RawEvent[]> {
    const events: RawEvent[] = [];
    let page = 0;
    let hasMore = true;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + LOOK_AHEAD_DAYS);

    while (hasMore && page < MAX_PAGES_PER_MARKET) {
      const params = new URLSearchParams({
        apikey: this.apiKey,
        classificationName: "music",
        marketId: market,
        startDateTime: this.formatDateTime(startDate),
        endDateTime: this.formatDateTime(endDate),
        size: PAGE_SIZE.toString(),
        page: page.toString(),
        sort: "date,asc",
      });

      const url = `https://app.ticketmaster.com/discovery/v2/events.json?${params}`;

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (response.status === 429) {
          this.log(
            "warn",
            `Rate limited on market ${market}, stopping pagination`,
            { page },
          );
          break;
        }

        if (response.status === 401) {
          throw new Error("Ticketmaster API key is invalid");
        }

        if (!response.ok) {
          throw new Error(`Ticketmaster API error: ${response.status}`);
        }

        const data: TicketmasterResponse = await response.json();

        if (!data._embedded?.events) {
          hasMore = false;
          break;
        }

        for (const event of data._embedded.events) {
          events.push(this.toRawEvent(event));
        }

        const totalPages = data.page?.totalPages || 0;
        hasMore =
          page + 1 < totalPages && data._embedded.events.length === PAGE_SIZE;
        page++;
      } catch (error) {
        this.log("error", `Error fetching page ${page} for market ${market}`, {
          error: this.getErrorMessage(error),
        });
        break;
      }
    }

    return events;
  }

  /**
   * Convert Ticketmaster event to RawEvent format.
   */
  private toRawEvent(event: TicketmasterEvent): RawEvent {
    return {
      sourceId: SOURCE_NAME,
      externalId: event.id,
      rawData: event,
      fetchedAt: new Date(),
    };
  }

  /**
   * Determine if event is a festival or concert.
   */
  private determineEventType(event: TicketmasterEvent): "concert" | "festival" {
    const nameLower = event.name.toLowerCase();
    const typeLower = event.type?.toLowerCase() || "";

    const festivalIndicators = ["festival", "fest", "tour", "series"];

    if (
      festivalIndicators.some(
        (ind) => nameLower.includes(ind) || typeLower.includes(ind),
      )
    ) {
      return "festival";
    }

    return "concert";
  }

  /**
   * Parse event date from Ticketmaster event.
   */
  private parseEventDate(event: TicketmasterEvent): Date {
    const dateStr = event.dates?.start?.localDate;
    const timeStr = event.dates?.start?.localTime;

    if (!dateStr) {
      return new Date();
    }

    if (timeStr) {
      return new Date(`${dateStr}T${timeStr}`);
    }

    return new Date(dateStr);
  }

  /**
   * Extract location from venue.
   */
  private extractLocation(
    venue?: TicketmasterVenue,
  ): NormalizedEvent["location"] {
    if (!venue) return undefined;

    return {
      city: venue.city?.name,
      region: venue.state?.name || venue.state?.stateCode,
      country: venue.country?.name,
      venue: venue.name,
    };
  }

  /**
   * Extract artists from attractions.
   */
  private extractArtists(
    attractions: TicketmasterAttraction[],
  ): NormalizedEvent["artists"] {
    if (!attractions || attractions.length === 0) return undefined;

    const musicAttractions = attractions.filter((attr) => {
      const genre = attr.classifications?.[0]?.genre?.name?.toLowerCase() || "";
      const segment =
        attr.classifications?.[0]?.segment?.name?.toLowerCase() || "";

      return (
        genre.includes("music") ||
        genre.includes("pop") ||
        genre.includes("rock") ||
        genre.includes("jazz") ||
        genre.includes("classical") ||
        genre.includes("hip") ||
        genre.includes("rap") ||
        genre.includes("latin") ||
        genre.includes("country") ||
        genre.includes("folk") ||
        genre.includes("metal") ||
        genre.includes("punk") ||
        genre.includes("blues") ||
        segment.includes("music")
      );
    });

    return musicAttractions.map((attr) => ({
      name: attr.name || "Unknown Artist",
      normalizedName: this.normalizeArtistName(attr.name || ""),
      externalUrls: attr.url ? { ticketmaster: attr.url } : undefined,
    }));
  }

  /**
   * Normalize artist name for comparison.
   */
  private normalizeArtistName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .trim();
  }

  /**
   * Extract images from event.
   */
  private extractImages(
    images?: TicketmasterImage[],
  ): NormalizedEvent["images"] {
    if (!images || images.length === 0) return undefined;

    const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));

    return sorted.slice(0, 5).map((img) => ({
      url: img.url,
      source: "ticketmaster",
      caption: undefined,
      license: undefined,
    }));
  }

  /**
   * Extract tags from event and attractions.
   */
  private extractTags(
    event: TicketmasterEvent,
    attractions: TicketmasterAttraction[],
  ): string[] {
    const tags: string[] = ["concierto", "ticketmaster"];

    for (const attr of attractions) {
      const genre = attr.classifications?.[0]?.genre?.name;
      const subGenre = attr.classifications?.[0]?.subGenre?.name;

      if (genre) tags.push(genre.toLowerCase());
      if (subGenre) tags.push(subGenre.toLowerCase());
    }

    const venue = event._embedded?.venues?.[0];
    if (venue?.country?.countryCode) {
      tags.push(venue.country.countryCode.toLowerCase());
    }

    if (this.determineEventType(event) === "festival") {
      tags.push("festival");
    }

    return [...new Set(tags)];
  }

  /**
   * Extract description from event.
   */
  private extractDescription(event: TicketmasterEvent): string | undefined {
    const desc = event.pleaseNote || event.info;

    if (desc && desc.length > 50) {
      return desc.slice(0, 500);
    }

    return undefined;
  }

  /**
   * Calculate hash from event components.
   */
  private calculateHashFromEvent(
    event: TicketmasterEvent,
    artists: NormalizedEvent["artists"],
  ): string {
    const artistKey =
      artists
        ?.map((a) => a.normalizedName)
        .sort()
        .join("|") || "";

    const venueKey = event._embedded?.venues?.[0]?.name || "";

    const dateStr =
      event.dates?.start?.localDate || new Date().toISOString().split("T")[0];

    return this.hashString(`${artistKey}|${dateStr}|${venueKey}`);
  }

  /**
   * Format date for Ticketmaster API (ISO 8601).
   */
  private formatDateTime(date: Date): string {
    return date.toISOString().slice(0, 19) + "Z";
  }
}

// ============================================================================
// Export
// ============================================================================

export default TicketmasterConnector;
