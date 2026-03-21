/**
 * Wikimedia On This Day Connector - System A
 *
 * Fetches historical music events from Wikimedia On This Day API.
 * Filters for music-related content and normalizes to CalendarEvent schema.
 *
 * @module ingestion/sources/wikimedia-otd
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
import { normalizeForHash, normalizeArtistName } from "../deduplication";

// ============================================================================
// Types
// ============================================================================

interface WikimediaPage {
  title: string;
  extract?: string;
  thumbnail?: {
    source: string;
    width?: number;
    height?: number;
  };
  content_urls?: {
    desktop: {
      page: string;
    };
  };
}

interface WikimediaEvent {
  text: string;
  pages: WikimediaPage[];
  year?: number;
}

interface WikimediaResponse {
  events?: WikimediaEvent[];
  selected?: WikimediaEvent[];
  births?: WikimediaEvent[];
  deaths?: WikimediaEvent[];
  holidays?: WikimediaEvent[];
}

interface RawEventContext {
  eventDate: Date;
  category: string;
}

// ============================================================================
// Constants
// ============================================================================

const SOURCE_NAME = "wikimedia";
const SOURCE_TYPE: SourceType = "api";

/**
 * Music-related keywords for filtering events.
 */
const MUSIC_KEYWORDS = [
  "music",
  "musician",
  "band",
  "singer",
  "song",
  "album",
  "concert",
  "festival",
  "rock",
  "jazz",
  "blues",
  "pop",
  "classical",
  "opera",
  "guitarist",
  "drummer",
  "bassist",
  "pianist",
  "orchestra",
  "composer",
  "songwriter",
  "rap",
  "hip-hop",
  "reggae",
  "salsa",
  "tango",
  "latin",
  "bossa",
  "nova",
  "metal",
  "punk",
  "indie",
  "electronic",
  "dj",
  "producer",
  "record",
  "label",
  "grammy",
  "chart",
  "hit",
  "single",
  "ep",
  "lp",
  "vinyl",
  "cassette",
  "cd",
  "streaming",
  "spotify",
  "apple music",
] as const;

/**
 * Known music-related Wikipedia categories for filtering.
 */
const MUSIC_CATEGORIES = [
  "music",
  "musician",
  "album",
  "song",
  "concert",
  "music festival",
  "band",
  "singer",
  "guitarist",
  "rock music",
  "pop music",
  "jazz",
  "classical music",
] as const;

// ============================================================================
// Connector Implementation
// ============================================================================

export class WikimediaOnThisDayConnector extends BaseConnector<NormalizedEvent> {
  readonly name = SOURCE_NAME;
  readonly sourceType = SOURCE_TYPE;

  constructor(
    config?: Partial<ConstructorParameters<typeof BaseConnector>[0]>,
  ) {
    super({
      sourceId: SOURCE_NAME,
      sourceType: SOURCE_TYPE,
      isShared: true,
      retryConfig: {
        maxRetries: 3,
        backoffMs: 1000,
      },
      ...config,
    });
  }

  // ============================================================================
  // BaseConnector Abstract Methods
  // ============================================================================

