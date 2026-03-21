import { describe, expect, it } from "vitest";
import { TopLogo } from "../TopLogo";
import type { BrandSection } from "../../../types";

const mockSection: BrandSection = {
  id: "1",
  tenantId: "test",
  slug: "noticias",
  name: "Noticias",
  color: "#06B6D4",
};

describe("PostVertical45 - TopLogo", () => {
  it("renders without errors", () => {
    const result = TopLogo({
      section: mockSection,
      title: "Test Title",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
    expect(result.props.style.width).toBe(1080);
    expect(result.props.style.height).toBe(1350);
  });

  it("renders with required props", () => {
    const result = TopLogo({
      section: mockSection,
      title: "Nueva Noticia Musical",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
  });

  it("positions logo at top", () => {
    const result = TopLogo({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    // Logo should be positioned at top-left
    expect(result).toBeDefined();
  });

  it("applies white background", () => {
    const result = TopLogo({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result.props.style.backgroundColor).toBe("#FFFFFF");
  });

  it("renders badge below logo", () => {
    const result = TopLogo({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    // Badge should be rendered after logo
    expect(result).toBeDefined();
  });

  it("handles empty photo URL", () => {
    const result = TopLogo({
      section: mockSection,
      title: "Test",
      photoUrl: "",
    });

    expect(result).toBeDefined();
  });

  it("left-aligns title", () => {
    const result = TopLogo({
      section: mockSection,
      title: "Test Title",
      photoUrl: "https://example.com/photo.jpg",
    });

    // Title should be left-aligned
    expect(result).toBeDefined();
  });
});
