/**
 * Test helpers for Topic Selection feature
 * Provides mock data factories for tests
 */

import type {
  PendingTopic,
  TopicSelection,
  FormatConfig,
  CreateSelectionInput,
} from "../types";

/**
 * Default format config for testing
 */
export const mockFormatConfig: FormatConfig = {
  type: "post",
  tone: "informative",
  priority: 1,
};

/**
 * Mock pending topic for testing
 */
export const mockPendingTopic: PendingTopic = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  sourceType: "calendar_event",
  source: "ticketmaster",
  title: "Oasis en River",
  description: "Concierto en el Estadio River Plate",
  date: "2026-03-25T21:00:00.000Z",
  type: "concert",
  priority: 3,
  image: "https://example.com/oasis.jpg",
  tags: ["rock", "concierto", "internacional"],
  isShared: false,
};

/**
 * Mock pending topic from content feed for testing
 */
export const mockFeedPendingTopic: PendingTopic = {
  id: "223e4567-e89b-12d3-a456-426614174001",
  sourceType: "content_feed_item",
  source: "newsapi",
  title: "Nuevo discovery en наука",
  description: "Scientists discover new particle",
  date: "2026-03-20T14:30:00.000Z",
  type: "breaking_news",
  priority: 4,
  image: undefined,
  tags: ["ciencia", "descubrimiento"],
  isShared: true,
};

/**
 * Mock topic selection for testing
 */
export const mockTopicSelection: TopicSelection = {
  id: "789e4567-e89b-12d3-a456-426614174002",
  tenantId: "tenant-123",
  sourceType: "calendar_event",
  sourceId: "123e4567-e89b-12d3-a456-426614174000",
  formats: [mockFormatConfig],
  targetPublishAt: "2026-03-26T18:00:00.000Z",
  urgency: "medium",
  status: "pending",
  createdBy: "user-456",
  createdAt: "2026-03-21T10:00:00.000Z",
  updatedAt: "2026-03-21T10:00:00.000Z",
  metadata: {},
};

/**
 * Mock input for creating a topic selection
 */
export const mockCreateSelectionInput: CreateSelectionInput = {
  sourceType: "calendar_event",
  sourceId: "123e4567-e89b-12d3-a456-426614174000",
  formats: [
    { type: "post", tone: "opinion", priority: 1 },
    { type: "story", tone: "informative", priority: 2 },
  ],
  targetPublishAt: "2026-03-26T18:00:00.000Z",
  urgency: "high",
  metadata: { notes: "High priority concert coverage" },
};

/**
 * Create a mock pending topic with custom overrides
 */
export function createMockPendingTopic(
  overrides: Partial<PendingTopic> = {},
): PendingTopic {
  return {
    ...mockPendingTopic,
    ...overrides,
  };
}

/**
 * Create a mock topic selection with custom overrides
 */
export function createMockTopicSelection(
  overrides: Partial<TopicSelection> = {},
): TopicSelection {
  return {
    ...mockTopicSelection,
    ...overrides,
  };
}

/**
 * Create multiple mock pending topics for pagination/filtering tests
 */
export function createMockPendingTopics(count: number): PendingTopic[] {
  return Array.from({ length: count }, (_, i) =>
    createMockPendingTopic({
      id: `topic-${i}`,
      title: `Test Topic ${i + 1}`,
      priority: (i % 4) + 1,
    }),
  );
}
