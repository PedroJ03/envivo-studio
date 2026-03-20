import path from "node:path";

export const COMPOSER_OUTPUT_DIR_DEFAULT = path.join(process.cwd(), "public", "composer-assets");
export const COMPOSER_PUBLIC_BASE_DEFAULT = "/composer-assets";

export interface ComposerStorageConfig {
  outputDirectory: string;
  publicBasePath: string;
  fileNamePrefix: string;
  pathTemplate: string;
  fileNameTemplate: string;
}

export interface ComposerConstraints {
  minDimension: number;
  maxWidth: number;
  maxHeight: number;
  maxBytes: number;
}

export interface ComposerConfiguration {
  storage: ComposerStorageConfig;
  constraints: ComposerConstraints;
}

const DEFAULT_CONSTRAINTS: ComposerConstraints = {
  minDimension: 720,
  maxWidth: 2048,
  maxHeight: 4096,
  maxBytes: 12 * 1024 * 1024,
};

const DEFAULT_PATH_TEMPLATE = "{tenant}/{candidate}/{template}-render";
const DEFAULT_FILE_NAME_TEMPLATE = "{prefix}-{template}-{candidate}-{uuid}";

export function getComposerConfig(): ComposerConfiguration {
  const outputDirectory = (process.env.COMPOSER_OUTPUT_DIR || COMPOSER_OUTPUT_DIR_DEFAULT).trim();
  const publicBasePath = (process.env.COMPOSER_PUBLIC_BASE_PATH || COMPOSER_PUBLIC_BASE_DEFAULT).trim();
  const fileNamePrefix = (process.env.COMPOSER_FILE_PREFIX || "preview").trim();
  const pathTemplate = (process.env.COMPOSER_ASSET_PATH_TEMPLATE || DEFAULT_PATH_TEMPLATE).trim();
  const fileNameTemplate = (process.env.COMPOSER_ASSET_FILE_TEMPLATE || DEFAULT_FILE_NAME_TEMPLATE).trim();

  const minDimension = Number.parseInt(process.env.COMPOSER_MIN_PHOTO_DIMENSION || "", 10);
  const maxWidth = Number.parseInt(process.env.COMPOSER_MAX_WIDTH || "", 10);
  const maxHeight = Number.parseInt(process.env.COMPOSER_MAX_HEIGHT || "", 10);
  const maxBytes = Number.parseInt(process.env.COMPOSER_MAX_BYTES || "", 10);

  return {
    storage: {
      outputDirectory,
      publicBasePath,
      fileNamePrefix,
      pathTemplate,
      fileNameTemplate,
    },
    constraints: {
      minDimension: Number.isFinite(minDimension) && minDimension > 0 ? minDimension : DEFAULT_CONSTRAINTS.minDimension,
      maxWidth: Number.isFinite(maxWidth) && maxWidth > 0 ? maxWidth : DEFAULT_CONSTRAINTS.maxWidth,
      maxHeight: Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : DEFAULT_CONSTRAINTS.maxHeight,
      maxBytes: Number.isFinite(maxBytes) && maxBytes > 0 ? maxBytes : DEFAULT_CONSTRAINTS.maxBytes,
    },
  };
}
