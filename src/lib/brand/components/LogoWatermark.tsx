// ============================================================================
// Logo Watermark Component - envivo.
// ============================================================================
//
// Simplified logo for Satori compatibility.
// Uses div with text instead of SVG text (Satori doesn't support SVG text nodes).
//
// Usage in Satori (React-style JSX):
//   <LogoWatermark position="bottom-right" size="md" />

import type { LogoWatermarkProps } from "../types";
import { PRIMARY_FONT } from "../config";

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
  // Determine which color to use
  const fillColor = color === "#FFFFFF" ? "#FFFFFF" : "#000000";

  // Size mapping
  const sizeMap = {
    sm: { fontSize: 16, dotSize: 6 },
    md: { fontSize: 20, dotSize: 8 },
    lg: { fontSize: 24, dotSize: 10 },
  };

  const dimensions = sizeMap[size];

  // Position styles based on position prop
  const getPositionStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      display: "flex",
      alignItems: "center",
      gap: 4,
    };

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
        fontFamily: PRIMARY_FONT,
        fontSize: dimensions.fontSize,
        fontWeight: 700,
        color: fillColor,
        letterSpacing: "-0.5px",
        pointerEvents: "none",
      }}
    >
      <span>envivo</span>
      <span
        style={{
          display: "flex",
          width: dimensions.dotSize,
          height: dimensions.dotSize,
          borderRadius: dimensions.dotSize / 2,
          backgroundColor: fillColor,
        }}
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// SVG Logo Export (for direct use)
// ----------------------------------------------------------------------------

// For backwards compatibility, export empty strings
// Components should use the LogoWatermark component instead
export const LOGO_SVG = "";
export const LOGO_SVG_LIGHT = "";
