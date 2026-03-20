import { describe, expect, it } from "vitest";

import {
  assertMinimumPhotoDimension,
  ComposerPhotoResolutionError,
} from "./composer";

describe("composer photo dimension constraints", () => {
  it("throws a typed error when width is below minimum", () => {
    expect(() =>
      assertMinimumPhotoDimension({
        width: 700,
        height: 1200,
        minimumDimension: 720,
      }),
    ).toThrowError(ComposerPhotoResolutionError);
  });

  it("throws a typed error when height is below minimum", () => {
    expect(() =>
      assertMinimumPhotoDimension({
        width: 1200,
        height: 600,
        minimumDimension: 720,
      }),
    ).toThrowError(ComposerPhotoResolutionError);
  });

  it("accepts photos that meet the configured minimum", () => {
    expect(() =>
      assertMinimumPhotoDimension({
        width: 720,
        height: 720,
        minimumDimension: 720,
      }),
    ).not.toThrow();
  });
});
