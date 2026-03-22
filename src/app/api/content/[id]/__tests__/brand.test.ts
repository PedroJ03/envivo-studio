import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../brand/route";
import { NextRequest } from "next/server";

// Mock db
vi.mock("@/lib/db/client", () => ({
  db: {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([{ id: "123", templateVariant: "minimal" }]),
        }),
      }),
    }),
  },
}));

describe("POST /api/content/[id]/brand", () => {
  it("returns 400 for invalid variant", async () => {
    const request = new NextRequest(
      new Request("http://localhost/api/content/123/brand", {
        method: "POST",
        body: JSON.stringify({ templateVariant: "invalid" }),
      }),
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 200 for valid variant", async () => {
    const request = new NextRequest(
      new Request("http://localhost/api/content/123/brand", {
        method: "POST",
        body: JSON.stringify({ templateVariant: "minimal" }),
      }),
    );

    const response = await POST(request, {
      params: Promise.resolve({ id: "123" }),
    });
    expect(response.status).toBe(200);
  });
});
