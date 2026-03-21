/**
 * Base Connector Class - Phase 1 Foundation
 *
 * Abstract base class for all source connectors.
 * Provides common functionality: retry logic, rate limiting, circuit breaker, logging.
 */

import crypto from "crypto";
import type {
  ConnectorContext,
  HealthStatus,
  NormalizedItem,
  RawEvent,
  RawFeedItem,
  SourceConnectorConfig,
  SourceType,
} from "./types";
import { IngestionCache } from "./cache";

/**
 * Abstract base connector class.
 * All source connectors must extend this class.
 */
export abstract class BaseConnector<T extends NormalizedItem> {
  protected abstract readonly name: string;
  protected abstract readonly sourceType: SourceType;

  constructor(
    protected config: SourceConnectorConfig,
    protected cache?: IngestionCache,
  ) {}

  // ============================================================================
  // Abstract Methods - Must be implemented by subclasses
  // ============================================================================

  /**
   * Fetch raw items from the source.
   */
  abstract fetch(ctx: ConnectorContext): Promise<RawEvent[] | RawFeedItem[]>;

  /**
   * Normalize a raw item to the internal format.
   */
  abstract normalize(raw: RawEvent | RawFeedItem): Promise<T>;

  /**
   * Calculate content hash for deduplication.
   */
  abstract calculateHash(item: T): string;

  /**
   * Check health of the source.
   */
  abstract health(ctx: ConnectorContext): Promise<HealthStatus>;

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Get connector name.
   */
  get connectorName(): string {
    return this.name;
  }

  /**
   * Get connector type.
   */
  get connectorType(): SourceType {
    return this.sourceType;
  }

  /**
   * Check if circuit breaker is open (too many recent failures).
   */
  async isCircuitOpen(): Promise<boolean> {
    if (!this.cache) return false;
    const state = await this.cache.getCircuitState(this.name);
    return state.open;
  }

  /**
   * Fetch with automatic retry and circuit breaker.
   * This is the main entry point for fetching data.
   */
  async fetchWithRetry(
    ctx: ConnectorContext,
  ): Promise<RawEvent[] | RawFeedItem[]> {
    // Check circuit breaker
    if (await this.isCircuitOpen()) {
      throw new Error(`Circuit breaker open for ${this.name}`);
    }

    // Check rate limit
    if (this.cache && this.config.rateLimitRps) {
      const allowed = await this.cache.checkRateLimit(
        this.name,
        Math.ceil(this.config.rateLimitRps),
        1, // 1 second window
      );
      if (!allowed.allowed) {
        throw new Error(`Rate limit exceeded for ${this.name}`);
      }
    }

    // Execute with retry
    try {
      const result = await this.executeWithRetry(ctx);

      // Record success in circuit breaker
      if (this.cache) {
        await this.cache.recordCircuitSuccess(this.name);
      }

      return result;
    } catch (error) {
      // Record failure in circuit breaker
      if (this.cache) {
        const threshold = this.config.circuitBreaker?.failureThreshold ?? 5;
        const resetTimeout =
          this.config.circuitBreaker?.resetTimeoutMs ?? 300000;
        await this.cache.recordCircuitFailure(
          this.name,
          threshold,
          resetTimeout,
        );
      }
      throw error;
    }
  }

  // ============================================================================
  // Protected Helpers
  // ============================================================================

  /**
   * Execute fetch with exponential backoff retry.
   */
  protected async executeWithRetry(
    ctx: ConnectorContext,
    attempt: number = 0,
  ): Promise<RawEvent[] | RawFeedItem[]> {
    const maxRetries = this.config.retryConfig?.maxRetries ?? 3;
    const baseBackoff = this.config.retryConfig?.backoffMs ?? 1000;

    try {
      return await this.fetch(ctx);
    } catch (error) {
      // Check if we should retry
      if (attempt >= maxRetries) {
        throw error;
      }

      // Check if error is retryable (5xx, network errors)
      const isRetryable = this.isRetryableError(error);
      if (!isRetryable) {
        throw error;
      }

      // Calculate backoff with exponential increase
      const backoffMs = baseBackoff * Math.pow(2, attempt);
      const jitter = Math.random() * 1000; // Add up to 1s of random jitter

      this.log("warn", `Retryable error, backing off ${backoffMs + jitter}ms`, {
        attempt: attempt + 1,
        maxRetries,
        error: this.getErrorMessage(error),
      });

      await this.sleep(backoffMs + jitter);
      return this.executeWithRetry(ctx, attempt + 1);
    }
  }

  /**
   * Check if an error is retryable (5xx, network timeout, etc.)
   */
  protected isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      // Network errors
      if (
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("ENOTFOUND")
      ) {
        return true;
      }

      // HTTP 5xx errors
      if (
        "status" in error &&
        typeof (error as { status: number }).status === "number"
      ) {
        const status = (error as { status: number }).status;
        return status >= 500 && status < 600;
      }

      // Rate limit (429)
      if ("status" in error && (error as { status: number }).status === 429) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate SHA256 hash of a string.
   */
  protected hashString(input: string): string {
    return crypto.createHash("sha256").update(input).digest("hex");
  }

  /**
   * Generate short hash (first 16 characters).
   */
  protected shortHash(input: string): string {
    return this.hashString(input).slice(0, 16);
  }

  /**
   * Hash an object's fields for deduplication.
   */
  protected hashObject(obj: Record<string, unknown>): string {
    const sorted = JSON.stringify(obj, Object.keys(obj).sort());
    return this.shortHash(sorted);
  }

  /**
   * Sleep for ms milliseconds.
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get error message from unknown error.
   */
  protected getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Log a message with connector context.
   */
  protected log(
    level: "debug" | "info" | "warn" | "error",
    message: string,
    data?: Record<string, unknown>,
  ): void {
    const logEntry = {
      connector: this.name,
      level,
      message,
      timestamp: new Date().toISOString(),
      ...data,
    };

    switch (level) {
      case "error":
        console.error("[Connector:Error]", JSON.stringify(logEntry));
        break;
      case "warn":
        console.warn("[Connector:Warn]", JSON.stringify(logEntry));
        break;
      case "info":
        console.info("[Connector:Info]", JSON.stringify(logEntry));
        break;
      case "debug":
        console.debug("[Connector:Debug]", JSON.stringify(logEntry));
        break;
    }
  }

  /**
   * Default health check - tries to fetch with a very short timeout.
   */
  protected async defaultHealthCheck(
    url: string,
    timeoutMs: number = 5000,
  ): Promise<HealthStatus> {
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      return {
        healthy: response.ok,
        latencyMs: Date.now() - start,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: this.getErrorMessage(error),
      };
    }
  }
}

// ============================================================================
// Re-export types for convenience
// ============================================================================

export type {
  ConnectorContext,
  HealthStatus,
  NormalizedItem,
  RawEvent,
  RawFeedItem,
} from "./types";
