// ============================================================================
// Content Approval Module - Public API
// envivo-tandil / content-approval-brand-integration
// ============================================================================

// Types
export * from "./types";

// Components
export { BrandPreviewLazy } from "./components/BrandPreviewLazy";
export { BrandPreview } from "./components/BrandPreview";
export { TemplateVariantSelector } from "./components/TemplateVariantSelector";
export { SkeletonLoader } from "./components/SkeletonLoader";

// NOTE: Server-side queries (getCandidateContentData) are NOT exported here
// to avoid bundling Node.js modules (drizzle/postgres) into client components.
// Import directly from "@/lib/content/queries" in server components only.
