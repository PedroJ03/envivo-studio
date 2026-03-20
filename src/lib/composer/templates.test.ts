import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import satori from "satori";

import { getComposerConfig } from "./config";
import {
  buildAssetLocation,
  type ComposerAssetLocation,
} from "./storage";
import {
  buildTemplateRenderNode,
  getDefaultTemplate,
  listComposerTemplates,
  validateTemplateConstraints,
  postHeroTemplate,
  storyTemplate,
  carouselTemplate,
  carouselPortraitTemplate,
} from "./templates";

const SAMPLE_CONTEXT = {
  title: "La noche del barrio",
  subtitle: "Entrada general",
  photoUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO1W8n0AAAAASUVORK5CYII=",
};

const fontFilePath = path.join("/", "usr", "share", "fonts", "truetype", "dejavu", "DejaVuSans.ttf");
const fallbackFont = fs.readFileSync(fontFilePath);

describe("composer templates", () => {
  it("defines fixed Instagram template presets", () => {
    const templates = listComposerTemplates();
    const byFormat = new Set(templates.map((template) => template.format));

    expect(byFormat.has("post")).toBe(true);
    expect(byFormat.has("story")).toBe(true);
    expect(byFormat.has("carousel")).toBe(true);
    expect(templates).toHaveLength(4);
  });

  it("defines reusable frame module templates", () => {
    expect(postHeroTemplate.kind).toBe("post-hero");
    expect(postHeroTemplate.id).toBe("ig-post-square");

    expect(storyTemplate.kind).toBe("story-slab");
    expect(storyTemplate.id).toBe("ig-story-portrait");

    expect(carouselTemplate.kind).toBe("carousel-card");
    expect(carouselPortraitTemplate.kind).toBe("carousel-card");
  });

  it("builds render nodes using template width and height", () => {
    const template = getDefaultTemplate("story");

    const layout = buildTemplateRenderNode(template, {
      title: "La noche del barrio",
      subtitle: "Entrada general",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(layout.renderNode.props.style?.width).toBe(`${template.width}px`);
    expect(layout.renderNode.props.style?.height).toBe(`${template.height}px`);
    expect(layout.template.id).toBe(template.id);
  });

  it("validates template dimensions against configurable limits", () => {
    const template = getDefaultTemplate("post");
    const config = getComposerConfig();

    expect(() =>
      validateTemplateConstraints(template, {
        maxWidth: config.constraints.maxWidth,
        maxHeight: config.constraints.maxHeight,
      }),
    ).not.toThrow();

    expect(() =>
      validateTemplateConstraints(
        {
          ...template,
          width: config.constraints.maxWidth + 1,
          height: template.height,
        },
        {
          maxWidth: config.constraints.maxWidth,
          maxHeight: config.constraints.maxHeight,
        },
      ),
    ).toThrow();
  });

  it("creates stable storage path conventions", () => {
    const location: ComposerAssetLocation = buildAssetLocation({
      tenantId: "tenant-Envivo:Tandil",
      candidateContentId: "candidate-001",
      templateId: "ig-post-square",
    });

    expect(location.filePath).toMatch(/composer-assets/);
    expect(location.publicUrl).toContain("composer-assets/");
    expect(location.publicUrl).toContain("tenant-envivo-tandil");
    expect(location.publicUrl).toContain("candidate-001");
  });

  it.each([
    ["post hero", postHeroTemplate],
    ["story", storyTemplate],
    ["carousel", carouselTemplate],
    ["carousel portrait", carouselPortraitTemplate],
  ])("renders %s template as stable SVG snapshot", async (_, template) => {
    const layout = buildTemplateRenderNode(template, {
      ...SAMPLE_CONTEXT,
      // Keep caption-less input for carousel variants to avoid unsupported Satori layout branches.
      subtitle: template.format === "carousel" ? undefined : SAMPLE_CONTEXT.subtitle,
    });
    const svg = await satori(layout.renderNode, {
      width: template.width,
      height: template.height,
      fonts: [{
        name: "DejaVu Sans",
        data: fallbackFont,
        weight: 400,
        style: "normal",
      }],
    });

    expect(svg).toMatchSnapshot();
  });
});
