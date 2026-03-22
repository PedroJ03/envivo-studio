// ============================================================================
// Title Component
// ============================================================================
//
// Título editorial con tipografía Syne y tamaños predefinidos.
// Diseñado para uso en Satori (React JSX sin browser APIs).
//
// Usage:
//   <Title text="Próximo Show" size="xl" color="#000" weight="bold" />
//   <Title text="Efemérides del Día" size="lg" align="center" maxLines={2} />

import type { TitleProps } from "../types";
import { PRIMARY_FONT, TITLE_COLOR } from "../config";

// ----------------------------------------------------------------------------
// Size configurations (font sizes in px)
// ----------------------------------------------------------------------------

const SIZE_CONFIG = {
  sm: 32,
  md: 48,
  lg: 64,
  xl: 80,
  "2xl": 96,
} as const;

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function Title({
  text,
  color = TITLE_COLOR,
  size = "md",
  weight = "bold",
  align = "left",
  maxLines,
  className,
}: TitleProps) {
  const fontSize = SIZE_CONFIG[size];
  const fontWeight = weight === "black" ? 900 : 700;

  // Build style object
  const style: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    fontFamily: PRIMARY_FONT,
    fontWeight: fontWeight,
    fontSize: fontSize,
    color: color,
    textAlign: align,
    lineHeight: 1.1,
    margin: 0,
    padding: 0,
  };

  // Apply maxLines overflow clamping if specified
  if (maxLines !== undefined && maxLines > 0) {
    style.overflow = "hidden";
    style.display = "-webkit-box";
    style.WebkitBoxOrient = "vertical";
    style.WebkitLineClamp = maxLines;
  }

  return (
    <div className={className} style={style}>
      {text}
    </div>
  );
}
