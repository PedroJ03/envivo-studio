// ============================================================================
// ReelCover9-16 - Magazine Variant
// ============================================================================
//
// Layout (estilo tapa de revista):
// +------------------+
// |FONDO: color      |  ← color sólido de sección
// |sección           |
// |                  |
// |                  |
// |   TÍTULO         |  ← Syne BLACK si existe, si no Bold MUY grande
// |   PRINCIPAL      |  ← 100-120px
// |   ENORME         |
// |                  |
// |                  |
// |   [FOTO]         |  ← centered, con tratamiento
// |                  |
// |                  |
// |        envivo.   |  ← sticker "envivo.sección" style
// +------------------+
//
// - Background: sólido color de sección
// - Título: blanco, tamaño enorme (100-120px), bold
// - Foto: centrada, con rounded corners
// - Logo: posicionado como sticker

import type { ReelCoverProps } from "../../types";
import { BadgeSection } from "../../components/BadgeSection";
import { Title } from "../../components/Title";
import { LogoWatermark } from "../../components/LogoWatermark";
import { SPACING, PRIMARY_FONT, getContrastColor } from "../../config";

// Template dimensions
const WIDTH = 1080;
const HEIGHT = 1920;
const PADDING = 48;

export function Magazine({
  section,
  title,
  subtitle,
  photoUrl,
}: Omit<ReelCoverProps, "template">) {
  // Determinar color de texto basado en el fondo
  const textColor = getContrastColor(section.color);
  // Forzar blanco para este template específico (más impactante)
  const titleColor = "#FFFFFF";

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: section.color,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        padding: PADDING,
        boxSizing: "border-box",
      }}
    >
      {/* Badge arriba */}
      <div style={{ marginBottom: SPACING.xl }}>
        <BadgeSection
          text={section.name}
          bgColor="#000000"
          textColor="#FFFFFF"
          size="lg"
        />
      </div>

      {/* Título principal - MUY grande */}
      <div style={{ marginBottom: SPACING.xl }}>
        <Title
          text={title}
          size="2xl"
          color={titleColor}
          align="left"
          weight="black"
          maxLines={4}
        />
      </div>

      {/* Subtítulo opcional */}
      {subtitle && (
        <div style={{ marginBottom: SPACING.lg }}>
          <span
            style={{
              fontFamily: PRIMARY_FONT,
              fontSize: 32,
              fontWeight: 400,
              color: titleColor,
              opacity: 0.9,
              lineHeight: 1.3,
            }}
          >
            {subtitle}
          </span>
        </div>
      )}

      {/* Foto centrada */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: SPACING.lg,
          marginBottom: SPACING.xl,
        }}
      >
        <div
          style={{
            width: "85%",
            aspectRatio: "1/1",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
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
      </div>

      {/* Logo estilo sticker */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          right: 48,
          backgroundColor: "#000000",
          padding: "12px 20px",
          borderRadius: 12,
        }}
      >
        <span
          style={{
            fontFamily: PRIMARY_FONT,
            fontSize: 20,
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: "-0.5px",
          }}
        >
          envivo.
        </span>
      </div>
    </div>
  );
}
