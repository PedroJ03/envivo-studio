import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";

import { clearPersonaCache, loadPersona, PersonaLoadError } from "./personas";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

const mockedReadFile = vi.mocked(await import("node:fs/promises").then((module) => module.readFile));

describe("loadPersona", () => {
  beforeEach(() => {
    clearPersonaCache();
    mockedReadFile.mockReset();
  });

  it("loads a persona markdown file by slug and returns cached metadata", async () => {
    mockedReadFile.mockResolvedValue("# Persona\n\nTone: claro\n");

    const persona = await loadPersona("dany");

    expect(persona.slug).toBe("dany");
    expect(persona.content).toBe("# Persona\n\nTone: claro\n");
    expect(persona.filePath).toBe(path.join(process.cwd(), "personas", "dany.md"));
    expect(typeof persona.loadedAt).toBe("string");
    expect(mockedReadFile).toHaveBeenCalledTimes(1);

    const again = await loadPersona("dany");
    expect(again.content).toBe(persona.content);
    expect(mockedReadFile).toHaveBeenCalledTimes(1);
  });

  it("throws a PersonaLoadError for missing files", async () => {
    const fileError = new Error("ENOENT") as NodeJS.ErrnoException;
    fileError.code = "ENOENT";
    mockedReadFile.mockRejectedValue(fileError);

    await expect(loadPersona("missing")).rejects.toThrow(PersonaLoadError);
  });

  it("rejects invalid persona slugs", async () => {
    await expect(loadPersona("../hack")).rejects.toThrow("Invalid persona slug");
    expect(mockedReadFile).not.toHaveBeenCalled();
  });
});
