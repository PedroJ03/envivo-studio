// ============================================================================
// PostVertical45 - Minimal Variant
// ============================================================================
//
// Layout:
// +------------------+
// |                  |
// | TÍTULO           |  ← máximo impacto, letra enorme
// |                  |
// | +--------------+ |
// | |              | |
// | |    [FOTO]    | |
// | |              | |
// | +--------------+ |
// | [SECCIÓN]  envivo.|  ← badge izq, logo der
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

export function Minimal({
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
      {/* Large Title - Maximum Impact */}
      <div
        style={{
          display: "flex",
          marginTop: SPACING.xxl,
          marginBottom: SPACING.xxl,
          flexShrink: 0,
        }}
      >
        <Title
          text={title}
          size="xl"
          color="#000000"
          align="left"
          weight="black"
          maxLines={3}
        />
      </div>

      {/* Photo */}
      <div
        style={{
          display: "flex",
          width: "100%",
          flex: 1,
          minHeight: 0,
          marginBottom: SPACING.lg,
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

      {/* Footer: Badge Left + Logo Right */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "auto",
        }}
      >
        <BadgeSection text={section.name} bgColor={section.color} size="md" />
        <LogoWatermark position="bottom-right" size="sm" color="#000000" />
      </div>
    </div>
  );
}
