import { createElement, type CSSProperties } from "react";

import {
  type ComposerTemplateDefinition,
  type ComposerTemplateLayout,
  type ComposerTemplateRenderContext,
} from "./types";

const POST_TEMPLATE_ID = "ig-post-square";

const postContainerBase = (template: ComposerTemplateDefinition) => ({
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

const postPhotoLayer = (context: ComposerTemplateRenderContext, title: string) => createElement("img", {
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

export const postHeroTemplate: ComposerTemplateDefinition = {
  id: POST_TEMPLATE_ID,
  name: "Post 1:1 Hero",
  format: "post",
  width: 1080,
  height: 1080,
  kind: "post-hero",
  backgroundColor: "#111827",
  overlayOpacity: 0.46,
  textColor: "#ffffff",
};

function buildPostOverlayBlock(template: ComposerTemplateDefinition, title: string, subtitle?: string): ReturnType<typeof createElement> {
  return createElement(
    "div",
    {
      style: {
        position: "absolute",
        bottom: "42px",
        left: "52px",
        right: "52px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      } as CSSProperties,
    },
    createElement(
      "div",
      {
        style: {
          fontSize: "62px",
          lineHeight: 1.1,
          fontWeight: 800,
          maxWidth: "948px",
        } as CSSProperties,
      },
      title,
    ),
    subtitle
      ? createElement(
          "div",
          {
            style: {
              fontSize: "33px",
              opacity: 0.9,
              maxWidth: "920px",
            } as CSSProperties,
          },
          subtitle,
        )
      : null,
  );
}

export function renderPostTemplate(
  template: ComposerTemplateDefinition,
  context: ComposerTemplateRenderContext,
  sanitizedTitle: string,
  sanitizedSubtitle?: string,
): ComposerTemplateLayout {
  const baseStyle = postContainerBase(template);

  return {
    template,
    containerStyle: baseStyle,
    renderNode: createElement(
      "div",
      { style: baseStyle },
      postPhotoLayer(context, sanitizedTitle),
      createElement(
        "div",
        {
          style: {
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "42%",
            background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,${template.overlayOpacity}) 100%)`,
          } as CSSProperties,
        },
      ),
      buildPostOverlayBlock(template, sanitizedTitle, sanitizedSubtitle),
    ),
  };
}
