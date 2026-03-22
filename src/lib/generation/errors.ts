export class GenerationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

export class MappingError extends GenerationError {
  constructor(field: string, value: string) {
    super(
      `Invalid mapping for field "${field}" with value "${value}"`,
      "MAPPING_ERROR",
    );
    this.name = "MappingError";
  }
}

export class SourceNotFoundError extends GenerationError {
  constructor(sourceType: string, sourceId: string) {
    super(
      `Source not found: ${sourceType} with id ${sourceId}`,
      "SOURCE_NOT_FOUND",
    );
    this.name = "SourceNotFoundError";
  }
}

export class BrandConfigurationError extends GenerationError {
  constructor(template: string, reason: string) {
    super(
      `Brand configuration error for template "${template}": ${reason}`,
      "BRAND_CONFIG_ERROR",
    );
    this.name = "BrandConfigurationError";
  }
}

export class GenerationTimeoutError extends GenerationError {
  constructor(format: string, timeoutMs: number) {
    super(
      `Generation timeout for format "${format}" after ${timeoutMs}ms`,
      "TIMEOUT",
    );
    this.name = "GenerationTimeoutError";
  }
}
