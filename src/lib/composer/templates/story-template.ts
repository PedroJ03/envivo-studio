import { createElement, type CSSProperties } from "react";

import {
  type ComposerTemplateDefinition,
  type ComposerTemplateLayout,
  type ComposerTemplateRenderContext,
} from "./types";

const STORY_TEMPLATE_ID = "ig-story-portrait";

const storyContainerBase = (template: ComposerTemplateDefinition) => ({
  width: `${template.width}px`,
  height: `${template.height}px`,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  alignItems: "stretch",
  position: "relative",
  overflow: "hidden",
  backgroundColor: template.backgroundColor,
  color: template.textColor,
  fontFamily: "Arial, Helvetica, sans-serif",
} as CSSProperties);

const storyPhotoLayer = (context: ComposerTemplateRenderContext, title: string) => createElement("img", {
  src: context.photoUrl,
  alt: title,
  style: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  } as CSSProperties,
});

export const storyTemplate: ComposerTemplateDefinition = {
  id: STORY_TEMPLATE_ID,
  name: "Story Portrait",
  format: "story",
  width: 1080,
  height: 1920,
  kind: "story-slab",
  backgroundColor: "#000000",
  overlayOpacity: 0.34,
  textColor: "#ffffff",
};

function buildStoryOverlay(template: ComposerTemplateDefinition, title: string, subtitle?: string): ReturnType<typeof createElement> {
  return createElement(
    "div",
    {
      style: {
        position: "absolute",
        left: "48px",
        right: "48px",
        top: "64px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      } as CSSProperties,
    },
    createElement(
      "div",
      {
        style: {
          width: "58px",
          height: "58px",
          borderRadius: "50%",
          border: `3px solid ${template.textColor}`,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          placeItems: "center",
          fontWeight: 700,
          fontSize: "28px",
        } as CSSProperties,
      },
      "IG",
    ),
    createElement(
      "div",
      {
        style: {
          fontSize: "56px",
          fontWeight: 800,
          lineHeight: 1.03,
          maxWidth: "860px",
        } as CSSProperties,
      },
      title,
    ),
    subtitle
      ? createElement(
          "div",
          {
            style: {
              fontSize: "34px",
              maxWidth: "820px",
              opacity: 0.88,
            } as CSSProperties,
          },
          subtitle,
        )
      : null,
  );
}

export function renderStoryTemplate(
  template: ComposerTemplateDefinition,
  context: ComposerTemplateRenderContext,
  sanitizedTitle: string,
  sanitizedSubtitle?: string,
): ComposerTemplateLayout {
  const baseStyle = storyContainerBase(template);

  return {
    template,
    containerStyle: baseStyle,
    renderNode: createElement(
      "div",
      { style: baseStyle },
      storyPhotoLayer(context, sanitizedTitle),
      createElement(
        "div",
        {
          style: {
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,${template.overlayOpacity}) 100%)`,
          } as CSSProperties,
        },
      ),
      buildStoryOverlay(template, sanitizedTitle, sanitizedSubtitle),
    ),
  };
}
