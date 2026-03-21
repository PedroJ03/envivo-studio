// ============================================================================
// PostVertical45 - Centered Variant
// ============================================================================
//
// Layout:
// +------------------+
// |      [SECCIÓN]   |  ← badge centrado arriba
// |                  |
// |                  |
// |   TÍTULO EN      |  ← Syne Bold, centrado
// |   MEDIO          |
// |                  |
// | +--------------+ |
// | |              | |
// | |    [FOTO]    | |
// | |              | |
// | +--------------+ |
// |                  |
// |           envivo.|
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

export function Centered({
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
        alignItems: "center",
        padding: PADDING,
        boxSizing: "border-box",
      }}
    >
      {/* Centered Badge */}
      <div style={{ marginBottom: SPACING.xxl }}>
        <BadgeSection text={section.name} bgColor={section.color} size="md" />
      </div>

      {/* Spacer for vertical balance */}
      <div style={{ flex: 0.5 }} />

      {/* Centered Title */}
      <div
        style={{
          marginBottom: SPACING.xxl,
          textAlign: "center",
          width: "100%",
        }}
      >
        <Title
          text={title}
          size="lg"
          color="#000000"
          align="center"
          weight="bold"
          maxLines={3}
        />
      </div>

      {/* Photo */}
      <div style={{ width: "100%", marginBottom: SPACING.lg }}>
        <PhotoContainer
          src={photoUrl}
          alt={title}
          roundedCorners="bottom"
          roundedSize={16}
          aspectRatio="4/3"
          objectFit="cover"
        />
      </div>

      {/* Logo */}
      <LogoWatermark position="bottom-right" size="md" color="#000000" />
    </div>
  );
}
