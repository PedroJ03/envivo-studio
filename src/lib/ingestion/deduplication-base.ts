/**
 * Deduplication Base Functions - Phase 1 Foundation
 *
 * Provides content hashing and normalization functions for deduplication.
 * These are the BASE layer utilities used by deduplication.ts (Phase 4).
 */

import crypto from "crypto";

// ============================================================================
// Content Hash Generation
// ============================================================================

/**
 * Generate SHA256 content hash from normalized fields.
 * Used for exact and hash-based deduplication.
 */
export function generateContentHash(fields: {
  title: string;
  body?: string;
  source: string;
  sourceId: string;
  date?: string; // ISO date string
  artistNames?: string[];
  venue?: string;
}): string {
  const normalized: Record<string, string | string[] | undefined> = {
    title: normalizeForHash(fields.title),
    body: fields.body ? normalizeForHash(fields.body) : undefined,
    source: fields.source,
    sourceId: fields.sourceId,
    date: fields.date,
    venue: fields.venue ? normalizeForHash(fields.venue) : undefined,
  };

  // Sort artist names and normalize
  if (fields.artistNames && fields.artistNames.length > 0) {
    normalized.artists = fields.artistNames
      .map((name) => normalizeArtistName(name))
      .sort();
  }

  const hashInput = Object.entries(normalized)
    .filter(([_, v]) => v !== undefined)
    .map(([k, v]) => `${k}:${Array.isArray(v) ? v.join("|") : v}`)
    .join("||");

  return crypto.createHash("sha256").update(hashInput).digest("hex");
}

/**
 * Generate short hash (16 characters) for cache keys.
 */
export function generateShortHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

// ============================================================================
// String Normalization
// ============================================================================

/**
 * Normalize a string for hashing comparison.
 * - Lowercase
 * - Trim whitespace
 * - Normalize unicode (NFC form)
 * - Remove extra spaces
 */
export function normalizeForHash(str: string): string {
  if (!str) return "";

  return str.toLowerCase().trim().normalize("NFC").replace(/\s+/g, " "); // Collapse multiple spaces
}

/**
 * Normalize a string for display (less aggressive than hash normalization).
 */
export function normalizeForDisplay(str: string): string {
  if (!str) return "";

  return str.trim().normalize("NFC").replace(/\s+/g, " ");
}

// ============================================================================
// Artist Name Normalization
// ============================================================================

/**
 * Normalize an artist name for comparison.
 * - Lowercase
 * - Remove special characters except spaces and hyphens
 * - Collapse multiple spaces/hyphens
 * - Common word replacements (the, el, la, etc.)
 */
const ARTIST_STOP_WORDS = [
  "the",
  "el",
  "la",
  "los",
  "las",
  "a",
  "an",
  "and",
  "or",
  "but",
];
const ARTIST_NORMALIZATIONS: Array<[RegExp, string]> = [
  [/\s+/g, " "], // Collapse spaces
  [/-+/g, "-"], // Collapse multiple hyphens
  [/[^a-z0-9\s-]/gi, ""], // Remove special chars
  [/^\s+|\s+$/g, ""], // Trim
];

export function normalizeArtistName(name: string): string {
  if (!name) return "";

  let normalized = name.toLowerCase();

  // Apply normalizations
  for (const [pattern, replacement] of ARTIST_NORMALIZATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }

  // Remove stop words at start
  const words = normalized.split(" ").filter((w) => w.length > 0);
  const firstWord = words[0];
  if (firstWord && ARTIST_STOP_WORDS.includes(firstWord) && words.length > 1) {
    words.shift();
  }

  return words.join(" ").trim();
}

// ============================================================================
// Venue Name Normalization
// ============================================================================

