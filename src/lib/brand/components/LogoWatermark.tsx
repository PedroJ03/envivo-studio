// ============================================================================
// Logo Watermark Component - envivo.
// ============================================================================
//
// Inline SVG logo with editorial minimalist style inspired by Filo.news.
// The final dot "." is the characteristic seal.
//
// Design:
// - Text "envivo" in Syne Bold (sans-serif, editorial)
// - Final dot "." in position of emphasis
// - Black #000000 on light backgrounds
// - White #FFFFFF on dark backgrounds
//
// Usage in Satori (React-style JSX):
//   <LogoWatermark position="bottom-right" size="md" />

import type { LogoWatermarkProps } from "../types";
import { LOGO_SVG, LOGO_SVG_LIGHT } from "../config";

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function LogoWatermark({
  variant = "horizontal",
  position = "bottom-right",
  size = "md",
  color,
  className,
}: LogoWatermarkProps) {
  // Determine which logo to use based on color prop
  const logoContent = color === "#FFFFFF" ? LOGO_SVG_LIGHT : LOGO_SVG;

  // Size mapping
  const sizeMap = {
    sm: { width: 80, height: variant === "vertical" ? 60 : 20 },
    md: { width: 120, height: variant === "vertical" ? 90 : 30 },
    lg: { width: 160, height: variant === "vertical" ? 120 : 40 },
  };

  const dimensions = sizeMap[size];

  // Position styles based on position prop
  const getPositionStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = { position: "absolute" };

    switch (position) {
      case "bottom-right":
        return { ...base, bottom: 24, right: 24 };
      case "bottom-left":
        return { ...base, bottom: 24, left: 24 };
      case "top-right":
        return { ...base, top: 24, right: 24 };
      case "top-left":
        return { ...base, top: 24, left: 24 };
      default:
        return { ...base, bottom: 24, right: 24 };
    }
  };

  return (
    <div
      className={className}
      style={{
        ...getPositionStyles(),
        width: dimensions.width,
        height: dimensions.height,
        pointerEvents: "none",
      }}
      dangerouslySetInnerHTML={{ __html: logoContent }}
    />
  );
}

// ----------------------------------------------------------------------------
// SVG Logo Export (for direct use)
// ----------------------------------------------------------------------------

export { LOGO_SVG, LOGO_SVG_LIGHT };
