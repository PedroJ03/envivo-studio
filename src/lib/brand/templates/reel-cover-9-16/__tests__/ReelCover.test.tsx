// ============================================================================
// ReelCover Tests
// ============================================================================

import { describe, it, expect } from "vitest";
import { Magazine, Duotone, Minimal, ReelCover } from "../ReelCover";
import type { BrandSection } from "../../../types";

// Mock section data
const mockSection: BrandSection = {
  id: "1",
  tenantId: "tenant-1",
  slug: "proximos-shows",
  name: "Próximos Shows",
  color: "#8B5CF6",
};

const mockProps = {
  section: mockSection,
  title: "Banda X en Vivo",
  subtitle: "Sábado 25 de Marzo",
  photoUrl: "https://example.com/photo.jpg",
};

describe("ReelCover Templates", () => {
  describe("Magazine", () => {
    it("should render without crashing", () => {
      const result = Magazine(mockProps);
      expect(result).toBeDefined();
      expect(result.type).toBe("div");
    });

    it("should use section color as background", () => {
      const result = Magazine(mockProps);
      expect(result.props.style.backgroundColor).toBe("#8B5CF6");
    });

    it("should render with correct dimensions", () => {
      const result = Magazine(mockProps);
      expect(result.props.style.width).toBe(1080);
      expect(result.props.style.height).toBe(1920);
    });
  });

  describe("Duotone", () => {
    it("should render without crashing", () => {
      const result = Duotone(mockProps);
      expect(result).toBeDefined();
      expect(result.type).toBe("div");
    });

    it("should have gradient background", () => {
      const result = Duotone(mockProps);
      expect(result.props.style.background).toContain("linear-gradient");
      expect(result.props.style.background).toContain("#8B5CF6");
    });

    it("should render with correct dimensions", () => {
      const result = Duotone(mockProps);
      expect(result.props.style.width).toBe(1080);
      expect(result.props.style.height).toBe(1920);
    });
  });

  describe("Minimal", () => {
    it("should render without crashing", () => {
      const result = Minimal(mockProps);
      expect(result).toBeDefined();
      expect(result.type).toBe("div");
    });

    it("should have black background", () => {
      const result = Minimal(mockProps);
      expect(result.props.style.backgroundColor).toBe("#000000");
    });

    it("should render with correct dimensions", () => {
      const result = Minimal(mockProps);
      expect(result.props.style.width).toBe(1080);
      expect(result.props.style.height).toBe(1920);
    });
  });

  describe("ReelCover (main component)", () => {
    it("should render Magazine by default", () => {
      const result = ReelCover({ ...mockProps, template: undefined });
      expect(result).toBeDefined();
    });

    it("should render Magazine variant", () => {
      const result = ReelCover({ ...mockProps, template: "magazine" });
      expect(result).toBeDefined();
    });

    it("should render Duotone variant", () => {
      const result = ReelCover({ ...mockProps, template: "duotone" });
      expect(result).toBeDefined();
    });

    it("should render Minimal variant", () => {
      const result = ReelCover({ ...mockProps, template: "minimal" });
      expect(result).toBeDefined();
    });
  });
});
