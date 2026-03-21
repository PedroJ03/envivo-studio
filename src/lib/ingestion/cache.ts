/**
 * Cache Utilities - Phase 1 Foundation
 *
 * Redis cache wrapper for content ingestion.
 * Handles API response caching, deduplication lookups, rate limiting, and circuit breaker state.
 */

// ============================================================================
// Redis Client (lazy initialization)
// ============================================================================

import { createClient, type RedisClientType } from "redis";

let redisClient: RedisClientType | null = null;

/**
 * Get or create the Redis client singleton.
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    redisClient = createClient({ url: redisUrl });

    redisClient.on("error", (err: Error) => {
      console.error("[Redis:Error]", err);
    });

    redisClient.on("connect", () => {
      console.info("[Redis:Connected]");
    });

    await redisClient.connect();
  }

  return redisClient;
}

/**
 * Close the Redis connection.
 */
export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

// ============================================================================
// TTL Constants (in seconds)
// ============================================================================

export const TTL = {
  // API response caching by source type
  API_WIKIMEDIA: 86400, // 24 hours - historical data doesn't change
  API_TICKETMASTER: 3600, // 1 hour - events update frequently
  API_EVENTBRITE: 1800, // 30 minutes
  API_NEWSAPI: 600, // 10 minutes - news changes fast
  API_GNEWS: 600, // 10 minutes
  API_WIKIDATA: 86400, // 24 hours - trivia is stable
  API_SCRAPER: 600, // 10 minutes - scraped data is volatile
  API_RSS: 1800, // 30 minutes

  // Deduplication lookups
  DEDUP_EXACT: 2592000, // 30 days
  DEDUP_HASH: 2592000, // 30 days
  DEDUP_FUZZY: 2592000, // 30 days

  // Circuit breaker
  CIRCUIT_FAILURE: 300, // 5 minutes
  CIRCUIT_RESET: 300, // 5 minutes

  // Rate limiting
  RATELIMIT_WINDOW: 60, // 1 minute
} as const;

// ============================================================================
// TTL by source type helper
// ============================================================================

const API_TTL_BY_SOURCE: Record<string, number> = {
  wikimedia: TTL.API_WIKIMEDIA,
  ticketmaster: TTL.API_TICKETMASTER,
  eventbrite: TTL.API_EVENTBRITE,
  newsapi: TTL.API_NEWSAPI,
  gnews: TTL.API_GNEWS,
  wikidata: TTL.API_WIKIDATA,
  tandil_municipio: TTL.API_SCRAPER,
  eldiario_rss: TTL.API_RSS,
  rollingstone: TTL.API_SCRAPER,
  indiehoy: TTL.API_SCRAPER,
};

/**
 * Get API response TTL for a source.
 */
export function getApiResponseTtl(sourceType: string): number {
  return API_TTL_BY_SOURCE[sourceType] ?? 3600; // Default 1 hour
}

// ============================================================================
// Cache Interface
// ============================================================================

export interface CircuitState {
  failures: number;
  lastFailure: number;
  open: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ============================================================================
// Ingestion Cache Class
// ============================================================================

export class IngestionCache {
  constructor(private redis: RedisClientType) {}

  /**
   * Create cache instance from environment.
   */
  static async create(): Promise<IngestionCache> {
    const redis = await getRedisClient();
    return new IngestionCache(redis);
  }

  // ==========================================================================
  // Generic Cache Operations
  // ==========================================================================

  /**
   * Get a value from cache.
   */
  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set a value in cache with TTL.
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.redis.setEx(key, ttlSeconds, JSON.stringify(value));
  }

  /**
   * Delete a key from cache.
   */
  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  /**
   * Get or set - returns cached value or executes factory and caches result.
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  // ==========================================================================
  // API Response Caching
  // ==========================================================================

  /**
   * Cache an API response.
   */
  async cacheApiResponse<T>(
    source: string,
    params: Record<string, string>,
    data: T,
    ttlSeconds?: number,
  ): Promise<void> {
    const key = this.buildApiKey(source, params);
    const ttl = ttlSeconds ?? getApiResponseTtl(source);
    await this.set(key, data, ttl);
  }

  /**
   * Get cached API response.
   */
  async getCachedApiResponse<T>(
    source: string,
    params: Record<string, string>,
  ): Promise<T | null> {
    const key = this.buildApiKey(source, params);
    return this.get<T>(key);
  }

