/**
 * System B Source Connectors Index
 *
 * Exports all System B connectors and their types.
 */

// Connectors
export { NewsAPIConnector, createNewsAPIConnector } from "./newsapi";
export { GNewsConnector, createGNewsConnector } from "./gnews";
export { WikidataConnector, createWikidataConnector } from "./wikidata";
export {
  RollingStoneConnector,
  createRollingStoneConnector,
} from "./rolling-stone";

// Re-export types for convenience
export type {
  ConnectorContext,
  ContentFeedItem,
  ContentFeedType,
  Fact,
  Image,
  NormalizedItem,
  RawFeedItem,
} from "../types";

// Constants
export { VIRAL_SCORE, EXPIRY } from "../types";
