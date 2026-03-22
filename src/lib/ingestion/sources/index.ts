/**
 * System B Source Connectors Index
 *
 * Exports all System B connectors and their types.
 */

// Connectors
export { NewsAPIConnector, createNewsAPIConnector } from "./newsapi";
export { GNewsConnector, createGNewsConnector } from "./gnews";
export { WikidataConnector, createWikidataConnector } from "./wikidata";

// La Nación RSS Connector (replaces Rolling Stone)
export {
  LaNacionRSSConnector,
  createLaNacionRSSConnector,
  FILTER_CONFIG as LaNacionFilterConfig,
} from "./lanacion-rss";

// System A Connectors (Local Events)
export { ElEcoTandilConnector } from "./el-eco-tandil";

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
