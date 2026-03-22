// ============================================================================
// Content Approval Module - Brand Preview Lazy Wrapper
// envivo-tandil / content-approval-brand-integration
// ============================================================================

"use client";

import dynamic from "next/dynamic";
import React from "react";
import type { BrandPreviewProps } from "../types";
import { SkeletonLoader } from "./SkeletonLoader";

// Dynamic import con ssr:false para evitar hydration mismatch
const BrandPreview = dynamic(
  () => import("./BrandPreview").then((mod) => mod.BrandPreview),
  {
    ssr: false,
    loading: () => <SkeletonLoader height={400} />,
  },
);

interface BrandPreviewLazyProps extends BrandPreviewProps {
  fallback?: React.ReactNode;
}

export function BrandPreviewLazy(props: BrandPreviewLazyProps) {
  return <BrandPreview {...props} />;
}
