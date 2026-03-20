import { describe, expect, it, vi } from "vitest";

import {
  extractEventFromUrl,
  normalizePhotoDimensions,
  normalizeScrapedDate,
} from "./extract";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mock-openai-model"),
}));

const { generateObject } = await import("ai");

describe("extractEventFromUrl", () => {
  it("extracts event fields from structured output", async () => {
    const mockedGenerateObject = vi.mocked(generateObject);
    mockedGenerateObject.mockResolvedValue({
      object: {
        name: "Filomelódicos en Tandil",
        date: "2026-08-13T21:00:00.000Z",
        venue: "Arena Los Ficus",
        photos: [
          {
            url: "https://cdn.example.org/photos/event1.jpg",
            width: 1280,
            height: 720,
          },
        ],
      },
    } as never);

    const result = await extractEventFromUrl({
      sourceUrl: "https://example.org/event",
      fetchPage: async () => "<html>Evento</html>",
    });

    expect(result.name).toBe("Filomelódicos en Tandil");
    expect(result.venue).toBe("Arena Los Ficus");
    expect(result.photos).toHaveLength(1);
    expect(result.photos[0].url).toBe("https://cdn.example.org/photos/event1.jpg");
  });

  it("throws a structured extraction error on malformed content", async () => {
    const mockedGenerateObject = vi.mocked(generateObject);
    mockedGenerateObject.mockRejectedValue(new Error("bad ai payload"));

    await expect(
      extractEventFromUrl({
        sourceUrl: "https://example.org/event",
        fetchPage: async () => "<html>Evento</html>",
      }),
    ).rejects.toThrow("Failed to extract event details for https://example.org/event");
  });
});

describe("normalizers", () => {
  it("normalizes invalid photos dimensions to zero", () => {
    expect(normalizePhotoDimensions(undefined)).toBe(0);
    expect(normalizePhotoDimensions(-40)).toBe(0);
    expect(normalizePhotoDimensions(1024.7)).toBe(1024);
  });

  it("normalizes parseable ISO dates", () => {
    expect(normalizeScrapedDate("2026-09-17T20:00:00.000Z")).toBeInstanceOf(Date);
    expect(normalizeScrapedDate("not-a-date")).toBeNull();
  });
});
