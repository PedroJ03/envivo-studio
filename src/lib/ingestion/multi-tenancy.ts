/**
 * Multi-tenancy Utilities - Phase 1 Foundation
 *
 * Helper functions for tenant isolation and source filtering.
 * These utilities work with in-memory data and help build query conditions.
 */

import type {
  CalendarEventQueryFilters,
  ContentFeedQueryFilters,
  EventType,
} from "./types";
import { isSharedSource } from "./types";

// ============================================================================
// Tenant Check Utilities
// ============================================================================

/**
 * Check if a source is shared (available to all tenants).
 */
export function isShared(sourceName: string): boolean {
  return isSharedSource(sourceName);
}

/**
 * Check if a source is tenant-local (specific to one tenant).
 */
export function isTenantLocal(sourceName: string): boolean {
  return !isSharedSource(sourceName);
}

/**
 * Determine the effective tenant ID for an item.
 * Shared sources should return null (no tenant restriction).
 * Tenant-local sources return the specified tenant ID.
 */
export function getEffectiveTenantId(
  sourceName: string,
  requestedTenantId: string | null,
): string | null {
  if (isSharedSource(sourceName)) {
    return null; // Shared sources have no tenant restriction
  }
  return requestedTenantId;
}

// ============================================================================
// Filtering Utilities
// ============================================================================

/**
 * Filter events by tenant scope.
 * Returns events that are either:
 * - Owned by the tenant, OR
 * - Shared (available to all tenants)
 */
export function filterByTenant<
  T extends { tenantId: string | null; isShared: boolean },
>(items: T[], tenantId: string): T[] {
  return items.filter(
    (item) => item.tenantId === tenantId || item.isShared === true,
  );
}

/**
 * Filter events by tenant scope, excluding shared items.
 * Returns only events owned by the specified tenant.
 */
export function filterByTenantOnly<T extends { tenantId: string | null }>(
  items: T[],
  tenantId: string,
): T[] {
  return items.filter((item) => item.tenantId === tenantId);
}

/**
 * Partition items into shared and tenant-local groups.
 */
export function partitionByTenancy<T extends { isShared: boolean }>(
  items: T[],
): { shared: T[]; tenantLocal: T[] } {
  return {
    shared: items.filter((item) => item.isShared),
    tenantLocal: items.filter((item) => !item.isShared),
  };
}

// ============================================================================
// Source Validation
// ============================================================================

/**
 * Validate that a source is appropriate for a tenant.
 * Tenant-local sources can only be used by their owning tenant.
 */
export function validateSourceForTenant(
  sourceName: string,
  tenantId: string,
  sourceTenantId: string | null,
): boolean {
  // Shared sources are valid for all tenants
  if (isSharedSource(sourceName)) {
    return true;
  }

  // Tenant-local sources must match the tenant
  return sourceTenantId === tenantId;
}

/**
 * Get allowed sources for a tenant.
 * Returns all shared sources + tenant-local sources owned by this tenant.
 */
export function getAllowedSources(
  tenantId: string,
  allSources: Array<{
    name: string;
    tenantId: string | null;
    isShared: boolean;
  }>,
): string[] {
  return allSources
    .filter((source) => source.isShared || source.tenantId === tenantId)
    .map((source) => source.name);
}

// ============================================================================
// Event Type Helpers
// ============================================================================

/**
 * Shared sources are typically historical/encyclopedic content.
 */
export const SHARED_EVENT_TYPES: EventType[] = [
  "historical",
  "concert",
  "festival",
];

/**
 * Tenant-local sources are typically local events.
 */
export const TENANT_LOCAL_EVENT_TYPES: EventType[] = ["local_event"];

/**
 * Check if an event type is typically shared.
 */
export function isSharedEventType(eventType: EventType): boolean {
  return SHARED_EVENT_TYPES.includes(eventType);
}

/**
 * Check if an event type is typically tenant-local.
 */
export function isTenantLocalEventType(eventType: EventType): boolean {
  return TENANT_LOCAL_EVENT_TYPES.includes(eventType);
}

