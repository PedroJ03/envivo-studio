// ============================================================================
// PostSquare11 - Centered Variant
// ============================================================================
//
// Layout cuadrado 1:1 con todo centrado:
// - Sección centrada arriba
// - Título centrado
// - Foto centrada
// - Logo abajo a la derecha
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

export interface CenteredProps {
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

export function Centered({
  sectionSlug,
  sectionName,
  title,
  subtitle,
  photoUrl,
  date,
}: CenteredProps) {
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
      {/* Header: Centered Section Badge */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        <BadgeSection
          text={sectionDisplayName}
          bgColor={sectionColor}
          size="md"
        />
      </div>

      {/* Title: Centered */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <Title
          text={title}
          size="lg"
          weight="bold"
          align="center"
          color="#000000"
        />
        {subtitle && (
          <span
            style={{
              display: "block",
              marginTop: 12,
              fontFamily: "Syne, Arial, sans-serif",
              fontSize: 18,
              fontWeight: 400,
              color: "#6B7280",
              textAlign: "center",
            }}
          >
            {subtitle}
          </span>
        )}
      </div>

      {/* Photo: Centered */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
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

      {/* Date (if present) */}
      {date && (
        <div
          style={{
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: "Syne, Arial, sans-serif",
              fontSize: 14,
              fontWeight: 400,
              color: "#9CA3AF",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
            }}
          >
            {date}
          </span>
        </div>
      )}

      {/* Logo */}
      <LogoWatermark position="bottom-right" size="md" />
    </div>
  );
}
