import { createElement, type CSSProperties } from "react";
import { type ReactElement } from "react";

export type ComposerTemplateFormat = "post" | "story" | "carousel";

export interface ComposerTemplateDefinition {
  readonly id: string;
  readonly name: string;
  readonly format: ComposerTemplateFormat;
  readonly width: number;
  readonly height: number;
  readonly kind: "post-hero" | "story-slab" | "carousel-card";
  readonly backgroundColor: string;
  readonly overlayOpacity: number;
  readonly textColor: string;
}

export interface ComposerTemplateRenderContext {
  title: string;
  subtitle?: string;
  photoUrl: string;
}

export interface ComposerTemplateLayout {
  template: ComposerTemplateDefinition;
  renderNode: ReactElement<{ style?: CSSProperties }>;
  containerStyle: CSSProperties;
}

export interface ComposerTemplateConstraints {
  maxWidth: number;
  maxHeight: number;
}

export type TemplateRenderer = (
  template: ComposerTemplateDefinition,
  context: ComposerTemplateRenderContext,
  title: string,
  subtitle?: string,
) => ComposerTemplateLayout;
