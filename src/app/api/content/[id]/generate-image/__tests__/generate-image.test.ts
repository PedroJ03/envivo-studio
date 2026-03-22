import { describe, it, expect, vi } from "vitest";
import { POST } from "../route";
import { NextRequest } from "next/server";

// Mock inngest client
vi.mock("@/inngest/client", () => ({
  inngestClient: {
    send: vi.fn().mockResolvedValue({ ids: ["event-1"] }),
  },
}));

describe("POST /api/content/[id]/generate-image", () => {
  it("emits event to inngest", async () => {
    const request = new NextRequest(
      new Request("http://localhost/api/content/123/generate-image", {
        method: "POST",
      }),
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("pending");
    expect(data.candidateId).toBe("123");
  });
});
