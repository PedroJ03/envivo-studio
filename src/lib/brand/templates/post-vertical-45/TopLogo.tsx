// ============================================================================
// PostVertical45 - TopLogo Variant
// ============================================================================
//
// Layout:
// +------------------+
// |  envivo.         |  ← logo ARRIBA izq
// |                  |
// | [SECCIÓN]        |  ← badge
// |                  |
// | TÍTULO           |  ← Syne Bold
// | PRINCIPAL        |
// |                  |
// | +--------------+ |
// | |    [FOTO]    | |
// | |              | |
// | +--------------+ |
// +------------------+

import type { PostVertical45Props } from "../../types";
import { BadgeSection } from "../../components/BadgeSection";
import { Title } from "../../components/Title";
import { PhotoContainer } from "../../components/PhotoContainer";
import { LogoWatermark } from "../../components/LogoWatermark";
import { SPACING } from "../../config";

// Template dimensions
const WIDTH = 1080;
const HEIGHT = 1350;
const PADDING = 40;

export function TopLogo({
  section,
  title,
  photoUrl,
}: Omit<PostVertical45Props, "template" | "subtitle" | "date">) {
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
      {/* Logo at Top */}
      <div style={{ marginBottom: SPACING.lg }}>
        <LogoWatermark position="top-left" size="md" color="#000000" />
      </div>

      {/* Badge */}
      <div style={{ marginBottom: SPACING.lg }}>
        <BadgeSection text={section.name} bgColor={section.color} size="md" />
      </div>

      {/* Title */}
      <div style={{ marginBottom: SPACING.xl }}>
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
      <div style={{ width: "100%" }}>
        <PhotoContainer
          src={photoUrl}
          alt={title}
          roundedCorners="bottom"
          roundedSize={16}
          aspectRatio="4/3"
          objectFit="cover"
        />
      </div>
    </div>
  );
}
