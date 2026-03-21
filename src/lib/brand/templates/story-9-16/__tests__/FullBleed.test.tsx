import { describe, expect, it } from "vitest";
import { FullBleed } from "../FullBleed";
import type { BrandSection } from "../../../types";

const mockSection: BrandSection = {
  id: "1",
  tenantId: "test",
  slug: "proximos-shows",
  name: "Próximos Shows",
  color: "#8B5CF6",
};

describe("Story9:16 - FullBleed", () => {
  it("renders without errors", () => {
    const result = FullBleed({
      section: mockSection,
      title: "Test Title",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
    expect(result.props.style.width).toBe(1080);
    expect(result.props.style.height).toBe(1920);
  });

  it("renders with required props", () => {
    const result = FullBleed({
      section: mockSection,
      title: "Concierto de Rock",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
  });

  it("renders with optional subtitle", () => {
    const result = FullBleed({
      section: mockSection,
      title: "Concierto de Rock",
      photoUrl: "https://example.com/photo.jpg",
      subtitle: "No te lo pierdas",
    });

    expect(result).toBeDefined();
  });

  it("renders with optional date", () => {
    const result = FullBleed({
      section: mockSection,
      title: "Concierto de Rock",
      photoUrl: "https://example.com/photo.jpg",
      date: "21 Mar 2025",
    });

    expect(result).toBeDefined();
  });

  it("uses section color for background", () => {
    const result = FullBleed({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    // Background should be a gradient starting with section color
    expect(result.props.style.background).toContain("#8B5CF6");
  });

  it("applies correct flex layout", () => {
    const result = FullBleed({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result.props.style.display).toBe("flex");
    expect(result.props.style.flexDirection).toBe("column");
  });

  it("handles different section colors", () => {
    const redSection: BrandSection = {
      ...mockSection,
      slug: "efemerides",
      name: "Efemérides",
      color: "#F59E0B",
    };

    const result = FullBleed({
      section: redSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result.props.style.background).toContain("#F59E0B");
  });
});
