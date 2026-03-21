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

describe("Story9:16 - Minimal", () => {
  it("renders without errors", () => {
    const result = Minimal({
      section: mockSection,
      title: "Test Title",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
    expect(result.props.style.width).toBe(1080);
    expect(result.props.style.height).toBe(1920);
  });

  it("renders with required props", () => {
    const result = Minimal({
      section: mockSection,
      title: "Banda Local Destacada",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
  });

  it("renders with subtitle", () => {
    const result = Minimal({
      section: mockSection,
      title: "Banda Local Destacada",
      photoUrl: "https://example.com/photo.jpg",
      subtitle: "Conoce su historia",
    });

    expect(result).toBeDefined();
  });

  it("renders photo as full bleed background", () => {
    const result = Minimal({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    // Photo should be the first child (absolute positioned)
    const photo = result.props.children[0];
    expect(photo.props.style.position).toBe("absolute");
    expect(photo.props.style.objectFit).toBe("cover");
    expect(photo.props.style.width).toBe("100%");
    expect(photo.props.style.height).toBe("100%");
  });

  it("applies dark overlay gradient", () => {
    const result = Minimal({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    const overlay = result.props.children[1];
    expect(overlay.props.style.position).toBe("absolute");
    expect(overlay.props.style.background).toContain("linear-gradient");
  });

  it("positions content at bottom", () => {
    const result = Minimal({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    const contentOverlay = result.props.children[2];
    expect(contentOverlay.props.style.position).toBe("absolute");
    expect(contentOverlay.props.style.bottom).toBe(0);
  });

  it("handles different section colors", () => {
    const purpleSection: BrandSection = {
      ...mockSection,
      slug: "proximos-shows",
      name: "Próximos Shows",
      color: "#8B5CF6",
    };

    const result = Minimal({
      section: purpleSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
  });

  it("applies overflow hidden to container", () => {
    const result = Minimal({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result.props.style.overflow).toBe("hidden");
  });
});
