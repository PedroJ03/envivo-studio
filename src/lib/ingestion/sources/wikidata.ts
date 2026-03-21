/**
 * Wikidata Connector - System B
 *
 * Fetches music trivia and curiosities from Wikidata SPARQL endpoint.
 * Generates content based on music-related facts, anniversaries, birthdays.
 * API: https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service
 */

import { BaseConnector } from "../base-connector";
import type {
  ConnectorContext,
  ContentFeedItem,
  ContentFeedType,
  Fact,
  HealthStatus,
  RawFeedItem,
  SourceConnectorConfig,
} from "../types";
import { generateContentHash } from "../deduplication";
import { TTL } from "../cache";
import type { IngestionCache } from "../cache";

// Wikidata SPARQL endpoint
const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

// Music-related SPARQL query templates
const QUERIES = {
  // Today's music anniversaries
  musicAnniversary: `
    SELECT ?item ?itemLabel ?description ?date (YEAR(?date) as ?year) (DAY(?date) as ?day) (MONTH(?date) as ?month)
    WHERE {
      ?item p:P585 ?statement .
      ?statement ps:P585 ?date .
      FILTER(DAY(?date) = DAY(NOW()) && MONTH(?date) = MONTH(NOW()))
      ?item wdt:P31 wd:Q5 .
      ?item wdt:P106 wd:Q177 .
      ?item rdfs:label ?itemLabel .
      FILTER(LANG(?itemLabel) = "en")
      OPTIONAL { ?item schema:description ?description . FILTER(LANG(?description) = "en") }
    }
    LIMIT 10
  `,

  // Famous musician birthdays this day
  musicianBirthdays: `
    SELECT ?item ?itemLabel ?description ?birthdate (YEAR(?birthdate) as ?birthyear)
    WHERE {
      ?item wdt:P31 wd:Q5 .
      ?item wdt:P569 ?birthdate .
      FILTER(DAY(?birthdate) = DAY(NOW()) && MONTH(?birthdate) = MONTH(NOW()))
      ?item wdt:P106 wd:Q177 .
      ?item rdfs:label ?itemLabel .
      FILTER(LANG(?itemLabel) = "en")
      OPTIONAL { ?item schema:description ?description . FILTER(LANG(?description) = "en") }
    }
    LIMIT 10
  `,

  // Random music facts
  randomMusicFacts: `
    SELECT ?item ?itemLabel ?description
    WHERE {
      ?item wdt:P31 wd:Q5 .
      ?item wdt:P106 wd:Q177 .
      ?item rdfs:label ?itemLabel .
      FILTER(LANG(?itemLabel) = "en")
      OPTIONAL { ?item schema:description ?description . FILTER(LANG(?description) = "en") }
    }
    LIMIT 20
  `,
};

// Wikidata response types
interface WikidataBinding {
  item: { value: string };
  itemLabel: { value: string };
  description?: { value: string };
  date?: { value: string };
  year?: { value: string };
  birthdate?: { value: string };
  birthyear?: { value: string };
}

interface WikidataResponse {
  head: {
    vars: string[];
  };
  results: {
    bindings: WikidataBinding[];
  };
}

interface WikidataFact {
  name: string;
  description?: string;
  year?: number;
  birthYear?: number;
  type: "anniversary" | "birthday" | "fact";
}

export class WikidataConnector extends BaseConnector<ContentFeedItem> {
  readonly name = "wikidata";
  readonly sourceType = "api" as const;

  // Rate limiting: Wikidata recommends 1 request per second
  private readonly requestDelayMs = 1100;
  private lastRequestTime = 0;

  constructor(config: SourceConnectorConfig, cache?: IngestionCache) {
    super(config, cache);
  }

