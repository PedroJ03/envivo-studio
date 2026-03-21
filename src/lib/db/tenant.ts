import { AsyncLocalStorage } from "node:async_hooks";
import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "./client";
import { tenants } from "./schema";

type TenantStore = { tenantId: string };

const tenantContext = new AsyncLocalStorage<TenantStore>();

export const TENANT_HEADER = "x-tenant-id";

export function withTenantContext<T>(
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
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

/**
 * Resolves a tenant slug to its UUID.
 * Dashboard pages receive slugs (e.g., "envivo-tandil") but database queries need UUIDs.
 * @param slug - The tenant slug from header/cookie/query param
 * @returns The tenant UUID, or null if not found
 */
export async function getTenantIdBySlug(slug: string): Promise<string | null> {
  const result = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1);

  return result[0]?.id ?? null;
}

/**
 * Checks if a value looks like a UUID (8-4-4-4-12 hex format)
 */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Resolves tenant ID from a Next.js request.
 * Checks header first (x-tenant-id), then query param (tenant_id).
 * If the value is a slug (not UUID), resolves it to UUID via getTenantIdBySlug.
 * This handles cases where the proxy middleware sets the header with a slug.
 */
export async function resolveTenantId(
  request: Request,
): Promise<string | null> {
  // Try header first
  const headerTenant = (request as Request & { headers: Headers }).headers.get(
    TENANT_HEADER,
  );
  if (headerTenant) {
    if (isUuid(headerTenant)) {
      return headerTenant;
    }
    return await getTenantIdBySlug(headerTenant);
  }

  // Try query param
  const url = new URL((request as Request & { url: string }).url || "");
  const queryTenant = url.searchParams.get("tenant_id");
  if (!queryTenant) {
    return null;
  }

  if (isUuid(queryTenant)) {
    return queryTenant;
  }

  return await getTenantIdBySlug(queryTenant);
}
