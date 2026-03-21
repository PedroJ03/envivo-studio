/**
 * Integration Test Helpers
 *
 * Provides mock connector responses, test data factories, and helper functions
 * for testing the content ingestion system.
 *
 * @module ingestion/__tests__/helpers
 */

/**
 * Creates mock Wikimedia API response for testing.
 */
export function createWikimediaResponse(
  options: {
    events?: Array<{
      text: string;
      year?: number;
      pages?: Array<{
        title: string;
        extract?: string;
        thumbnail?: { source: string };
      }>;
    }>;
    selected?: Array<{
      text: string;
      year?: number;
      pages?: Array<{ title: string }>;
    }>;
  } = {},
) {
  return {
    events: options.events || [
      {
        text: "In 1969, The Beatles released Abbey Road",
        year: 1969,
        pages: [
          {
            title: "Abbey Road",
            extract: "Abbey Road is a studio album by The Beatles",
            thumbnail: { source: "http://example.com/abbey-road.jpg" },
          },
        ],
      },
    ],
    selected: options.selected || [],
    births: [],
    deaths: [],
    holidays: [],
  };
}

/**
 * Creates mock Ticketmaster API response for testing.
 */
export function createTicketmasterResponse(
  options: {
    events?: Array<{
      id?: string;
      name?: string;
      url?: string;
      images?: Array<{ url: string; width: number }>;
      dates?: {
        start?: { localDate: string; localTime?: string };
      };
      _embedded?: {
        venues?: Array<{
          name?: string;
          city?: { name?: string };
          country?: { name?: string; countryCode?: string };
        }>;
        attractions?: Array<{
          name?: string;
          url?: string;
          classifications?: Array<{
            genre?: { name?: string };
            segment?: { name?: string };
          }>;
        }>;
      };
    }>;
    page?: { totalPages?: number; number?: number };
  } = {},
) {
  return {
    _embedded: {
      events: options.events || [
        {
          id: "evt-123",
          name: "The Beatles Concert",
          url: "https://ticketmaster.com/event/123",
          images: [{ url: "http://example.com/event.jpg", width: 500 }],
          dates: {
            start: { localDate: "2024-12-15", localTime: "20:00:00" },
          },
          _embedded: {
            venues: [
              {
                name: "Luna Park",
                city: { name: "Buenos Aires" },
                country: { name: "Argentina", countryCode: "AR" },
              },
            ],
            attractions: [
              {
                name: "The Beatles",
                classifications: [
                  { genre: { name: "Rock" }, segment: { name: "Music" } },
                ],
              },
            ],
          },
        },
      ],
    },
    page: options.page || { totalPages: 1, number: 0 },
  };
}

/**
 * Creates mock Eventbrite API response for testing.
 */
export function createEventbriteResponse(
  options: {
    events?: Array<{
      id?: string;
      name?: { text: string };
      url?: string;
      description?: { text?: string; html?: string };
      start?: { local: string };
      venue?: {
        name?: string;
        address?: { city?: string; region?: string; country?: string };
      };
      organizer?: { name?: string };
      logo?: { url?: string };
      category?: { name?: string };
      tags?: string[];
    }>;
    pagination?: { page_count?: number };
  } = {},
) {
  return {
    events: options.events || [
      {
        id: "eb-123",
        name: { text: "Rock Concert Live" },
        url: "https://eventbrite.com/e/123",
        description: { text: "Great rock concert!" },
        start: { local: "2024-12-20T20:00:00" },
        venue: {
          name: "Teatro Gran Rex",
          address: { city: "Buenos Aires", region: "CABA", country: "AR" },
        },
        organizer: { name: "The Rolling Stones" },
        logo: { url: "http://example.com/logo.jpg" },
        category: { name: "Music" },
        tags: ["rock", "concert"],
      },
    ],
    pagination: options.pagination || { page_count: 1 },
  };
}

/**
 * Creates mock NewsAPI response for testing.
 */
export function createNewsAPIResponse(
  options: {
    articles?: Array<{
      source?: { id?: string | null; name?: string };
      author?: string | null;
      title?: string;
      description?: string | null;
      url?: string;
      urlToImage?: string | null;
      publishedAt?: string;
      content?: string | null;
    }>;
    totalResults?: number;
  } = {},
) {
  return {
    status: "ok",
    totalResults: options.totalResults || options.articles?.length || 1,
    articles: options.articles || [
      {
        source: { id: "bbc", name: "BBC News" },
        author: "John Doe",
        title: "The Beatles reunion announced",
        description: "Amazing news for fans worldwide",
        url: "https://bbc.com/article/123",
        urlToImage: "http://bbc.com/image.jpg",
        publishedAt: "2024-03-20T10:00:00Z",
        content: "Full article content about the announcement",
      },
    ],
  };
}

/**
 * Creates a mock NormalizedEvent for testing.
 */
