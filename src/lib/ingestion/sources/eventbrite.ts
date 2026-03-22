/**
 * Eventbrite Argentina Connector - System A
 *
 * Fetches music events from Eventbrite API, focusing on Argentina.
 * Good for indie artists and smaller events not covered by Ticketmaster.
 *
 * @module ingestion/sources/eventbrite
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

interface EventbriteImage {
  url: string;
  width?: number;
  height?: number;
}

interface EventbriteVenue {
  id?: string;
  name?: string;
  address?: {
    localized_address_display?: string;
    city?: string;
    region?: string;
    country?: string;
    latitude?: string;
    longitude?: string;
  };
  resource_uri?: string;
}

interface EventbriteOrganizer {
  id?: string;
  name?: string;
  description?: string;
  url?: string;
}

interface EventbriteEvent {
  id: string;
  name: {
    text: string;
    html?: string;
  };
  description?: {
    text?: string;
    html?: string;
  };
  url?: string;
  start?: {
    timezone?: string;
    local?: string;
    utc?: string;
  };
  end?: {
    timezone?: string;
    local?: string;
    utc?: string;
  };
  created?: string;
  changed?: string;
  published?: string;
  status?: string;
  currency?: string;
  online_event?: boolean;
  venue_id?: string;
  venue?: EventbriteVenue;
  organizer?: EventbriteOrganizer;
  logo?: {
    url?: string;
  };
  image?: EventbriteImage;
  category_id?: string;
  category?: {
    id?: string;
    name?: string;
    short_name?: string;
  };
  subcategory?: {
    id?: string;
    name?: string;
    short_name?: string;
  };
  tags?: string[];
  is_series?: boolean;
  is_series_parent?: boolean;
  is_free?: boolean;
  version?: string;
  resource_uri?: string;
}

interface EventbriteSearchResponse {
  pagination?: {
    object_count?: number;
    page_number?: number;
    page_size?: number;
    page_count?: number;
    has_more_items?: boolean;
  };
  events?: EventbriteEvent[];
}

// ============================================================================
// Constants
// ============================================================================

const SOURCE_NAME = "eventbrite";
const SOURCE_TYPE: SourceType = "api";

/**
 * Eventbrite category IDs for music.
 */
const MUSIC_CATEGORY_IDS = ["103", "107"];

/**
 * Default location for Argentina search.
 */
const DEFAULT_LOCATION = {
  city: "Buenos Aires",
  country: "AR",
};

/**
 * Search radius in kilometers.
 */
const DEFAULT_RADIUS_KM = 100;

/**
 * Maximum events to fetch per request.
 */
const PAGE_SIZE = 100;

/**
 * Number of days to look ahead.
 */
const LOOK_AHEAD_DAYS = 90;

// ============================================================================
// Connector Implementation
// ============================================================================

export class EventbriteConnector extends BaseConnector<NormalizedEvent> {
  readonly name = SOURCE_NAME;
  readonly sourceType = SOURCE_TYPE;

  private apiKey: string;

