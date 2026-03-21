import { describe, expect, it } from "vitest";
import { LogoWatermark } from "../LogoWatermark";
import { LOGO_SVG, LOGO_SVG_LIGHT } from "../LogoWatermark";

describe("LogoWatermark", () => {
  it("renders with dark logo by default", () => {
    const result = LogoWatermark({});

    expect(result.props.dangerouslySetInnerHTML.__html).toBe(LOGO_SVG);
  });

  it("renders with light logo when color is white", () => {
    const result = LogoWatermark({ color: "#FFFFFF" });

    expect(result.props.dangerouslySetInnerHTML.__html).toBe(LOGO_SVG_LIGHT);
  });

  describe("position", () => {
    it("applies bottom-right position by default", () => {
      const result = LogoWatermark({ position: "bottom-right" });

      expect(result.props.style.position).toBe("absolute");
      expect(result.props.style.bottom).toBe(24);
      expect(result.props.style.right).toBe(24);
    });

    it("applies bottom-left position", () => {
      const result = LogoWatermark({ position: "bottom-left" });

      expect(result.props.style.bottom).toBe(24);
      expect(result.props.style.left).toBe(24);
    });

    it("applies top-right position", () => {
      const result = LogoWatermark({ position: "top-right" });

      expect(result.props.style.top).toBe(24);
      expect(result.props.style.right).toBe(24);
    });

    it("applies top-left position", () => {
      const result = LogoWatermark({ position: "top-left" });

      expect(result.props.style.top).toBe(24);
      expect(result.props.style.left).toBe(24);
    });
  });

  describe("size", () => {
    it("applies sm size (80px width)", () => {
      const result = LogoWatermark({ size: "sm" });

      expect(result.props.style.width).toBe(80);
      expect(result.props.style.height).toBe(20);
    });

    it("applies md size (120px width)", () => {
      const result = LogoWatermark({ size: "md" });

      expect(result.props.style.width).toBe(120);
      expect(result.props.style.height).toBe(30);
    });

    it("applies lg size (160px width)", () => {
      const result = LogoWatermark({ size: "lg" });

      expect(result.props.style.width).toBe(160);
      expect(result.props.style.height).toBe(40);
    });

    it("applies vertical dimensions when variant is vertical", () => {
      const result = LogoWatermark({ variant: "vertical", size: "md" });

      expect(result.props.style.width).toBe(120);
      expect(result.props.style.height).toBe(90);
    });
  });

  it("sets pointerEvents to none", () => {
    const result = LogoWatermark({});

    expect(result.props.style.pointerEvents).toBe("none");
  });

  it("applies className when provided", () => {
    const result = LogoWatermark({ className: "custom-watermark" });

    expect(result.props.className).toBe("custom-watermark");
  });
});
