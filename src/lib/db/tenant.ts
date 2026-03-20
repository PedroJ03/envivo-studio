import { AsyncLocalStorage } from "node:async_hooks";
import { eq, sql, type SQL } from "drizzle-orm";

type TenantStore = { tenantId: string };

const tenantContext = new AsyncLocalStorage<TenantStore>();

export const TENANT_HEADER = "x-tenant-id";

export function withTenantContext<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
  if (!tenantId) {
    return Promise.reject(new Error("Tenant id is required."));
  }

  return tenantContext.run({ tenantId }, fn);
}

export function getTenantContext(): TenantStore {
  const store = tenantContext.getStore();

  if (!store?.tenantId) {
    throw new Error(
      "Tenant context missing. Wrap query execution with withTenantContext(tenantId, ...).",
    );
  }

  return store;
}

export function getActiveTenantId(fallbackTenantId?: string): string {
  if (fallbackTenantId) {
    return fallbackTenantId;
  }

  return getTenantContext().tenantId;
}

export function withTenantConfigSet(tenantId: string): SQL {
  return sql`set_config('app.current_tenant_id', ${tenantId}, false)`;
}

type TenantEqLeft = Parameters<typeof eq>[0];

export function tenantFilter(column: TenantEqLeft, tenantId?: string): SQL {
  return eq(column, getActiveTenantId(tenantId));
}
