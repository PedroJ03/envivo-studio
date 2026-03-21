// ============================================================================
// Story 9:16 Template - Minimal Variant
// ============================================================================
//
// Foto full bleed (cubre todo) con overlay oscuro sutil.
// Título y badge como overlay sobre la foto.
// Overlay oscuro para legibilidad.
//
// Layout:
// +------------------+
// |                  |
// |                  |
// |                  |
// |                  |
// |    [FOTO]        |  ← foto full bleed, overlay oscuro sutil
// |                  |
// |                  |
// |                  |
// | TÍTULO           |  ← overlay en la foto, bottom
// | [SECCIÓN]  envivo.|  ← badge + logo bottom
// +------------------+

import type { StoryProps } from "../../types";
import { BadgeSection } from "../../components/BadgeSection";
import { Title } from "../../components/Title";
import { LogoWatermark } from "../../components/LogoWatermark";
import { TEMPLATE_SIZES, SPACING } from "../../config";

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function Minimal({ section, title, subtitle, photoUrl }: StoryProps) {
  const { width, height } = TEMPLATE_SIZES["story-9-16"];

  return (
    <div
      style={{
        width,
        height,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background Image - Full Bleed */}
      <img
        src={photoUrl}
        alt={title}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {/* Dark Overlay - Subtle gradient for legibility */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0.7) 100%)",
        }}
      />

      {/* Content Overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: SPACING.xl,
          paddingBottom: SPACING.xxl,
          display: "flex",
          flexDirection: "column",
          gap: SPACING.md,
        }}
      >
        {/* Badge */}
        <BadgeSection
          text={section.name}
          bgColor={section.color}
          textColor="#FFFFFF"
          size="md"
        />

        {/* Title */}
        <Title
          text={title}
          size="xl"
          weight="black"
          color="#FFFFFF"
          maxLines={3}
          align="left"
        />

        {/* Subtitle (optional) */}
        {subtitle && (
          <Title
            text={subtitle}
            size="sm"
            weight="bold"
            color="#FFFFFF"
            maxLines={2}
            align="left"
          />
        )}
      </div>

      {/* Logo Watermark - Bottom Right */}
      <LogoWatermark position="bottom-right" size="lg" color="#FFFFFF" />
    </div>
  );
}

export default Minimal;
