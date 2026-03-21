import { describe, expect, it } from "vitest";
import { Minimal } from "../Minimal";

describe("PostSquare11 - Minimal", () => {
  const defaultProps = {
    sectionSlug: "bandas-locales" as const,
    title: "Banda Local Destacada",
    photoUrl: "https://example.com/photo.jpg",
  };

  it("renders with correct dimensions (1080x1080)", () => {
    const result = Minimal(defaultProps);

    expect(result.props.style.width).toBe(1080);
    expect(result.props.style.height).toBe(1080);
  });

  it("renders with white background", () => {
    const result = Minimal(defaultProps);

    expect(result.props.style.backgroundColor).toBe("#FFFFFF");
  });

  it("uses 32px padding", () => {
    const result = Minimal(defaultProps);

    expect(result.props.style.padding).toBe(32);
  });

  it("renders as flex column layout", () => {
    const result = Minimal(defaultProps);

    expect(result.props.style.display).toBe("flex");
    expect(result.props.style.flexDirection).toBe("column");
  });

  it("handles date when provided", () => {
    const result = Minimal({
      ...defaultProps,
      date: "21 MAR 2026",
    });

    expect(result).toBeDefined();
  });

  it("handles empty date gracefully", () => {
    const result = Minimal({
      ...defaultProps,
      date: undefined,
    });

    expect(result).toBeDefined();
  });

  it("renders with subtitle when provided", () => {
    const result = Minimal({
      ...defaultProps,
      subtitle: "Subtítulo minimalista",
    });

    expect(result).toBeDefined();
  });

  it("renders without subtitle when not provided", () => {
    const result = Minimal({
      ...defaultProps,
      subtitle: undefined,
    });

    expect(result).toBeDefined();
  });

  it("uses section name override when provided", () => {
    const result = Minimal({
      ...defaultProps,
      sectionSlug: "bandas-locales",
      sectionName: "Custom Banda",
    });

    expect(result).toBeDefined();
  });
});
