import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { getPendingTopics } from "@/lib/topics/queries";
import { TopicsListClient } from "./topics-list-client";
import type { PendingTopicsResponse } from "@/lib/topics/types";

export const dynamic = "force-dynamic";

async function getTenantSlug(): Promise<string | null> {
  const headerTenant = (await headers()).get("x-tenant-id");
  if (headerTenant) {
    return headerTenant;
  }
  return (await cookies()).get("tenant-id")?.value ?? null;
}

export default async function TopicsPage() {
  const tenantSlug = await getTenantSlug();

  // Default to empty topics if no tenant
  let initialTopics: PendingTopicsResponse = {
    topics: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  };
  let tenantId: string | null = null;

  if (tenantSlug) {
    try {
      // Use slug as tenant ID for initial load (will be resolved by API)
      tenantId = tenantSlug;

      // Try to fetch initial topics server-side
      initialTopics = await getPendingTopics(tenantSlug, {
        page: 1,
        limit: 20,
      });
    } catch (error) {
      console.error("[Topics page] Failed to load topics:", error);
      // Keep empty topics on error
    }
  }

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Temas Pendientes</h1>
        <span className="text-sm text-slate-400">
          {initialTopics.total > 0
            ? `${initialTopics.total} tema(s) disponible(s)`
            : "Sin temas pendientes"}
        </span>
      </div>

      <Suspense
        fallback={
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded border border-slate-800 bg-slate-900/60 p-4"
              >
                <div className="flex gap-4">
                  <div className="h-24 w-24 rounded bg-slate-800" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-48 rounded bg-slate-800" />
                    <div className="h-3 w-full rounded bg-slate-800" />
                    <div className="h-3 w-3/4 rounded bg-slate-800" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        }
      >
        <TopicsListClient
          initialTopics={initialTopics.topics}
          tenantId={tenantId}
        />
      </Suspense>
    </section>
  );
}