export function createMockEvent(
  overrides: {
    id?: string;
    source?: string;
    sourceId?: string;
    title?: string;
    eventType?: "historical" | "concert" | "festival" | "local_event";
    eventDate?: Date;
    year?: number;
    location?: {
      city?: string;
      region?: string;
      country?: string;
      venue?: string;
    };
    artists?: Array<{ name: string; normalizedName: string }>;
    images?: Array<{ url: string; source?: string }>;
    tags?: string[];
    description?: string;
    priority?: number;
    isShared?: boolean;
    tenantId?: string | null;
  } = {},
) {
  const {
    id = "test-id",
    source = "ticketmaster",
    sourceId = "evt-123",
    title = "Test Event",
    eventType = "concert",
    eventDate = new Date("2024-12-15"),
    year,
    location = {
      city: "Buenos Aires",
      country: "Argentina",
      venue: "Test Venue",
    },
    artists = [{ name: "Test Artist", normalizedName: "test-artist" }],
    images = [{ url: "http://example.com/image.jpg", source: "test" }],
    tags = ["test", "concert"],
    description = "Test description",
    priority = 1,
    isShared = true,
    tenantId = null,
  } = overrides;

  return {
    id,
    source,
    sourceId,
    sourceUrl: `https://example.com/${sourceId}`,
    title,
    contentHash: `hash-${sourceId}`,
    tenantId,
    isShared,
    metadata: {},
    eventType,
    eventDate,
    year,
    location,
    artists,
    images,
    tags,
    description,
    priority,
    updatedAt: new Date(),
  };
}

/**
 * Creates a mock ContentFeedItem for testing.
 */
export function createMockFeedItem(
  overrides: {
    id?: string;
    source?: string;
    sourceId?: string;
    title?: string;
    contentType?: "breaking_news" | "trending" | "curiosity" | "trivia";
    body?: string;
    hook?: string;
    facts?: Array<{ fact: string; source?: string }>;
    images?: Array<{ url: string; source?: string }>;
    tags?: string[];
    publishAt?: Date;
    expiresAt?: Date;
    viralScore?: number;
    isShared?: boolean;
    tenantId?: string | null;
  } = {},
) {
  const {
    id = "feed-id",
    source = "newsapi",
    sourceId = "news-123",
    title = "Test News",
    contentType = "trending",
    body = "Test body content",
    hook = "Test hook",
    facts = [],
    images = [{ url: "http://example.com/image.jpg" }],
    tags = ["test", "news"],
    publishAt = new Date(),
    expiresAt,
    viralScore = 70,
    isShared = true,
    tenantId = null,
  } = overrides;

  return {
    id,
    source,
    sourceId,
    sourceUrl: `https://example.com/news/${sourceId}`,
    title,
    contentHash: `hash-${sourceId}`,
    tenantId,
    isShared,
    metadata: {},
    contentType,
    body,
    hook,
    facts,
    images,
    tags,
    publishAt,
    expiresAt,
    viralScore,
    updatedAt: new Date(),
  };
}

/**
 * Creates mock IngestMetrics for testing.
 */
export function createMockMetrics(
  overrides: {
    runId?: string;
    source?: string;
    system?: "A" | "B";
    eventsCreated?: number;
    duplicatesSkipped?: number;
    errors?: number;
    durationMs?: number;
    status?: "success" | "partial" | "failed";
  } = {},
) {
  const {
    runId = "run-123",
    source = "ticketmaster",
    system = "A",
    eventsCreated = 10,
    duplicatesSkipped = 2,
    errors = 0,
    durationMs = 1000,
    status = "success",
  } = overrides;

  return {
    runId,
    source,
    system,
    eventsCreated,
    duplicatesSkipped,
    errors,
    durationMs,
    status,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Helper to create array of mock events for dedup testing.
 */
export function createMockEventArray(
  count: number,
  overrides: Partial<Parameters<typeof createMockEvent>[0]> = {},
): ReturnType<typeof createMockEvent>[] {
  return Array.from({ length: count }, (_, i) =>
    createMockEvent({
      ...overrides,
      sourceId: `evt-${i}`,
      title: `Event ${i}`,
    }),
  );
}

/**
 * Helper to simulate different sources for conflict resolution testing.
 */
export function createEventsFromMultipleSources(sourceNames: string[]) {
  return sourceNames.map((source, index) =>
    createMockEvent({
      source,
      sourceId: `${source}-evt-${index}`,
      title: `Event from ${source}`,
      priority: source === "ticketmaster" ? 1 : source === "eventbrite" ? 2 : 3,
    }),
  );
}

/**
 * Mocks fetch for testing connector API calls.
 */
export function mockFetchResponse(
  data: unknown,
  options: {
    ok?: boolean;
    status?: number;
    statusText?: string;
  } = {},
) {
  const { ok = true, status = 200, statusText = "OK" } = options;

  return {
    ok,
    status,
    statusText,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

/**
 * Creates a failing fetch mock for error testing.
 */
export function mockFetchError(message: string, status = 500) {
  return {
    ok: false,
    status,
    statusText: "Error",
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(message),
  };
}
