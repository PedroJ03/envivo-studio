import { describe, expect, it } from "vitest";
import { BadgeSection } from "../BadgeSection";

describe("BadgeSection", () => {
  it("renders with correct text", () => {
    const { children } = BadgeSection({
      text: "Próximos Shows",
      bgColor: "#8B5CF6",
    }).props as { children: string };

    expect(children).toBe("Próximos Shows");
  });

  it("applies background color", () => {
    const bgColor = "#8B5CF6";
    const result = BadgeSection({ text: "Test", bgColor });

    expect(result.props.style.backgroundColor).toBe(bgColor);
  });

  it("applies custom text color when provided", () => {
    const textColor = "#FF0000";
    const result = BadgeSection({ text: "Test", bgColor: "#000", textColor });

    expect(result.props.style.color).toBe(textColor);
  });

  it("uses white as default text color", () => {
    const result = BadgeSection({ text: "Test", bgColor: "#8B5CF6" });

    expect(result.props.style.color).toBe("#FFFFFF");
  });

  it("applies sm size correctly", () => {
    const result = BadgeSection({ text: "Test", bgColor: "#000", size: "sm" });

    expect(result.props.style.fontSize).toBe(12);
  });

  it("applies md size correctly", () => {
    const result = BadgeSection({ text: "Test", bgColor: "#000", size: "md" });

    expect(result.props.style.fontSize).toBe(14);
  });

  it("applies lg size correctly", () => {
    const result = BadgeSection({ text: "Test", bgColor: "#000", size: "lg" });

    expect(result.props.style.fontSize).toBe(16);
  });

  it("applies pill border-radius (full)", () => {
    const result = BadgeSection({ text: "Test", bgColor: "#000" });

    expect(result.props.style.borderRadius).toBe(9999);
  });

  it("applies uppercase text transform", () => {
    const result = BadgeSection({ text: "Test", bgColor: "#000" });

    expect(result.props.style.textTransform).toBe("uppercase");
  });

  it("applies letter spacing", () => {
    const result = BadgeSection({ text: "Test", bgColor: "#000" });

    expect(result.props.style.letterSpacing).toBe("0.05em");
  });

  it("handles empty text", () => {
    const result = BadgeSection({ text: "", bgColor: "#8B5CF6" });

    expect(result.props.children).toBe("");
  });
});
