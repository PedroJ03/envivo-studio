// ============================================================================
// ReelCover9-16 - Minimal Variant
// ============================================================================
//
// Layout:
// +------------------+
// |                  |
// |                  |
// |                  |
// |    [FOTO]        |  ← foto full bleed
// |                  |
// |                  |
// |                  |
// |------------------|
// |FONDO NEGRO       |
// | TÍTULO           |  ← título en barra negra
// | [SEC]    envivo. |
// +------------------+
//
// - Barra negra inferior (20-25% altura)
// - Título + badge + logo en la barra
// - Foto sin overlays arriba

import type { ReelCoverProps } from "../../types";
import { BadgeSection } from "../../components/BadgeSection";
import { Title } from "../../components/Title";
import { SPACING, PRIMARY_FONT } from "../../config";

// Template dimensions
const WIDTH = 1080;
const HEIGHT = 1920;
const PADDING = 40;
const FOOTER_HEIGHT = 420; // ~22% de la altura

export function Minimal({
  section,
  title,
  subtitle,
  photoUrl,
}: Omit<ReelCoverProps, "template">) {
  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: "#000000",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Foto full bleed arriba */}
      <div
        style={{
          flex: 1,
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
        {/* Gradient sutil para transición al footer */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 100,
            background:
              "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 100%)",
          }}
        />
      </div>

      {/* Barra negra inferior */}
      <div
        style={{
          height: FOOTER_HEIGHT,
          backgroundColor: "#000000",
          padding: PADDING,
          paddingTop: 32,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          boxSizing: "border-box",
        }}
      >
        {/* Contenido superior de la barra */}
        <div>
          {/* Badge */}
          <div style={{ marginBottom: SPACING.md }}>
            <BadgeSection
              text={section.name}
              bgColor={section.color}
              textColor="#FFFFFF"
              size="md"
            />
          </div>

          {/* Título */}
          <div style={{ marginBottom: subtitle ? SPACING.sm : 0 }}>
            <Title
              text={title}
              size="lg"
              color="#FFFFFF"
              align="left"
              weight="bold"
              maxLines={2}
            />
          </div>

          {/* Subtítulo opcional */}
          {subtitle && (
            <div style={{ marginTop: SPACING.sm }}>
              <span
                style={{
                  fontFamily: PRIMARY_FONT,
                  fontSize: 22,
                  fontWeight: 400,
                  color: "#9CA3AF", // gray-400
                  lineHeight: 1.3,
                }}
              >
                {subtitle}
              </span>
            </div>
          )}
        </div>

        {/* Logo alineado a la derecha abajo */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
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
    </div>
  );
}
