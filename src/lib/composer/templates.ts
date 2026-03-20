import {
  type ComposerTemplateDefinition,
  type ComposerTemplateConstraints,
  type ComposerTemplateFormat,
  type ComposerTemplateLayout,
  type ComposerTemplateRenderContext,
  type TemplateRenderer,
} from "./templates/types";
import {
  carouselPortraitTemplate,
  carouselTemplate,
  renderCarouselTemplate,
} from "./templates/carousel-template";
import { postHeroTemplate, renderPostTemplate } from "./templates/post-template";
import { renderStoryTemplate, storyTemplate } from "./templates/story-template";

const templateDefinitions: ComposerTemplateDefinition[] = [
  postHeroTemplate,
  storyTemplate,
  carouselTemplate,
  carouselPortraitTemplate,
];

const MAX_TEXT_LENGTH = {
  title: 120,
  subtitle: 74,
};

function normalizeTemplateContext(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function truncateText(value: string, maxLength: number): string {
  const normalized = normalizeTemplateContext(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

const rendererByKind: Record<ComposerTemplateDefinition["kind"], TemplateRenderer> = {
  "post-hero": (template, context, title, subtitle) =>
    renderPostTemplate(template, context, truncateText(title, MAX_TEXT_LENGTH.title), subtitle),
  "story-slab": (template, context, title, subtitle) =>
    renderStoryTemplate(template, context, truncateText(title, MAX_TEXT_LENGTH.title), subtitle),
  "carousel-card": (template, context, title, subtitle) =>
    renderCarouselTemplate(
      template,
      context,
      truncateText(title, MAX_TEXT_LENGTH.title),
      subtitle,
    ),
};

export function listComposerTemplates(): ComposerTemplateDefinition[] {
  return [...templateDefinitions];
}

export function getComposerTemplate(templateId: string): ComposerTemplateDefinition | undefined {
  return templateDefinitions.find((template) => template.id === templateId);
}

export function getDefaultTemplate(format: ComposerTemplateFormat): ComposerTemplateDefinition {
  const template = templateDefinitions.find((entry) => entry.format === format);

  if (!template) {
    throw new Error(`No default composer template found for format '${format}'.`);
  }

  return template;
}

export function getTemplateForRender(input: {
  templateId?: string;
  format: ComposerTemplateFormat;
}): ComposerTemplateDefinition {
  if (input.templateId) {
    const template = getComposerTemplate(input.templateId);

    if (!template) {
      throw new Error(`Template '${input.templateId}' not found.`);
    }

    if (template.format !== input.format) {
      throw new Error(`Template '${template.id}' does not support format '${input.format}'.`);
    }

    return template;
  }

  return getDefaultTemplate(input.format);
}

export function validateTemplateConstraints(
  template: Pick<ComposerTemplateDefinition, "width" | "height">,
  constraints: ComposerTemplateConstraints,
): void {
  if (template.width <= 0 || template.height <= 0) {
    throw new Error(`Template dimensions must be positive. Received ${template.width}x${template.height}.`);
  }

  if (template.width > constraints.maxWidth || template.height > constraints.maxHeight) {
    throw new Error(
      `Template ${template.width}x${template.height} exceeds configured limits ${constraints.maxWidth}x${constraints.maxHeight}.`,
    );
  }
}

export function buildTemplateRenderNode(
  template: ComposerTemplateDefinition,
  context: ComposerTemplateRenderContext,
): ComposerTemplateLayout {
  const renderer = rendererByKind[template.kind];
  const title = truncateText(context.title, MAX_TEXT_LENGTH.title);
  const subtitle = context.subtitle ? truncateText(context.subtitle, MAX_TEXT_LENGTH.subtitle) : undefined;

  return renderer(template, context, title, subtitle);
}

export {
  carouselPortraitTemplate,
  carouselTemplate,
  postHeroTemplate,
  storyTemplate,
};
