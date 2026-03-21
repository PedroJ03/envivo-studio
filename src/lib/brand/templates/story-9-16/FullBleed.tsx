// ============================================================================
// Story 9:16 Template - FullBleed Variant
// ============================================================================
//
// Layout vertical con fondo color sólido de sección (degradado sutil).
// El título es enorme y vertical, la foto aparece debajo centrada.
//
// Layout:
// +------------------+
// |                  |  ← FONDO COLOR SECCIÓN (degradado sutil)
// |  [SECCIÓN]       |  ← badge
// |                  |
// |                  |
// |                  |
// |  TÍTULO ENORME   |  ← Syne Bold, muy grande (96-120px)
// |  VERTICAL        |
// |                  |
// |                  |
// |                  |
// |    [FOTO]        |  ← centered, rounded
// |                  |
// |                  |
// |           envivo.|  ← logo
// +------------------+

import type { StoryProps } from "../../types";
import { BadgeSection } from "../../components/BadgeSection";
import { Title } from "../../components/Title";
import { PhotoContainer } from "../../components/PhotoContainer";
import { LogoWatermark } from "../../components/LogoWatermark";
import {
  TEMPLATE_SIZES,
  SPACING,
  getContrastColor,
  LOGO_SVG_LIGHT,
} from "../../config";

// ----------------------------------------------------------------------------
// Helper: Create subtle gradient from section color
// ----------------------------------------------------------------------------

function createSubtleGradient(baseColor: string): string {
  // Create a slightly lighter version for gradient
  return `linear-gradient(180deg, ${baseColor} 0%, ${baseColor}E6 100%)`;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function FullBleed({ section, title, subtitle, photoUrl }: StoryProps) {
  const { width, height } = TEMPLATE_SIZES["story-9-16"];
  const textColor = getContrastColor(section.color);
  const logoColor = textColor === "#FFFFFF" ? "#FFFFFF" : "#000000";

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        background: createSubtleGradient(section.color),
        position: "relative",
        padding: SPACING.xl,
        boxSizing: "border-box",
      }}
    >
      {/* Badge Section - Top */}
      <div style={{ marginTop: SPACING.lg }}>
        <BadgeSection text={section.name} bgColor={section.color} size="lg" />
      </div>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: SPACING.xl,
        }}
      >
        {/* Title - Extra Large */}
        <Title
          text={title}
          size="2xl"
          weight="black"
          color={textColor}
          maxLines={4}
          align="left"
        />

        {/* Subtitle (optional) */}
        {subtitle && (
          <Title
            text={subtitle}
            size="md"
            weight="bold"
            color={textColor}
            maxLines={2}
            align="left"
          />
        )}

        {/* Photo Container - Centered */}
        <div style={{ marginTop: SPACING.lg }}>
          <PhotoContainer
            src={photoUrl}
            alt={title}
            roundedCorners="all"
            roundedSize={24}
            aspectRatio="1/1"
            objectFit="cover"
          />
        </div>
      </div>

      {/* Logo Watermark - Bottom Right */}
      <LogoWatermark position="bottom-right" size="lg" color={logoColor} />
    </div>
  );
}

export default FullBleed;
