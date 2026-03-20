import { describe, expect, it } from "vitest";

import {
  applyMachineTransition,
  getInitialMachineSnapshot,
} from "./machine";

describe("content-machine", () => {
  it("allows valid transitions through the happy path", () => {
    const started = getInitialMachineSnapshot("tenant-1", "candidate-1");

    const approved = applyMachineTransition(started, {
      type: "SUBMIT_FOR_REVIEW",
    });

    const generating = applyMachineTransition(
      {
        ...started,
        state: approved.to,
      },
      {
        type: "START_GENERATION",
      },
    );

    const generated = applyMachineTransition(
      {
        ...started,
        state: generating.to,
      },
      {
        type: "GENERATION_SUCCESS",
      },
    );

    const reviewed = applyMachineTransition(
      {
        ...started,
        state: generated.to,
      },
      {
        type: "APPROVE",
      },
    );

    const published = applyMachineTransition(
      {
        ...started,
        state: reviewed.to,
      },
      {
        type: "PUBLISH",
      },
    );

    expect(approved.to).toBe("approved");
    expect(generating.to).toBe("generating");
    expect(generated.to).toBe("generated");
    expect(reviewed.to).toBe("reviewed");
    expect(published.to).toBe("published");
  });

  it("throws on invalid transitions", () => {
    const snapshot = getInitialMachineSnapshot("tenant-1", "candidate-1");

    expect(() =>
      applyMachineTransition(snapshot, {
        type: "PUBLISH",
      }),
    ).toThrow("Invalid content-machine transition draft -> PUBLISH");
  });

  it("treats explicit idempotent transitions as no-op", () => {
    const snapshot = {
      ...getInitialMachineSnapshot("tenant-1", "candidate-1"),
      state: "reviewed" as const,
    };

    const result = applyMachineTransition(snapshot, {
      type: "APPROVE",
    });

    expect(result.to).toBe("reviewed");
  });
});
