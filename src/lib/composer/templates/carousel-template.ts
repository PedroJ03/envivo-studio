import { createElement, type CSSProperties } from "react";

import {
  type ComposerTemplateDefinition,
  type ComposerTemplateLayout,
  type ComposerTemplateRenderContext,
} from "./types";

const CAROUSEL_DEFAULT_ID = "ig-carousel-square";
const CAROUSEL_TALL_ID = "ig-carousel-portrait";

const carouselBaseStyle = (template: ComposerTemplateDefinition) => ({
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

const carouselPhotoLayer = (context: ComposerTemplateRenderContext, title: string) => createElement("img", {
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

export const carouselTemplate: ComposerTemplateDefinition = {
  id: CAROUSEL_DEFAULT_ID,
  name: "Carousel 1:1",
  format: "carousel",
  width: 1080,
  height: 1080,
  kind: "carousel-card",
  backgroundColor: "#0b1220",
  overlayOpacity: 0.42,
  textColor: "#ffffff",
};

export const carouselPortraitTemplate: ComposerTemplateDefinition = {
  id: CAROUSEL_TALL_ID,
  name: "Carousel 4:5",
  format: "carousel",
  width: 1080,
  height: 1350,
  kind: "carousel-card",
  backgroundColor: "#0f172a",
  overlayOpacity: 0.4,
  textColor: "#ffffff",
};

function buildCarouselOverlay(
  template: ComposerTemplateDefinition,
  title: string,
  subtitle?: string,
): ReturnType<typeof createElement> {
    return createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          position: "absolute",
          left: "56px",
          right: "56px",
          bottom: "58px",
        padding: "18px",
        borderRadius: "18px",
        backdropFilter: "blur(6px)",
        background: "rgba(0,0,0,0.34)",
        border: "1px solid rgba(255,255,255,0.17)",
        maxWidth: "920px",
      } as CSSProperties,
    },
    createElement(
      "div",
      {
        style: {
          fontSize: "50px",
          fontWeight: 700,
          lineHeight: 1.05,
          marginBottom: subtitle ? "12px" : 0,
        } as CSSProperties,
      },
      title,
    ),
    subtitle
      ? createElement(
          "div",
          {
            style: {
              fontSize: "29px",
              lineHeight: 1.2,
              maxWidth: "840px",
            } as CSSProperties,
          },
          subtitle,
        )
      : null,
  );
}

export function renderCarouselTemplate(
  template: ComposerTemplateDefinition,
  context: ComposerTemplateRenderContext,
  sanitizedTitle: string,
  sanitizedSubtitle?: string,
): ComposerTemplateLayout {
  const baseStyle = carouselBaseStyle(template);

  return {
    template,
    containerStyle: baseStyle,
    renderNode: createElement(
      "div",
      { style: baseStyle },
      carouselPhotoLayer(context, sanitizedTitle),
      createElement(
        "div",
        {
          style: {
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            background: `linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,${template.overlayOpacity}) 100%)`,
          } as CSSProperties,
        },
      ),
      buildCarouselOverlay(template, sanitizedTitle, sanitizedSubtitle),
    ),
  };
}
