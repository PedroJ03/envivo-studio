// ============================================================================
// ReelCover9-16 - Main Export
// ============================================================================
//
// Reel Cover templates para Instagram Reels (9:16 aspect ratio).
// Estas son las "tapas" que se muestran antes de que empiece el video.
//
// Variants:
// - magazine: Estilo tapa de revista, color sólido, título enorme
// - duotone: Efecto duotono con gradiente y foto tratada
// - minimal: Foto full bleed con barra negra inferior
//
// Usage:
//   import { ReelCover } from "./ReelCover";
//   <ReelCover.Magazine section={section} title="..." photoUrl="..." />

import type { ReelCoverProps } from "../../types";
import { Magazine } from "./Magazine";
import { Duotone } from "./Duotone";
import { Minimal } from "./Minimal";

// Re-export individual components
export { Magazine } from "./Magazine";
export { Duotone } from "./Duotone";
export { Minimal } from "./Minimal";

// Main component that switches by template prop
export function ReelCover({
  section,
  title,
  subtitle,
  photoUrl,
  template = "magazine",
}: ReelCoverProps) {
  const props = { section, title, subtitle, photoUrl };

  switch (template) {
    case "magazine":
      return <Magazine {...props} />;
    case "duotone":
      return <Duotone {...props} />;
    case "minimal":
      return <Minimal {...props} />;
    default:
      return <Magazine {...props} />;
  }
}
