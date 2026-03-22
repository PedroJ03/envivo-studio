// ============================================================================
// PhotoContainer Component
// ============================================================================
//
// Contenedor de foto con border-radius configurable.
// Diseñado para uso en Satori (React JSX sin browser APIs).
//
// Usage:
//   <PhotoContainer
//     src="https://example.com/photo.jpg"
//     alt="Banda tocando en vivo"
//     roundedCorners="all"
//     roundedSize={16}
//     aspectRatio="4/3"
//     objectFit="cover"
//   />

import type { PhotoContainerProps } from "../types";
import { PRIMARY_FONT } from "../config";

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function PhotoContainer({
  src,
  alt = "",
  roundedCorners = "all",
  roundedSize = 16,
  aspectRatio = "4/3",
  objectFit = "cover",
  className,
}: PhotoContainerProps) {
  // Calculate border radius based on roundedCorners setting
  const getBorderRadius = (): string => {
    switch (roundedCorners) {
      case "all":
        return `${roundedSize}px`;
      case "bottom":
        return `0 0 ${roundedSize}px ${roundedSize}px`;
      case "none":
      default:
        return "0";
    }
  };

  // Parse aspect ratio to calculate height
  const [w, h] = aspectRatio.split("/").map(Number);
  const calculatedHeight = h && w ? `${(h / w) * 100}%` : "75%";

  // Container style
  const containerStyle: React.CSSProperties = {
    display: "flex",
    position: "relative",
    width: "100%",
    height: calculatedHeight,
    overflow: "hidden",
    borderRadius: getBorderRadius(),
  };

  // Image style
  const imageStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: objectFit,
  };

  // Placeholder style (shown when src is empty)
  const placeholderStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB", // gray-200
    color: "#6B7280", // gray-500
    fontFamily: PRIMARY_FONT,
    fontSize: 14,
  };

  // If no src, render placeholder
  if (!src || src.trim() === "") {
    return (
      <div className={className} style={containerStyle}>
        <div style={placeholderStyle}>Sin imagen</div>
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      <img src={src} alt={alt} style={imageStyle} />
    </div>
  );
}
