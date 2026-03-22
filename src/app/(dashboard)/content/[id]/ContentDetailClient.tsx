"use client";

import React, { useState, useCallback } from "react";
import { BrandPreviewLazy } from "@/lib/content";
import { TemplateVariantSelector } from "@/lib/content";
import type {
  CandidateContentData,
  TemplateVariant,
} from "@/lib/content/types";

interface ContentDetailClientProps {
  candidate: CandidateContentData;
}

export function ContentDetailClient({ candidate }: ContentDetailClientProps) {
  const [selectedVariant, setSelectedVariant] = useState<TemplateVariant>(
    candidate.templateVariant || "classic",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Save template variant
  const handleVariantChange = useCallback(
    async (variant: TemplateVariant) => {
      setSelectedVariant(variant);
      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(`/api/content/${candidate.id}/brand`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateVariant: variant }),
        });

        if (!response.ok) {
          throw new Error("Failed to save template variant");
        }
      } catch (err) {
        setError("Failed to save. Please try again.");
        setSelectedVariant(candidate.templateVariant || "classic");
      } finally {
        setIsSaving(false);
      }
    },
    [candidate.id, candidate.templateVariant],
  );

  // Generate image
  const handleGenerateImage = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/content/${candidate.id}/generate-image`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to generate image");
      }

      const data = await response.json();

      if (data.status === "pending") {
        // Image generation queued - in real app, poll for completion
        alert("Image generation started. You'll be notified when ready.");
      }
    } catch (err) {
      setError("Failed to generate image. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [candidate.id]);

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Brand Preview */}
      <BrandPreviewLazy
        candidateId={candidate.id}
        title={candidate.title}
        subtitle={candidate.subtitle}
        photoUrl={candidate.photoUrl}
        date={candidate.date}
        sectionSlug={candidate.sectionSlug}
        sectionName={candidate.sectionName}
        sectionColor={candidate.sectionColor}
        templateId={candidate.templateId}
        templateVariant={selectedVariant}
        caption={candidate.caption}
        hashtags={candidate.hashtags}
      />

      {/* Template Variant Selector */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Template Variant
          {isSaving && <span className="ml-2 text-gray-400">(Saving...)</span>}
        </h3>
        <TemplateVariantSelector
          currentVariant={selectedVariant}
          onVariantChange={handleVariantChange}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={handleGenerateImage}
          disabled={isGenerating}
          className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isGenerating ? "Generando..." : "Generar Imagen"}
        </button>
      </div>
    </div>
  );
}
