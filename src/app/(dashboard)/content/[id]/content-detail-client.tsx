"use client";

import { useState, useCallback } from "react";
import { ContentHistory } from "@/components/content/content-history";

type Photo = {
  id: string;
  originalUrl: string;
  width: number;
  height: number;
};

type Persona = {
  id: string;
  slug: string;
  name: string;
};

type GeneratedOutput = {
  id: string;
  fileUrl: string;
  sortOrder: number;
  width: number;
  height: number;
};

type ContentDetailState = {
  id: string;
  title: string;
  selectedFormat: "post" | "story" | "carousel";
  selectedTone: string | null;
  currentState: string;
  actor: string | null;
  rejectionReason: string | null;
};

type PreviewData = {
  fileUrl: string;
  width: number;
  height: number;
  caption?: string;
};

type ActionBarProps = {
  contentId: string;
  currentState: string;
  onActionComplete: () => void;
};

function ActionBar({ contentId, currentState, onActionComplete }: ActionBarProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canApprove = currentState === "generated" || currentState === "reviewed";
  const canReject = currentState === "generated" || currentState === "reviewed";
  const canRegenerate = currentState === "generated" || currentState === "reviewed" || currentState === "rejected";
  const canSubmit = currentState === "draft";

  const handleAction = async (action: string) => {
    setLoading(action);
    setError(null);

    try {
      const body: Record<string, unknown> = { action };

      if (action === "reject" && reason.trim()) {
        body.reason = reason.trim();
      }

      const res = await fetch(`/api/content/${contentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Action failed");
      }

      setReason("");
      setShowRejectInput(false);
      onActionComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3 rounded border border-slate-700 bg-slate-900/40 p-4">
      <h3 className="text-sm font-semibold text-slate-300">Acciones</h3>

      {error && (
        <p className="rounded bg-red-900/30 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {showRejectInput && (
        <div className="space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo del rechazo..."
            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleAction("reject")}
              disabled={loading === "reject"}
              className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-50"
            >
              {loading === "reject" ? "Rechazando..." : "Confirmar rechazo"}
            </button>
            <button
              onClick={() => setShowRejectInput(false)}
              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!showRejectInput && (
        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <button
              onClick={() => handleAction("submit")}
              disabled={loading !== null}
              className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading === "submit" ? "Enviando..." : "Enviar a revisión"}
            </button>
          )}

          {canApprove && (
            <button
              onClick={() => handleAction("approve")}
              disabled={loading !== null}
              className="rounded bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {loading === "approve" ? "Aprobando..." : "Aprobar"}
            </button>
          )}

          {canReject && (
            <button
              onClick={() => setShowRejectInput(true)}
              disabled={loading !== null}
              className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-500 disabled:opacity-50"
            >
              Rechazar
            </button>
          )}

          {canRegenerate && (
            <button
              onClick={() => handleAction("regenerate")}
              disabled={loading === "regenerate"}
              className="rounded bg-yellow-600 px-4 py-2 text-sm text-white hover:bg-yellow-500 disabled:opacity-50"
            >
              {loading === "regenerate" ? "Regenerando..." : "Regenerar"}
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500">
        Estado actual: <span className="font-medium text-slate-400">{currentState}</span>
      </p>
    </div>
  );
}

type ContentDetailClientProps = {
  content: ContentDetailState;
  photos: Photo[];
  personas: Persona[];
  generatedOutputs: GeneratedOutput[];
  previewData?: PreviewData;
};

export function ContentDetailClient({
  content,
  photos: initialPhotos,
  personas,
  generatedOutputs: initialOutputs,
  previewData: initialPreview,
}: ContentDetailClientProps) {
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(
    new Set(initialPhotos.filter((p) => p).map((p) => p.id)),
  );
  const [format, setFormat] = useState<"post" | "story" | "carousel">(content.selectedFormat);
  const [tone, setTone] = useState<string>(content.selectedTone ?? personas[0]?.slug ?? "");
  const [preview, setPreview] = useState<PreviewData | null>(initialPreview ?? null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const togglePhoto = useCallback((photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }, []);

  const handleFormatChange = (newFormat: "post" | "story" | "carousel") => {
    setFormat(newFormat);
  };

  const handleToneChange = (newTone: string) => {
    setTone(newTone);
  };

  const handlePreview = async () => {
    setLoadingPreview(true);
    setPreviewError(null);

    try {
      const res = await fetch("/api/composer/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateContentId: content.id,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Preview failed");
      }

      const data = await res.json();
      setPreview({
        fileUrl: data.fileUrl,
        width: data.width,
        height: data.height,
      });
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{content.title}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Estado: <span className="font-medium text-slate-300">{content.currentState}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Selección de fotos</h2>
            {initialPhotos.length === 0 ? (
              <p className="text-sm text-slate-400">No hay fotos disponibles.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {initialPhotos.map((photo) => (
                  <li key={photo.id}>
                    <button
                      onClick={() => togglePhoto(photo.id)}
                      className={`relative w-full overflow-hidden rounded border-2 transition-colors ${
                        selectedPhotoIds.has(photo.id)
                          ? "border-indigo-500"
                          : "border-transparent hover:border-slate-600"
                      }`}
                    >
                      <img
                        src={photo.originalUrl}
                        alt={`Foto ${photo.id.slice(0, 8)}`}
                        className="aspect-square w-full bg-slate-800 object-cover"
                      />
                      {selectedPhotoIds.has(photo.id) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-indigo-500/30">
                          <span className="rounded-full bg-indigo-500 px-2 py-1 text-xs font-bold text-white">
                            ✓
                          </span>
                        </div>
                      )}
                      <p className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-xs text-white">
                        {photo.width}x{photo.height}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Formato</h2>
            <div className="flex gap-2">
              {(["post", "story", "carousel"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => handleFormatChange(f)}
                  className={`rounded px-4 py-2 text-sm font-medium transition-colors ${
                    format === f
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {f === "post" ? "Post" : f === "story" ? "Story" : "Carousel"}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Tono / Persona</h2>
            <select
              value={tone}
              onChange={(e) => handleToneChange(e.target.value)}
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              {personas.map((p) => (
                <option key={p.id} value={p.slug}>
                  {p.name}
                </option>
              ))}
            </select>
          </section>

          <ActionBar
            contentId={content.id}
            currentState={content.currentState}
            onActionComplete={() => window.location.reload()}
          />
        </div>

        <div className="space-y-4">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Vista previa</h2>
              <button
                onClick={handlePreview}
                disabled={loadingPreview}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {loadingPreview ? "Generando..." : "Generar preview"}
              </button>
            </div>

            {previewError && (
              <p className="rounded bg-red-900/30 px-3 py-2 text-sm text-red-300">
                {previewError}
              </p>
            )}

            {preview ? (
              <div className="space-y-2">
                <img
                  src={preview.fileUrl}
                  alt="Preview"
                  className="w-full rounded border border-slate-700 bg-slate-800"
                  style={{ aspectRatio: `${preview.width}/${preview.height}` }}
                />
                <p className="text-xs text-slate-500">
                  {preview.width}x{preview.height}px
                </p>
              </div>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded border border-slate-700 bg-slate-800">
                <p className="text-sm text-slate-500">
                  Hacé click en &quot;Generar preview&quot; para ver el resultado.
                </p>
              </div>
            )}
          </section>

          {initialOutputs.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Imágenes generadas</h2>
              <ul className="space-y-2">
                {initialOutputs
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((output) => (
                    <li key={output.id} className="rounded border border-slate-700 bg-slate-900/40 p-2">
                      <img
                        src={output.fileUrl}
                        alt={`Slide ${output.sortOrder + 1}`}
                        className="w-full rounded bg-slate-800"
                      />
                      <p className="mt-1 text-xs text-slate-500">
                        Slide {output.sortOrder + 1} · {output.width}x{output.height}px
                      </p>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          <section className="space-y-3 rounded border border-slate-700 bg-slate-900/40 p-4">
            <ContentHistory candidateContentId={content.id} />
          </section>
        </div>
      </div>
    </div>
  );
}
