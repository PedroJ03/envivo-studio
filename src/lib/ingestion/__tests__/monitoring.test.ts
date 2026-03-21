/**
 * Monitoring & Alerting Tests - Phase 6
 *
 * Tests for structured logging, metrics collection, and alerting.
 *
 * @module ingestion/__tests__/monitoring.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  logIngestMetrics,
  logIngestBatch,
  checkAlertThresholds,
  checkSourceHealth,
  logHealthCheck,
  aggregateMetrics,
  formatDatadogMetrics,
  formatStatsDMetrics,
  type IngestMetrics,
  type Alert,
  type SourceHealth,
} from "../monitoring";

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
const mockConsoleError = vi
  .spyOn(console, "error")
  .mockImplementation(() => {});

describe("Monitoring & Alerting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "test");
  });

  afterEach(() => {
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
  });

  describe("logIngestMetrics", () => {
    it("should log structured JSON metrics", () => {
      const metrics: IngestMetrics = {
        runId: "run-123",
        source: "ticketmaster",
        system: "A",
        eventsCreated: 10,
        duplicatesSkipped: 5,
        errors: 1,
        durationMs: 1500,
        fetchDurationMs: 1000,
        normalizeDurationMs: 300,
        dedupeDurationMs: 200,
        status: "partial",
        timestamp: "2024-03-21T10:00:00Z",
      };

      logIngestMetrics(metrics);

      expect(mockConsoleLog).toHaveBeenCalled();

      const loggedOutput = mockConsoleLog.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedOutput);

      expect(parsed.type).toBe("ingest_metrics");
      expect(parsed.runId).toBe("run-123");
      expect(parsed.source).toBe("ticketmaster");
      expect(parsed.eventsCreated).toBe(10);
      expect(parsed.errorRate).toBe("6.25"); // 1 / 16 * 100
    });

    it("should calculate events per second", () => {
      const metrics: IngestMetrics = {
        runId: "run-456",
        source: "wikimedia",
        system: "A",
        eventsCreated: 100,
        duplicatesSkipped: 0,
        errors: 0,
        durationMs: 1000,
        status: "success",
        timestamp: "2024-03-21T10:00:00Z",
      };

      logIngestMetrics(metrics);

      const loggedOutput = mockConsoleLog.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedOutput);

      expect(parsed.eventsPerSecond).toBe("100.00");
    });

    it("should handle zero duration", () => {
      const metrics: IngestMetrics = {
        runId: "run-789",
        source: "ticketmaster",
        system: "A",
        eventsCreated: 0,
        duplicatesSkipped: 0,
        errors: 0,
        durationMs: 0,
        status: "success",
        timestamp: "2024-03-21T10:00:00Z",
      };

      logIngestMetrics(metrics);

      const loggedOutput = mockConsoleLog.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedOutput);

      expect(parsed.eventsPerSecond).toBe("0.00");
    });
  });

  describe("logIngestBatch", () => {
    it("should log aggregated batch metrics", () => {
      const batchMetrics: IngestMetrics[] = [
        {
          runId: "run-1",
          source: "ticketmaster",
          system: "A",
          eventsCreated: 10,
          duplicatesSkipped: 2,
          errors: 1,
          durationMs: 1000,
          status: "partial",
          timestamp: "2024-03-21T10:00:00Z",
        },
        {
          runId: "run-2",
          source: "eventbrite",
          system: "A",
          eventsCreated: 5,
          duplicatesSkipped: 1,
          errors: 0,
          durationMs: 500,
          status: "success",
          timestamp: "2024-03-21T10:00:00Z",
        },
      ];

      logIngestBatch(batchMetrics);

      const loggedOutput = mockConsoleLog.mock.calls[0][0] as string;
      const parsed = JSON.parse(loggedOutput);

      expect(parsed.type).toBe("ingest_batch_summary");
      expect(parsed.totalSources).toBe(2);
      expect(parsed.totalEventsCreated).toBe(15);
      expect(parsed.totalDuplicatesSkipped).toBe(3);
      expect(parsed.totalErrors).toBe(1);
      expect(parsed.sources).toHaveLength(2);
    });
  });

  describe("checkAlertThresholds", () => {
    it("should generate alert when error rate > 10%", () => {
      const metrics: IngestMetrics = {
        runId: "run-123",
        source: "ticketmaster",
        system: "A",
        eventsCreated: 5,
        duplicatesSkipped: 0,
        errors: 2, // 2/7 = 28.6%
        durationMs: 1000,
        status: "partial",
        timestamp: "2024-03-21T10:00:00Z",
      };

      const alerts = checkAlertThresholds(metrics);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("HIGH_ERROR_RATE");
      expect(alerts[0].severity).toBe("warning");
      expect(alerts[0].source).toBe("ticketmaster");
    });

    it("should generate critical alert when error rate > 50%", () => {
      const metrics: IngestMetrics = {
        runId: "run-123",
        source: "ticketmaster",
        system: "A",
        eventsCreated: 2,
        duplicatesSkipped: 0,
        errors: 5, // 5/7 = 71%
        durationMs: 1000,
        status: "failed",
        timestamp: "2024-03-21T10:00:00Z",
      };

      const alerts = checkAlertThresholds(metrics);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].severity).toBe("critical");
    });

    it("should not alert when error rate is within threshold", () => {
      const metrics: IngestMetrics = {
        runId: "run-123",
        source: "ticketmaster",
        system: "A",
        eventsCreated: 100,
        duplicatesSkipped: 0,
        errors: 5, // 5/105 = 4.8%
        durationMs: 1000,
        status: "success",
        timestamp: "2024-03-21T10:00:00Z",
      };

      const alerts = checkAlertThresholds(metrics);

      expect(alerts).toHaveLength(0);
    });

    it("should not alert when no activity", () => {
      const metrics: IngestMetrics = {
        runId: "run-123",
        source: "ticketmaster",
        system: "A",
        eventsCreated: 0,
        duplicatesSkipped: 0,
        errors: 0,
        durationMs: 1000,
        status: "success",
        timestamp: "2024-03-21T10:00:00Z",
      };

      const alerts = checkAlertThresholds(metrics);

      expect(alerts).toHaveLength(0);
    });

    it("should alert when no events ingested after previous success", () => {
      const metrics: IngestMetrics = {
        runId: "run-123",
        source: "ticketmaster",
        system: "A",
        eventsCreated: 0,
        duplicatesSkipped: 0,
        errors: 0,
        durationMs: 1000,
        status: "success",
        timestamp: "2024-03-21T10:00:00Z",
      };

      const previousMetrics: IngestMetrics[] = [
        {
          runId: "run-prev",
          source: "ticketmaster",
          system: "A",
          eventsCreated: 10,
          duplicatesSkipped: 2,
          errors: 0,
          durationMs: 1000,
          status: "success",
          timestamp: "2024-03-21T09:00:00Z",
        },
      ];

      const alerts = checkAlertThresholds(metrics, previousMetrics);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe("NO_EVENTS_INGESTED");
      expect(alerts[0].severity).toBe("warning");
    });

    it("should not alert on first run with no events", () => {
      const metrics: IngestMetrics = {
        runId: "run-123",
        source: "ticketmaster",
        system: "A",
        eventsCreated: 0,
        duplicatesSkipped: 0,
        errors: 0,
        durationMs: 1000,
        status: "success",
        timestamp: "2024-03-21T10:00:00Z",
      };

      const alerts = checkAlertThresholds(metrics);

      expect(alerts).toHaveLength(0);
    });

    it("should track consecutive failures", () => {
      const metrics: IngestMetrics = {
        runId: "run-123",
        source: "ticketmaster",
        system: "A",
        eventsCreated: 0,
        duplicatesSkipped: 0,
        errors: 1,
        durationMs: 1000,
        status: "failed",
        errorMessage: "Connection timeout",
        timestamp: "2024-03-21T10:00:00Z",
      };

      const previousMetrics: IngestMetrics[] = [
        {
          runId: "run-prev-1",
          source: "ticketmaster",
          system: "A",
          eventsCreated: 0,
          duplicatesSkipped: 0,
          errors: 1,
          durationMs: 1000,
          status: "failed",
          timestamp: "2024-03-21T09:00:00Z",
        },
        {
          runId: "run-prev-2",
          source: "ticketmaster",
          system: "A",
          eventsCreated: 0,
          duplicatesSkipped: 0,
          errors: 1,
          durationMs: 1000,
          status: "failed",
          timestamp: "2024-03-21T08:00:00Z",
        },
      ];

      const alerts = checkAlertThresholds(metrics, previousMetrics);

      expect(alerts.some((a) => a.type === "SOURCE_DOWN")).toBe(true);
    });
  });

  describe("checkSourceHealth", () => {
    it("should return healthy status on success", async () => {
      const healthCheck = async () => ({
        healthy: true,
        latencyMs: 150,
      });

      const result = await checkSourceHealth("ticketmaster", healthCheck);

      expect(result.healthy).toBe(true);
      expect(result.latencyMs).toBe(150);
      expect(result.consecutiveFailures).toBe(0);
    });

    it("should return unhealthy status on failure", async () => {
      const healthCheck = async () => ({
        healthy: false,
        error: "Connection refused",
      });

      const result = await checkSourceHealth("ticketmaster", healthCheck);

      expect(result.healthy).toBe(false);
      expect(result.lastError).toBe("Connection refused");
      expect(result.consecutiveFailures).toBe(1);
    });

    it("should handle exceptions", async () => {
      const healthCheck = async () => {
        throw new Error("Network error");
      };

      const result = await checkSourceHealth("ticketmaster", healthCheck);

      expect(result.healthy).toBe(false);
      expect(result.lastError).toBe("Network error");
      expect(result.consecutiveFailures).toBe(1);
    });
  });

  describe("logHealthCheck", () => {
    it("should log health check results", () => {
      const healthResult = {
        healthy: false,
        sources: [
          {
            source: "ticketmaster",
            healthy: true,
            latencyMs: 100,
            consecutiveFailures: 0,
            rateLimitHits: 0,
            circuitOpen: false,
          },
          {
            source: "wikimedia",
            healthy: false,
            latencyMs: 500,
            lastError: "Timeout",
            consecutiveFailures: 3,
            rateLimitHits: 0,
            circuitOpen: false,
          },
        ] as SourceHealth[],
        overallLatencyMs: 600,
        timestamp: "2024-03-21T10:00:00Z",
        summary: {
          total: 2,
          healthy: 1,
          unhealthy: 1,
          avgLatencyMs: 300,
        },
      };

      logHealthCheck(healthResult);

      expect(mockConsoleLog).toHaveBeenCalled();
      expect(mockConsoleError).toHaveBeenCalled(); // For unhealthy sources
    });
  });

  describe("aggregateMetrics", () => {
    it("should aggregate multiple metrics", () => {
      const metricsList: IngestMetrics[] = [
        {
          runId: "run-1",
          source: "ticketmaster",
          system: "A",
          eventsCreated: 10,
          duplicatesSkipped: 2,
          errors: 1,
          durationMs: 1000,
          status: "success",
          timestamp: "2024-03-21T10:00:00Z",
        },
        {
          runId: "run-2",
          source: "eventbrite",
          system: "A",
          eventsCreated: 5,
          duplicatesSkipped: 1,
          errors: 0,
          durationMs: 500,
          status: "success",
          timestamp: "2024-03-21T11:00:00Z",
        },
      ];

      const summary = aggregateMetrics(metricsList);

      expect(summary.totalEventsCreated).toBe(15);
      expect(summary.totalDuplicatesSkipped).toBe(3);
      expect(summary.totalErrors).toBe(1);
      expect(summary.sourcesActive).toBe(2);
      expect(summary.sourcesWithErrors).toBe(1);
    });

    it("should handle empty metrics list", () => {
      const summary = aggregateMetrics([]);

      expect(summary.totalEventsCreated).toBe(0);
      expect(summary.totalDuplicatesSkipped).toBe(0);
      expect(summary.totalErrors).toBe(0);
      expect(summary.avgErrorRate).toBe(0);
    });

    it("should calculate average error rate", () => {
      const metricsList: IngestMetrics[] = [
        {
          runId: "run-1",
          source: "ticketmaster",
          system: "A",
          eventsCreated: 80,
          duplicatesSkipped: 10,
          errors: 10,
          durationMs: 1000,
          status: "partial",
          timestamp: "2024-03-21T10:00:00Z",
        },
      ];

      const summary = aggregateMetrics(metricsList);

      // (10 / 100) * 100 = 10%
      expect(summary.avgErrorRate).toBe(10);
    });
  });

  describe("formatDatadogMetrics", () => {
    it("should format metrics in Datadog format", () => {
      const metrics: IngestMetrics = {
        runId: "run-123",
        source: "ticketmaster",
        system: "A",
        eventsCreated: 10,
        duplicatesSkipped: 2,
        errors: 1,
        durationMs: 1000,
        status: "success",
        timestamp: "2024-03-21T10:00:00Z",
      };

      const formatted = formatDatadogMetrics(metrics);

      expect(formatted).toHaveProperty("metric", "envivo.ingestion.events");
      expect(formatted).toHaveProperty("type", "count");
      expect(formatted).toHaveProperty("tags");
      expect((formatted as any).tags).toContain("source:ticketmaster");
      expect((formatted as any).tags).toContain("system:A");
    });
  });

  describe("formatStatsDMetrics", () => {
    it("should format metrics in StatsD format", () => {
      const metrics: IngestMetrics = {
        runId: "run-123",
        source: "ticketmaster",
        system: "A",
        eventsCreated: 10,
        duplicatesSkipped: 2,
        errors: 1,
        durationMs: 1000,
        status: "success",
        timestamp: "2024-03-21T10:00:00Z",
      };

      const lines = formatStatsDMetrics(metrics);

      expect(lines).toHaveLength(4);
      expect(lines[0]).toContain(
        "envivo.ingestion.ticketmaster.events_created:10|c",
      );
      expect(lines[1]).toContain(
        "envivo.ingestion.ticketmaster.duplicates_skipped:2|c",
      );
      expect(lines[2]).toContain("envivo.ingestion.ticketmaster.errors:1|c");
      expect(lines[3]).toContain(
        "envivo.ingestion.ticketmaster.duration:1000|ms",
      );
    });
  });
});
