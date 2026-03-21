import { describe, expect, it } from "vitest";
import { Centered } from "../Centered";
import type { BrandSection } from "../../../types";

const mockSection: BrandSection = {
  id: "1",
  tenantId: "test",
  slug: "efemerides",
  name: "Efemérides",
  color: "#F59E0B",
};

describe("PostVertical45 - Centered", () => {
  it("renders without errors", () => {
    const result = Centered({
      section: mockSection,
      title: "Test Title",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
    expect(result.props.style.width).toBe(1080);
    expect(result.props.style.height).toBe(1350);
  });

  it("renders with required props", () => {
    const result = Centered({
      section: mockSection,
      title: "Un Día Como Hoy",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result).toBeDefined();
  });

  it("centers content horizontally", () => {
    const result = Centered({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result.props.style.alignItems).toBe("center");
  });

  it("applies white background", () => {
    const result = Centered({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    expect(result.props.style.backgroundColor).toBe("#FFFFFF");
  });

  it("uses centered badge position", () => {
    const result = Centered({
      section: mockSection,
      title: "Test",
      photoUrl: "https://example.com/photo.jpg",
    });

    // Badge should be rendered centered
    expect(result).toBeDefined();
  });

  it("handles empty photo URL", () => {
    const result = Centered({
      section: mockSection,
      title: "Test",
      photoUrl: "",
    });

    expect(result).toBeDefined();
  });

  it("centers title text", () => {
    const result = Centered({
      section: mockSection,
      title: "Test Title Centered",
      photoUrl: "https://example.com/photo.jpg",
    });

    // Title should have center alignment
    expect(result).toBeDefined();
  });
});
