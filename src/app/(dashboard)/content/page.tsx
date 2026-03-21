import { cookies, headers } from "next/headers";
import { desc, eq, inArray } from "drizzle-orm";

import { withTenantDb } from "@/lib/db/client";
import { candidateContent, contentStates } from "@/lib/db/schema";
import { tenantFilter } from "@/lib/db/tenant";
import { TENANT_HEADER } from "@/proxy";
import { ContentListClient } from "./content-list-client";

type ContentMachineState =
  | "draft"
  | "generating"
  | "generated"
  | "approved"
  | "reviewed"
  | "published"
  | "rejected"
  | "failed";

async function getTenantId() {
  const headerTenant = (await headers()).get(TENANT_HEADER);
  if (headerTenant) {
    return headerTenant;
  }

  return (await cookies()).get("tenant-id")?.value ?? null;
}

type CandidateContentRow = typeof candidateContent.$inferSelect;
type ContentStateRow = typeof contentStates.$inferSelect;

type ContentItem = {
  id: string;
  title: string;
  selectedFormat: "post" | "story" | "carousel";
  selectedTone: string | null;
  status: ContentMachineState;
  createdAt: string;
};

async function loadContentList(tenantId: string): Promise<ContentItem[]> {
  return withTenantDb(tenantId, async (tx) => {
    const candidates = (await tx
      .select()
      .from(candidateContent)
      .where(eq(candidateContent.tenantId, tenantId))
      .orderBy(desc(candidateContent.createdAt))) as CandidateContentRow[];

    if (candidates.length === 0) {
      return [];
    }

    const candidateIds = candidates.map((c) => c.id);

    const states = (await tx
      .select()
      .from(contentStates)
      .where(
        inArray(contentStates.candidateContentId, candidateIds),
      )
      .orderBy(
        contentStates.candidateContentId,
        desc(contentStates.createdAt),
      )) as ContentStateRow[];

    const latestStateMap = new Map<string, ContentStateRow>();
    for (const state of states) {
      if (!latestStateMap.has(state.candidateContentId)) {
        latestStateMap.set(state.candidateContentId, state);
      }
    }

    return candidates.map((candidate) => {
      const latestState = latestStateMap.get(candidate.id);

      return {
        id: candidate.id,
        title: candidate.title,
        selectedFormat: candidate.selectedFormat,
        selectedTone: candidate.selectedTone,
        status: (latestState?.state ?? "draft") as ContentMachineState,
        createdAt: candidate.createdAt.toISOString(),
      };
    });
  });
}

export default async function ContentPage() {
  const tenantId = await getTenantId();

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Contenido</h1>
        <p className="rounded border border-yellow-700/50 bg-yellow-700/10 p-3 text-sm">
          Falta contexto de tenant. Pasá{" "}
          <code className="rounded bg-black/40 px-1">x-tenant-id</code> por
          header o cookie para ver contenido.
        </p>
      </section>
    );
  }

  try {
    const content = await loadContentList(tenantId);

    return <ContentListClient initialContent={content} />;
  } catch (error) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Contenido</h1>
        <p className="rounded border border-red-700/50 bg-red-700/10 p-3 text-sm text-red-100">
          No pudimos cargar el contenido: {String(error)}
        </p>
      </section>
    );
  }
}
