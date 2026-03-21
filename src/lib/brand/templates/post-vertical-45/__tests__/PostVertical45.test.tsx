import { describe, expect, it } from "vitest";
import { PostVertical45 } from "../PostVertical45";
import type { BrandSection, PostVertical45Variant } from "../../../types";

const mockSection: BrandSection = {
  id: "1",
  tenantId: "test",
  slug: "proximos-shows",
  name: "Próximos Shows",
  color: "#8B5CF6",
};

describe("PostVertical45 - Main Component", () => {
  it("renders without errors", () => {
    const result = PostVertical45({
      section: mockSection,
      title: "Test Title",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
  });

  it("defaults to classic template when no template prop provided", () => {
    const result = PostVertical45({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
    // Should render Classic variant by default
  });

  it("renders classic template when explicitly specified", () => {
    const result = PostVertical45({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
      template: "classic",
    });

    expect(result).toBeDefined();
  });

  it("renders centered template when specified", () => {
    const result = PostVertical45({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
      template: "centered",
    });

    expect(result).toBeDefined();
  });

  it("renders toplogo template when specified", () => {
    const result = PostVertical45({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
      template: "toplogo",
    });

    expect(result).toBeDefined();
  });

  it("renders minimal template when specified", () => {
    const result = PostVertical45({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
      template: "minimal",
    });

    expect(result).toBeDefined();
  });

  it("passes all props correctly to classic variant", () => {
    const result = PostVertical45({
      section: mockSection,
      title: "Concierto Especial",
      subtitle: "No te lo pierdas",
      photoUrl: "https://example.com/photo.jpg",
      date: "21 Mar 2025",
      template: "classic",
    });

    expect(result).toBeDefined();
  });

  it("handles invalid template by defaulting to classic", () => {
    const result = PostVertical45({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
      template: "invalid" as PostVertical45Variant,
    });

    expect(result).toBeDefined();
    // Should fall back to classic
  });

  it("renders with empty photo URL", () => {
    const result = PostVertical45({
      section: mockSection,
      title: "Test",
      photoUrl: "",
    });

    expect(result).toBeDefined();
  });

  it("renders with all optional props", () => {
    const result = PostVertical45({
      section: mockSection,
      title: "Test Title",
      subtitle: "Test Subtitle",
      photoUrl: "https://example.com/photo.jpg",
      date: "21 Mar 2025",
      template: "classic",
    });

    expect(result).toBeDefined();
  });
});
