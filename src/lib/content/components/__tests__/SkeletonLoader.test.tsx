import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SkeletonLoader } from "../SkeletonLoader";

describe("SkeletonLoader", () => {
  it("renders with default props", () => {
    render(<SkeletonLoader />);
    const loader = document.querySelector('[style*="shimmer"]');
    expect(loader).toBeDefined();
  });

  it("renders with custom height", () => {
    const { container } = render(<SkeletonLoader height={200} />);
    const loader = container.querySelector('[style*="shimmer"]');
    expect(loader).toBeDefined();
    expect(loader?.getAttribute("style")).toContain("height: 200px");
  });

  it("renders with custom width", () => {
    const { container } = render(<SkeletonLoader width={300} />);
    const loader = container.querySelector('[style*="shimmer"]');
    expect(loader).toBeDefined();
    expect(loader?.getAttribute("style")).toContain("width: 300px");
  });
});
