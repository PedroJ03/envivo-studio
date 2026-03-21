import { describe, expect, it } from "vitest";
import { Title } from "../Title";

describe("Title", () => {
  it("renders with correct text", () => {
    const { children } = Title({ text: "Próximo Show" }).props as {
      children: string;
    };

    expect(children).toBe("Próximo Show");
  });

  it("applies default color (black)", () => {
    const result = Title({ text: "Test" });

    expect(result.props.style.color).toBe("#000000");
  });

  it("applies custom color when provided", () => {
    const color = "#8B5CF6";
    const result = Title({ text: "Test", color });

    expect(result.props.style.color).toBe(color);
  });

  it("applies sm size (32px)", () => {
    const result = Title({ text: "Test", size: "sm" });

    expect(result.props.style.fontSize).toBe(32);
  });

  it("applies md size (48px)", () => {
    const result = Title({ text: "Test", size: "md" });

    expect(result.props.style.fontSize).toBe(48);
  });

  it("applies lg size (64px)", () => {
    const result = Title({ text: "Test", size: "lg" });

    expect(result.props.style.fontSize).toBe(64);
  });

  it("applies xl size (80px)", () => {
    const result = Title({ text: "Test", size: "xl" });

    expect(result.props.style.fontSize).toBe(80);
  });

  it("applies 2xl size (96px)", () => {
    const result = Title({ text: "Test", size: "2xl" });

    expect(result.props.style.fontSize).toBe(96);
  });

  it("applies bold weight (700) by default", () => {
    const result = Title({ text: "Test" });

    expect(result.props.style.fontWeight).toBe(700);
  });

  it("applies black weight (900) when specified", () => {
    const result = Title({ text: "Test", weight: "black" });

    expect(result.props.style.fontWeight).toBe(900);
  });

  it("applies left align by default", () => {
    const result = Title({ text: "Test" });

    expect(result.props.style.textAlign).toBe("left");
  });

  it("applies center align", () => {
    const result = Title({ text: "Test", align: "center" });

    expect(result.props.style.textAlign).toBe("center");
  });

  it("applies right align", () => {
    const result = Title({ text: "Test", align: "right" });

    expect(result.props.style.textAlign).toBe("right");
  });

  it("applies line-height 1.1", () => {
    const result = Title({ text: "Test" });

    expect(result.props.style.lineHeight).toBe(1.1);
  });

  it("applies maxLines overflow clamping", () => {
    const result = Title({ text: "Test", maxLines: 2 });

    expect(result.props.style.overflow).toBe("hidden");
    expect(result.props.style.display).toBe("-webkit-box");
    expect(result.props.style.WebkitBoxOrient).toBe("vertical");
    expect(result.props.style.WebkitLineClamp).toBe(2);
  });

  it("does not apply maxLines styles when maxLines is undefined", () => {
    const result = Title({ text: "Test" });

    expect(result.props.style.overflow).toBeUndefined();
    expect(result.props.style.WebkitLineClamp).toBeUndefined();
  });

  it("handles empty text", () => {
    const result = Title({ text: "" });

    expect(result.props.children).toBe("");
  });
});
