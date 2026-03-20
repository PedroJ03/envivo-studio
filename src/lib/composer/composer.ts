import { createRequire } from "node:module";
import path from "node:path";
import { promises as fs } from "node:fs";
import { and, desc, eq } from "drizzle-orm";

import { withTenantDb } from "@/lib/db/client";
import { candidateContent, contentStates, generatedOutputs, photos } from "@/lib/db/schema";
import { getComposerConfig } from "./config";
import {
  buildTemplateRenderNode,
  getTemplateForRender,
  validateTemplateConstraints,
} from "./templates";
import type { ComposerTemplateDefinition } from "./templates/types";
import { buildAssetLocation } from "./storage";

const requireModule = createRequire(import.meta.url);

type SafePhotoRecord = {
  originalUrl: string;
  width: number;
  height: number;
};

type SafeCandidateRecord = {
  id: string;
  tenantId: string;
  title: string;
  summaryJson: Record<string, unknown> | null;
  selectedFormat: "post" | "story" | "carousel";
  photoId: string | null;
};

export class ComposerPhotoResolutionError extends Error {
  public readonly code = "COMPOSER_PHOTO_RESOLUTION_TOO_LOW";

  constructor(width: number, height: number, minimumDimension: number) {
    super(`Photo resolution ${width}x${height} is below minimum ${minimumDimension}x${minimumDimension}.`);
    this.name = "ComposerPhotoResolutionError";
  }
}

export class ComposerCandidateNotFoundError extends Error {
  public readonly code = "COMPOSER_CANDIDATE_NOT_FOUND";

  constructor(candidateContentId: string, tenantId: string) {
    super(`Candidate '${candidateContentId}' was not found for tenant '${tenantId}'.`);
    this.name = "ComposerCandidateNotFoundError";
  }
}

export class ComposerPhotoNotFoundError extends Error {
  public readonly code = "COMPOSER_PHOTO_NOT_FOUND";

  constructor(photoId: string, candidateContentId: string) {
    super(`Photo '${photoId}' for candidate '${candidateContentId}' was not found.`);
    this.name = "ComposerPhotoNotFoundError";
  }
}

export function assertMinimumPhotoDimension(input: {
  width: number;
  height: number;
  minimumDimension: number;
}): void {
  if (input.width < input.minimumDimension || input.height < input.minimumDimension) {
    throw new ComposerPhotoResolutionError(input.width, input.height, input.minimumDimension);
  }
}

type CandidateContentStateRecord = typeof contentStates.$inferSelect;
type GeneratedOutputRecord = typeof generatedOutputs.$inferInsert;

type PuppeteerLike = {
  launch: (options: {
    headless: boolean;
    args: string[];
  }) => Promise<{
    newPage: () => Promise<PuppeteerPageLike>;
    close: () => Promise<void>;
  }>;
};

type PuppeteerPageLike = {
  setViewport: (options: { width: number; height: number; deviceScaleFactor: number }) => Promise<void>;
  setContent: (content: string, options: { waitUntil: "networkidle0" | "load" | "domcontentloaded" }) => Promise<void>;
  screenshot: (options: {
    type: "png";
    clip: { x: number; y: number; width: number; height: number };
  }) => Promise<Buffer | Uint8Array | null>;
  close: () => Promise<void>;
};

type SatoriLike = {
  default: (node: unknown, options: {
    width: number;
    height: number;
    fonts?: Array<{ name: string; data: Buffer; weight?: number; style?: string }>;
  }) => Promise<string>;
};

export interface ComposerRenderInput {
  tenantId: string;
  candidateContentId: string;
  templateId?: string;
}

export interface ComposerRenderOutput {
  filePath: string;
  fileUrl: string;
  templateId: string;
  width: number;
  height: number;
  bytes: number;
  metadata: {
    mimeType: string;
    generatedWith: "satori" | "puppeteer-fallback";
    candidateContentId: string;
    photoUrl: string;
  };
}

export interface ComposerComposeInput extends ComposerRenderInput {
  sortOrder?: number;
}

export interface ComposerComposeOutput extends ComposerRenderOutput {
  generatedOutputId: string;
  contentStateId: string;
  sortOrder: number;
}