  /**
   * Invalidate API cache for a source.
   */
  async invalidateApiCache(
    source: string,
    params?: Record<string, string>,
  ): Promise<void> {
    if (params) {
      const key = this.buildApiKey(source, params);
      await this.delete(key);
    } else {
      // Delete all keys for this source
      const pattern = `api:${source}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    }
  }

  private buildApiKey(source: string, params: Record<string, string>): string {
    const sorted = Object.entries(params).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const paramStr = sorted.map(([k, v]) => `${k}=${v}`).join("&");
    const hash = paramStr
      ? crypto.createHash("sha256").update(paramStr).digest("hex").slice(0, 16)
      : "empty";
    return `api:${source}:${hash}`;
  }

  // ==========================================================================
  // Deduplication Lookups
  // ==========================================================================

  /**
   * Cache a deduplication lookup (hash -> eventId).
   */
  async cacheDedupeLookup(
    hash: string,
    eventId: string,
    ttlDays: number = 30,
  ): Promise<void> {
    const key = `dedupe:hash:${hash}`;
    await this.set(
      key,
      { eventId, cachedAt: new Date().toISOString() },
      ttlDays * 86400,
    );
  }

  /**
   * Get deduplication lookup.
   */
  async getDedupeLookup(
    hash: string,
  ): Promise<{ eventId: string; cachedAt: string } | null> {
    const key = `dedupe:hash:${hash}`;
    return this.get(key);
  }

  /**
   * Check if a content hash exists in recent cache.
   */
  async hasRecentHash(hash: string, maxAgeDays: number = 30): Promise<boolean> {
    const key = `dedupe:hash:${hash}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  // ==========================================================================
  // Rate Limiting (Token Bucket)
  // ==========================================================================

  /**
   * Check rate limit for a source.
   * Uses sliding window counter algorithm.
   */
  async checkRateLimit(
    source: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const key = `ratelimit:${source}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    // Remove old entries outside the window
    await this.redis.zRemRangeByScore(key, 0, windowStart);

    // Count current requests in window
    const current = await this.redis.zCard(key);

    if (current >= maxRequests) {
      // Calculate reset time based on current count and oldest timestamp
      // We approximate based on window size rather than exact oldest entry
      const resetAt = now + windowSeconds;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
      };
    }

    // Add this request with current timestamp as score
    const requestId = `${now}-${Math.random().toString(36).slice(2)}`;
    await this.redis.zAdd(key, { score: now, value: requestId });
    await this.redis.expire(key, windowSeconds);

    return {
      allowed: true,
      remaining: maxRequests - current - 1,
      resetAt: now + windowSeconds,
    };
  }

  /**
   * Get current rate limit status without incrementing.
   */
  async getRateLimitStatus(
    source: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const key = `ratelimit:${source}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    await this.redis.zRemRangeByScore(key, 0, windowStart);
    const current = await this.redis.zCard(key);

    return {
      allowed: current < maxRequests,
      remaining: Math.max(0, maxRequests - current),
      resetAt: now + windowSeconds,
    };
  }

  // ==========================================================================
  // Circuit Breaker State
  // ==========================================================================

  /**
   * Get circuit breaker state for a source.
   */
  async getCircuitState(source: string): Promise<CircuitState> {
    const key = `circuit:${source}`;
    const state = await this.get<CircuitState>(key);
    return state ?? { failures: 0, lastFailure: 0, open: false };
  }

  /**
   * Record a circuit breaker failure.
   */
  async recordCircuitFailure(
    source: string,
    threshold: number,
    resetTimeoutMs: number,
  ): Promise<void> {
    const key = `circuit:${source}`;
    const state = await this.getCircuitState(source);

    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= threshold) {
      state.open = true;
      // Set expiry on the key to auto-reset
      await this.redis.setEx(
        key,
        Math.ceil(resetTimeoutMs / 1000),
        JSON.stringify(state),
      );
    } else {
      await this.redis.set(key, JSON.stringify(state));
    }
  }

  /**
   * Record a circuit breaker success (resets failure count).
   */
  async recordCircuitSuccess(source: string): Promise<void> {
    const key = `circuit:${source}`;
    await this.redis.del(key);
  }

  /**
   * Check if circuit is open.
   */
  async isCircuitOpen(source: string): Promise<boolean> {
    const state = await this.getCircuitState(source);

    if (!state.open) return false;

    // Check if reset timeout has passed
    const resetTimeoutMs = 300000; // 5 minutes default
    const timeSinceLastFailure = Date.now() - state.lastFailure;

    if (timeSinceLastFailure > resetTimeoutMs) {
      // Auto-reset circuit
      await this.recordCircuitSuccess(source);
      return false;
    }

    return true;
  }

  // ==========================================================================
  // Event Cache (for batch dedup)
  // ==========================================================================

  /**
   * Get cached events for a source + date combination.
   */
  async getCachedEvents(
    source: string,
    date: string, // ISO date string YYYY-MM-DD
  ): Promise<string[]> {
    const key = `events:${source}:${date}`;
    return (await this.get<string[]>(key)) ?? [];
  }

  /**
   * Cache events after ingestion.
   */
  async setCachedEvents(
    source: string,
    date: string,
    eventIds: string[],
    ttlDays: number = 7,
  ): Promise<void> {
    const key = `events:${source}:${date}`;
    await this.set(key, eventIds, ttlDays * 86400);
  }

  /**
   * Add event IDs to source+date cache.
   */
  async addCachedEvents(
    source: string,
    date: string,
    eventIds: string[],
  ): Promise<void> {
    const key = `events:${source}:${date}`;
    const existing = await this.getCachedEvents(source, date);
    const combined = [...new Set([...existing, ...eventIds])];
    await this.setCachedEvents(source, date, combined);
  }

  // ==========================================================================
  // Keys for ingestion
  // ==========================================================================

  /**
   * Get the ingestion lock key for a source (prevents concurrent runs).
   */
  getIngestionLockKey(sourceSlug: string): string {
    return `lock:ingest:${sourceSlug}`;
  }

  /**
   * Acquire an ingestion lock.
   */
  async acquireIngestionLock(
    sourceSlug: string,
    ttlSeconds: number = 300, // 5 minutes default
  ): Promise<boolean> {
    const key = this.getIngestionLockKey(sourceSlug);
    const result = await this.redis.setNX(key, "1");
    if (result) {
      await this.redis.expire(key, ttlSeconds);
    }
    return result;
  }

  /**
   * Release an ingestion lock.
   */
  async releaseIngestionLock(sourceSlug: string): Promise<void> {
    const key = this.getIngestionLockKey(sourceSlug);
    await this.redis.del(key);
  }
}

// ============================================================================
// Crypto import for hash functions
// ============================================================================

import crypto from "crypto";
