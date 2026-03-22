// ============================================================================
// BadgeSection Component
// ============================================================================
//
// Badge con fondo de color de sección y texto adaptativo.
// Automatic calculates text color (black or white) for WCAG AA compliance.
// Diseñado para uso en Satori (React JSX sin browser APIs).
//
// Usage:
//   <BadgeSection text="Próximos Shows" bgColor="#8B5CF6" size="md" />
//   <BadgeSection text="Efemérides" sectionSlug="efemerides" bgColor="#D97706" />

import type { BadgeSectionProps } from "../types";
import { PRIMARY_FONT, BADGE_TEXT_COLOR, getContrastColor } from "../config";

// ----------------------------------------------------------------------------
// Size configurations
// ----------------------------------------------------------------------------

const SIZE_CONFIG = {
  sm: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    fontSize: 12,
  },
  md: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  lg: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    fontSize: 16,
  },
} as const;

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function BadgeSection({
  text,
  bgColor,
  textColor,
  sectionSlug,
  size = "md",
  className,
}: BadgeSectionProps) {
  const sizeConfig = SIZE_CONFIG[size];

  // Automatically calculate text color for WCAG AA compliance
  // When sectionSlug is provided, use the adaptive color from config
  // Otherwise fall back to the default white
  const resolvedTextColor =
    textColor ?? (sectionSlug ? getContrastColor(bgColor) : BADGE_TEXT_COLOR);

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bgColor,
        color: resolvedTextColor,
        paddingTop: sizeConfig.paddingVertical,
        paddingBottom: sizeConfig.paddingVertical,
        paddingLeft: sizeConfig.paddingHorizontal,
        paddingRight: sizeConfig.paddingHorizontal,
        borderRadius: 9999, // pill shape (full)
        fontFamily: PRIMARY_FONT,
        fontWeight: 700, // bold
        fontSize: sizeConfig.fontSize,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        lineHeight: 1,
      }}
    >
      {text}
    </div>
  );
}
