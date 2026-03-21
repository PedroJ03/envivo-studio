// ============================================================================
// PostVertical45 - Main Export File
// ============================================================================
//
// Exporta todos los variantes de Post Vertical 4:5 (1080x1350)
//
// Variants:
// - Classic: Badge izq + fecha der, título izq, logo bottom-right
// - Centered: Badge centrado arriba, título centrado
// - TopLogo: Logo arriba izq, badge, título, foto
// - Minimal: Título enorme, badge + logo en bottom

import type { PostVertical45Props } from "../../types";
import { Classic } from "./Classic";
import { Centered } from "./Centered";
import { TopLogo } from "./TopLogo";
import { Minimal } from "./Minimal";

// Re-exportar variantes individuales
export { Classic };
export { Centered };
export { TopLogo };
export { Minimal };

// Componente principal que selecciona el template según prop
export function PostVertical45({
  section,
  title,
  subtitle,
  photoUrl,
  date,
  template = "classic",
}: PostVertical45Props) {
  switch (template) {
    case "centered":
      return <Centered section={section} title={title} photoUrl={photoUrl} />;
    case "toplogo":
      return <TopLogo section={section} title={title} photoUrl={photoUrl} />;
    case "minimal":
      return <Minimal section={section} title={title} photoUrl={photoUrl} />;
    case "classic":
    default:
      return (
        <Classic
          section={section}
          title={title}
          subtitle={subtitle}
          photoUrl={photoUrl}
          date={date}
        />
      );
  }
}

// Export default para facilitar imports
export default PostVertical45;