  /**
   * Fetch trivia facts from Wikidata.
   */
  async fetch(ctx: ConnectorContext): Promise<RawFeedItem[]> {
    const facts: RawFeedItem[] = [];

    // Fetch different types of facts
    const queryTypes: Array<{
      type: "anniversary" | "birthday" | "fact";
      query: string;
    }> = [
      { type: "anniversary", query: QUERIES.musicAnniversary },
      { type: "birthday", query: QUERIES.musicianBirthdays },
      { type: "fact", query: QUERIES.randomMusicFacts },
    ];

    for (const { type, query } of queryTypes) {
      try {
        const results = await this.executeSparqlQuery(query);
        const parsed = this.parseWikidataResults(results, type);

        for (const fact of parsed) {
          facts.push({
            sourceId: this.name,
            externalId: this.generateExternalId(fact),
            rawData: {
              fact,
              fetchedAt: new Date().toISOString(),
            },
            fetchedAt: new Date(),
          });
        }

        this.log(
          "info",
          `Fetched ${parsed.length} ${type} items from Wikidata`,
        );

        // Rate limiting delay
        await this.delay(this.requestDelayMs);
      } catch (error) {
        this.log("error", `Failed to fetch ${type} from Wikidata`, {
          error: this.getErrorMessage(error),
        });
        // Continue with other query types
      }
    }

    return facts;
  }

  /**
   * Normalize Wikidata fact to ContentFeedItem.
   */
  async normalize(raw: RawFeedItem): Promise<ContentFeedItem> {
    const data = raw.rawData as {
      fact: WikidataFact;
      fetchedAt: string;
    };
    const fact = data.fact;

    // Determine content type
    const contentType: ContentFeedType =
      fact.type === "anniversary"
        ? "trivia"
        : fact.type === "birthday"
          ? "curiosity"
          : "curiosity";

    // Build title and body based on fact type
    const { title, body, hook, tags } = this.buildContent(fact, contentType);

    // Calculate viral score (curiosities are medium priority)
    const viralScore = this.calculateViralScore(contentType, fact);

    // Trivia is evergreen (no expiry)
    // Curiosities expire after 90 days
    const expiresAt =
      contentType === "trivia"
        ? undefined
        : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

    const item: ContentFeedItem = {
      source: this.name,
      sourceId: raw.externalId,
      sourceUrl: `https://www.wikidata.org/wiki/${fact.name.replace(/ /g, "_")}`,
      title,
      contentHash: "",
      tenantId: null,
      isShared: true,
      metadata: {
        wikidataName: fact.name,
        description: fact.description,
        year: fact.year,
        birthYear: fact.birthYear,
        factType: fact.type,
      },
      contentType,
      body,
      hook,
      facts: [
        {
          fact: body,
          source: "Wikidata",
          verifiedAt: new Date(),
        },
      ],
      tags,
      publishAt: new Date(), // Publish immediately after ingestion
      expiresAt,
      viralScore,
    };

    item.contentHash = this.calculateHash(item);

    return item;
  }

  /**
   * Calculate content hash.
   */
  calculateHash(item: ContentFeedItem): string {
    return generateContentHash({
      title: item.title,
      body: item.body,
      source: item.source,
      sourceId: item.sourceId,
    });
  }

