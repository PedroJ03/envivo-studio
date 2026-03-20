"use client";

import { useEffect, useState } from "react";

type HistoryEntry = {
  id: string;
  state: string;
  actor: string | null;
  rejectionReason: string | null;
  createdAt: string;
  metadataJson: {
    transition?: {
      from: string | null;
      to: string;
      event: string;
      actor: string | null;
    };
    reason?: string | null;
  };
};

type ContentHistoryProps = {
  candidateContentId: string;
};

const EVENT_LABELS: Record<string, string> = {
  CREATE: "Creado",
  SUBMIT_FOR_REVIEW: "Enviado a revisión",
  START_GENERATION: "Generación iniciada",
  GENERATION_SUCCESS: "Generación exitosa",
  GENERATION_FAILED: "Generación fallida",
  APPROVE: "Aprobado",
  REJECT: "Rechazado",
  REGENERATE: "Regenerado",
  PUBLISH: "Publicado",
  REVIEW_TIMEOUT: "Tiempo de revisión agotado",
};

const STATE_LABELS: Record<string, string> = {
  draft: "Borrador",
  generating: "Generando",
  generated: "Generado",
  approved: "Aprobado",
  reviewed: "Revisado",
  published: "Publicado",
  rejected: "Rechazado",
  failed: "Fallido",
};

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(dateStr));
}

export function ContentHistory({ candidateContentId }: ContentHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`/api/content/${candidateContentId}/history`);

        if (!res.ok) {
          throw new Error("Failed to load history");
        }

        const data = await res.json();
        setHistory(data.history ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, [candidateContentId]);

  if (loading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-300">Historial</h3>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 rounded bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-300">Historial</h3>
        <p className="text-xs text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-300">Historial</h3>
        <p className="text-sm text-slate-500">Sin historial disponible.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-300">Historial</h3>
      <ol className="relative border-l border-slate-700 pl-4 space-y-4">
        {history.map((entry) => {
          const eventLabel = entry.metadataJson?.transition?.event
            ? EVENT_LABELS[entry.metadataJson.transition.event] ?? entry.metadataJson.transition.event
            : STATE_LABELS[entry.state] ?? entry.state;
          const transition = entry.metadataJson?.transition;
          const actor = entry.actor ?? transition?.actor ?? "Sistema";

          return (
            <li key={entry.id} className="relative">
              <div className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-slate-600 bg-slate-800" />
              <div className="ml-4 space-y-1">
                <p className="text-sm font-medium text-slate-200">
                  {eventLabel}
                  {transition?.from && transition?.to && transition.from !== transition.to && (
                    <span className="ml-1 text-slate-500">
                      ({transition.from} → {transition.to})
                    </span>
                  )}
                </p>
                {entry.rejectionReason && (
                  <p className="text-xs rounded bg-red-900/30 px-2 py-1 text-red-300">
                    Razón: {entry.rejectionReason}
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  {actor} · {formatDate(entry.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
