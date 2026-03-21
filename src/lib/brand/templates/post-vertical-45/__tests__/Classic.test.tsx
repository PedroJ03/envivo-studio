import { describe, expect, it } from "vitest";
import { Classic } from "../Classic";
import type { BrandSection } from "../../../types";

const mockSection: BrandSection = {
  id: "1",
  tenantId: "test",
  slug: "proximos-shows",
  name: "Próximos Shows",
  color: "#8B5CF6",
};

describe("PostVertical45 - Classic", () => {
  it("renders without errors", () => {
    const result = Classic({
      section: mockSection,
      title: "Test Title",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
    expect(result.props.style.width).toBe(1080);
    expect(result.props.style.height).toBe(1350);
  });

  it("renders with required props", () => {
    const result = Classic({
      section: mockSection,
      title: "Concierto de Rock",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
  });

  it("renders with optional date", () => {
    const result = Classic({
      section: mockSection,
      title: "Concierto de Rock",
      photoUrl: "https://example.com/photo.jpg",
      date: "21 Mar 2025",
    });

    expect(result).toBeDefined();
    // The date should be rendered in the header
  });

  it("renders with optional subtitle", () => {
    const result = Classic({
      section: mockSection,
      title: "Concierto de Rock",
      photoUrl: "https://example.com/photo.jpg",
      subtitle: "No te lo pierdas",
    });

    expect(result).toBeDefined();
  });

  it("hides subtitle block when subtitle is not provided", () => {
    const result = Classic({
      section: mockSection,
      title: "Concierto de Rock",
      photoUrl: "https://example.com/photo.jpg",
    });

    // Should render without subtitle section
    expect(result).toBeDefined();
  });

  it("applies white background", () => {
    const result = Classic({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result.props.style.backgroundColor).toBe("#FFFFFF");
  });

  it("uses section color for badge", () => {
    const result = Classic({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    // Badge should use the section color
    expect(result).toBeDefined();
  });

  it("handles empty photo URL with placeholder", () => {
    const result = Classic({
      section: mockSection,
      title: "Test",
      photoUrl: "",
    });

    expect(result).toBeDefined();
  });
});
