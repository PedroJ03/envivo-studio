/**
 * Configuration Loader - Phase 6: Configuration & Operations
 *
 * Loads and validates the YAML source configuration.
 * Merges with environment variables for credentials.
 */

import { readFileSync } from "fs";
import { join } from "path";
import yaml from "yaml";

// ============================================================================
// Types
// ============================================================================

export interface SourceConfig {
  slug: string;
  name: string;
  system: "A" | "B";
  connector: string;
  description?: string;
  is_shared: boolean;
  tenant_id?: string;
  enabled: boolean;
  priority: number;
  supports_breaking?: boolean;
  schedule?: string;
  config: Record<string, unknown>;
  rate_limit?: {
    requests_per_day?: number;
    requests_per_minute?: number;
    requests_per_second?: number;
  };
  retry?: {
    max_retries: number;
    backoff_ms: number;
  };
  circuit_breaker?: {
    failure_threshold: number;
    reset_timeout_ms: number;
  };
  cache?: {
    api_response_ttl?: number;
  };
  selectors?: Record<string, string>;
  filter_keywords?: string[];
  exclude_keywords?: string[];
  date_formats?: string[];
}

export interface DefaultsConfig {
  retry: {
    max_retries: number;
    backoff_ms: number;
  };
  circuit_breaker: {
    failure_threshold: number;
    reset_timeout_ms: number;
  };
  cache: {
    api_response_ttl: number;
  };
}

export interface AlertingConfig {
  error_rate_threshold: number;
  no_events_threshold_hours: number;
  source_down_threshold_hours: number;
  rate_limit_hit_threshold: number;
  health_check_interval_minutes: number;
}

export interface BackfillConfig {
  batch_size: number;
  batch_delay_ms: number;
  max_parallel_sources: number;
  checkpoint_enabled: boolean;
  checkpoint_prefix: string;
}

export interface SourcesYamlConfig {
  defaults: DefaultsConfig;
  sources: SourceConfig[];
  alerting: AlertingConfig;
  backfill: BackfillConfig;
}

// ============================================================================
// Configuration Loader
// ============================================================================

let cachedConfig: SourcesYamlConfig | null = null;

/**
 * Load configuration from YAML file.
 * Configuration is cached after first load.
 */
export function loadConfig(configPath?: string): SourcesYamlConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const defaultPath = join(process.cwd(), "config", "sources.yaml");
  const filePath = configPath || defaultPath;

  try {
    const fileContents = readFileSync(filePath, "utf8");
    const config = yaml.parse(fileContents) as SourcesYamlConfig;

    // Validate required fields
    validateConfig(config);

    // Apply defaults and expand env vars
    cachedConfig = expandEnvVars(config);

    return cachedConfig;
  } catch (error) {
    if (error instanceof Error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        throw new Error(
          `Configuration file not found: ${filePath}. Create config/sources.yaml or set SOURCES_CONFIG_PATH environment variable.`,
        );
      }
      throw new Error(`Failed to load configuration: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Reload configuration (bypasses cache).
 */
export function reloadConfig(configPath?: string): SourcesYamlConfig {
  cachedConfig = null;
  return loadConfig(configPath);
}

/**
 * Validate configuration structure.
 */
function validateConfig(config: SourcesYamlConfig): void {
  const errors: string[] = [];

  // Validate defaults
  if (!config.defaults) {
    errors.push("Missing 'defaults' section");
  } else {
    if (!config.defaults.retry) {
      errors.push("Missing 'defaults.retry' configuration");
    }
    if (!config.defaults.circuit_breaker) {
      errors.push("Missing 'defaults.circuit_breaker' configuration");
    }
    if (!config.defaults.cache) {
      errors.push("Missing 'defaults.cache' configuration");
    }
  }

  // Validate sources array
  if (!config.sources || !Array.isArray(config.sources)) {
    errors.push("Missing or invalid 'sources' array");
  } else {
    config.sources.forEach((source, index) => {
      const sourceErrors = validateSource(source, index);
      errors.push(...sourceErrors);
    });

    // Check for duplicate slugs
    const slugs = config.sources.map((s) => s.slug);
    const duplicates = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
    if (duplicates.length > 0) {
      errors.push(`Duplicate source slugs: ${duplicates.join(", ")}`);
    }
  }

  // Validate alerting config
  if (!config.alerting) {
    errors.push("Missing 'alerting' configuration");
  }

  // Validate backfill config
  if (!config.backfill) {
    errors.push("Missing 'backfill' configuration");
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation errors:\n  - ${errors.join("\n  - ")}`,
    );
  }
}

/**
 * Validate individual source configuration.
 */
