// ============================================================================
// BadgeSection Component
// ============================================================================
//
// Badge con fondo de color de sección y texto en blanco.
// Diseñado para uso en Satori (React JSX sin browser APIs).
//
// Usage:
//   <BadgeSection text="Próximos Shows" bgColor="#8B5CF6" size="md" />

import type { BadgeSectionProps } from "../types";
import { PRIMARY_FONT, BADGE_TEXT_COLOR } from "../config";

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
  textColor = BADGE_TEXT_COLOR,
  size = "md",
  className,
}: BadgeSectionProps) {
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bgColor,
        color: textColor,
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
