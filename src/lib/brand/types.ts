// ============================================================================
// Brand System Types - filo-news-brand-system
// ============================================================================

// Sección de contenido (editorial category)
export interface BrandSection {
  id: string;
  tenantId: string;
  slug: BrandSectionSlug;
  name: string;
  color: string; // HEX format #RRGGBB
  createdAt?: Date;
  updatedAt?: Date;
}

export type BrandSectionSlug =
  | "proximos-shows"
  | "efemerides"
  | "noticias"
  | "bandas-locales";

// Brand config por tenant
export interface BrandConfig {
  id: string;
  tenantId: string;
  primaryFont: string; // 'Syne'
  logoSvg: string; // SVG inline
  customColors?: Record<BrandSectionSlug, string>; // Override de colores por sección
  createdAt?: Date;
  updatedAt?: Date;
}

// Template variant
export interface TemplateVariant {
  id: string; // 'post-vertical-45-classic'
  name: string; // 'Classic'
  format: TemplateFormat;
}

export type TemplateFormat =
  | "post-vertical-45"
  | "post-square-11"
  | "story-9-16"
  | "reel-cover-9-16";

// Compose input - contexto para renderizar un template
export interface ComposeInput {
  contentId: string;
  templateId: string;
  sectionId?: string;
  sectionSlug?: BrandSectionSlug;
  sectionColor?: string;
  templateVariant?: TemplateVariant;
  overrides?: {
    title?: string;
    subtitle?: string;
    photoUrl?: string;
  };
}

// Brand render context - input al sistema de brand
export interface BrandRenderContext {
  // Core data
  title: string;
  subtitle?: string;
  photoUrl: string;

  // Brand extensions
  sectionId?: string;
  sectionSlug?: BrandSectionSlug;
  sectionColor?: string; // HEX: #8B5CF6
  templateVariant: TemplateFormat;

  // Optional overrides
  badgeText?: string;
  overlayOpacity?: number;
}

// Componente props - BadgeSection
export interface BadgeSectionProps {
  text: string;
  bgColor: string;
  textColor?: string;
  /** When provided and textColor is not set, automatically calculates optimal text color for WCAG AA contrast */
  sectionSlug?: BrandSectionSlug;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Componente props - Title
export interface TitleProps {
  text: string;
  color?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  weight?: "bold" | "black";
  align?: "left" | "center" | "right";
  maxLines?: number;
  className?: string;
}

// Componente props - PhotoContainer
export interface PhotoContainerProps {
  src: string;
  alt?: string;
  roundedCorners?: "all" | "bottom" | "none";
  roundedSize?: number;
  aspectRatio?: string;
  objectFit?: "cover" | "contain";
  className?: string;
}

// Componente props - LogoWatermark
export interface LogoWatermarkProps {
  variant?: "horizontal" | "vertical";
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
  size?: "sm" | "md" | "lg";
  color?: string;
  className?: string;
}

export type TemplateSize = { width: number; height: number };

// Template variants for Post Vertical 4:5
export type PostVertical45Variant =
  | "classic"
  | "centered"
  | "toplogo"
  | "minimal";

// Props for Post Vertical 4:5 templates
export interface PostVertical45Props {
  section: BrandSection;
  title: string;
  subtitle?: string;
  photoUrl: string;
  date?: string;
  template?: PostVertical45Variant;
}

// Template variants for Reel Cover 9:16
export type ReelCoverVariant = "magazine" | "duotone" | "minimal";

// Props for Reel Cover 9:16 templates
export interface ReelCoverProps {
  section: BrandSection;
  title: string;
  subtitle?: string;
  photoUrl: string;
  template?: ReelCoverVariant;
}

// Template variants for Story 9:16
export type StoryVariant = "fullbleed" | "split" | "minimal";

// Props for Story 9:16 templates
export interface StoryProps {
  section: BrandSection;
  title: string;
  subtitle?: string;
  photoUrl: string;
  date?: string;
  template?: StoryVariant;
}

// Template variants for Post Square 1:1
export type PostSquare11Variant = "classic" | "centered" | "minimal";

// Props for Post Square 1:1 templates
export interface PostSquare11Props {
  section: BrandSection;
  title: string;
  subtitle?: string;
  photoUrl: string;
  date?: string;
  template?: PostSquare11Variant;
}