// ============================================================================
// Query Options Builders
// ============================================================================

/**
 * Build default query options for a tenant.
 */
export function defaultTenantQuery(tenantId: string): {
  tenantId: string;
  includeShared: boolean;
} {
  return {
    tenantId,
    includeShared: true,
  };
}

/**
 * Build query options that only return shared content.
 */
export function sharedOnlyQuery(): {
  includeShared: boolean;
} {
  return {
    includeShared: true,
  };
}

/**
 * Build query options that only return tenant-local content.
 */
export function tenantLocalOnlyQuery(tenantId: string): {
  tenantId: string;
  includeShared: boolean;
} {
  return {
    tenantId,
    includeShared: false, // Exclude shared content
  };
}

// ============================================================================
// Calendar Event Query Filter Helpers
// ============================================================================

/**
 * Check if a calendar event matches the query filters.
 */
export function matchesCalendarEventFilters(
  event: {
    tenantId: string | null;
    isShared: boolean;
    eventDate: Date | string;
    eventType: EventType;
    source: string;
  },
  filters: CalendarEventQueryFilters,
): boolean {
  // Tenant check
  if (
    !filters.includeShared &&
    !event.isShared &&
    event.tenantId !== filters.tenantId
  ) {
    return false;
  }
  if (event.tenantId !== filters.tenantId && !event.isShared) {
    return false;
  }

  // Date range check
  if (filters.eventDateFrom) {
    const eventDate = new Date(event.eventDate);
    if (eventDate < filters.eventDateFrom) {
      return false;
    }
  }
  if (filters.eventDateTo) {
    const eventDate = new Date(event.eventDate);
    if (eventDate > filters.eventDateTo) {
      return false;
    }
  }

  // Event type check
  if (filters.eventTypes && filters.eventTypes.length > 0) {
    if (!filters.eventTypes.includes(event.eventType)) {
      return false;
    }
  }

  // Source check
  if (filters.sources && filters.sources.length > 0) {
    if (!filters.sources.includes(event.source)) {
      return false;
    }
  }

  return true;
}

/**
 * Filter calendar events by query filters.
 */
export function filterCalendarEvents(
  events: Array<{
    tenantId: string | null;
    isShared: boolean;
    eventDate: Date | string;
    eventType: EventType;
    source: string;
  }>,
  filters: CalendarEventQueryFilters,
): typeof events {
  return events.filter((event) => matchesCalendarEventFilters(event, filters));
}

// ============================================================================
// Content Feed Query Filter Helpers
// ============================================================================

/**
 * Check if a content feed item matches the query filters.
 */
export function matchesContentFeedFilters(
  item: {
    tenantId: string | null;
    isShared: boolean;
    publishAt: Date | string;
    expiresAt: Date | string | null;
    contentType: string;
    source: string;
  },
  filters: ContentFeedQueryFilters,
): boolean {
  // Tenant check
  if (item.tenantId !== filters.tenantId && !item.isShared) {
    return false;
  }

  // Published only check
  if (filters.publishedOnly !== false) {
    const now = new Date();
    const publishAt = new Date(item.publishAt);

    if (publishAt > now) {
      return false;
    }

    if (item.expiresAt) {
      const expiresAt = new Date(item.expiresAt);
      if (expiresAt <= now) {
        return false;
      }
    }
  }

  // Content type check
  if (filters.contentTypes && filters.contentTypes.length > 0) {
    if (!filters.contentTypes.includes(item.contentType as never)) {
      return false;
    }
  }

  // Source check
  if (filters.sources && filters.sources.length > 0) {
    if (!filters.sources.includes(item.source)) {
      return false;
    }
  }

  return true;
}

/**
 * Filter content feed items by query filters.
 */
export function filterContentFeedItems(
  items: Array<{
    tenantId: string | null;
    isShared: boolean;
    publishAt: Date | string;
    expiresAt: Date | string | null;
    contentType: string;
    source: string;
  }>,
  filters: ContentFeedQueryFilters,
): typeof items {
  return items.filter((item) => matchesContentFeedFilters(item, filters));
}
