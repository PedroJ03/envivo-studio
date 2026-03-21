/**
 * Configuration Loader Tests - Phase 6
 *
 * Tests for YAML configuration parsing, environment variable expansion,
 * and source configuration queries.
 *
 * @module ingestion/__tests__/config-loader.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  loadConfig,
  reloadConfig,
  getSourceConfig,
  getEnabledSources,
  getEnabledSourcesForSystem,
  getSourcesForTenant,
  getSharedSources,
  getTenantLocalSources,
  getBreakingNewsSources,
  getAlertingConfig,
  getBackfillConfig,
  validateEnvVars,
  getRequiredEnvVars,
} from "../config-loader";

// Mock fs.readFileSync
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

const mockFs = vi.mocked(fs);

describe("Configuration Loader", () => {
  const validYamlConfig = `
defaults:
  retry:
    max_retries: 3
    backoff_ms: 1000
  circuit_breaker:
    failure_threshold: 5
    reset_timeout_ms: 300000
  cache:
    api_response_ttl: 3600

sources:
  - slug: ticketmaster-discovery
    name: "Ticketmaster Discovery"
    system: A
    connector: ticketmaster
    is_shared: true
    enabled: true
    priority: 1
    config:
      api_key: \${TICKETMASTER_API_KEY}
      markets: ["AR", "US"]

  - slug: eventbrite-argentina
    name: "Eventbrite Argentina"
    system: A
    connector: eventbrite
    is_shared: true
    enabled: true
    priority: 2
    config:
      api_key: \${EVENTBRITE_API_KEY}

  - slug: wikimedia-onthisday
    name: "Wikimedia On This Day"
    system: A
    connector: wikimedia
    is_shared: true
    enabled: false
    priority: 2
    config:
      base_url: "https://api.wikimedia.org"

  - slug: tandil-municipio
    name: "Municipalidad de Tandil"
    system: A
    connector: scraper
    is_shared: false
    tenant_id: \${TANDIL_TENANT_ID}
    enabled: true
    priority: 2
    config:
      base_url: "https://tandil.gov.ar"

  - slug: newsapi-breaking
    name: "NewsAPI Breaking"
    system: B
    connector: newsapi
    is_shared: true
    enabled: true
    priority: 1
    supports_breaking: true
    config:
      api_key: \${NEWS_API_KEY}

  - slug: gnews-trending
    name: "GNews Trending"
    system: B
    connector: gnews
    is_shared: true
    enabled: true
    priority: 2
    supports_breaking: true
    config:
      api_key: \${GNEWS_API_KEY}

alerting:
  error_rate_threshold: 10
  no_events_threshold_hours: 24
  source_down_threshold_hours: 1
  rate_limit_hit_threshold: 5
  health_check_interval_minutes: 15

backfill:
  batch_size: 100
  batch_delay_ms: 1000
  max_parallel_sources: 5
  checkpoint_enabled: true
  checkpoint_prefix: "backfill"
`;

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variables
    process.env.TICKETMASTER_API_KEY = "test-tm-key";
    process.env.EVENTBRITE_API_KEY = "test-eb-key";
    process.env.NEWS_API_KEY = "test-news-key";
    process.env.GNEWS_API_KEY = "test-gnews-key";
    process.env.TANDIL_TENANT_ID = "tandil-tenant-uuid";
  });

  afterEach(() => {
    delete process.env.TICKETMASTER_API_KEY;
    delete process.env.EVENTBRITE_API_KEY;
    delete process.env.NEWS_API_KEY;
    delete process.env.GNEWS_API_KEY;
    delete process.env.TANDIL_TENANT_ID;
    // Reset cached config
    reloadConfig();
  });

  describe("YAML Parsing", () => {
    it("should parse valid YAML configuration", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const config = loadConfig("/test/config.yaml");

      expect(config.defaults).toBeDefined();
      expect(config.defaults.retry.max_retries).toBe(3);
      expect(config.sources).toHaveLength(6);
      expect(config.alerting.error_rate_threshold).toBe(10);
      expect(config.backfill.batch_size).toBe(100);
    });

    it("should throw on missing defaults.retry", () => {
      const invalidConfig = `
defaults:
  circuit_breaker:
    failure_threshold: 5
sources: []
alerting: {}
backfill: {}
`;
      mockFs.readFileSync.mockReturnValueOnce(invalidConfig);

      expect(() => loadConfig("/test/config.yaml")).toThrow(
        /Missing 'defaults.retry'/,
      );
    });

    it("should throw on missing sources array", () => {
      const invalidConfig = `
defaults:
  retry: { max_retries: 3, backoff_ms: 1000 }
  circuit_breaker: { failure_threshold: 5, reset_timeout_ms: 300000 }
  cache: { api_response_ttl: 3600 }
alerting: {}
backfill: {}
`;
      mockFs.readFileSync.mockReturnValueOnce(invalidConfig);

      expect(() => loadConfig("/test/config.yaml")).toThrow(
        /Missing or invalid 'sources'/,
      );
    });

    it("should throw on duplicate source slugs", () => {
      const invalidConfig = `
defaults:
  retry: { max_retries: 3, backoff_ms: 1000 }
  circuit_breaker: { failure_threshold: 5, reset_timeout_ms: 300000 }
  cache: { api_response_ttl: 3600 }
sources:
  - slug: same-slug
    name: "Source 1"
    system: A
    connector: ticketmaster
    is_shared: true
    enabled: true
    priority: 1
  - slug: same-slug
    name: "Source 2"
    system: A
    connector: eventbrite
    is_shared: true
    enabled: true
    priority: 2
alerting: {}
backfill: {}
`;
      mockFs.readFileSync.mockReturnValueOnce(invalidConfig);

      expect(() => loadConfig("/test/config.yaml")).toThrow(
        /Duplicate source slugs/,
      );
    });

    it("should throw on file not found", () => {
      mockFs.readFileSync.mockImplementation(() => {
        const error = new Error("ENOENT") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      });

      expect(() => loadConfig("/nonexistent/config.yaml")).toThrow(
        /Configuration file not found/,
      );
    });
  });

  describe("Environment Variable Expansion", () => {
    it("should expand environment variables in config", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const config = loadConfig("/test/config.yaml");

      const ticketmasterSource = config.sources.find(
        (s) => s.slug === "ticketmaster-discovery",
      );
      expect(ticketmasterSource?.config.api_key).toBe("test-tm-key");
    });

    it("should expand tenant_id environment variables", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const config = loadConfig("/test/config.yaml");

      const tandilSource = config.sources.find(
        (s) => s.slug === "tandil-municipio",
      );
      expect(tandilSource?.tenant_id).toBe("tandil-tenant-uuid");
    });

    it("should warn on unset environment variables", () => {
      delete process.env.TICKETMASTER_API_KEY;
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      // Should not throw, but should warn
      const config = loadConfig("/test/config.yaml");

      const ticketmasterSource = config.sources.find(
        (s) => s.slug === "ticketmaster-discovery",
      );
      expect(ticketmasterSource?.config.api_key).toBe("");
    });

    it("should handle array environment variables", () => {
      const configWithArray = `
defaults:
  retry: { max_retries: 3, backoff_ms: 1000 }
  circuit_breaker: { failure_threshold: 5, reset_timeout_ms: 300000 }
  cache: { api_response_ttl: 3600 }
sources:
  - slug: test-source
    name: "Test"
    system: A
    connector: ticketmaster
    is_shared: true
    enabled: true
    priority: 1
    config:
      markets: ["AR", "US", "MX"]
alerting: {}
backfill: {}
`;
      mockFs.readFileSync.mockReturnValueOnce(configWithArray);

      const config = loadConfig("/test/config.yaml");

      const testSource = config.sources.find((s) => s.slug === "test-source");
      expect(testSource?.config.markets).toEqual(["AR", "US", "MX"]);
    });
  });

  describe("getSourceConfig", () => {
    it("should return configuration for a specific source", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const source = getSourceConfig("ticketmaster-discovery");

      expect(source).toBeDefined();
      expect(source?.name).toBe("Ticketmaster Discovery");
      expect(source?.connector).toBe("ticketmaster");
    });

    it("should return undefined for non-existent source", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const source = getSourceConfig("non-existent-source");

      expect(source).toBeUndefined();
    });
  });

  describe("getEnabledSources", () => {
    it("should return only enabled sources", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const sources = getEnabledSources();

      expect(sources).toHaveLength(5);
      expect(
        sources.find((s) => s.slug === "wikimedia-onthisday"),
      ).toBeUndefined();
    });
  });

  describe("getEnabledSourcesForSystem", () => {
    it("should return only System A sources", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const sources = getEnabledSourcesForSystem("A");

      expect(sources).toHaveLength(3);
      expect(sources.every((s) => s.system === "A")).toBe(true);
    });

    it("should return only System B sources", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const sources = getEnabledSourcesForSystem("B");

      expect(sources).toHaveLength(2);
      expect(sources.every((s) => s.system === "B")).toBe(true);
    });
  });

  describe("getSourcesForTenant", () => {
    it("should return shared sources plus tenant-local sources", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const sources = getSourcesForTenant("tandil-tenant-uuid");

      // Shared (5) + Tandil local (1) = 6
      expect(sources).toHaveLength(6);
    });

    it("should only return shared sources for unknown tenant", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const sources = getSourcesForTenant("unknown-tenant");

      // Only shared sources (5)
      expect(sources).toHaveLength(5);
      expect(sources.every((s) => s.is_shared)).toBe(true);
    });
  });

  describe("getSharedSources", () => {
    it("should return only shared sources", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const sources = getSharedSources();

      expect(sources).toHaveLength(5);
      expect(sources.every((s) => s.is_shared)).toBe(true);
    });
  });

  describe("getTenantLocalSources", () => {
    it("should return only tenant-local sources for a tenant", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const sources = getTenantLocalSources("tandil-tenant-uuid");

      expect(sources).toHaveLength(1);
      expect(sources[0].slug).toBe("tandil-municipio");
    });
  });

  describe("getBreakingNewsSources", () => {
    it("should return sources that support breaking news", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const sources = getBreakingNewsSources();

      expect(sources).toHaveLength(2);
      expect(sources.every((s) => s.supports_breaking === true)).toBe(true);
    });
  });

  describe("getAlertingConfig", () => {
    it("should return alerting configuration", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const alerting = getAlertingConfig();

      expect(alerting.error_rate_threshold).toBe(10);
      expect(alerting.no_events_threshold_hours).toBe(24);
    });
  });

  describe("getBackfillConfig", () => {
    it("should return backfill configuration", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const backfill = getBackfillConfig();

      expect(backfill.batch_size).toBe(100);
      expect(backfill.max_parallel_sources).toBe(5);
      expect(backfill.checkpoint_enabled).toBe(true);
    });
  });

  describe("validateEnvVars", () => {
    it("should return valid=true when all env vars are set", () => {
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const result = validateEnvVars();

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it("should return valid=false with missing vars", () => {
      delete process.env.TICKETMASTER_API_KEY;
      mockFs.readFileSync.mockReturnValueOnce(validYamlConfig);

      const result = validateEnvVars();

      expect(result.valid).toBe(false);
      expect(result.missing).toContain("TICKETMASTER_API_KEY");
    });
  });

  describe("getRequiredEnvVars", () => {
    it("should return list of required environment variables", () => {
      const required = getRequiredEnvVars();

      expect(required.length).toBeGreaterThan(0);
      expect(
        required.find((r) => r.name === "TICKETMASTER_API_KEY"),
      ).toBeDefined();
      expect(required.find((r) => r.name === "NEWS_API_KEY")).toBeDefined();
    });
  });

  describe("reloadConfig", () => {
    it("should bypass cache on reload", () => {
      mockFs.readFileSync
        .mockReturnValueOnce(validYamlConfig)
        .mockReturnValueOnce(validYamlConfig);

      // First load
      loadConfig("/test/config.yaml");

      // Modify the file
      process.env.TICKETMASTER_API_KEY = "new-key";

      // Reload should pick up changes
      const config = reloadConfig("/test/config.yaml");

      const ticketmasterSource = config.sources.find(
        (s) => s.slug === "ticketmaster-discovery",
      );
      expect(ticketmasterSource?.config.api_key).toBe("new-key");
    });
  });
});
