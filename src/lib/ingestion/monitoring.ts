/**
 * Monitoring & Alerting - Phase 6: Configuration & Operations
 *
 * Structured logging, metrics collection, and alerting for content ingestion.
 */

// ============================================================================
// Types
// ============================================================================

export interface IngestMetrics {
  runId: string;
  source: string;
  system: "A" | "B";
  // Counts
  eventsCreated: number;
  duplicatesSkipped: number;
  errors: number;
  // Timing
  durationMs: number;
  fetchDurationMs?: number;
  normalizeDurationMs?: number;
  dedupeDurationMs?: number;
  // Status
  status: "success" | "partial" | "failed";
  errorMessage?: string;
  // Context
  tenantId?: string;
  timestamp: string;
}

export interface SourceHealth {
  source: string;
  healthy: boolean;
  latencyMs?: number;
  lastSuccessfulIngest?: string;
  lastError?: string;
  consecutiveFailures: number;
  rateLimitHits: number;
  circuitOpen: boolean;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: "info" | "warning" | "critical";
  source: string;
  message: string;
  details: Record<string, unknown>;
  timestamp: string;
  acknowledged: boolean;
}

export type AlertType =
  | "SOURCE_DOWN"
  | "HIGH_ERROR_RATE"
  | "NO_EVENTS_INGESTED"
  | "RATE_LIMIT_HIT"
  | "CIRCUIT_OPEN"
  | "CONFIG_ERROR";

export interface HealthCheckResult {
  healthy: boolean;
  sources: SourceHealth[];
  overallLatencyMs: number;
  timestamp: string;
  summary?: {
    total: number;
    healthy: number;
    unhealthy: number;
    avgLatencyMs: number;
  };
}

// ============================================================================
// Alert Thresholds (from config)
// ============================================================================

const ALERT_THRESHOLDS = {
  // Error rate > 10%
  ERROR_RATE_THRESHOLD: 10,
  // No events for 24 hours
  NO_EVENTS_THRESHOLD_HOURS: 24,
  // Source down for > 1 hour
  SOURCE_DOWN_THRESHOLD_HOURS: 1,
  // Rate limit hit > 5 consecutive
  RATE_LIMIT_HIT_THRESHOLD: 5,
  // Health check interval
  HEALTH_CHECK_INTERVAL_MS: 15 * 60 * 1000, // 15 minutes
} as const;

// ============================================================================
// Metrics Logging
// ============================================================================

/**
 * Log ingestion metrics in structured JSON format.
 * Designed for log aggregation systems (Datadog, Grafana, ELK, etc.)
 */
export function logIngestMetrics(metrics: IngestMetrics): void {
  const logEntry = {
    type: "ingest_metrics",
    ...metrics,
    // Computed fields for easier querying
    errorRate:
      metrics.eventsCreated + metrics.duplicatesSkipped + metrics.errors > 0
        ? (
            (metrics.errors /
              (metrics.eventsCreated +
                metrics.duplicatesSkipped +
                metrics.errors)) *
            100
          ).toFixed(2)
        : "0.00",
    eventsPerSecond:
      metrics.durationMs > 0
        ? (metrics.eventsCreated / (metrics.durationMs / 1000)).toFixed(2)
        : "0.00",
  };

  // Output as structured JSON for log aggregation
  console.log(JSON.stringify(logEntry));

  // Also log to console in development for readability
  if (process.env.NODE_ENV === "development") {
    console.log(
      `[Ingest] ${metrics.source} | Created: ${metrics.eventsCreated} | ` +
        `Duplicates: ${metrics.duplicatesSkipped} | Errors: ${metrics.errors} | ` +
        `Duration: ${metrics.durationMs}ms | Status: ${metrics.status}`,
    );
  }
}

/**
 * Log a batch of metrics (aggregated).
 */