const VENUE_NORMALIZATIONS: Array<[RegExp, string]> = [
  [/\s+/g, " "], // Collapse spaces
  [/-+/g, "-"], // Collapse multiple hyphens
  [/[,.'"]+/g, ""], // Remove punctuation
  [/^\s+|\s+$/g, ""], // Trim
  [/\b(stadium|arena|auditorium|theatre|theater|hall|center|centre)\b/gi, ""], // Remove venue type
];

export function normalizeVenueName(name: string): string {
  if (!name) return "";

  let normalized = name.toLowerCase();

  for (const [pattern, replacement] of VENUE_NORMALIZATIONS) {
    normalized = normalized.replace(pattern, replacement);
  }

  return normalized.replace(/\s+/g, " ").trim();
}

// ============================================================================
// Date Normalization
// ============================================================================

/**
 * Normalize a date to ISO date string (YYYY-MM-DD).
 */
export function normalizeDate(
  date: Date | string | null | undefined,
): string | null {
  if (!date) return null;

  if (typeof date === "string") {
    // Parse string to Date
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split("T")[0];
  }

  return date.toISOString().split("T")[0];
}

/**
 * Normalize a date to just year.
 */
export function normalizeToYear(
  date: Date | string | null | undefined,
): number | null {
  const normalized = normalizeDate(date);
  if (!normalized) return null;
  return parseInt(normalized.split("-")[0], 10);
}

/**
 * Check if two dates are the same day.
 */
export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  return d1 !== null && d2 !== null && d1 === d2;
}

/**
 * Check if a date falls within a window (in days) around another date.
 */
export function isWithinWindow(
  targetDate: Date | string,
  referenceDate: Date | string,
  windowDays: number,
): boolean {
  const target = new Date(targetDate);
  const reference = new Date(referenceDate);

  const diffMs = Math.abs(target.getTime() - reference.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  return diffDays <= windowDays;
}

// ============================================================================
// Basic Exact Match Check
// ============================================================================

/**
 * Basic exact match check for source + sourceId.
 * This is the first tier of deduplication.
 */
export function exactMatch(
  newItem: { source: string; sourceId: string },
  existingItem: { source: string; sourceId: string },
): boolean {
  return (
    newItem.source === existingItem.source &&
    newItem.sourceId === existingItem.sourceId
  );
}

/**
 * Check if content hashes match exactly.
 */
export function hashMatch(hash1: string, hash2: string): boolean {
  return hash1 === hash2;
}

// ============================================================================
// Levenshtein Distance (for fuzzy matching)
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings.
 * Used for fuzzy matching.
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create DP table
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] =
          1 +
          Math.min(
            dp[i - 1][j], // deletion
            dp[i][j - 1], // insertion
            dp[i - 1][j - 1], // substitution
          );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate Jaro-Winkler similarity between two strings.
 * Returns a value between 0 and 1, where 1 is exact match.
 */
export function jaroWinklerSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  const matchWindow = Math.floor(Math.max(str1.length, str2.length) / 2) - 1;
  const str1Matches = new Array(str1.length).fill(false);
  const str2Matches = new Array(str2.length).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < str1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, str2.length);

    for (let j = start; j < end; j++) {
      if (str2Matches[j] || str1[i] !== str2[j]) continue;
      str1Matches[i] = true;
      str2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < str1.length; i++) {
    if (!str1Matches[i]) continue;
    while (!str2Matches[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  const jaro =
    (matches / str1.length +
      matches / str2.length +
      (matches - transpositions / 2) / matches) /
    3;

  // Winkler modification - common prefix (up to 4 chars)
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(str1.length, str2.length)); i++) {
    if (str1[i] === str2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

// ============================================================================
// Event-Specific Deduplication Helpers
// ============================================================================

export interface EventDedupeKey {
  source: string;
  sourceId: string;
  title: string;
  eventDate: string;
  year?: number;
  artistNames?: string[];
  venue?: string;
}

/**
 * Generate deduplication key for calendar events.
 * Different event types use different key strategies.
 */
export function generateEventDedupeKey(
  item: EventDedupeKey,
  eventType: "historical" | "concert" | "festival" | "local_event",
): string {
  const base = {
    source: item.source,
    sourceId: item.sourceId,
    title: normalizeForHash(item.title),
    eventDate: item.eventDate,
  };

  switch (eventType) {
    case "historical":
      // Historical: source+sourceId OR (title + date + year)
      return generateShortHash(
        `${base.source}||${base.sourceId}||${base.title}||${base.eventDate}||${item.year ?? ""}`,
      );

    case "concert":
      // Concert: artist + date + venue
      const artists = (item.artistNames ?? [])
        .map(normalizeArtistName)
        .sort()
        .join("|");
      const venue = item.venue ? normalizeVenueName(item.venue) : "";
      return generateShortHash(
        `${normalizeForHash(artists)}||${base.eventDate}||${venue}`,
      );

    case "local_event":
      // Local event: source + sourceId OR (title + date within 1 day)
      return generateShortHash(
        `${base.source}||${base.sourceId}||${base.title}||${base.eventDate}`,
      );

    case "festival":
      // Festival: title + date range (just start date)
      return generateShortHash(`${base.title}||${base.eventDate}`);

    default:
      return generateContentHash({
        title: item.title,
        source: item.source,
        sourceId: item.sourceId,
        date: item.eventDate,
        artistNames: item.artistNames,
        venue: item.venue,
      });
  }
}

/**
 * Check if two artist names are likely the same.
 * Uses normalized comparison with some tolerance.
 */
export function artistsMatch(name1: string, name2: string): boolean {
  const n1 = normalizeArtistName(name1);
  const n2 = normalizeArtistName(name2);

  // Exact match after normalization
  if (n1 === n2) return true;

  // One contains the other (with word boundaries)
  if (n1.includes(n2) || n2.includes(n1)) return true;

  // Levenshtein distance (for typos)
  const distance = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  const similarity = 1 - distance / maxLen;

  return similarity > 0.85;
}

/**
 * Check if two venue names are likely the same.
 */
export function venuesMatch(name1: string, name2: string): boolean {
  const n1 = normalizeVenueName(name1);
  const n2 = normalizeVenueName(name2);

  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;

  const distance = levenshteinDistance(n1, n2);
  const maxLen = Math.max(n1.length, n2.length);
  const similarity = 1 - distance / maxLen;

  return similarity > 0.8;
}
