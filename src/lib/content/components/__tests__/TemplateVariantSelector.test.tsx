import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TemplateVariantSelector } from "../TemplateVariantSelector";

describe("TemplateVariantSelector", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it("renders all available variants", () => {
    render(
      <TemplateVariantSelector
        currentVariant="classic"
        onVariantChange={mockOnChange}
      />,
    );

    expect(screen.getByText("Classic")).toBeDefined();
    expect(screen.getByText("Minimal")).toBeDefined();
    expect(screen.getByText("Centered")).toBeDefined();
  });

  it("calls onVariantChange when variant is clicked", () => {
    render(
      <TemplateVariantSelector
        currentVariant="classic"
        onVariantChange={mockOnChange}
      />,
    );

    fireEvent.click(screen.getByText("Minimal"));
    expect(mockOnChange).toHaveBeenCalledWith("minimal");
  });

  it("highlights current variant", () => {
    render(
      <TemplateVariantSelector
        currentVariant="minimal"
        onVariantChange={mockOnChange}
      />,
    );

    // Current variant should have different styling
    expect(screen.getByText("Minimal")).toBeDefined();
  });
});
