import { describe, expect, it } from "vitest";
import { Split } from "../Split";
import type { BrandSection } from "../../../types";

const mockSection: BrandSection = {
  id: "1",
  tenantId: "test",
  slug: "noticias",
  name: "Noticias",
  color: "#06B6D4",
};

describe("Story9:16 - Split", () => {
  it("renders without errors", () => {
    const result = Split({
      section: mockSection,
      title: "Test Title",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
    expect(result.props.style.width).toBe(1080);
    expect(result.props.style.height).toBe(1920);
  });

  it("renders with required props", () => {
    const result = Split({
      section: mockSection,
      title: "Nueva Noticia",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
  });

  it("renders with date", () => {
    const result = Split({
      section: mockSection,
      title: "Nueva Noticia",
      photoUrl: "https://example.com/photo.jpg",
      date: "21 Mar 2025",
    });

    expect(result).toBeDefined();
  });

  it("renders with subtitle", () => {
    const result = Split({
      section: mockSection,
      title: "Nueva Noticia",
      photoUrl: "https://example.com/photo.jpg",
      subtitle: "Información importante",
    });

    expect(result).toBeDefined();
  });

  it("uses section color for top half background", () => {
    const result = Split({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    // Split layout divides height in half
    const topHalf = result.props.children[0];
    expect(topHalf.props.style.backgroundColor).toBe("#06B6D4");
    expect(topHalf.props.style.height).toBe(960); // 1920 / 2
  });

  it("renders photo in bottom half", () => {
    const result = Split({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    const bottomHalf = result.props.children[1];
    expect(bottomHalf.props.style.height).toBe(960);
    expect(bottomHalf.props.style.overflow).toBe("hidden");
  });

  it("applies flex column layout", () => {
    const result = Split({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result.props.style.display).toBe("flex");
    expect(result.props.style.flexDirection).toBe("column");
  });

  it("handles different sections", () => {
    const greenSection: BrandSection = {
      ...mockSection,
      slug: "bandas-locales",
      name: "Bandas Locales",
      color: "#10B981",
    };

    const result = Split({
      section: greenSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    const topHalf = result.props.children[0];
    expect(topHalf.props.style.backgroundColor).toBe("#10B981");
  });
});
