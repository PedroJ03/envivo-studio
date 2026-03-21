// ============================================================================
// ReelCover9-16 - Duotone Variant
// ============================================================================
//
// Layout:
// +------------------+
// |                  |  ← FONDO: duotono (sección + negro)
// |                  |
// |                  |
// |  TÍTULO          |  ← white sobre duotono
// |  PRINCIPAL       |
// |                  |
// |                  |
// |  [FOTO]          |  ← treatment duotone también
// |                  |
// |                  |
// | [SEC]     envivo.|  ← badge + logo
// +------------------+
//
// - Duotone: aplicar filter o overlay con color sección
// - Título en blanco para contraste
// - Foto con mismo tratamiento de color

import type { ReelCoverProps } from "../../types";
import { BadgeSection } from "../../components/BadgeSection";
import { Title } from "../../components/Title";
import { SPACING, PRIMARY_FONT } from "../../config";

// Template dimensions
const WIDTH = 1080;
const HEIGHT = 1920;
const PADDING = 48;

export function Duotone({
  section,
  title,
  subtitle,
  photoUrl,
}: Omit<ReelCoverProps, "template">) {
  // Crear gradiente duotone
  const duotoneGradient = `linear-gradient(135deg, ${section.color} 0%, #000000 100%)`;

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        background: duotoneGradient,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        padding: PADDING,
        boxSizing: "border-box",
      }}
    >
      {/* Título principal - blanco sobre duotono */}
      <div style={{ marginTop: 120, marginBottom: SPACING.xl }}>
        <Title
          text={title}
          size="xl"
          color="#FFFFFF"
          align="center"
          weight="black"
          maxLines={3}
        />
      </div>

      {/* Subtítulo opcional */}
      {subtitle && (
        <div style={{ marginBottom: SPACING.xl, textAlign: "center" }}>
          <span
            style={{
              fontFamily: PRIMARY_FONT,
              fontSize: 28,
              fontWeight: 400,
              color: "#FFFFFF",
              opacity: 0.85,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </span>
        </div>
      )}

      {/* Foto con efecto duotone */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: SPACING.lg,
          marginBottom: 120,
        }}
      >
        <div
          style={{
            width: "90%",
            aspectRatio: "1/1",
            borderRadius: 16,
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Imagen base */}
          <img
            src={photoUrl}
            alt={title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              // Efecto duotone mediante filter
              filter: "grayscale(100%) contrast(1.2)",
            }}
          />
          {/* Overlay de color para efecto duotone */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: section.color,
              mixBlendMode: "multiply",
              opacity: 0.6,
            }}
          />
          {/* Overlay oscuro para profundidad */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background:
                "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.5) 100%)",
            }}
          />
        </div>
      </div>

      {/* Footer: Badge + Logo */}
      <div
        style={{
          position: "absolute",
          bottom: 48,
          left: PADDING,
          right: PADDING,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <BadgeSection
          text={section.name}
          bgColor={section.color}
          textColor="#FFFFFF"
          size="md"
        />
        <span
          style={{
            fontFamily: PRIMARY_FONT,
            fontSize: 24,
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