function validateSource(source: SourceConfig, index: number): string[] {
  const errors: string[] = [];
  const prefix = `sources[${index}]`;

  if (!source.slug) {
    errors.push(`${prefix}: missing 'slug'`);
  } else if (!/^[a-z0-9-]+$/.test(source.slug)) {
    errors.push(
      `${prefix}: slug '${source.slug}' must be lowercase alphanumeric with hyphens only`,
    );
  }

  if (!source.name) {
    errors.push(`${prefix}: missing 'name'`);
  }

  if (!source.system || !["A", "B"].includes(source.system)) {
    errors.push(`${prefix}: invalid 'system' (must be 'A' or 'B')`);
  }

  if (!source.connector) {
    errors.push(`${prefix}: missing 'connector'`);
  }

  if (source.tenant_id && !source.tenant_id.startsWith("${")) {
    // It's not an env var reference, check if it's a valid UUID format or env var
    if (
      !/^\{[A-Z_]+\}$/.test(source.tenant_id) &&
      !/^[0-9a-f-]{36}$/i.test(source.tenant_id)
    ) {
      // Might be a reference like ${TANDIL_TENANT_ID}
      if (
        !source.tenant_id.includes("_ID") &&
        !source.tenant_id.includes("_TENANT")
      ) {
        errors.push(
          `${prefix}: tenant_id '${source.tenant_id}' doesn't look valid`,
        );
      }
    }
  }

  if (typeof source.enabled !== "boolean") {
    errors.push(`${prefix}: 'enabled' must be a boolean`);
  }

  if (typeof source.is_shared !== "boolean") {
    errors.push(`${prefix}: 'is_shared' must be a boolean`);
  }

  return errors;
}

/**
 * Expand environment variable references in config values.
 * Supports ${VAR_NAME} syntax.
 */
function expandEnvVars(config: SourcesYamlConfig): SourcesYamlConfig {
  const expand = (value: unknown): unknown => {
    if (typeof value === "string") {
      // Match ${VAR_NAME} pattern
      const envVarMatch = value.match(/^\$\{([A-Z_][A-Z0-9_]*)\}$/);
      if (envVarMatch) {
        const varName = envVarMatch[1];
        const envValue = process.env[varName];
        if (envValue === undefined) {
          console.warn(
            `[Config] Environment variable ${varName} is not set (referenced in sources.yaml)`,
          );
          return ""; // Return empty string for unset vars
        }
        return envValue;
      }
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(expand);
    }

    if (value && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = expand(val);
      }
      return result;
    }

    return value;
  };

  // Deep clone and expand
  const expanded = JSON.parse(JSON.stringify(config)) as SourcesYamlConfig;

  // Expand sources
  expanded.sources = expanded.sources.map((source) => {
    const expandedSource = { ...source };
    expandedSource.config = expand(source.config) as Record<string, unknown>;
    if (source.selectors) {
      expandedSource.selectors = expand(source.selectors) as Record<
        string,
        string
      >;
    }
    if (source.filter_keywords) {
      expandedSource.filter_keywords = expand(
        source.filter_keywords,
      ) as string[];
    }
    if (source.exclude_keywords) {
      expandedSource.exclude_keywords = expand(
        source.exclude_keywords,
      ) as string[];
    }
    return expandedSource;
  });

  return expanded;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get configuration for a specific source by slug.
 */
export function getSourceConfig(slug: string): SourceConfig | undefined {
  const config = loadConfig();
  return config.sources.find((s) => s.slug === slug);
}

/**
 * Get all enabled sources.
 */
export function getEnabledSources(): SourceConfig[] {
  const config = loadConfig();
  return config.sources.filter((s) => s.enabled);
}

/**
 * Get all enabled sources for a specific system.
 */
export function getEnabledSourcesForSystem(system: "A" | "B"): SourceConfig[] {
  const config = loadConfig();
  return config.sources.filter((s) => s.enabled && s.system === system);
}

/**
 * Get sources for a specific tenant.
 * Returns both tenant-local sources and shared sources.
 */
export function getSourcesForTenant(tenantId: string): SourceConfig[] {
  const config = loadConfig();
  return config.sources.filter(
    (s) => s.enabled && (s.tenant_id === tenantId || s.is_shared),
  );
}

/**
 * Get only shared sources.
 */
export function getSharedSources(): SourceConfig[] {
  const config = loadConfig();
  return config.sources.filter((s) => s.enabled && s.is_shared);
}

/**
 * Get only tenant-local sources for a specific tenant.
 */
export function getTenantLocalSources(tenantId: string): SourceConfig[] {
  const config = loadConfig();
  return config.sources.filter(
    (s) => s.enabled && !s.is_shared && s.tenant_id === tenantId,
  );
}

/**
 * Get breaking news sources (supports_breaking: true).
 */
