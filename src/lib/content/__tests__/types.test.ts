import { describe, it, expect } from "vitest";
import type {
  TemplateVariant,
  BrandPreviewProps,
  SaveTemplateRequest,
} from "../types";

describe("types", () => {
  describe("TemplateVariant", () => {
    it("accepts valid variants", () => {
      const variants: TemplateVariant[] = [
        "classic",
        "minimal",
        "centered",
        "toplogo",
        "fullbleed",
        "split",
        "magazine",
        "duotone",
      ];

      variants.forEach((variant) => {
        expect(variant).toBe(variant);
      });
    });
  });

  describe("BrandPreviewProps", () => {
    it("accepts valid props", () => {
      const props: BrandPreviewProps = {
        candidateId: "123",
        title: "Test Title",
        sectionSlug: "proximos-shows",
        sectionName: "Próximos Shows",
        sectionColor: "#8B5CF6",
        templateId: "post-vertical-45",
        templateVariant: "classic",
      };

      expect(props.candidateId).toBe("123");
      expect(props.title).toBe("Test Title");
    });
  });
});
