import { cookies, headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { withTenantDb } from "@/lib/db/client";
import { candidateContent, events, photos } from "@/lib/db/schema";
import { tenantFilter } from "@/lib/db/tenant";
import { TENANT_HEADER } from "@/middleware";

type RouteContext = {
  params: {
    id: string;
  };
};

type CandidateWithPhoto = {
  candidateId: string;
  candidateStatus: "candidate" | "selected" | "rejected" | "archived";
  eventDate: string | null;
  photoUrl: string;
  width: number;
  height: number;
};

async function getTenantId() {
  const headerTenant = (await headers()).get(TENANT_HEADER);
  if (headerTenant) {
    return headerTenant;
  }

  return (await cookies()).get("tenant-id")?.value ?? null;
}

async function loadEventById(tenantId: string, id: string) {
  return withTenantDb(tenantId, async (tx) => {
    const [eventRecord] = await tx
      .select({
        id: events.id,
        title: events.title,
        venue: events.venue,
        eventDate: events.eventDate,
        statusText: events.statusText,
      })
      .from(events)
      .where(and(eq(events.id, id), tenantFilter(events.tenantId)));

    if (!eventRecord) {
      return null;
    }

    const candidates = await tx
      .select({
        candidateId: candidateContent.id,
        candidateStatus: candidateContent.status,
        photoUrl: photos.originalUrl,
        width: photos.width,
        height: photos.height,
      })
      .from(candidateContent)
      .leftJoin(photos, eq(candidateContent.photoId, photos.id))
      .where(and(eq(candidateContent.eventId, eventRecord.id), tenantFilter(candidateContent.tenantId)))
      .orderBy(desc(candidateContent.createdAt));

    return {
      event: eventRecord,
      candidates: candidates
        .filter((candidate) => candidate.photoUrl !== null)
        .map((candidate) => ({
          candidateId: candidate.candidateId,
          candidateStatus: candidate.candidateStatus as CandidateWithPhoto["candidateStatus"],
          eventDate: eventRecord.eventDate ? eventRecord.eventDate.toISOString() : null,
          photoUrl: candidate.photoUrl,
          width: candidate.width,
          height: candidate.height,
        })),
    };
  });
}

export default async function EventDetailPage({ params }: RouteContext) {
  const tenantId = await getTenantId();

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Detalle del evento</h1>
        <p className="rounded border border-yellow-700/50 bg-yellow-700/10 p-3 text-sm">
          Falta contexto de tenant. Probá agregar <code className="rounded bg-black/40 px-1">x-tenant-id</code>.
        </p>
      </section>
    );
  }

  const loaded = await loadEventById(tenantId, params.id);

  if (!loaded) {
    notFound();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Detalle del evento</h1>
      <div className="rounded border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-xl font-medium">{loaded.event.title}</h2>
        <p className="mt-1 text-sm text-slate-300">Estado: {loaded.event.statusText}</p>
        <p className="text-sm text-slate-400">
          {loaded.event.venue ? `Lugar: ${loaded.event.venue}` : "Lugar sin definir"}
        </p>
        {loaded.event.eventDate ? (
          <p className="text-sm text-slate-400">
            Fecha: {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(loaded.event.eventDate)}
          </p>
        ) : null}
      </div>

      <h3 className="text-lg font-semibold">Fotos candidatas ({loaded.candidates.length})</h3>
      {loaded.candidates.length === 0 ? (
        <p className="text-sm text-slate-400">Todavía no hay candidatas para este evento.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {loaded.candidates.map((candidate) => (
            <li
              key={candidate.candidateId}
              className="rounded border border-slate-700 bg-slate-900/40 p-3"
            >
              <img
                src={candidate.photoUrl ?? ""}
                alt={`Foto candidata ${candidate.candidateId}`}
                className="mb-2 w-full rounded bg-slate-800 object-cover"
                loading="lazy"
              />
              <div className="text-sm text-slate-300">Estado: {candidate.candidateStatus}</div>
              <div className="text-xs text-slate-400">
                {candidate.width}x{candidate.height}
              </div>
              <p className="mt-2 rounded bg-slate-800 px-2 py-1 text-xs text-slate-200">
                Fecha evento: {candidate.eventDate ? new Date(candidate.eventDate).toLocaleString("es-AR") : "Sin fecha"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