export function getBreakingNewsSources(): SourceConfig[] {
  const config = loadConfig();
  return config.sources.filter(
    (s) => s.enabled && s.supports_breaking === true,
  );
}

/**
 * Get alerting configuration.
 */
export function getAlertingConfig(): AlertingConfig {
  const config = loadConfig();
  return config.alerting;
}

/**
 * Get backfill configuration.
 */
export function getBackfillConfig(): BackfillConfig {
  const config = loadConfig();
  return config.backfill;
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check if all required environment variables are set.
 */
export function validateEnvVars(): { valid: boolean; missing: string[] } {
  const config = loadConfig();
  const requiredVars = new Set<string>();

  // Collect all env var references from sources
  for (const source of config.sources) {
    collectEnvVars(source.config, requiredVars);
    if (source.tenant_id?.startsWith("${") && source.tenant_id?.endsWith("}")) {
      const varName = source.tenant_id.slice(2, -1);
      requiredVars.add(varName);
    }
  }

  // Check which ones are missing
  const missing: string[] = [];
  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}

function collectEnvVars(obj: unknown, vars: Set<string>): void {
  if (typeof obj === "string") {
    const match = obj.match(/^\$\{([A-Z_][A-Z0-9_]*)\}$/);
    if (match) {
      vars.add(match[1]);
    }
    return;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      collectEnvVars(item, vars);
    }
    return;
  }

  if (obj && typeof obj === "object") {
    for (const val of Object.values(obj)) {
      collectEnvVars(val, vars);
    }
  }
}

/**
 * Get list of required environment variables with descriptions.
 */
export function getRequiredEnvVars(): Array<{
  name: string;
  description: string;
  example?: string;
}> {
  return [
    {
      name: "TICKETMASTER_API_KEY",
      description: "Ticketmaster Discovery API key for concert events",
      example: "your-ticketmaster-api-key",
    },
    {
      name: "EVENTBRITE_API_KEY",
      description: "Eventbrite API key for Argentina events",
      example: "your-eventbrite-api-key",
    },
    {
      name: "NEWS_API_KEY",
      description: "NewsAPI key for breaking music news",
      example: "your-newsapi-key",
    },
    {
      name: "GNEWS_API_KEY",
      description: "GNews API key for alternative news source",
      example: "your-gnews-api-key",
    },
    {
      name: "TANDIL_TENANT_ID",
      description: "UUID for the Tandil tenant (for tenant-local sources)",
      example: "550e8400-e29b-41d4-a716-446655440000",
    },
    {
      name: "REDIS_URL",
      description: "Redis connection URL for caching and rate limiting",
      example: "redis://localhost:6379",
    },
    {
      name: "DATABASE_URL",
      description: "PostgreSQL connection string",
      example: "postgresql://user:pass@localhost:5432/envivo_studio",
    },
  ];
}

// ============================================================================
// CLI Helpers
// ============================================================================

/**
 * Print configuration summary (for CLI).
 */
export function printConfigSummary(): void {
  const config = loadConfig();

  console.log("\n📋 Content Ingestion Configuration Summary\n");
  console.log(`Total sources: ${config.sources.length}`);
  console.log(
    `  System A (Calendar): ${config.sources.filter((s) => s.system === "A").length}`,
  );
  console.log(
    `  System B (Feed): ${config.sources.filter((s) => s.system === "B").length}`,
  );
  console.log(`  Enabled: ${config.sources.filter((s) => s.enabled).length}`);
  console.log(`  Shared: ${config.sources.filter((s) => s.is_shared).length}`);
  console.log(
    `  Tenant-local: ${config.sources.filter((s) => !s.is_shared).length}`,
  );

  console.log("\n📊 Sources by System:\n");

  console.log("System A (Calendar Events):");
  for (const source of config.sources.filter((s) => s.system === "A")) {
    const status = source.enabled ? "✅" : "❌";
    const shared = source.is_shared ? "(shared)" : "(tenant-local)";
    console.log(`  ${status} ${source.slug} ${shared}`);
  }

  console.log("\nSystem B (Content Feed):");
  for (const source of config.sources.filter((s) => s.system === "B")) {
    const status = source.enabled ? "✅" : "❌";
    const shared = source.is_shared ? "(shared)" : "(tenant-local)";
    const breaking = source.supports_breaking ? " [breaking]" : "";
    console.log(`  ${status} ${source.slug} ${shared}${breaking}`);
  }

  // Check env vars
  const envCheck = validateEnvVars();
  console.log("\n🔐 Environment Variables:\n");
  if (envCheck.valid) {
    console.log("  ✅ All required environment variables are set");
  } else {
    console.log(`  ❌ Missing ${envCheck.missing.length} required variables:`);
    for (const missing of envCheck.missing) {
      console.log(`     - ${missing}`);
    }
  }

  console.log();
}
