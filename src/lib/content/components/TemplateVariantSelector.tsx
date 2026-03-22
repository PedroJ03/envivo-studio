// ============================================================================
// Content Approval Module - Template Variant Selector Component
// envivo-tandil / content-approval-brand-integration
// ============================================================================

"use client";

import React from "react";
import type { TemplateVariant } from "../types";

interface TemplateVariantSelectorProps {
  currentVariant: TemplateVariant;
  onVariantChange: (variant: TemplateVariant) => void;
  availableVariants?: TemplateVariant[];
}

const VARIANT_LABELS: Record<
  TemplateVariant,
  { name: string; description: string }
> = {
  classic: {
    name: "Classic",
    description: "Diseño tradicional con badge de sección",
  },
  minimal: {
    name: "Minimal",
    description: "Texto sobre fondo con logo pequeño",
  },
  centered: {
    name: "Centered",
    description: "Todo centrado con tipografía grande",
  },
  toplogo: {
    name: "Top Logo",
    description: "Logo en la parte superior",
  },
  fullbleed: {
    name: "Full Bleed",
    description: "Imagen de fondo con overlay",
  },
  split: {
    name: "Split",
    description: "Mitad imagen, mitad texto",
  },
  magazine: {
    name: "Magazine",
    description: "Estilo revista con múltiples elementos",
  },
  duotone: {
    name: "Duotone",
    description: "Dos tonos de color",
  },
};

const DEFAULT_VARIANTS: TemplateVariant[] = ["classic", "minimal", "centered"];

export function TemplateVariantSelector({
  currentVariant,
  onVariantChange,
  availableVariants = DEFAULT_VARIANTS,
}: TemplateVariantSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {availableVariants.map((variant) => {
        const { name, description } = VARIANT_LABELS[variant];
        const isSelected = variant === currentVariant;

        return (
          <button
            key={variant}
            onClick={() => onVariantChange(variant)}
            className={`
              px-4 py-2 rounded-lg border-2 transition-all
              ${
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-gray-200 hover:border-gray-300"
              }
            `}
            title={description}
          >
            <span className="font-medium">{name}</span>
          </button>
        );
      })}
    </div>
  );
}
