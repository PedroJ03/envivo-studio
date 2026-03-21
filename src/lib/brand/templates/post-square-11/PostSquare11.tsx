// ============================================================================
// PostSquare11 - Main Export
// ============================================================================
//
// Exporta todas las variantes del template cuadrado 1:1 (1080x1080px).
//
// Variantes:
// - Classic: Layout tradicional, foto grande, título a la izquierda
// - Centered: Todo centrado, diseño simétrico
// - Minimal: Título grande prominente, foto más pequeña

import type { BrandSectionSlug } from "../../types";
import { Classic, type ClassicProps } from "./Classic";
import { Centered, type CenteredProps } from "./Centered";
import { Minimal, type MinimalProps } from "./Minimal";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type PostSquare11Variant = "classic" | "centered" | "minimal";

export interface PostSquare11Props {
  sectionSlug: BrandSectionSlug;
  sectionName?: string;
  title: string;
  subtitle?: string;
  photoUrl: string;
  date?: string;
  template?: PostSquare11Variant;
}

// Re-export variant props
export type { ClassicProps, CenteredProps, MinimalProps };

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------

export function PostSquare11({
  sectionSlug,
  sectionName,
  title,
  subtitle,
  photoUrl,
  date,
  template = "classic",
}: PostSquare11Props) {
  const commonProps = {
    sectionSlug,
    sectionName,
    title,
    subtitle,
    photoUrl,
    date,
  };

  switch (template) {
    case "centered":
      return <Centered {...commonProps} />;
    case "minimal":
      return <Minimal {...commonProps} />;
    case "classic":
    default:
      return <Classic {...commonProps} />;
  }
}

// ----------------------------------------------------------------------------
// Named exports for direct use
// ----------------------------------------------------------------------------

export { Classic };
export { Centered };
export { Minimal };
