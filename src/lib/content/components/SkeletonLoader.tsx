// ============================================================================
// Content Approval Module - Skeleton Loader Component
// envivo-tandil / content-approval-brand-integration
// ============================================================================

import React from "react";

interface SkeletonLoaderProps {
  height?: number | string;
  width?: number | string;
}

export function SkeletonLoader({
  height = 400,
  width = "100%",
}: SkeletonLoaderProps) {
  return (
    <div
      style={{
        height,
        width,
        background:
          "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
        borderRadius: 8,
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </div>
  );
}
