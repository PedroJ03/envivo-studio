// ============================================================================
// Content Approval Module - Brand Preview Component
// envivo-tandil / content-approval-brand-integration
// ============================================================================

"use client";

import React, { useEffect, useState } from "react";
import type { BrandPreviewProps } from "../types";
import { SkeletonLoader } from "./SkeletonLoader";
import { TemplateVariantSelector } from "./TemplateVariantSelector";

export function BrandPreview({
  candidateId,
  title,
  subtitle,
  photoUrl,
  date,
  sectionSlug,
  sectionName,
  sectionColor,
  templateId,
  templateVariant: initialVariant,
  caption,
  hashtags = [],
}: BrandPreviewProps) {
  const [selectedVariant, setSelectedVariant] = useState(initialVariant);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isImageGenerated, setIsImageGenerated] = useState(false);

  // Handler for variant change - updates state and triggers re-fetch
  const handleVariantChange = (variant: typeof initialVariant) => {
    setSelectedVariant(variant);
  };

  useEffect(() => {
    async function fetchPreview() {
      try {
        setLoading(true);
        setError(null);
        // Pass variant as query param for live preview
        const url = `/api/preview/${candidateId}?variant=${selectedVariant}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to load preview");
        const svg = await response.text();
        setImageUrl(`data:image/svg+xml;base64,${btoa(svg)}`);
      } catch (err) {
        setError("Failed to load preview");
      } finally {
        setLoading(false);
      }
    }

    fetchPreview();
  }, [candidateId, selectedVariant]);

  return (
    <div className="space-y-4">
      {/* Preview Area */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden">
        {loading ? (
          <SkeletonLoader height={400} />
        ) : error ? (
          <div
            className="aspect-square flex items-center justify-center"
            style={{ backgroundColor: `${sectionColor}20` }}
          >
            <div className="text-center p-8">
              <p className="text-red-500 mb-2">{error}</p>
              <p className="text-sm text-gray-500">Showing fallback preview</p>
              <div className="mt-4">
                <div
                  className="inline-block px-3 py-1 rounded-full text-sm font-medium mb-4"
                  style={{ backgroundColor: sectionColor, color: "white" }}
                >
                  {sectionName}
                </div>
                <h3 className="text-xl font-bold mb-2">{title}</h3>
                {subtitle && <p className="text-gray-600 mb-2">{subtitle}</p>}
                {date && <p className="text-sm text-gray-500">{date}</p>}
              </div>
            </div>
          </div>
        ) : imageUrl ? (
          <img src={imageUrl} alt="Brand preview" className="w-full h-auto" />
        ) : null}

        {/* Overlay con controles cuando hover */}
        <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity">
          <TemplateVariantSelector
            currentVariant={selectedVariant}
            onVariantChange={handleVariantChange}
          />
        </div>
      </div>

      {/* Caption Area */}
      {caption && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-700 mb-2">{caption}</p>
          <div className="flex flex-wrap gap-1">
            {hashtags.map((tag) => (
              <span key={tag} className="text-xs text-primary">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsImageGenerated(true)}
          className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          {isImageGenerated ? "Imagen Generada" : "Generar Imagen"}
        </button>
      </div>
    </div>
  );
}
