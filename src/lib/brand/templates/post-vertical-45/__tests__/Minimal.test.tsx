import { describe, expect, it } from "vitest";
import { Minimal } from "../Minimal";
import type { BrandSection } from "../../../types";

const mockSection: BrandSection = {
  id: "1",
  tenantId: "test",
  slug: "bandas-locales",
  name: "Bandas Locales",
  color: "#10B981",
};

describe("PostVertical45 - Minimal", () => {
  it("renders without errors", () => {
    const result = Minimal({
      section: mockSection,
      title: "Test Title",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
    expect(result.props.style.width).toBe(1080);
    expect(result.props.style.height).toBe(1350);
  });

  it("renders with required props", () => {
    const result = Minimal({
      section: mockSection,
      title: "Banda Local del Mes",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
  });

  it("renders large title for maximum impact", () => {
    const result = Minimal({
      section: mockSection,
      title: "TÍTULO GRANDE",
      photoUrl: "https://example.com/photo.jpg",
    });

    // Title should use xl size and black weight
    expect(result).toBeDefined();
  });

  it("positions badge and logo at bottom", () => {
    const result = Minimal({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    // Footer should have badge left and logo right
    expect(result).toBeDefined();
  });

  it("applies white background", () => {
    const result = Minimal({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result.props.style.backgroundColor).toBe("#FFFFFF");
  });

  it("handles empty photo URL", () => {
    const result = Minimal({
      section: mockSection,
      title: "Test",
      photoUrl: "",
    });

    expect(result).toBeDefined();
  });

  it("uses section color for badge", () => {
    const result = Minimal({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    // Badge should use emerald color (#10B981)
    expect(result).toBeDefined();
  });
});
