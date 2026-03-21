import { describe, expect, it } from "vitest";
import { Centered } from "../Centered";

describe("PostSquare11 - Centered", () => {
  const defaultProps = {
    sectionSlug: "efemerides" as const,
    title: "Efeméride del Día",
    photoUrl: "https://example.com/photo.jpg",
  };

  it("renders with correct dimensions (1080x1080)", () => {
    const result = Centered(defaultProps);

    expect(result.props.style.width).toBe(1080);
    expect(result.props.style.height).toBe(1080);
  });

  it("renders with white background", () => {
    const result = Centered(defaultProps);

    expect(result.props.style.backgroundColor).toBe("#FFFFFF");
  });

  it("uses 32px padding", () => {
    const result = Centered(defaultProps);

    expect(result.props.style.padding).toBe(32);
  });

  it("renders as flex column layout", () => {
    const result = Centered(defaultProps);

    expect(result.props.style.display).toBe("flex");
    expect(result.props.style.flexDirection).toBe("column");
  });

  it("handles date when provided", () => {
    const result = Centered({
      ...defaultProps,
      date: "21 MAR 2026",
    });

    expect(result).toBeDefined();
  });

  it("handles empty date gracefully", () => {
    const result = Centered({
      ...defaultProps,
      date: undefined,
    });

    expect(result).toBeDefined();
  });

  it("renders with subtitle when provided", () => {
    const result = Centered({
      ...defaultProps,
      subtitle: "Subtítulo centrado",
    });

    expect(result).toBeDefined();
  });

  it("renders without subtitle when not provided", () => {
    const result = Centered({
      ...defaultProps,
      subtitle: undefined,
    });

    expect(result).toBeDefined();
  });

  it("uses section name override when provided", () => {
    const result = Centered({
      ...defaultProps,
      sectionSlug: "efemerides",
      sectionName: "Custom Efeméride",
    });

    expect(result).toBeDefined();
  });
});
