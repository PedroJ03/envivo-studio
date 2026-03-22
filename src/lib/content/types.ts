// ============================================================================
// Content Approval Module - Types
// envivo-tandil / content-approval-brand-integration
// ============================================================================

// Template variants para content approval
export type TemplateVariant =
  | "classic"
  | "minimal"
  | "centered"
  | "toplogo"
  | "fullbleed"
  | "split"
  | "magazine"
  | "duotone";

export interface BrandPreviewProps {
  candidateId: string;
  title: string;
  subtitle?: string;
  photoUrl?: string;
  date?: string;
  sectionSlug: string;
  sectionName: string;
  sectionColor: string;
  templateId: string;
  templateVariant: TemplateVariant;
  caption?: string;
  hashtags?: string[];
}

export interface TemplateOption {
  id: TemplateVariant;
  name: string;
  description: string;
}

export interface SaveTemplateRequest {
  templateVariant: TemplateVariant;
}

export interface SaveTemplateResponse {
  success: boolean;
  candidateId: string;
  templateVariant: TemplateVariant;
}

export interface GenerateImageResponse {
  imageUrl?: string;
  status: "generated" | "pending";
  candidateId: string;
}

export interface CandidateContentData {
  id: string;
  title: string;
  subtitle?: string;
  photoUrl?: string;
  date?: string;
  sectionSlug: string;
  sectionName: string;
  sectionColor: string;
  templateId: string;
  templateVariant: TemplateVariant;
  caption?: string;
  hashtags?: string[];
  status: string;
}
