import { describe, expect, it } from "vitest";

vi.mock("@/lib/composer/composer", () => ({
  renderCandidatePreview: vi.fn(),
}));

import { getReviewDecisionTransition } from "./pipeline";

describe("content pipeline review decision mapping", () => {
  it("maps a missing decision to timeout transition", () => {
    const result = getReviewDecisionTransition(null, "human-operator");

    expect(result.timedOut).toBe(true);
    expect(result.noEvent).toBe(true);
    expect(result.transition.type).toBe("REVIEW_TIMEOUT");
    expect(result.transition.actor).toBe("human-operator");
    expect(result.reason).toBe("Review timed out waiting for HITL decision.");
  });

  it("maps approve/reject/regenerate decisions to explicit transitions", () => {
    const approved = getReviewDecisionTransition({
      tenantId: "tenant-1",
      candidateContentId: "candidate-1",
      decision: "approve",
      actor: "human-operator",
      reason: "Looks good",
    });

    const rejected = getReviewDecisionTransition({
      tenantId: "tenant-1",
      candidateContentId: "candidate-1",
      decision: "reject",
      actor: "human-operator",
      reason: "Bad framing",
    });

    const regenerated = getReviewDecisionTransition({
      tenantId: "tenant-1",
      candidateContentId: "candidate-1",
      decision: "regenerate",
      actor: "human-operator",
      reason: "Need clearer copy",
    });

    expect(approved.timedOut).toBe(false);
    expect(approved.noEvent).toBe(false);
    expect(approved.transition.type).toBe("APPROVE");
    expect(approved.reason).toBe("Looks good");

    expect(rejected.transition.type).toBe("REJECT");
    expect(rejected.transition.actor).toBe("human-operator");

    expect(regenerated.transition.type).toBe("REGENERATE");
    expect(regenerated.transition.actor).toBe("human-operator");
  });
});
