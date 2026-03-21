import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { TENANT_HEADER } from "@/proxy";

const { withTenantDb, MockInvalidTransitionError, MockContentNotFoundError } = vi.hoisted(() => ({
  withTenantDb: vi.fn(),
  MockInvalidTransitionError: class extends Error {
    public readonly code = "INVALID_TRANSITION";

    constructor(from: string, eventType: string) {
      super(`Invalid content-machine transition ${from} -> ${eventType}`);
    }
  },
  MockContentNotFoundError: class extends Error {
    public readonly code = "CONTENT_NOT_FOUND";

    constructor(message: string) {
      super(message);
    }
  },
}));

const { applyContentTransitionMock, inngestSendMock } = vi.hoisted(() => ({
  applyContentTransitionMock: vi.fn(),
  inngestSendMock: vi.fn().mockResolvedValue({ ids: ["event-1"] }),
}));

vi.mock("@/lib/db/client", () => ({
  withTenantDb,
}));

vi.mock("@/lib/pipeline/store", () => ({
  applyContentTransition: applyContentTransitionMock,
  ContentNotFoundError: MockContentNotFoundError,
  InvalidTransitionError: MockInvalidTransitionError,
}));

vi.mock("@/inngest/functions/pipeline", () => ({
  PIPELINE_START_EVENT: "content/pipeline.start",
  PIPELINE_PUBLISH_READY_EVENT: "content/pipeline.publish-ready",
  PIPELINE_REVIEW_DECISION_EVENT: "content/review.decision",
  REVIEW_DECISION_EVENT: "content/review.decision",
}));

vi.mock("@/inngest/client", () => ({
  inngestClient: {
    send: inngestSendMock,
  },
}));

import { PATCH } from "./route";

function createPatchRequest(body: unknown, tenantId?: string): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (tenantId) {
    headers[TENANT_HEADER] = tenantId;
  }

  return new NextRequest("http://localhost/api/content/candidate-1", {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
}

describe("content item patch API", () => {
  beforeEach(() => {
    withTenantDb.mockReset();
    applyContentTransitionMock.mockReset();
    inngestSendMock.mockReset().mockResolvedValue({ ids: ["event-1"] });

    withTenantDb.mockImplementation(async (_tenantId: string, callback: (tx: unknown) => Promise<unknown>) => {
      return callback({});
    });
  });

  it("returns 409 when transition is invalid", async () => {
    const request = createPatchRequest({ action: "publish" }, "tenant-1");

    applyContentTransitionMock.mockRejectedValueOnce(new MockInvalidTransitionError("draft", "APPROVE"));

    const response = await PATCH(request, { params: { id: "candidate-1" } });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({ error: "Invalid transition", code: "INVALID_TRANSITION" });
  });

  it("returns idempotent true when state transition has no effect", async () => {
    const request = createPatchRequest({ action: "publish", actor: "reviewer" }, "tenant-1");

    applyContentTransitionMock.mockResolvedValueOnce({
      from: "published",
      to: "published",
      state: {
        state: "published",
        context: {
          tenantId: "tenant-1",
          candidateContentId: "candidate-1",
        },
        serialized: {
          version: 1,
          state: "published",
          context: { tenantId: "tenant-1", candidateContentId: "candidate-1" },
        },
        actor: "reviewer",
        rejectionReason: null,
      },
    });

    const response = await PATCH(request, { params: { id: "candidate-1" } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.idempotent).toBe(true);
    expect(payload.from).toBe("published");
    expect(payload.to).toBe("published");
  });

  it("dispatches review decision events on approve/reject/regenerate", async () => {
    const approveRequest = createPatchRequest({ action: "approve", actor: "human", reason: "ok" }, "tenant-1");

    const response = await PATCH(approveRequest, { params: { id: "candidate-1" } });

    expect(response.status).toBe(202);
    expect(inngestSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "content/review.decision",
        data: {
          tenantId: "tenant-1",
          candidateContentId: "candidate-1",
          decision: "approve",
          actor: "human",
          reason: "ok",
        },
      }),
    );
  });
});
