// ============================================================================
// Post Square 1:1 Templates - Index
// ============================================================================
//
// Exporta todas las variantes del template cuadrado 1:1 (1080x1080px).
//
// Variantes:
// - Classic: Layout tradicional, foto grande, título a la izquierda
// - Centered: Todo centrado, diseño simétrico
// - Minimal: Título grande prominente, foto más pequeña

export { PostSquare11 } from "./PostSquare11";
export { Classic } from "./Classic";
export { Centered } from "./Centered";
export { Minimal } from "./Minimal";

// Re-export types
export type {
  PostSquare11Props,
  PostSquare11Variant,
  ClassicProps,
  CenteredProps,
  MinimalProps,
} from "./PostSquare11";
