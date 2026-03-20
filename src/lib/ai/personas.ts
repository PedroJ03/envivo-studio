import { readFile } from "node:fs/promises";
import path from "node:path";

export interface PersonaData {
  readonly slug: string;
  readonly content: string;
  readonly loadedAt: string;
  readonly filePath: string;
}

type PersonaCache = {
  loadedAt: string;
  filePath: string;
  content: string;
};

const PERSONA_DIR = path.join(process.cwd(), "personas");
const PERSONA_CACHE = new Map<string, PersonaCache>();
const VALID_PERSONA_SLUG = /^[a-zA-Z0-9_-]+$/;

export class PersonaLoadError extends Error {
  public readonly code = "PERSONA_LOAD_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "PersonaLoadError";
  }
}

function normalizePersonaSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();

  if (!VALID_PERSONA_SLUG.test(normalized)) {
    throw new PersonaLoadError(
      `Invalid persona slug '${slug}'. Allowed characters are letters, numbers, '_' and '-'.`,
    );
  }

  return normalized;
}

function getPersonaFilePath(slug: string): string {
  return path.resolve(PERSONA_DIR, `${slug}.md`);
}

export function clearPersonaCache(): void {
  PERSONA_CACHE.clear();
}

export async function loadPersona(slug: string): Promise<PersonaData> {
  const normalizedSlug = normalizePersonaSlug(slug);
  const filePath = getPersonaFilePath(normalizedSlug);

  const cached = PERSONA_CACHE.get(normalizedSlug);
  if (cached && cached.filePath === filePath) {
    return {
      slug: normalizedSlug,
      content: cached.content,
      loadedAt: cached.loadedAt,
      filePath: cached.filePath,
    };
  }

  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (error: unknown) {
    const reason = error as { code?: string };
    if (reason?.code === "ENOENT") {
      throw new PersonaLoadError(`Persona '${normalizedSlug}' not found at ${filePath}.`);
    }

    throw new PersonaLoadError(`Failed to load persona '${normalizedSlug}': ${String(error)}`);
  }

  if (!content || !content.trim()) {
    throw new PersonaLoadError(`Persona '${normalizedSlug}' is empty.`);
  }

  const loadedAt = new Date().toISOString();
  const entry: PersonaCache = {
    content,
    loadedAt,
    filePath,
  };

  PERSONA_CACHE.set(normalizedSlug, entry);

  return {
    slug: normalizedSlug,
    content,
    loadedAt,
    filePath,
  };
}
