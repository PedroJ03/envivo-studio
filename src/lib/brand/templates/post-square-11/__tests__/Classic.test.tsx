import { describe, expect, it } from "vitest";
import { Classic } from "../Classic";

describe("PostSquare11 - Classic", () => {
  const defaultProps = {
    sectionSlug: "noticias" as const,
    title: "Gran Show en Tandil",
    photoUrl: "https://example.com/photo.jpg",
  };

  it("renders with correct dimensions (1080x1080)", () => {
    const result = Classic(defaultProps);

    expect(result.props.style.width).toBe(1080);
    expect(result.props.style.height).toBe(1080);
  });

  it("renders with white background", () => {
    const result = Classic(defaultProps);

    expect(result.props.style.backgroundColor).toBe("#FFFFFF");
  });

  it("uses 32px padding", () => {
    const result = Classic(defaultProps);

    expect(result.props.style.padding).toBe(32);
  });

  it("renders as flex column layout", () => {
    const result = Classic(defaultProps);

    expect(result.props.style.display).toBe("flex");
    expect(result.props.style.flexDirection).toBe("column");
  });

  it("handles empty date gracefully", () => {
    const result = Classic({
      ...defaultProps,
      date: undefined,
    });

    expect(result).toBeDefined();
    expect(result.props.style.width).toBe(1080);
  });

  it("handles date when provided", () => {
    const result = Classic({
      ...defaultProps,
      date: "21 MAR 2026",
    });

    expect(result).toBeDefined();
  });

  it("renders with subtitle when provided", () => {
    const result = Classic({
      ...defaultProps,
      subtitle: "Subtítulo de prueba",
    });

    expect(result).toBeDefined();
  });

  it("renders without subtitle when not provided", () => {
    const result = Classic({
      ...defaultProps,
      subtitle: undefined,
    });

    expect(result).toBeDefined();
  });

  it("uses section name override when provided", () => {
    const result = Classic({
      ...defaultProps,
      sectionSlug: "noticias",
      sectionName: "Custom Name",
    });

    expect(result).toBeDefined();
  });
});