  /**
   * Health check for Wikidata endpoint.
   */
  async health(ctx: ConnectorContext): Promise<HealthStatus> {
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(SPARQL_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/sparql-query",
          Accept: "application/json",
        },
        body: "SELECT ?item WHERE { ?item wdt:Q31 wd:Q5 } LIMIT 1",
        signal: controller.signal,
      });

      clearTimeout(timeout);

      return {
        healthy: response.ok,
        latencyMs: Date.now() - start,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - start,
        error: this.getErrorMessage(error),
      };
    }
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  /**
   * Execute SPARQL query against Wikidata endpoint.
   */
  private async executeSparqlQuery(query: string): Promise<WikidataResponse> {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.requestDelayMs) {
      await this.delay(this.requestDelayMs - timeSinceLastRequest);
    }

    this.lastRequestTime = Date.now();

    const response = await fetch(SPARQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/sparql-query",
        Accept: "application/json",
        "User-Agent": "EnvivoStudio/1.0 (content ingestion bot)",
      },
      body: query,
    });

    if (!response.ok) {
      throw new Error(`Wikidata SPARQL request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Parse Wikidata JSON response into structured facts.
   */
  private parseWikidataResults(
    data: WikidataResponse,
    type: "anniversary" | "birthday" | "fact",
  ): WikidataFact[] {
    const facts: WikidataFact[] = [];

    for (const binding of data.results.bindings) {
      const name = binding.itemLabel?.value || "";
      const description = binding.description?.value;

      if (!name) continue;

      const fact: WikidataFact = {
        name,
        description,
        type,
      };

      if (type === "anniversary" && binding.year?.value) {
        fact.year = parseInt(binding.year.value, 10);
      }

      if (type === "birthday" && binding.birthyear?.value) {
        fact.birthYear = parseInt(binding.birthyear.value, 10);
      }

      facts.push(fact);
    }

    return facts;
  }

  /**
   * Generate unique external ID for fact.
   */
  private generateExternalId(fact: WikidataFact): string {
    const input = `${fact.type}:${fact.name}:${fact.year || fact.birthYear || ""}`;
    return this.shortHash(input);
  }

  /**
   * Build content (title, body, hook, tags) from fact.
   */
  private buildContent(
    fact: WikidataFact,
    contentType: ContentFeedType,
  ): {
    title: string;
    body: string;
    hook: string;
    tags: string[];
  } {
    const currentYear = new Date().getFullYear();
    const tags = ["music", "trivia", fact.type];

    switch (fact.type) {
      case "anniversary": {
        const yearsAgo = fact.year ? currentYear - fact.year : 0;
        const title = `${fact.name} - ${yearsAgo} anos de su ${fact.description || "evento"}`;
        const body = `El ${yearsAgo} aniversario de "${fact.description || "evento notable"}" relacionado con ${fact.name}.`;
        const hook = `Sabias que hoy se cumplen ${yearsAgo} anos de...`;
        return {
          title,
          body,
          hook,
          tags: [...tags, "anniversary", "music-history"],
        };
      }

      case "birthday": {
        const age = fact.birthYear ? currentYear - fact.birthYear : 0;
        const title = `${fact.name} cumple ${age} anos`;
        const body = `${fact.name}${fact.description ? `, ${fact.description}` : ""}, celebra su cumpleaños hoy.`;
        const hook = `Feliz cumpleaños para ${fact.name}!`;
        return {
          title,
          body,
          hook,
          tags: [...tags, "birthday", "celebration"],
        };
      }

      default: {
        const title = `Sobre ${fact.name}`;
        const body = `${fact.name}${fact.description ? `: ${fact.description}` : ""}.`;
        const hook = `Conocias estos datos sobre ${fact.name}?`;
        return { title, body, hook, tags };
      }
    }
  }

  /**
   * Calculate viral score.
   */
  private calculateViralScore(
    contentType: ContentFeedType,
    fact: WikidataFact,
  ): number {
    let score = 40; // Base for trivia/curiosity

    // Boost for famous artists (those with descriptions)
    if (fact.description) {
      score += 10;
    }

    // Birthdays get slightly higher scores (engagement)
    if (fact.type === "birthday") {
      score += 15;
    }

    // Anniversaries of major events get boost
    if (fact.type === "anniversary" && fact.year && fact.year < 2000) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Delay execution.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createWikidataConnector(
  cache?: IngestionCache,
): WikidataConnector {
  return new WikidataConnector(
    {
      sourceId: "wikidata",
      sourceType: "api",
      isShared: true,
      rateLimitRps: 0.9, // ~1 request per second (Wikidata limit)
      retryConfig: {
        maxRetries: 2,
        backoffMs: 2000,
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeoutMs: 60000, // 1 minute
      },
    },
    cache,
  );
}
