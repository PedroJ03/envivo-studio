import { describe, expect, it } from "vitest";
import { PostSquare11, Classic, Centered, Minimal } from "../PostSquare11";

describe("PostSquare11 - Main Component", () => {
  const defaultProps = {
    sectionSlug: "noticias" as const,
    title: "Test Title",
    photoUrl: "https://example.com/photo.jpg",
  };

  it("exports main PostSquare11 component", () => {
    expect(PostSquare11).toBeDefined();
    expect(typeof PostSquare11).toBe("function");
  });

  it("renders without errors", () => {
    // Component returns JSX element, we just verify it doesn't throw
    expect(() => PostSquare11(defaultProps)).not.toThrow();
  });

  it("accepts classic template prop", () => {
    expect(() =>
      PostSquare11({
        ...defaultProps,
        template: "classic",
      }),
    ).not.toThrow();
  });

  it("accepts centered template prop", () => {
    expect(() =>
      PostSquare11({
        ...defaultProps,
        template: "centered",
      }),
    ).not.toThrow();
  });

  it("accepts minimal template prop", () => {
    expect(() =>
      PostSquare11({
        ...defaultProps,
        template: "minimal",
      }),
    ).not.toThrow();
  });

  it("accepts all optional props", () => {
    expect(() =>
      PostSquare11({
        sectionSlug: "noticias",
        sectionName: "Custom Section",
        title: "Custom Title",
        subtitle: "Custom Subtitle",
        photoUrl: "https://custom.com/photo.jpg",
        date: "21 MAR 2026",
        template: "classic",
      }),
    ).not.toThrow();
  });
});

describe("PostSquare11 - Direct Exports", () => {
  it("exports Classic component", () => {
    expect(Classic).toBeDefined();
    expect(typeof Classic).toBe("function");
  });

  it("exports Centered component", () => {
    expect(Centered).toBeDefined();
    expect(typeof Centered).toBe("function");
  });

  it("exports Minimal component", () => {
    expect(Minimal).toBeDefined();
    expect(typeof Minimal).toBe("function");
  });
});