function getModuleOptional<T>(id: string): T | null {
  try {
    return requireModule(id) as T;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildFallbackHtml(template: ComposerTemplateDefinition, renderContext: { title: string; subtitle?: string; photoUrl: string }): string {
  const title = escapeHtml(renderContext.title);
  const subtitle = escapeHtml(renderContext.subtitle ?? "");
  const overlay = template.kind === "story-slab";

  const topBand = overlay
    ? `
      <div style="position:absolute; left:48px; right:48px; top:64px; color:#fff; font-size:56px; font-weight:800; line-height:1.03; max-width:860px;">
        ${title}
      </div>
      ${subtitle ? `<div style="position:absolute; left:48px; right:48px; top:182px; color:#fff; font-size:34px; opacity:0.88; max-width:820px;">${subtitle}</div>` : ""}
    `
    : `
      <div style="position:absolute; left:56px; right:56px; bottom:58px; color:#fff; border-radius:18px; background:rgba(0,0,0,0.34); border:1px solid rgba(255,255,255,0.17); padding:18px; max-width:920px;">
        <div style="font-size:50px; font-weight:700; line-height:1.05; margin-bottom:${subtitle ? "12px" : "0"};">${title}</div>
        ${subtitle ? `<div style="font-size:29px; line-height:1.2;">${subtitle}</div>` : ""}
      </div>
    `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          html, body {
            margin: 0;
            width: ${template.width}px;
            height: ${template.height}px;
            overflow: hidden;
          }
        </style>
      </head>
      <body>
        <div style="position:relative; width:${template.width}px; height:${template.height}px; background:${template.backgroundColor}; color:${template.textColor}; font-family:Arial, Helvetica, sans-serif;">
          <img src="${escapeHtml(renderContext.photoUrl)}" alt="${title}" style="position:absolute; inset:0; width:100%; height:100%; object-fit:cover;" />
          <div style="position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,${template.overlayOpacity}) 100%);"></div>
          ${topBand}
        </div>
      </body>
    </html>
  `;
}

function buildHtmlForSvg(svg: string, width: number, height: number): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          html, body {
            margin: 0;
            width: ${width}px;
            height: ${height}px;
            overflow: hidden;
          }
          .frame { width: ${width}px; height: ${height}px; }
        </style>
      </head>
      <body>
        <div class="frame">${svg}</div>
      </body>
    </html>
  `;
}

async function saveImageBuffer(input: { imageBuffer: ArrayBuffer | Uint8Array | Buffer; filePath: string }): Promise<number> {
  const directory = path.dirname(input.filePath);

  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(input.filePath, new Uint8Array(input.imageBuffer));

  const stat = await fs.stat(input.filePath);

  return stat.size;
}

async function renderWithPuppeteer(html: string, width: number, height: number): Promise<Buffer> {
  const puppeteer = getModuleOptional<unknown>("puppeteer");

  if (!puppeteer) {
    throw new Error("Puppeteer is not installed. Install puppeteer to enable HTML/SVG screenshot rendering.");
  }

  const browser = await (puppeteer as PuppeteerLike).launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    try {
      await page.setViewport({ width, height, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "networkidle0" });

      const screenshot = await page.screenshot({
        type: "png",
        clip: {
          x: 0,
          y: 0,
          width,
          height,
        },
      });

      if (!screenshot || (!(screenshot instanceof Buffer) && !(screenshot instanceof Uint8Array))) {
        throw new Error("Puppeteer screenshot returned an unexpected value.");
      }

      return Buffer.from(screenshot);
    } finally {
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

function getSummaryString(summary: Record<string, unknown> | null, key: string): string {
  if (!summary) {
    return "";
  }

  const value = summary[key];

  return typeof value === "string" ? value : "";
}

async function renderTemplate(
  template: ComposerTemplateDefinition,
  templateRenderOptions: { width: number; height: number },
  context: { title: string; subtitle?: string; photoUrl: string },
): Promise<{ buffer: Buffer; renderer: "satori" | "puppeteer-fallback" }> {
  const satori = getModuleOptional<unknown>("satori");

  if (satori) {
    try {
      const { default: satoriRenderer } = satori as SatoriLike;

      const layout = buildTemplateRenderNode(template, context);
      const svg = await satoriRenderer(layout.renderNode, {
        width: templateRenderOptions.width,
        height: templateRenderOptions.height,
        fonts: [],
      });

      const html = buildHtmlForSvg(svg, templateRenderOptions.width, templateRenderOptions.height);
      return {
        buffer: await renderWithPuppeteer(html, templateRenderOptions.width, templateRenderOptions.height),
        renderer: "satori",
      };
    } catch (error) {
      // If Satori is installed but cannot process this payload, keep pipeline alive and fall back to Puppeteer HTML.
      console.error("Satori rendering failed, switching to Puppeteer fallback.", error);
    }
  }

  const html = buildFallbackHtml(template, context);

  return {
    buffer: await renderWithPuppeteer(html, templateRenderOptions.width, templateRenderOptions.height),
    renderer: "puppeteer-fallback",
  };
}

export async function renderCandidatePreview(input: ComposerRenderInput): Promise<ComposerRenderOutput> {
  const config = getComposerConfig();

  return withTenantDb(input.tenantId, async (tx) => {
    const [candidate] = (await tx
      .select({
        id: candidateContent.id,
        tenantId: candidateContent.tenantId,
        title: candidateContent.title,
        selectedFormat: candidateContent.selectedFormat,
        summaryJson: candidateContent.summaryJson,
        photoId: candidateContent.photoId,
      })
      .from(candidateContent)
      .where(and(eq(candidateContent.id, input.candidateContentId), eq(candidateContent.tenantId, input.tenantId)))
      .limit(1)) as SafeCandidateRecord[];

    if (!candidate) {
      throw new ComposerCandidateNotFoundError(input.candidateContentId, input.tenantId);
    }

    const selectedTemplate = getTemplateForRender({
      templateId: input.templateId,
      format: candidate.selectedFormat,
    });

    if (!candidate.photoId) {
      throw new Error(`Candidate '${input.candidateContentId}' has no photo attached.`);
    }

    const [photo] = (await tx
      .select({
        originalUrl: photos.originalUrl,
        width: photos.width,
        height: photos.height,
      })
      .from(photos)
      .where(and(eq(photos.id, candidate.photoId), eq(photos.tenantId, input.tenantId)))
      .limit(1)) as SafePhotoRecord[];

    if (!photo) {
      throw new ComposerPhotoNotFoundError(candidate.photoId, input.candidateContentId);
    }

  assertMinimumPhotoDimension({
    width: photo.width,
    height: photo.height,
    minimumDimension: config.constraints.minDimension,
  });

    validateTemplateConstraints(selectedTemplate, {
      maxWidth: config.constraints.maxWidth,
      maxHeight: config.constraints.maxHeight,
    });

    const subtitle = getSummaryString(candidate.summaryJson as Record<string, unknown> | null, "subtitle") ||
      getSummaryString(candidate.summaryJson as Record<string, unknown> | null, "eventDate") ||
      "En vivo en Tandil";

    const renderContext = {
      title: candidate.title,
      subtitle,
      photoUrl: photo.originalUrl,
    };

    const { buffer, renderer } = await renderTemplate(selectedTemplate, {
      width: selectedTemplate.width,
      height: selectedTemplate.height,
    }, renderContext);

    if (buffer.byteLength === 0) {
      throw new Error("Generated image buffer is empty.");
    }

    if (buffer.byteLength > config.constraints.maxBytes) {
      throw new Error("Generated image exceeds composer maximum file size constraint.");
    }

    const location = buildAssetLocation({
      tenantId: candidate.tenantId,
      candidateContentId: candidate.id,
      templateId: selectedTemplate.id,
      extension: "png",
    });

    const bytes = await saveImageBuffer({
      imageBuffer: buffer,
      filePath: location.filePath,
    });

    return {
      filePath: location.filePath,
      fileUrl: location.publicUrl,
      templateId: selectedTemplate.id,
      width: selectedTemplate.width,
      height: selectedTemplate.height,
      bytes,
      metadata: {
        mimeType: "image/png",
        generatedWith: renderer,
        candidateContentId: candidate.id,
        photoUrl: photo.originalUrl,
      },
    };
  });
}

export async function composeCandidate(input: ComposerComposeInput): Promise<ComposerComposeOutput> {
  const candidateOutput = await renderCandidatePreview(input);
  const requestedSortOrder = input.sortOrder ?? 0;
  const sortOrder =
    Number.isInteger(requestedSortOrder) && requestedSortOrder >= 0 ? requestedSortOrder : 0;

  const persisted = await withTenantDb(input.tenantId, async (tx) => {
    const latestStateRows = (await tx
      .select()
      .from(contentStates)
      .where(
        and(
          eq(contentStates.candidateContentId, input.candidateContentId),
          eq(contentStates.tenantId, input.tenantId),
        ),
      )
      .orderBy(desc(contentStates.createdAt), desc(contentStates.id))
      .limit(1)) as CandidateContentStateRecord[];

    const currentState = latestStateRows[0];

    if (!currentState) {
      throw new Error(`No content state exists for candidate '${input.candidateContentId}'.`);
    }

    const inserted = (await tx
      .insert(generatedOutputs)
      .values({
        tenantId: input.tenantId,
        contentStateId: currentState.id,
        candidateContentId: candidateOutput.metadata.candidateContentId,
        fileUrl: candidateOutput.fileUrl,
        sortOrder,
        width: candidateOutput.width,
        height: candidateOutput.height,
        metadataJson: {
          sourceTemplateId: candidateOutput.templateId,
          generatedWith: candidateOutput.metadata.generatedWith,
          photoUrl: candidateOutput.metadata.photoUrl,
          filePath: candidateOutput.filePath,
        },
      })
      .returning({
        id: generatedOutputs.id,
        contentStateId: generatedOutputs.contentStateId,
      })) as Array<Pick<GeneratedOutputRecord, "id" | "contentStateId">>;

    const output = inserted[0];

    if (!output) {
      throw new Error("Failed to persist generated output row.");
    }

    return output;
  });

  return {
    ...candidateOutput,
    generatedOutputId: (() => {
      if (!persisted.id) {
        throw new Error("Generated output identifier is missing after insert.");
      }

      return persisted.id;
    })(),
    contentStateId: (() => {
      if (!persisted.contentStateId) {
        throw new Error("Content state identifier is missing after insert.");
      }

      return persisted.contentStateId;
    })(),
    sortOrder,
  };
}
