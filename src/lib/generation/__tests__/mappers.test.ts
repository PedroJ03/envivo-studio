import { describe, it, expect } from "vitest";
import {
  SOURCE_TO_SECTION,
  FORMAT_TO_TEMPLATE,
  TONE_TO_TONE_FILE,
  mapSourceToSection,
  mapFormatToTemplate,
  mapToneToFile,
  createMappingResult,
} from "../mappers";
import { MappingError } from "../errors";

describe("SOURCE_TO_SECTION", () => {
  it("maps calendar_event to proximos-shows", () => {
    expect(SOURCE_TO_SECTION.calendar_event).toBe("proximos-shows");
  });

  it("maps content_feed_item to noticias", () => {
    expect(SOURCE_TO_SECTION.content_feed_item).toBe("noticias");
  });
});

describe("FORMAT_TO_TEMPLATE", () => {
  it("maps post to post-vertical-45", () => {
    expect(FORMAT_TO_TEMPLATE.post).toBe("post-vertical-45");
  });

  it("maps story to story-9-16", () => {
    expect(FORMAT_TO_TEMPLATE.story).toBe("story-9-16");
  });

  it("maps carousel to reel-cover-9-16", () => {
    expect(FORMAT_TO_TEMPLATE.carousel).toBe("reel-cover-9-16");
  });
});

describe("TONE_TO_TONE_FILE", () => {
  it("maps informative to informative", () => {
    expect(TONE_TO_TONE_FILE.informative).toBe("informative");
  });

  it("maps opinion to opinion", () => {
    expect(TONE_TO_TONE_FILE.opinion).toBe("opinion");
  });

  it("maps nostalgic to nostalgic", () => {
    expect(TONE_TO_TONE_FILE.nostalgic).toBe("nostalgic");
  });

  it("maps humorous to humorous", () => {
    expect(TONE_TO_TONE_FILE.humorous).toBe("humorous");
  });

  it("maps urgent to urgent", () => {
    expect(TONE_TO_TONE_FILE.urgent).toBe("urgent");
  });
});

describe("mapSourceToSection", () => {
  it("returns section slug for valid sourceType calendar_event", () => {
    expect(mapSourceToSection("calendar_event")).toBe("proximos-shows");
  });

  it("returns section slug for valid sourceType content_feed_item", () => {
    expect(mapSourceToSection("content_feed_item")).toBe("noticias");
  });

  it("throws MappingError for invalid sourceType", () => {
    expect(() => mapSourceToSection("invalid" as any)).toThrow(MappingError);
  });

  it("MappingError has correct code MAPPING_ERROR", () => {
    try {
      mapSourceToSection("invalid" as any);
    } catch (error) {
      expect(error).toBeInstanceOf(MappingError);
      expect((error as MappingError).code).toBe("MAPPING_ERROR");
      expect((error as MappingError).name).toBe("MappingError");
    }
  });
});

describe("mapFormatToTemplate", () => {
  it("returns template format for valid formatType post", () => {
    expect(mapFormatToTemplate("post")).toBe("post-vertical-45");
  });

  it("returns template format for valid formatType story", () => {
    expect(mapFormatToTemplate("story")).toBe("story-9-16");
  });

  it("returns template format for valid formatType carousel", () => {
    expect(mapFormatToTemplate("carousel")).toBe("reel-cover-9-16");
  });

  it("throws MappingError for invalid formatType", () => {
    expect(() => mapFormatToTemplate("invalid" as any)).toThrow(MappingError);
  });

  it("MappingError has correct code MAPPING_ERROR", () => {
    try {
      mapFormatToTemplate("invalid" as any);
    } catch (error) {
      expect(error).toBeInstanceOf(MappingError);
      expect((error as MappingError).code).toBe("MAPPING_ERROR");
    }
  });
});

describe("mapToneToFile", () => {
  it("returns tone file for valid toneType informative", () => {
    expect(mapToneToFile("informative")).toBe("informative");
  });

  it("returns tone file for valid toneType opinion", () => {
    expect(mapToneToFile("opinion")).toBe("opinion");
  });

  it("returns tone file for valid toneType nostalgic", () => {
    expect(mapToneToFile("nostalgic")).toBe("nostalgic");
  });

  it("returns tone file for valid toneType humorous", () => {
    expect(mapToneToFile("humorous")).toBe("humorous");
  });

  it("returns tone file for valid toneType urgent", () => {
    expect(mapToneToFile("urgent")).toBe("urgent");
  });

  it("throws MappingError for invalid toneType", () => {
    expect(() => mapToneToFile("invalid" as any)).toThrow(MappingError);
  });

  it("MappingError has correct code MAPPING_ERROR", () => {
    try {
      mapToneToFile("invalid" as any);
    } catch (error) {
      expect(error).toBeInstanceOf(MappingError);
      expect((error as MappingError).code).toBe("MAPPING_ERROR");
    }
  });
});

describe("createMappingResult", () => {
  it("returns all mappings for calendar_event + post + informative", () => {
    const result = createMappingResult("calendar_event", "post", "informative");
    expect(result.section).toBe("proximos-shows");
    expect(result.template).toBe("post-vertical-45");
    expect(result.toneFile).toBe("informative");
  });

  it("returns all mappings for content_feed_item + story + opinion", () => {
    const result = createMappingResult("content_feed_item", "story", "opinion");
    expect(result.section).toBe("noticias");
    expect(result.template).toBe("story-9-16");
    expect(result.toneFile).toBe("opinion");
  });

  it("returns all mappings for calendar_event + carousel + urgent", () => {
    const result = createMappingResult("calendar_event", "carousel", "urgent");
    expect(result.section).toBe("proximos-shows");
    expect(result.template).toBe("reel-cover-9-16");
    expect(result.toneFile).toBe("urgent");
  });

  it("throws MappingError when sourceType is invalid", () => {
    expect(() =>
      createMappingResult("invalid" as any, "post", "informative"),
    ).toThrow(MappingError);
  });

  it("throws MappingError when formatType is invalid", () => {
    expect(() =>
      createMappingResult("calendar_event", "invalid" as any, "informative"),
    ).toThrow(MappingError);
  });

  it("throws MappingError when toneType is invalid", () => {
    expect(() =>
      createMappingResult("calendar_event", "post", "invalid" as any),
    ).toThrow(MappingError);
  });
});
