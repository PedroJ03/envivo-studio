// ============================================================================
// PostSquare11 - Classic Variant
// ============================================================================
//
// Layout compacto cuadrado 1:1 con estructura tradicional:
// - Sección + Fecha arriba
// - Título a la izquierda
// - Foto grande ocupando la mayor parte
// - Subtítulo y logo abajo
//
// Tamaño: 1080x1080px
// Padding: 32px (más compacto por ser cuadrado)

import type { BrandSectionSlug } from "../../types";
import { BadgeSection } from "../../components/BadgeSection";
import { Title } from "../../components/Title";
import { PhotoContainer } from "../../components/PhotoContainer";
import { LogoWatermark } from "../../components/LogoWatermark";
import {
  getSectionColor,
  getSectionName,
  TEMPLATE_SIZES,
  SPACING,
} from "../../config";

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface ClassicProps {
  sectionSlug: BrandSectionSlug;
  sectionName?: string;
  title: string;
  subtitle?: string;
  photoUrl: string;
  date?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function Classic({
  sectionSlug,
  sectionName,
  title,
  subtitle,
  photoUrl,
  date,
}: ClassicProps) {
  const sectionColor = getSectionColor(sectionSlug);
  const sectionDisplayName = sectionName || getSectionName(sectionSlug);
  const { width, height } = TEMPLATE_SIZES["post-square-11"];
  const padding = SPACING.lg; // 32px

  // Calculate available space for photo
  const headerHeight = 80; // Badge + date row
  const titleHeight = 120; // Title area
  const footerHeight = subtitle ? 100 : 60; // Subtitle + logo
  const photoHeight =
    height - headerHeight - titleHeight - footerHeight - padding * 2;

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: "#FFFFFF",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        padding,
        boxSizing: "border-box",
      }}
    >
      {/* Header: Section Badge + Date */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <BadgeSection
          text={sectionDisplayName}
          bgColor={sectionColor}
          size="md"
        />
        {date && (
          <span
            style={{
              fontFamily: "Syne, Arial, sans-serif",
              fontSize: 14,
              fontWeight: 400,
              color: "#6B7280",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {date}
          </span>
        )}
      </div>

      {/* Title: Left-aligned */}
      <div style={{ marginBottom: 16 }}>
        <Title
          text={title}
          size="md"
          weight="bold"
          align="left"
          color="#000000"
        />
      </div>

      {/* Photo: Large, takes most space */}
      <div
        style={{
          flex: 1,
          minHeight: photoHeight,
          marginBottom: 16,
        }}
      >
        <PhotoContainer
          src={photoUrl}
          alt={title}
          roundedCorners="all"
          roundedSize={16}
          aspectRatio={`${width - padding * 2}/${photoHeight}`}
          objectFit="cover"
        />
      </div>

      {/* Footer: Subtitle + Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          minHeight: 40,
        }}
      >
        {subtitle && (
          <span
            style={{
              fontFamily: "Syne, Arial, sans-serif",
              fontSize: 16,
              fontWeight: 400,
              color: "#374151",
              maxWidth: "70%",
              lineHeight: 1.3,
            }}
          >
            {subtitle}
          </span>
        )}
        <LogoWatermark position="bottom-right" size="md" />
      </div>
    </div>
  );
}
