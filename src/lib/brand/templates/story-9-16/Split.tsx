// ============================================================================
// Story 9:16 Template - Split Variant
// ============================================================================
//
// Layout dividido 50/50:
// - Mitad superior: título + info (fondo negro o color de sección)
// - Mitad inferior: foto full bleed, sin rounded
//
// Layout:
// +------------------+
// |[SECCIÓN]  [FECHA]|
// |                  |
// | TÍTULO           |  ← izq
// |                  |
// +------------------+
// |                  |
// |                  |
// |     [FOTO]       |  ← foto ocupa MITAD inferior
// |                  |
// |                  |
// +------------------+

import type { StoryProps } from "../../types";
import { BadgeSection } from "../../components/BadgeSection";
import { Title } from "../../components/Title";
import { LogoWatermark } from "../../components/LogoWatermark";
import { TEMPLATE_SIZES, SPACING, getContrastColor } from "../../config";

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function Split({
  section,
  title,
  subtitle,
  photoUrl,
  date,
}: StoryProps) {
  const { width, height } = TEMPLATE_SIZES["story-9-16"];
  const halfHeight = height / 2;
  const textColor = getContrastColor(section.color);
  const logoColor = textColor === "#FFFFFF" ? "#FFFFFF" : "#000000";

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Top Half - Info Section */}
      <div
        style={{
          width: "100%",
          height: halfHeight,
          display: "flex",
          flexDirection: "column",
          backgroundColor: section.color,
          padding: SPACING.xl,
          boxSizing: "border-box",
        }}
      >
        {/* Top Row: Badge and Date */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginTop: SPACING.lg,
          }}
        >
          <BadgeSection
            text={section.name}
            bgColor={textColor === "#FFFFFF" ? "#000000" : "#FFFFFF"}
            textColor={textColor}
            size="md"
          />
          {date && (
            <span
              style={{
                fontFamily: "Syne, Arial, sans-serif",
                fontSize: 14,
                fontWeight: 400,
                color: textColor,
                opacity: 0.8,
              }}
            >
              {date}
            </span>
          )}
        </div>

        {/* Title Area */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: SPACING.md,
            marginTop: SPACING.lg,
          }}
        >
          <Title
            text={title}
            size="xl"
            weight="black"
            color={textColor}
            maxLines={3}
            align="left"
          />

          {subtitle && (
            <Title
              text={subtitle}
              size="sm"
              weight="bold"
              color={textColor}
              maxLines={2}
              align="left"
            />
          )}
        </div>
      </div>

      {/* Bottom Half - Full Bleed Photo */}
      <div
        style={{
          width: "100%",
          height: halfHeight,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <img
          src={photoUrl}
          alt={title}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Logo Watermark - Bottom Right (over photo) */}
      <LogoWatermark position="bottom-right" size="lg" color="#FFFFFF" />
    </div>
  );
}

export default Split;
