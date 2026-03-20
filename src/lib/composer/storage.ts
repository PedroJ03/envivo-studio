import path from "node:path";

import { randomUUID } from "node:crypto";
import { getComposerConfig } from "./config";

export interface ComposerAssetLocation {
  filePath: string;
  publicUrl: string;
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function expandTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\w+\}/g, (token) => {
    const key = token.slice(1, -1);

    return vars[key] ?? token;
  });
}

function buildPathSegments(value: string): string[] {
  return value
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => sanitizeSegment(segment));
}

export function buildAssetLocation(input: {
  tenantId: string;
  candidateContentId: string;
  templateId: string;
  extension?: string;
}): ComposerAssetLocation {
  const config = getComposerConfig();
  const ext = (input.extension || "png").replace(/^\./, "");
  const basePath = config.storage.publicBasePath.replace(/^\/+|\/+$/g, "");

  const vars = {
    tenant: sanitizeSegment(input.tenantId),
    candidate: sanitizeSegment(input.candidateContentId),
    template: sanitizeSegment(input.templateId),
    prefix: sanitizeSegment(config.storage.fileNamePrefix),
    uuid: randomUUID(),
  };

  const directorySegments = buildPathSegments(expandTemplate(config.storage.pathTemplate, vars));
  const fileName = `${expandTemplate(config.storage.fileNameTemplate, vars)}.${ext}`;

  const filePath = path.join(config.storage.outputDirectory, ...directorySegments, fileName);
  const publicUrl = [basePath, ...directorySegments, fileName].filter(Boolean).join("/");

  return {
    filePath,
    publicUrl,
  };
}
