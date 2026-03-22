// ============================================================================
// PostVertical45 - Classic Variant
// ============================================================================
//
// Layout:
// +------------------+
// | [SECCIÓN] [Fecha]|  ← Badge izq, fecha der
// |                  |
// | TÍTULO           |  ← Syne Bold, izq, 2-3 líneas
// | PRINCIPAL        |
// |                  |
// | +--------------+ |
// | |              | |
// | |    [FOTO]    | |  ← rounded bottom
// | |              | |
// | +--------------+ |
// |                  |
// | Subtítulo        |  ← opcional, color sección
// |                  |
// |           envivo.|  ← logo bottom-right
// +------------------+

import type { PostVertical45Props } from "../../types";
import { BadgeSection } from "../../components/BadgeSection";
import { Title } from "../../components/Title";
import { PhotoContainer } from "../../components/PhotoContainer";
import { LogoWatermark } from "../../components/LogoWatermark";
import { SPACING, PRIMARY_FONT } from "../../config";

// Template dimensions
const WIDTH = 1080;
const HEIGHT = 1350;
const PADDING = 40;

export function Classic({
  section,
  title,
  subtitle,
  photoUrl,
  date,
}: Omit<PostVertical45Props, "template">) {
  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: "#FFFFFF",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        padding: PADDING,
        boxSizing: "border-box",
      }}
    >
      {/* Header: Badge + Date */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: SPACING.lg,
        }}
      >
        <BadgeSection text={section.name} bgColor={section.color} size="md" />
        {date && (
          <span
            style={{
              fontFamily: PRIMARY_FONT,
              fontSize: 14,
              color: "#6B7280",
              fontWeight: 400,
            }}
          >
            {date}
          </span>
        )}
      </div>

      {/* Title */}
      <div style={{ display: "flex", marginBottom: SPACING.xl }}>
        <Title
          text={title}
          size="lg"
          color="#000000"
          align="left"
          weight="bold"
          maxLines={3}
        />
      </div>

      {/* Photo */}
      <div
        style={{
          display: "flex",
          flex: 1,
          marginBottom: subtitle ? SPACING.lg : 0,
        }}
      >
        <PhotoContainer
          src={photoUrl}
          alt={title}
          roundedCorners="bottom"
          roundedSize={16}
          aspectRatio="4/3"
          objectFit="cover"
        />
      </div>

      {/* Optional Subtitle */}
      {subtitle && (
        <div
          style={{
            display: "flex",
            marginTop: SPACING.md,
            marginBottom: SPACING.xl,
          }}
        >
          <span
            style={{
              fontFamily: PRIMARY_FONT,
              fontSize: 24,
              fontWeight: 400,
              color: section.color,
              lineHeight: 1.3,
            }}
          >
            {subtitle}
          </span>
        </div>
      )}

      {/* Logo */}
      <LogoWatermark position="bottom-right" size="md" color="#000000" />
    </div>
  );
}
