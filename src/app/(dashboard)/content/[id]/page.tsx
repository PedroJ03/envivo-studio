import { cookies, headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { withTenantDb } from "@/lib/db/client";
import { candidateContent, contentStates, events, generatedOutputs, personas, photos } from "@/lib/db/schema";
import { TENANT_HEADER } from "@/proxy";
import { ContentDetailClient } from "./content-detail-client";

type RouteContext = {
  params: {
    id: string;
  };
};

type ContentMachineState =
  | "draft"
  | "generating"
  | "generated"
  | "approved"
  | "reviewed"
  | "published"
  | "rejected"
  | "failed";

type CandidateRow = typeof candidateContent.$inferSelect;
type PhotoRow = typeof photos.$inferSelect;
type PersonaRow = typeof personas.$inferSelect;
type ContentStateRow = typeof contentStates.$inferSelect;
type GeneratedOutputRow = typeof generatedOutputs.$inferSelect;

async function getTenantId() {
  const headerTenant = (await headers()).get(TENANT_HEADER);
  if (headerTenant) {
    return headerTenant;
  }

  return (await cookies()).get("tenant-id")?.value ?? null;
}

async function loadContentDetail(tenantId: string, contentId: string) {
  return withTenantDb(tenantId, async (tx) => {
    const [candidate] = (await tx
      .select()
      .from(candidateContent)
      .where(
        and(
          eq(candidateContent.id, contentId),
          eq(candidateContent.tenantId, tenantId),
        ),
      )) as CandidateRow[];

    if (!candidate) {
      return null;
    }

    const [latestState] = (await tx
      .select()
      .from(contentStates)
      .where(eq(contentStates.candidateContentId, contentId))
      .orderBy(desc(contentStates.createdAt))
      .limit(1)) as ContentStateRow[];

    let eventPhotos: PhotoRow[] = [];
    if (candidate.eventId) {
      eventPhotos = (await tx
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.eventId, candidate.eventId),
            eq(photos.tenantId, tenantId),
          ),
        )) as PhotoRow[];
    }

    const allPersonas = (await tx
      .select()
      .from(personas)
      .where(eq(personas.tenantId, tenantId))) as PersonaRow[];

    const outputs = (await tx
      .select()
      .from(generatedOutputs)
      .where(eq(generatedOutputs.candidateContentId, contentId))
      .orderBy(generatedOutputs.sortOrder)) as GeneratedOutputRow[];

    return {
      candidate,
      state: latestState,
      photos: eventPhotos,
      personas: allPersonas,
      outputs,
    };
  });
}

export default async function ContentDetailPage({ params }: RouteContext) {
  const tenantId = await getTenantId();

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Detalle del contenido</h1>
        <p className="rounded border border-yellow-700/50 bg-yellow-700/10 p-3 text-sm">
          Falta contexto de tenant.
        </p>
      </section>
    );
  }

  try {
    const detail = await loadContentDetail(tenantId, params.id);

    if (!detail) {
      notFound();
    }

    const content = {
      id: detail.candidate.id,
      title: detail.candidate.title,
      selectedFormat: detail.candidate.selectedFormat,
      selectedTone: detail.candidate.selectedTone,
      currentState: (detail.state?.state ?? "draft") as ContentMachineState,
      actor: detail.state?.actor ?? null,
      rejectionReason: detail.state?.rejectionReason ?? null,
    };

    const photosList = detail.photos.map((p) => ({
      id: p.id,
      originalUrl: p.originalUrl,
      width: p.width,
      height: p.height,
    }));

    const personasList = detail.personas.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
    }));

    const generatedOutputsList = detail.outputs.map((o) => ({
      id: o.id,
      fileUrl: o.fileUrl,
      sortOrder: o.sortOrder,
      width: o.width,
      height: o.height,
    }));

    return (
      <ContentDetailClient
        content={content}
        photos={photosList}
        personas={personasList}
        generatedOutputs={generatedOutputsList}
      />
    );
  } catch (error) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Detalle del contenido</h1>
        <p className="rounded border border-red-700/50 bg-red-700/10 p-3 text-sm text-red-100">
          Error al cargar: {String(error)}
        </p>
      </section>
    );
  }
}
