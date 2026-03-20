import { beforeEach, describe, expect, it, vi } from "vitest";

import { generatePersonaText } from "./generate";

vi.mock("ai", () => ({
  generateObject: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  openai: vi.fn(() => "mock-openai-model"),
}));

const mockedGenerateObject = vi.mocked(await import("ai").then((module) => module.generateObject));
const mockedLoadOpenAI = vi.mocked(await import("@ai-sdk/openai").then((module) => module.openai));

describe("generatePersonaText", () => {
  const previousOpenAi = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
    mockedGenerateObject.mockReset();
    mockedLoadOpenAI.mockReset();
  });

  it("injects persona instructions into the system prompt", async () => {
    const modelOutput = {
      caption: "Vení con vos la energía de la noche.",
      hashtags: ["envivo", "tandil", "musica"],
    };

    mockedLoadOpenAI.mockReturnValue("mock-openai-model" as never);
    mockedGenerateObject.mockResolvedValue({ object: modelOutput } as never);

    const result = await generatePersonaText({
      personaSlug: "dany",
      title: "Noches Filomelodicas",
      selectedFormat: "post",
      selectedTone: "dany",
      summaryJson: {
        name: "Noches Filomelodicas",
        venue: "Club Central",
        date: "2026-10-02T21:00:00.000Z",
      },
    });

    expect(result).toEqual({
      caption: modelOutput.caption,
      hashtags: ["#envivo", "#tandil", "#musica"],
    });

    const callArgs = mockedGenerateObject.mock.calls.at(0)?.[0];
    expect(callArgs?.system).toContain("Persona (from markdown skill file)");
    expect(callArgs?.system).toContain("Dany");
    expect(callArgs?.prompt).toContain("Noches Filomelodicas");
  });

  it("falls back to placeholder output when API key is missing", async () => {
    process.env.OPENAI_API_KEY = "";
    const fallbackInput = {
      title: "Preview Local",
      selectedFormat: "story" as const,
      selectedTone: "informativo",
      personaSlug: "informativo",
      summaryJson: { name: "Fiesta de Barrio" },
    };

    const result = await generatePersonaText(fallbackInput);
    expect(mockedGenerateObject).not.toHaveBeenCalled();
    expect(result.caption).toContain("informativo");
    expect(result.hashtags).toEqual(["#envivo", "#tandil", "#musica"]);
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = previousOpenAi;
  });
});
