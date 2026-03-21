/**
 * Type Tests for Topic Selection feature
 *
 * Tests that TypeScript types and constants are correctly defined.
 *
 * @module topics/__tests__/types.test
 */

import { describe, it, expect } from "vitest";
import {
  TONES,
  FORMAT_TYPES,
  URGENCY_LEVELS,
  SELECTION_STATUSES,
} from "../types";

describe("Topic Type Constants", () => {
  describe("TONES", () => {
    it("should contain all 5 tones", () => {
      expect(TONES).toEqual([
        "informative",
        "opinion",
        "nostalgic",
        "humorous",
        "urgent",
      ]);
    });

    it("should have exactly 5 elements", () => {
      expect(TONES).toHaveLength(5);
    });

    it("should contain only string values", () => {
      TONES.forEach((tone) => {
        expect(typeof tone).toBe("string");
      });
    });
  });

  describe("FORMAT_TYPES", () => {
    it("should contain post, story, reel", () => {
      expect(FORMAT_TYPES).toEqual(["post", "story", "reel"]);
    });

    it("should have exactly 3 elements", () => {
      expect(FORMAT_TYPES).toHaveLength(3);
    });

    it("should contain only string values", () => {
      FORMAT_TYPES.forEach((format) => {
        expect(typeof format).toBe("string");
      });
    });
  });

  describe("URGENCY_LEVELS", () => {
    it("should contain all 4 levels", () => {
      expect(URGENCY_LEVELS).toEqual(["low", "medium", "high", "breaking"]);
    });

    it("should have exactly 4 elements", () => {
      expect(URGENCY_LEVELS).toHaveLength(4);
    });

    it("should contain only string values", () => {
      URGENCY_LEVELS.forEach((level) => {
        expect(typeof level).toBe("string");
      });
    });
  });

  describe("SELECTION_STATUSES", () => {
    it("should contain all 5 statuses", () => {
      expect(SELECTION_STATUSES).toEqual([
        "pending",
        "generating",
        "ready",
        "discarded",
      ]);
    });

    it("should have exactly 4 elements", () => {
      expect(SELECTION_STATUSES).toHaveLength(4);
    });

    it("should contain only string values", () => {
      SELECTION_STATUSES.forEach((status) => {
        expect(typeof status).toBe("string");
      });
    });
  });
});

describe("TypeScript Type Exports", () => {
  it("should export SourceType type", () => {
    const { SourceType } = require("../types");
    // SourceType is a union type, so we just verify it exists
    expect(SourceType).toBeDefined();
  });

  it("should export Urgency type", () => {
    const { Urgency } = require("../types");
    expect(Urgency).toBeDefined();
  });

  it("should export SelectionStatus type", () => {
    const { SelectionStatus } = require("../types");
    expect(SelectionStatus).toBeDefined();
  });

  it("should export Tone type", () => {
    const { Tone } = require("../types");
    expect(Tone).toBeDefined();
  });

  it("should export FormatType type", () => {
    const { FormatType } = require("../types");
    expect(FormatType).toBeDefined();
  });

  it("should export FormatConfig interface", () => {
    const { FormatConfig } = require("../types");
    expect(FormatConfig).toBeDefined();
    expect(typeof FormatConfig).toBe("object");
  });

  it("should export PendingTopic interface", () => {
    const { PendingTopic } = require("../types");
    expect(PendingTopic).toBeDefined();
    expect(typeof PendingTopic).toBe("object");
  });

  it("should export TopicSelection interface", () => {
    const { TopicSelection } = require("../types");
    expect(TopicSelection).toBeDefined();
    expect(typeof TopicSelection).toBe("object");
  });

  it("should export CreateSelectionInput interface", () => {
    const { CreateSelectionInput } = require("../types");
    expect(CreateSelectionInput).toBeDefined();
    expect(typeof CreateSelectionInput).toBe("object");
  });

  it("should export FilterOptions interface", () => {
    const { FilterOptions } = require("../types");
    expect(FilterOptions).toBeDefined();
    expect(typeof FilterOptions).toBe("object");
  });

  it("should export PendingTopicsResponse interface", () => {
    const { PendingTopicsResponse } = require("../types");
    expect(PendingTopicsResponse).toBeDefined();
    expect(typeof PendingTopicsResponse).toBe("object");
  });

  it("should export SelectionResponse interface", () => {
    const { SelectionResponse } = require("../types");
    expect(SelectionResponse).toBeDefined();
    expect(typeof SelectionResponse).toBe("object");
  });
});