  /**
   * Fetch historical events from Wikimedia On This Day API.
   * Filters for music-related content.
   */
  async fetch(ctx: ConnectorContext): Promise<RawEvent[]> {
    const date = ctx.date || new Date();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Build URL for English Wikipedia (most comprehensive)
    const url = `https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;

    this.log("debug", `Fetching Wikimedia On This Day for ${month}/${day}`, {
      url,
    });

    // Make HTTP request directly (retry logic handled by fetchWithRetry in base class)
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "EnvivoStudio/1.0 (content-ingestion)",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Wikimedia API error: ${response.status} ${response.statusText}`,
      );
    }

    const data: WikimediaResponse = await response.json();

    // Collect all event types (selected, events, births, deaths)
    const allEvents: WikimediaEvent[] = [
      ...(data.selected || []),
      ...(data.events || []),
      ...(data.births || []),
      ...(data.deaths || []),
    ];

    // Filter for music-related content
    const musicEvents = this.filterMusicEvents(allEvents);

    this.log(
      "info",
      `Found ${musicEvents.length} music events out of ${allEvents.length} total`,
      {
        month,
        day,
      },
    );

    // Convert to RawEvent format
    return musicEvents.map((event) => this.toRawEvent(event, date));
  }

  /**
   * Normalize a Wikimedia raw event to NormalizedEvent format.
   */
  async normalize(raw: RawEvent): Promise<NormalizedEvent> {
    const event = (
      raw.rawData as { event: WikimediaEvent; _context: RawEventContext }
    ).event;
    const ctx = (
      raw.rawData as { event: WikimediaEvent; _context: RawEventContext }
    )._context;

    const title = this.extractTitle(event.text);
    const artists = this.extractArtists(event.text);

    return {
      source: SOURCE_NAME,
      sourceId: raw.externalId,
      sourceUrl: this.extractSourceUrl(event),
      title,
      contentHash: this.calculateHashFromEvent(
        title,
        ctx.eventDate,
        event.year,
        artists,
      ),
      tenantId: null, // Shared source
      isShared: true,
      metadata: {
        originalText: event.text,
        wikipediaPages: event.pages.map((p) => p.title),
        eventCategory: ctx.category,
      },
      eventType: "historical",
      eventDate: ctx.eventDate,
      year: event.year || undefined,
      location: undefined, // Historical events don't have specific locations
      artists: artists.length > 0 ? artists : undefined,
      images: this.extractImages(event.pages),
      tags: this.extractTags(event.text, event.year),
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
    return this.hashString(
      `${item.title}|${item.eventDate}|${item.year || ""}|${artistKey}`,
    );
  }

  /**
   * Health check for Wikimedia API.
   */
  async health(_ctx: ConnectorContext): Promise<HealthStatus> {
    return this.defaultHealthCheck(
      "https://api.wikimedia.org/feed/v1/wikipedia/en/onthisday/all/03/21",
      5000,
    );
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Filter events for music-related content.
   */
  private filterMusicEvents(events: WikimediaEvent[]): WikimediaEvent[] {
    return events.filter((event) => {
      const textLower = event.text.toLowerCase();
      const titleLower = event.pages[0]?.title.toLowerCase() || "";

      // Check if any keyword matches the text or page title
      const keywordMatch = MUSIC_KEYWORDS.some(
        (keyword) =>
          textLower.includes(keyword.toLowerCase()) ||
          titleLower.includes(keyword.toLowerCase()),
      );

      // Also check if page title suggests music-related content
      const categoryMatch = MUSIC_CATEGORIES.some((cat) =>
        titleLower.includes(cat.toLowerCase()),
      );

      return keywordMatch || categoryMatch;
    });
  }

  /**
   * Convert Wikimedia event to RawEvent format.
   */
  private toRawEvent(event: WikimediaEvent, date: Date): RawEvent {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return {
      sourceId: SOURCE_NAME,
      externalId: this.generateExternalId(month, day, event),
      rawData: {
        event,
        _context: {
          eventDate: new Date(date.getFullYear(), month - 1, day),
          category: this.determineCategory(event),
        },
      } as unknown as WikimediaEvent,
      fetchedAt: new Date(),
    };
  }

  /**
   * Generate unique external ID for an event.
   */
  private generateExternalId(
    month: number,
    day: number,
    event: WikimediaEvent,
  ): string {
    const dateStr = `${month}-${day}`;
    const yearStr = event.year ? `-${event.year}` : "";
    const titleHash = this.shortHash(event.text.slice(0, 50));
    return `wikimedia-${dateStr}${yearStr}-${titleHash}`;
  }

  /**
   * Determine which category an event belongs to.
   */
  private determineCategory(event: WikimediaEvent): string {
    if (event.year && event.year < 1900) {
      return "historical";
    }
    return "selected";
  }

  /**
   * Extract title from event text.
   */
  private extractTitle(text: string): string {
    const patterns = [
      /(?:released?|published?|launched?|debuted?|formed?|started?)\s+(?:the\s+)?([^.!,]+?)(?:\s+(?:album|song|band|record|ep|vinyl|cd|single|lp|concert|festival|show|performance|hit))/i,
      /(?:the\s+)?([^.!,]+?)\s+(?:released?|published?|launched?|debuted?)/i,
      /(?:in\s+\d+\s+)?([^.!,]+?)\s+(?:was born|died|passed away)/i,
      /([^.!,]+?)\s+(?:concert|festival|album|song|record)/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const title = match[1].trim();
        if (title.length > 2 && title.length < 150) {
          return this.truncateTitle(title);
        }
      }
    }

    return this.truncateTitle(text);
  }

  /**
   * Truncate title to max 200 chars, breaking at word boundary.
   */
  private truncateTitle(text: string): string {
    if (text.length <= 200) return text;

    const truncated = text.slice(0, 200);
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastSpace > 150) {
      return truncated.slice(0, lastSpace) + "...";
    }

    return truncated + "...";
  }

  /**
   * Extract artists from event text.
   */
  private extractArtists(text: string): NormalizedEvent["artists"] {
    const artists: NormalizedEvent["artists"] = [];

    const knownArtists = [
      "The Beatles",
      "Led Zeppelin",
      "Pink Floyd",
      "Queen",
      "David Bowie",
      "Freddie Mercury",
      "Mick Jagger",
      "Elvis Presley",
      "Michael Jackson",
      "Madonna",
      "Prince",
      "Whitney Houston",
      "Bob Dylan",
      "Bruce Springsteen",
      "Tom Petty",
      "Kurt Cobain",
      "Nirvana",
      "Radiohead",
      "U2",
      "The Rolling Stones",
      "The Who",
      "Fleetwood Mac",
      "Eric Clapton",
      "Jimi Hendrix",
      "Bob Marley",
      "The Doors",
      "Metallica",
      "AC/DC",
      "Black Sabbath",
      "Deep Purple",
      "The Eagles",
      "The Clash",
      "Joy Division",
      "New Order",
      "Depeche Mode",
      "Miles Davis",
      "John Coltrane",
      "Louis Armstrong",
      "Duke Ellington",
      "Charlie Parker",
      "Thelonious Monk",
      "Bill Evans",
      "Herbie Hancock",
      "B.B. King",
      "Muddy Waters",
      "John Lee Hooker",
      "Carlos Santana",
      "Shakira",
      "Ricky Martin",
      "Jennifer Lopez",
      "Marc Anthony",
      "Charly García",
      "Soda Stereo",
      "Gustavo Cerati",
      "Fito Páez",
      "Enanitos Verdes",
      "Mozart",
      "Beethoven",
      "Bach",
      "Chopin",
      "Tchaikovsky",
      "Vivaldi",
      "Handel",
      "Brahms",
      "Schubert",
      "Schumann",
      "Rachmaninoff",
      "Debussy",
      "Ravel",
      "Stravinsky",
    ];

    for (const artist of knownArtists) {
      if (text.toLowerCase().includes(artist.toLowerCase())) {
        artists.push({
          name: artist,
          normalizedName: normalizeArtistName(artist),
        });
      }
    }

    return artists;
  }

  /**
   * Extract images from Wikipedia pages.
   */
  private extractImages(pages: WikimediaPage[]): NormalizedEvent["images"] {
    return pages
      .filter((page) => page.thumbnail?.source)
      .slice(0, 5)
      .map((page) => ({
        url: page.thumbnail!.source,
        source: "wikimedia",
        caption: page.title,
        license: "CC BY-SA",
      }));
  }

  /**
   * Extract source URL from Wikipedia pages.
   */
  private extractSourceUrl(event: WikimediaEvent): string {
    const page = event.pages[0];
    if (page?.content_urls?.desktop?.page) {
      return page.content_urls.desktop.page;
    }
    if (page?.title) {
      return `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, "_"))}`;
    }
    return "https://en.wikipedia.org/wiki/On_this_day";
  }

  /**
   * Extract description/summary from Wikipedia pages.
   */
  private extractDescription(event: WikimediaEvent): string | undefined {
    const extract = event.pages[0]?.extract;
    if (extract && extract.length > 50) {
      return extract.slice(0, 500);
    }
    return undefined;
  }

  /**
   * Extract tags from event text.
   */
  private extractTags(text: string, year?: number): string[] {
    const tags: string[] = ["efeméride", "historia", "música"];

    const textLower = text.toLowerCase();

    if (MUSIC_KEYWORDS.some((k) => textLower.includes("rock"))) {
      tags.push("rock");
    }
    if (MUSIC_KEYWORDS.some((k) => textLower.includes("jazz"))) {
      tags.push("jazz");
    }
    if (MUSIC_KEYWORDS.some((k) => textLower.includes("pop"))) {
      tags.push("pop");
    }
    if (MUSIC_KEYWORDS.some((k) => textLower.includes("classical"))) {
      tags.push("clásica");
    }
    if (
      MUSIC_KEYWORDS.some((k) => textLower.includes("latin")) ||
      textLower.includes("salsa") ||
      textLower.includes("tango")
    ) {
      tags.push("latina");
    }

    if (year) {
      tags.push(`año-${year}`);
    }

    return [...new Set(tags)];
  }

  /**
   * Calculate hash from event components.
   */
  private calculateHashFromEvent(
    title: string,
    eventDate: Date,
    year: number | undefined,
    artists: NormalizedEvent["artists"],
  ): string {
    const artistKey =
      artists
        ?.map((a) => a.normalizedName)
        .sort()
        .join("|") || "";
    return this.hashString(
      `${normalizeForHash(title)}|${eventDate.toISOString().split("T")[0]}|${year || ""}|${artistKey}`,
    );
  }
}

// ============================================================================
// Export
// ============================================================================

export default WikimediaOnThisDayConnector;
