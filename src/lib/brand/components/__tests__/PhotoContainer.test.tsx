import { describe, expect, it } from "vitest";
import { PhotoContainer } from "../PhotoContainer";

describe("PhotoContainer", () => {
  it("renders img with correct src", () => {
    const result = PhotoContainer({ src: "https://example.com/photo.jpg" });
    const imgElement = result.props.children;

    expect(imgElement.props.src).toBe("https://example.com/photo.jpg");
  });

  it("renders img with correct alt", () => {
    const result = PhotoContainer({
      src: "https://example.com/photo.jpg",
      alt: "Banda en vivo",
    });
    const imgElement = result.props.children;

    expect(imgElement.props.alt).toBe("Banda en vivo");
  });

  it("uses empty string as default alt", () => {
    const result = PhotoContainer({ src: "https://example.com/photo.jpg" });
    const imgElement = result.props.children;

    expect(imgElement.props.alt).toBe("");
  });

  it("applies 4/3 aspect ratio by default", () => {
    const result = PhotoContainer({ src: "https://example.com/photo.jpg" });

    expect(result.props.style.aspectRatio).toBe("4/3");
  });

  it("applies custom aspect ratio", () => {
    const result = PhotoContainer({
      src: "https://example.com/photo.jpg",
      aspectRatio: "1/1",
    });

    expect(result.props.style.aspectRatio).toBe("1/1");
  });

  it("applies cover objectFit by default", () => {
    const result = PhotoContainer({ src: "https://example.com/photo.jpg" });
    const imgElement = result.props.children;

    expect(imgElement.props.style.objectFit).toBe("cover");
  });

  it("applies contain objectFit when specified", () => {
    const result = PhotoContainer({
      src: "https://example.com/photo.jpg",
      objectFit: "contain",
    });
    const imgElement = result.props.children;

    expect(imgElement.props.style.objectFit).toBe("contain");
  });

  describe("roundedCorners", () => {
    it("applies rounded corners on all sides when 'all'", () => {
      const result = PhotoContainer({
        src: "https://example.com/photo.jpg",
        roundedCorners: "all",
      });

      expect(result.props.style.borderRadius).toBe("16px");
    });

    it("applies rounded corners only on bottom when 'bottom'", () => {
      const result = PhotoContainer({
        src: "https://example.com/photo.jpg",
        roundedCorners: "bottom",
      });

      expect(result.props.style.borderRadius).toBe("0 0 16px 16px");
    });

    it("applies no border radius when 'none'", () => {
      const result = PhotoContainer({
        src: "https://example.com/photo.jpg",
        roundedCorners: "none",
      });

      expect(result.props.style.borderRadius).toBe("0");
    });

    it("applies custom roundedSize", () => {
      const result = PhotoContainer({
        src: "https://example.com/photo.jpg",
        roundedCorners: "all",
        roundedSize: 24,
      });

      expect(result.props.style.borderRadius).toBe("24px");
    });
  });

  describe("placeholder", () => {
    it("renders placeholder when src is empty", () => {
      const result = PhotoContainer({ src: "" });

      expect(result.props.children.type).toBe("div");
      expect(result.props.children.props.children).toBe("Sin imagen");
    });

    it("renders placeholder when src is only whitespace", () => {
      const result = PhotoContainer({ src: "   " });

      expect(result.props.children.type).toBe("div");
    });

    it("renders img when src is provided", () => {
      const result = PhotoContainer({ src: "https://example.com/photo.jpg" });

      expect(result.props.children.type).toBe("img");
    });
  });
});
