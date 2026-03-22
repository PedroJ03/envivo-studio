/**
 * Feature flag for the Stage 2-3 generation pipeline.
 * Set ENABLE_GENERATION_PIPELINE=true in .env.local to enable.
 */
export function isGenerationEnabled(): boolean {
  return process.env.ENABLE_GENERATION_PIPELINE === "true";
}

/**
 * Timeout for a single format generation (AI + BrandComposer) in milliseconds.
 * Standard timeout for AI + brand processing operations.
 */
export const FORMAT_GENERATION_TIMEOUT_MS = 30_000; // 30 seconds

/**
 * Retry configuration for AI generation.
 */
export const RETRY_CONFIG = {
  maxAttempts: 3,
  backoffMs: [1000, 2000, 4000], // 1s, 2s, 4s - exponential backoff
};

/**
 * Maximum formats to process in parallel.
 */
export const MAX_PARALLEL_FORMATS = 3;
