// ============================================================================
// PostSquare11 - Minimal Variant
// ============================================================================
//
// Layout cuadrado 1:1 minimalista:
// - Título GRANDE arriba (principal elemento)
// - Foto más pequeña debajo
// - Sección y logo juntos abajo (compacto)
//
// Tamaño: 1080x1080px
// Padding: 32px

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

export interface MinimalProps {
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

export function Minimal({
  sectionSlug,
  sectionName,
  title,
  subtitle,
  photoUrl,
  date,
}: MinimalProps) {
  const sectionColor = getSectionColor(sectionSlug);
  const sectionDisplayName = sectionName || getSectionName(sectionSlug);
  const { width, height } = TEMPLATE_SIZES["post-square-11"];
  const padding = SPACING.lg; // 32px

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
      {/* Main Title: LARGE and prominent */}
      <div
        style={{
          marginBottom: 24,
          paddingTop: 40,
        }}
      >
        <Title
          text={title}
          size="xl"
          weight="bold"
          align="center"
          color="#000000"
        />
        {subtitle && (
          <span
            style={{
              display: "block",
              marginTop: 16,
              fontFamily: "Syne, Arial, sans-serif",
              fontSize: 20,
              fontWeight: 400,
              color: "#6B7280",
              textAlign: "center",
            }}
          >
            {subtitle}
          </span>
        )}
      </div>

      {/* Photo: Smaller than other variants */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          maxHeight: 450,
        }}
      >
        <PhotoContainer
          src={photoUrl}
          alt={title}
          roundedCorners="all"
          roundedSize={16}
          aspectRatio="1/1"
          objectFit="cover"
        />
      </div>

      {/* Footer: Section + Date + Logo compact */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <BadgeSection
            text={sectionDisplayName}
            bgColor={sectionColor}
            size="sm"
          />
          {date && (
            <span
              style={{
                fontFamily: "Syne, Arial, sans-serif",
                fontSize: 12,
                fontWeight: 400,
                color: "#9CA3AF",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {date}
            </span>
          )}
        </div>
        <LogoWatermark position="bottom-right" size="sm" />
      </div>
    </div>
  );
}
