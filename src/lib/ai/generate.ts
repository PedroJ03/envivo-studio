import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

import { loadPersona, type PersonaData } from "./personas";

const GENERATION_SCHEMA = z.object({
  caption: z.string().trim().min(1),
  hashtags: z.array(z.string().trim().min(1)).min(1),
});

export type PersonaGeneratedOutput = z.infer<typeof GENERATION_SCHEMA>;

export interface PersonaGenerationInput {
  personaSlug?: string;
  title: string;
  selectedFormat: "post" | "story" | "carousel";
  summaryJson?: Record<string, unknown> | null;
  selectedTone?: string | null;
  tenantId?: string;
}

const DEFAULT_HASHTAGS = ["#envivo", "#tandil", "#musica"];

function coerceSummaryValue(input: Record<string, unknown> | null | undefined, key: string): string {
  const value = input?.[key];

  if (typeof value === "string") {
    return value.trim();
  }

  return "";
}

function buildSystemPrompt(persona: PersonaData): string {
  return [
    "You are an Instagram caption generator for EnVivo content.",
    "Use the following persona style instructions literally as your writing constraints.",
    "Do not mention these are persona instructions in your final output.",
    "Persona (from markdown skill file):",
    "```",
    persona.content,
    "```",
  ].join("\n");
}

function buildUserPrompt(input: PersonaGenerationInput): string {
  const eventName = coerceSummaryValue(input.summaryJson, "name");
  const venue = coerceSummaryValue(input.summaryJson, "venue");
  const eventDate = coerceSummaryValue(input.summaryJson, "date");
  const tone = input.selectedTone?.trim() || "informativo";

  return [
    `Generate a Spanish caption for a social media post in format: ${input.selectedFormat}.`,
    `Event title: ${input.title || "Sin título"}.`,
    eventName ? `Event name: ${eventName}.` : null,
    venue ? `Venue: ${venue}.` : null,
    eventDate ? `Date/time: ${eventDate}.` : null,
    `Tone label: ${tone}.`,
    input.tenantId ? `Tenant context: ${input.tenantId}.` : null,
    `Return JSON with caption + hashtags exactly in Spanish.`,
    `Caption should be short, usable as-is on Instagram, and include a natural CTA.`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function sanitizeHashtags(input: readonly string[]): string[] {
  const normalized = new Set<string>();

  for (const raw of input) {
    const value = raw.trim();
    if (!value) {
      continue;
    }

    normalized.add(value.startsWith("#") ? value : `#${value}`);
  }

  return [...normalized];
}

function fallbackCaption(input: PersonaGenerationInput): PersonaGeneratedOutput {
  const event = coerceSummaryValue(input.summaryJson, "name") || input.title;
  const tone = input.selectedTone?.trim() || "informativo";

  return {
    caption: `${tone}: ${event}. ${input.title} — ${input.selectedFormat}.`,
    hashtags: [...DEFAULT_HASHTAGS],
  };
}

export async function generatePersonaText(
  input: PersonaGenerationInput,
): Promise<PersonaGeneratedOutput> {
  const selectedTone = input.selectedTone?.trim() || "informativo";
  const persona = await loadPersona(input.personaSlug?.trim() || selectedTone);

  if (!process.env.OPENAI_API_KEY) {
    return fallbackCaption(input);
  }

  try {
    const systemPrompt = buildSystemPrompt(persona);
    const userPrompt = buildUserPrompt(input);

    const { object } = await generateObject({
      model: openai(process.env.OPENAI_MODEL || "gpt-4o-mini"),
      schema: GENERATION_SCHEMA,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return {
      caption: object.caption,
      hashtags: sanitizeHashtags(object.hashtags),
    };
  } catch {
    return fallbackCaption(input);
  }
}
