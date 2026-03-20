import { describe, expect, it } from "vitest";
import { getActiveTenantId, tenantFilter, withTenantContext } from "./tenant";
import { candidateContent } from "./schema";

describe("tenant isolation utilities", () => {
  it("requires an active tenant context", () => {
    expect(() => getActiveTenantId()).toThrow(
      "Tenant context missing. Wrap query execution with withTenantContext(tenantId, ...).",
    );
  });

  it("builds tenant-scoped filters in async context", async () => {
    await withTenantContext("tenant-studio", () => {
      const scoped = tenantFilter(candidateContent.tenantId);
      expect(scoped).toBeDefined();
      return Promise.resolve();
    });
  });

  it("allows explicit tenant override to avoid global context", () => {
    const clause = tenantFilter(candidateContent.tenantId, "tenant-manual");
    expect(clause).toBeDefined();
  });
});
