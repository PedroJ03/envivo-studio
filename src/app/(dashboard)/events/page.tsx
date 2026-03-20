import Link from "next/link";
import { cookies, headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";

import { withTenantDb } from "@/lib/db/client";
import { events } from "@/lib/db/schema";
import { TENANT_HEADER } from "@/middleware";

type EventCard = {
  id: string;
  title: string;
  eventDate: Date | null;
  venue: string | null;
  statusText: string;
};

async function getTenantId() {
  const headerTenant = (await headers()).get(TENANT_HEADER);
  if (headerTenant) {
    return headerTenant;
  }

  return (await cookies()).get("tenant-id")?.value ?? null;
}

async function loadEvents(tenantId: string): Promise<EventCard[]> {
  return withTenantDb(tenantId, async (tx) => {
    return tx
      .select({
        id: events.id,
        title: events.title,
        eventDate: events.eventDate,
        venue: events.venue,
        statusText: events.statusText,
      })
      .from(events)
      .where(and(eq(events.tenantId, tenantId)))
      .orderBy(desc(events.createdAt));
  });
}

function formatDate(date: Date | null): string {
  if (!date) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function EventsPage() {
  const tenantId = await getTenantId();

  if (!tenantId) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Eventos</h1>
        <p className="rounded border border-yellow-700/50 bg-yellow-700/10 p-3 text-sm">
          Falta contexto de tenant. Pasá <code className="rounded bg-black/40 px-1">tenant_id</code> por
          querystring/cookie para ver eventos.
        </p>
      </section>
    );
  }

  try {
    const rows = await loadEvents(tenantId);

    if (rows.length === 0) {
      return (
        <section className="space-y-4">
          <h1 className="text-2xl font-semibold">Eventos</h1>
          <p className="text-sm text-slate-400">Sin eventos todavía para este tenant.</p>
        </section>
      );
    }

    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Eventos</h1>
        <div className="space-y-3">
          {rows.map((event) => (
            <article
              key={event.id}
              className="rounded border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="mb-2 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">{event.title}</h2>
                  <p className="text-sm text-slate-400">{formatDate(event.eventDate)} · {event.venue || "Sin venue"}</p>
                </div>
                <span className="rounded bg-emerald-900/40 px-2 py-1 text-xs font-semibold text-emerald-300">
                  {event.statusText}
                </span>
              </div>
              <Link
                href={`/events/${event.id}`}
                className="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500"
              >
                Ver detalle
              </Link>
            </article>
          ))}
        </div>
      </section>
    );
  } catch (error) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-semibold">Eventos</h1>
        <p className="rounded border border-red-700/50 bg-red-700/10 p-3 text-sm text-red-100">
          No pudimos cargar los eventos. Revisá la DB y configuración de entorno: {String(error)}
        </p>
      </section>
    );
  }
}