export function logIngestBatch(metrics: IngestMetrics[]): void {
  const summary = {
    type: "ingest_batch_summary",
    timestamp: new Date().toISOString(),
    totalSources: metrics.length,
    totalEventsCreated: metrics.reduce((sum, m) => sum + m.eventsCreated, 0),
    totalDuplicatesSkipped: metrics.reduce(
      (sum, m) => sum + m.duplicatesSkipped,
      0,
    ),
    totalErrors: metrics.reduce((sum, m) => sum + m.errors, 0),
    totalDurationMs: metrics.reduce((sum, m) => sum + m.durationMs, 0),
    sources: metrics.map((m) => ({
      source: m.source,
      status: m.status,
      eventsCreated: m.eventsCreated,
    })),
  };

  console.log(JSON.stringify(summary));
}

// ============================================================================
// Alerting
// ============================================================================

/**
 * Check metrics against alert thresholds and generate alerts.
 */
export function checkAlertThresholds(
  metrics: IngestMetrics,
  previousMetrics?: IngestMetrics[],
): Alert[] {
  const alerts: Alert[] = [];
  const totalRequests =
    metrics.eventsCreated + metrics.duplicatesSkipped + metrics.errors;

  // Skip if no activity
  if (totalRequests === 0) {
    return alerts;
  }

  // 1. High error rate check (>10%)
  const errorRate = (metrics.errors / totalRequests) * 100;
  if (errorRate > ALERT_THRESHOLDS.ERROR_RATE_THRESHOLD) {
    alerts.push({
      id: `alert-${metrics.source}-${Date.now()}`,
      type: "HIGH_ERROR_RATE",
      severity: errorRate > 50 ? "critical" : "warning",
      source: metrics.source,
      message: `High error rate for ${metrics.source}: ${errorRate.toFixed(1)}%`,
      details: {
        errorRate: errorRate.toFixed(2),
        errors: metrics.errors,
        totalRequests,
        runId: metrics.runId,
      },
      timestamp: new Date().toISOString(),
      acknowledged: false,
    });
  }

  // 2. No events ingested check (compare with previous)
  if (
    metrics.eventsCreated === 0 &&
    metrics.duplicatesSkipped === 0 &&
    metrics.errors === 0
  ) {
    // Check if this is unusual (previous runs had events)
    const previousHadEvents = previousMetrics?.some(
      (m) => m.source === metrics.source && m.eventsCreated > 0,
    );

    if (previousHadEvents) {
      alerts.push({
        id: `alert-${metrics.source}-no-events-${Date.now()}`,
        type: "NO_EVENTS_INGESTED",
        severity: "warning",
        source: metrics.source,
        message: `No events ingested from ${metrics.source} (previously had events)`,
        details: {
          runId: metrics.runId,
          previousRunIds: previousMetrics
            ?.filter((m) => m.source === metrics.source)
            .map((m) => m.runId),
        },
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }
  }

  // 3. Consecutive failures check
  if (metrics.status === "failed") {
    const previousFailures = previousMetrics?.filter(
      (m) => m.source === metrics.source && m.status === "failed",
    ).length;

    if (previousFailures && previousFailures >= 3) {
      alerts.push({
        id: `alert-${metrics.source}-consecutive-failures-${Date.now()}`,
        type: "SOURCE_DOWN",
        severity: "critical",
        source: metrics.source,
        message: `${metrics.source} has failed ${previousFailures + 1} consecutive times`,
        details: {
          consecutiveFailures: previousFailures + 1,
          lastError: metrics.errorMessage,
          runId: metrics.runId,
        },
        timestamp: new Date().toISOString(),
        acknowledged: false,
      });
    }
  }

  return alerts;
}

/**
 * Send alert to external monitoring system.
 * Currently supports console/logging; can be extended for Slack, PagerDuty, etc.
 */
export async function sendAlert(alert: Alert): Promise<void> {
  // Log the alert
  const alertLog = {
    event_type: "alert",
    ...alert,
  };
  console.error(JSON.stringify(alertLog));

  // In production, you would integrate with external systems:
  // - Slack: Send to configured webhook
  // - PagerDuty: Create incident for critical alerts
  // - Datadog: Send metric event
  // - Email: Send notification

  if (process.env.SLACK_WEBHOOK_URL && alert.severity !== "info") {
    await sendSlackAlert(alert);
  }

  if (alert.severity === "critical" && process.env.PAGERDUTY_KEY) {
    await sendPagerDutyAlert(alert);
  }
}

/**
 * Send alert to Slack.
 */
async function sendSlackAlert(alert: Alert): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const severityEmoji = {
    info: "ℹ️",
    warning: "⚠️",
    critical: "🚨",
  }[alert.severity];

  const color = {
    info: "#36a64f",
    warning: "#ff9800",
    critical: "#f44336",
  }[alert.severity];

  const payload = {
    attachments: [
      {
        color,
        title: `${severityEmoji} ${alert.type}: ${alert.source}`,
        text: alert.message,
        fields: [
          {
            title: "Severity",
            value: alert.severity.toUpperCase(),
            short: true,
          },
          {
            title: "Timestamp",
            value: alert.timestamp,
            short: true,
          },
        ],
        footer: "envivo-studio ingestion",
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("[Monitoring] Failed to send Slack alert:", error);
  }
}

/**
 * Send critical alert to PagerDuty.
 */
async function sendPagerDutyAlert(alert: Alert): Promise<void> {
  const serviceKey = process.env.PAGERDUTY_KEY;
  if (!serviceKey) return;

  const payload = {
    service_key: serviceKey,
    event_type: "trigger",
    description: `${alert.type}: ${alert.message}`,
    incident_key: `envivo-${alert.source}-${alert.type}`,
    payload: {
      summary: alert.message,
      severity: alert.severity === "critical" ? "critical" : "warning",
      source: alert.source,
      custom_details: alert.details,
    },
  };

  try {
    await fetch(
      "https://events.pagerduty.com/generic/2010-04-15/create_event.json",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
  } catch (error) {
    console.error("[Monitoring] Failed to send PagerDuty alert:", error);
  }
}

// ============================================================================
// Health Checks
// ============================================================================

/**
 * Check health of a specific source.
 * Returns status with latency measurement.
 */
export async function checkSourceHealth(
  source: string,
  healthCheckFn: () => Promise<{
    healthy: boolean;
    latencyMs?: number;
    error?: string;
  }>,
): Promise<SourceHealth> {
  const startTime = Date.now();

  try {
    const result = await healthCheckFn();
    return {
      source,
      healthy: result.healthy,
      latencyMs: result.latencyMs ?? Date.now() - startTime,
      consecutiveFailures: 0,
      rateLimitHits: 0,
      circuitOpen: false,
      ...(result.healthy
        ? { lastSuccessfulIngest: new Date().toISOString() }
        : { lastError: result.error }),
    };
  } catch (error) {
    return {
      source,
      healthy: false,
      latencyMs: Date.now() - startTime,
      lastError: error instanceof Error ? error.message : String(error),
      consecutiveFailures: 1,
      rateLimitHits: 0,
      circuitOpen: false,
    };
  }
}

/**
 * Perform health check on all enabled sources.
 */
export async function checkAllSourcesHealth(
  sources: Array<{
    slug: string;
    healthCheck: () => Promise<{
      healthy: boolean;
      latencyMs?: number;
      error?: string;
    }>;
  }>,
): Promise<HealthCheckResult> {
  const startTime = Date.now();

  const results = await Promise.all(
    sources.map(async (source) => {
      try {
        return await checkSourceHealth(source.slug, source.healthCheck);
      } catch {
        return {
          source: source.slug,
          healthy: false,
          consecutiveFailures: 1,
          rateLimitHits: 0,
          circuitOpen: false,
          lastError: "Health check failed",
        } as SourceHealth;
      }
    }),
  );

  const healthy = results.filter((r) => r.healthy);
  const unhealthy = results.filter((r) => !r.healthy);

  return {
    healthy: unhealthy.length === 0,
    sources: results,
    overallLatencyMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
    // Summary for easy alerting
    summary: {
      total: results.length,
      healthy: healthy.length,
      unhealthy: unhealthy.length,
      avgLatencyMs:
        results.reduce((sum, r) => sum + (r.latencyMs ?? 0), 0) /
        results.length,
    },
  };
}

// ============================================================================
// Health Status Logging
// ============================================================================

/**
 * Log health check result.
 */
export function logHealthCheck(result: HealthCheckResult): void {
  const logEntry = {
    type: "health_check",
    ...result,
  };

  console.log(JSON.stringify(logEntry));

  // Development-friendly output
  if (process.env.NODE_ENV === "development") {
    const status = result.healthy ? "✅" : "❌";
    console.log(
      `[Health] ${status} ${result.sources.length} sources checked in ${result.overallLatencyMs}ms`,
    );

    if (result.summary) {
      console.log(
        `  Healthy: ${result.summary.healthy}/${result.summary.total}, ` +
          `Avg Latency: ${result.summary.avgLatencyMs?.toFixed(0) ?? "N/A"}ms`,
      );
    }
  }

  // Alert on unhealthy sources
  const unhealthy = result.sources.filter((s) => !s.healthy);
  if (unhealthy.length > 0) {
    for (const source of unhealthy) {
      console.error(
        JSON.stringify({
          type: "source_unhealthy",
          source: source.source,
          error: source.lastError,
          consecutiveFailures: source.consecutiveFailures,
          timestamp: result.timestamp,
        }),
      );
    }
  }
}

// ============================================================================
// Integration Points for External Monitoring
// ============================================================================

/**
 * Export metrics in Datadog format.
 * Call this to submit metrics to Datadog.
 */
export function formatDatadogMetrics(metrics: IngestMetrics): object {
  const timestamp = new Date(metrics.timestamp).getTime() / 1000;

  return {
    metric: "envivo.ingestion.events",
    points: [[timestamp, metrics.eventsCreated]],
    type: "count",
    tags: [
      `source:${metrics.source}`,
      `system:${metrics.system}`,
      `status:${metrics.status}`,
    ],
  };
}

/**
 * Get statsd-compatible metric format.
 */
export function formatStatsDMetrics(metrics: IngestMetrics): string[] {
  const lines: string[] = [];
  const prefix = `envivo.ingestion.${metrics.source}`;

  lines.push(`${prefix}.events_created:${metrics.eventsCreated}|c`);
  lines.push(`${prefix}.duplicates_skipped:${metrics.duplicatesSkipped}|c`);
  lines.push(`${prefix}.errors:${metrics.errors}|c`);
  lines.push(`${prefix}.duration:${metrics.durationMs}|ms`);

  return lines;
}

// ============================================================================
// Dashboard Helpers
// ============================================================================

/**
 * Get a summary of recent ingestion activity.
 * Useful for dashboards.
 */
export interface IngestionSummary {
  totalEventsCreated: number;
  totalDuplicatesSkipped: number;
  totalErrors: number;
  avgErrorRate: number;
  sourcesActive: number;
  sourcesWithErrors: number;
  periodStart: string;
  periodEnd: string;
}

/**
 * Aggregate metrics over a time period.
 */
export function aggregateMetrics(
  metricsList: IngestMetrics[],
): IngestionSummary {
  if (metricsList.length === 0) {
    return {
      totalEventsCreated: 0,
      totalDuplicatesSkipped: 0,
      totalErrors: 0,
      avgErrorRate: 0,
      sourcesActive: 0,
      sourcesWithErrors: 0,
      periodStart: new Date().toISOString(),
      periodEnd: new Date().toISOString(),
    };
  }

  const totalEventsCreated = metricsList.reduce(
    (sum, m) => sum + m.eventsCreated,
    0,
  );
  const totalDuplicatesSkipped = metricsList.reduce(
    (sum, m) => sum + m.duplicatesSkipped,
    0,
  );
  const totalErrors = metricsList.reduce((sum, m) => sum + m.errors, 0);
  const totalRequests =
    totalEventsCreated + totalDuplicatesSkipped + totalErrors;

  const timestamps = metricsList
    .map((m) => new Date(m.timestamp).getTime())
    .sort((a, b) => a - b);

  return {
    totalEventsCreated,
    totalDuplicatesSkipped,
    totalErrors,
    avgErrorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
    sourcesActive: new Set(metricsList.map((m) => m.source)).size,
    sourcesWithErrors: new Set(
      metricsList.filter((m) => m.errors > 0).map((m) => m.source),
    ).size,
    periodStart: new Date(timestamps[0]).toISOString(),
    periodEnd: new Date(timestamps[timestamps.length - 1]).toISOString(),
  };
}
