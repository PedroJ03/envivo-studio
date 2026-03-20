import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

const scrapePhotoSchema = z.object({
  url: z.string().url(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  altText: z.string().optional(),
  source: z.string().url().optional(),
});

export const scrapedEventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  date: z.string().min(1, "Event date is required"),
  venue: z.string().min(1, "Event venue is required"),
  photos: z.array(scrapePhotoSchema).min(1, "At least one photo is required"),
});

export type ScrapedPhoto = z.infer<typeof scrapePhotoSchema>;
export type ScrapedEvent = z.infer<typeof scrapedEventSchema>;

export type ExtractEventInput = {
  sourceUrl: string;
  fetchPage?: (url: string, timeoutMs?: number) => Promise<string>;
  model?: Parameters<typeof generateObject>[0]["model"];
  fetchTimeoutMs?: number;
};

export class ScrapeExtractionError extends Error {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ScrapeExtractionError";
    this.cause = cause;
  }
}

const defaultTimeoutMs = 8_000;

async function fetchEventHtml(url: string, timeoutMs = defaultTimeoutMs): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "accept-language": "en",
        "user-agent": "envivo-studio-scraper/1.0 (+https://envivo-studio.local)",
      },
    });

    if (!response.ok) {
      throw new ScrapeExtractionError(`Failed to fetch ${url}: HTTP ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      throw new ScrapeExtractionError(`Expected HTML content for ${url}, got ${contentType}`);
    }

    return response.text();
  } catch (error) {
    if (error instanceof ScrapeExtractionError) {
      throw error;
    }

    throw new ScrapeExtractionError(`Unable to download ${url}`, error);
  } finally {
    clearTimeout(timer);
  }
}

function buildExtractionPrompt(sourceUrl: string, html: string): string {
  return [
    `You are an event metadata extraction engine for a social media content system.`,
    `Extract the event details from the following page context and return only structured data.`,
    `If an exact value is unknown, prefer the most semantically likely interpretation from the visible content.`,
    `Source URL: ${sourceUrl}`,
    `Raw HTML (first 35000 chars):`,
    html.slice(0, 35_000),
  ].join("\n");
}

export async function extractEventFromUrl({
  sourceUrl,
  fetchPage = fetchEventHtml,
  model = openai("gpt-4o-mini"),
  fetchTimeoutMs,
}: ExtractEventInput): Promise<ScrapedEvent> {
  let html = "";
  try {
    html = await fetchPage(sourceUrl, fetchTimeoutMs);

    const { object } = await generateObject({
      model,
      schema: scrapedEventSchema,
      prompt: buildExtractionPrompt(sourceUrl, html),
    });

    return object;
  } catch (error) {
    if (error instanceof ScrapeExtractionError) {
      throw error;
    }

    throw new ScrapeExtractionError(`Failed to extract event details for ${sourceUrl}`, error);
  }
}

export function normalizeScrapedDate(isoLikeDate: string): Date | null {
  if (!isoLikeDate) {
    return null;
  }

  const parsed = new Date(isoLikeDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function normalizePhotoDimensions(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.trunc(value);
}
