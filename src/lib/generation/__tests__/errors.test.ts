import { describe, expect, it } from "vitest";
import {
  GenerationError,
  MappingError,
  SourceNotFoundError,
  BrandConfigurationError,
  GenerationTimeoutError,
} from "../errors";

describe("GenerationError", () => {
  it("has name 'GenerationError'", () => {
    const error = new GenerationError("Test error", "TEST_ERROR");
    expect(error.name).toBe("GenerationError");
  });

  it("has correct code", () => {
    const error = new GenerationError("Test error", "TEST_ERROR");
    expect(error.code).toBe("TEST_ERROR");
  });

  it("has correct message", () => {
    const error = new GenerationError("Test error", "TEST_ERROR");
    expect(error.message).toBe("Test error");
  });

  it("is instance of Error", () => {
    const error = new GenerationError("Test error", "TEST_ERROR");
    expect(error).toBeInstanceOf(Error);
  });
});

describe("MappingError", () => {
  it("has name 'MappingError'", () => {
    const error = new MappingError("sourceType", "invalid");
    expect(error.name).toBe("MappingError");
  });

  it("has code 'MAPPING_ERROR'", () => {
    const error = new MappingError("sourceType", "invalid");
    expect(error.code).toBe("MAPPING_ERROR");
  });

  it("has descriptive message with field and value", () => {
    const error = new MappingError("formatType", "invalid_format");
    expect(error.message).toBe(
      'Invalid mapping for field "formatType" with value "invalid_format"',
    );
  });

  it("is instance of GenerationError", () => {
    const error = new MappingError("sourceType", "invalid");
    expect(error).toBeInstanceOf(GenerationError);
  });
});

describe("SourceNotFoundError", () => {
  it("has name 'SourceNotFoundError'", () => {
    const error = new SourceNotFoundError("calendar_event", "source-id-123");
    expect(error.name).toBe("SourceNotFoundError");
  });

  it("has code 'SOURCE_NOT_FOUND'", () => {
    const error = new SourceNotFoundError("calendar_event", "source-id-123");
    expect(error.code).toBe("SOURCE_NOT_FOUND");
  });

  it("has descriptive message with source type and id", () => {
    const error = new SourceNotFoundError("calendar_event", "abc-123");
    expect(error.message).toBe(
      "Source not found: calendar_event with id abc-123",
    );
  });

  it("is instance of GenerationError", () => {
    const error = new SourceNotFoundError("calendar_event", "source-id");
    expect(error).toBeInstanceOf(GenerationError);
  });
});

describe("BrandConfigurationError", () => {
  it("has name 'BrandConfigurationError'", () => {
    const error = new BrandConfigurationError(
      "post-vertical-45",
      "missing color",
    );
    expect(error.name).toBe("BrandConfigurationError");
  });

  it("has code 'BRAND_CONFIG_ERROR'", () => {
    const error = new BrandConfigurationError(
      "post-vertical-45",
      "missing color",
    );
    expect(error.code).toBe("BRAND_CONFIG_ERROR");
  });

  it("has descriptive message with template and reason", () => {
    const error = new BrandConfigurationError("story-9-16", "invalid variant");
    expect(error.message).toBe(
      'Brand configuration error for template "story-9-16": invalid variant',
    );
  });

  it("is instance of GenerationError", () => {
    const error = new BrandConfigurationError("template", "reason");
    expect(error).toBeInstanceOf(GenerationError);
  });
});

describe("GenerationTimeoutError", () => {
  it("has name 'GenerationTimeoutError'", () => {
    const error = new GenerationTimeoutError("post", 30000);
    expect(error.name).toBe("GenerationTimeoutError");
  });

  it("has code 'TIMEOUT'", () => {
    const error = new GenerationTimeoutError("post", 30000);
    expect(error.code).toBe("TIMEOUT");
  });

  it("has descriptive message with format and timeout", () => {
    const error = new GenerationTimeoutError("carousel", 60000);
    expect(error.message).toBe(
      'Generation timeout for format "carousel" after 60000ms',
    );
  });

  it("is instance of GenerationError", () => {
    const error = new GenerationTimeoutError("post", 30000);
    expect(error).toBeInstanceOf(GenerationError);
  });
});