  constructor(
    config?: Partial<ConstructorParameters<typeof BaseConnector>[0]> & {
      apiKey?: string;
    },
  ) {
    const resolvedApiKey = config?.apiKey || process.env.EVENTBRITE_API_KEY;

    if (!resolvedApiKey) {
      throw new Error(
        "Eventbrite API key is required. Set EVENTBRITE_API_KEY environment variable.",
      );
    }

    super({
      sourceId: SOURCE_NAME,
      sourceType: SOURCE_TYPE,
      isShared: true,
      apiKey: resolvedApiKey,
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
   * Fetch music events from Eventbrite API.
   */
  async fetch(ctx: ConnectorContext): Promise<RawEvent[]> {
    const allEvents: RawEvent[] = [];

    for (const categoryId of MUSIC_CATEGORY_IDS) {
      try {
        const categoryEvents = await this.fetchCategoryEvents(categoryId, ctx);
        allEvents.push(...categoryEvents);

        this.log(
          "info",
          `Fetched ${categoryEvents.length} events for category ${categoryId}`,
        );
      } catch (error) {
        this.log("error", `Failed to fetch category ${categoryId}`, {
          error: this.getErrorMessage(error),
        });
      }
    }

    const uniqueEvents = this.deduplicateById(allEvents);

    this.log("info", `Total unique events: ${uniqueEvents.length}`);
    return uniqueEvents;
  }

  /**
   * Normalize an Eventbrite raw event to NormalizedEvent format.
   */
  async normalize(raw: RawEvent): Promise<NormalizedEvent> {
    const event = raw.rawData as EventbriteEvent;

    const eventDate = this.parseEventDate(event);
    const venue = event.venue;

    return {
      source: SOURCE_NAME,
      sourceId: raw.externalId,
      sourceUrl: event.url || "",
      title: event.name?.text || "Untitled Event",
      contentHash: this.calculateHashFromEvent(event),
      tenantId: null,
      isShared: true,
      metadata: {
        eventbriteId: event.id,
        eventStatus: event.status,
        isOnline: event.online_event,
        isSeries: event.is_series,
        isFree: event.is_free,
        organizerName: event.organizer?.name,
        categoryId: event.category_id,
        categoryName: event.category?.name,
        subcategoryName: event.subcategory?.name,
        tags: event.tags,
      },
      eventType: this.determineEventType(event),
      eventDate,
      year: undefined,
      location: this.extractLocation(venue),
      artists: this.extractArtists(event),
      images: this.extractImages(event),
      tags: this.extractTags(event),
      description: this.extractDescription(event),
      priority: PRIORITY.MEDIUM,
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
    return this.hashString(`${artistKey}|${item.eventDate}|${venueKey}`);
  }

  /**
   * Health check for Eventbrite API.
   */
  async health(_ctx: ConnectorContext): Promise<HealthStatus> {
    return this.defaultHealthCheck(
      "https://www.eventbriteapi.com/v3/events/search/",
      5000,
    );
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Fetch events for a specific category.
   */
  private async fetchCategoryEvents(
    categoryId: string,
    ctx: ConnectorContext,
  ): Promise<RawEvent[]> {
    const events: RawEvent[] = [];
    let page = 1;
    let hasMore = true;

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + LOOK_AHEAD_DAYS);

    while (hasMore) {
      const params = new URLSearchParams({
        token: this.apiKey,
        categories: categoryId,
        location: DEFAULT_LOCATION.city,
        "location.within": `${DEFAULT_RADIUS_KM}km`,
        "start_date.range_start": startDate.toISOString(),
        "start_date.range_end": endDate.toISOString(),
        page_size: PAGE_SIZE.toString(),
        page: page.toString(),
      });

      const url = `https://www.eventbriteapi.com/v3/events/search/?${params}`;

      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        });

        if (response.status === 401) {
          throw new Error("Eventbrite API key is invalid");
        }

        if (response.status === 429) {
          this.log("warn", "Rate limited, stopping pagination");
          break;
        }

        if (!response.ok) {
          throw new Error(`Eventbrite API error: ${response.status}`);
        }

        const data: EventbriteSearchResponse = await response.json();

        if (!data.events || data.events.length === 0) {
          hasMore = false;
          break;
        }

        for (const event of data.events) {
          events.push(this.toRawEvent(event));
        }

        const pageCount = data.pagination?.page_count || 1;
        hasMore = page < pageCount && data.events.length === PAGE_SIZE;
        page++;
      } catch (error) {
        this.log("error", `Error fetching page ${page}`, {
          error: this.getErrorMessage(error),
        });
        break;
      }
    }

    return events;
  }

  /**
   * Convert Eventbrite event to RawEvent format.
   */
  private toRawEvent(event: EventbriteEvent): RawEvent {
    return {
      sourceId: SOURCE_NAME,
      externalId: event.id,
      rawData: event,
      fetchedAt: new Date(),
    };
  }

  /**
   * Deduplicate events by ID.
   */
  private deduplicateById(events: RawEvent[]): RawEvent[] {
    const seen = new Set<string>();
    return events.filter((event) => {
      if (seen.has(event.externalId)) {
        return false;
      }
      seen.add(event.externalId);
      return true;
    });
  }

  /**
   * Parse event date from Eventbrite event.
   */
  private parseEventDate(event: EventbriteEvent): string {
    const localDateStr = event.start?.local;

    if (!localDateStr) {
      return new Date().toISOString().split("T")[0];
    }

    try {
      return new Date(localDateStr).toISOString().split("T")[0];
    } catch {
      return new Date().toISOString().split("T")[0];
    }
  }

  /**
   * Determine event type (festival vs concert).
   */
  private determineEventType(event: EventbriteEvent): "concert" | "festival" {
    const nameLower = event.name?.text?.toLowerCase() || "";
    const tags = event.tags || [];

    const festivalIndicators = ["festival", "fest", "tour", "series"];

    if (
      festivalIndicators.some(
        (ind) =>
          nameLower.includes(ind) ||
          tags.some((tag) => tag.toLowerCase().includes(ind)),
      )
    ) {
      return "festival";
    }

    return "concert";
  }

  /**
   * Extract location from venue.
   */
  private extractLocation(
    venue?: EventbriteVenue,
  ): NormalizedEvent["location"] {
    if (!venue) {
      return {
        city: DEFAULT_LOCATION.city,
        country: DEFAULT_LOCATION.country,
      };
    }

    return {
      city: venue.address?.city || DEFAULT_LOCATION.city,
      region: venue.address?.region,
      country: venue.address?.country || DEFAULT_LOCATION.country,
      venue: venue.name,
    };
  }

  /**
   * Extract artists from event.
   */
  private extractArtists(event: EventbriteEvent): NormalizedEvent["artists"] {
    const description = event.description?.text || "";
    const organizerName = event.organizer?.name;

    const artistPatterns = [
      /presents?[:\s]+([^.!?]+?)(?:\s+(?:in|at|with|on|$|\.))/i,
      /^([^.!?]+?)\s+(?:en\s+vivo|live|in\s+concert)/i,
      /^([^.!?-]+?)\s*-\s*(?:concert|show|performance|live)/i,
    ];

    const artists: NormalizedEvent["artists"] = [];

    for (const pattern of artistPatterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        const artistName = match[1].trim();
        if (artistName.length > 1 && artistName.length < 100) {
          artists.push({
            name: artistName,
            normalizedName: this.normalizeArtistName(artistName),
          });
        }
      }
    }

    if (artists.length === 0 && organizerName) {
      const isLikelyArtist =
        !/venue|palacio|teatro|centro|auditorio|sala|stage/i.test(
          organizerName,
        );

      if (isLikelyArtist) {
        artists.push({
          name: organizerName,
          normalizedName: this.normalizeArtistName(organizerName),
        });
      }
    }

    return artists.length > 0 ? artists : undefined;
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
  private extractImages(event: EventbriteEvent): NormalizedEvent["images"] {
    const images: NormalizedEvent["images"] = [];

    if (event.logo?.url) {
      images.push({
        url: event.logo.url,
        source: "eventbrite",
        caption: event.name?.text,
        license: undefined,
      });
    }

    if (event.image?.url && event.image.url !== event.logo?.url) {
      images.push({
        url: event.image.url,
        source: "eventbrite",
        caption: event.name?.text,
        license: undefined,
      });
    }

    return images.length > 0 ? images.slice(0, 5) : undefined;
  }

  /**
   * Extract tags from event.
   */
  private extractTags(event: EventbriteEvent): string[] {
    const tags: string[] = ["concierto", "eventbrite"];

    if (event.category?.name) {
      tags.push(event.category.name.toLowerCase());
    }

    if (event.subcategory?.name) {
      tags.push(event.subcategory.name.toLowerCase());
    }

    if (event.tags) {
      tags.push(...event.tags.slice(0, 5).map((t) => t.toLowerCase()));
    }

    tags.push("argentina");

    return [...new Set(tags)];
  }

  /**
   * Extract description from event.
   */
  private extractDescription(event: EventbriteEvent): string | undefined {
    const desc = event.description?.text || event.description?.html || "";

    if (desc.length > 50) {
      const plainText = desc.replace(/<[^>]+>/g, "").trim();

      if (plainText.length > 500) {
        return plainText.slice(0, 500) + "...";
      }

      return plainText;
    }

    return undefined;
  }

  /**
   * Calculate hash from event components.
   */
  private calculateHashFromEvent(event: EventbriteEvent): string {
    const artistKey = event.organizer?.name
      ? this.normalizeArtistName(event.organizer.name)
      : "";

    const venueKey = event.venue?.name || "";

    const dateStr =
      event.start?.local || new Date().toISOString().split("T")[0];

    return this.hashString(`${artistKey}|${dateStr}|${venueKey}`);
  }
}

// ============================================================================
// Export
// ============================================================================

export default EventbriteConnector;
