"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type PhotoItem = {
  photoId: string;
  sourceId: string;
  photoUrl: string;
  width: number;
  height: number;
};

type EventInfo = {
  id: string;
  title: string;
  venue: string | null;
  eventDate: Date | null;
  statusText: string;
};

type FormatType = "post" | "story" | "carousel";

const FORMAT_LABELS: Record<FormatType, string> = {
  post: "Post",
  story: "Story",
  carousel: "Carousel",
};

const TONE_OPTIONS = [
  { value: "dany", label: "Dany (personalizado)" },
  { value: "informativo", label: "Informativo" },
];

interface EventDetailClientProps {
  event: EventInfo;
  photos: PhotoItem[];
  tenantSlug: string | null;
}

export function EventDetailClient({
  event,
  photos,
  tenantSlug,
}: EventDetailClientProps) {
  const router = useRouter();
  const [selectedPhotos, setSelectedPhotos] = useState<Set<string>>(new Set());
  const [selectedFormat, setSelectedFormat] = useState<FormatType>("post");
  const [selectedTone, setSelectedTone] = useState<string>("dany");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const togglePhoto = (photoId: string) => {
    const newSelected = new Set(selectedPhotos);
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId);
    } else {
      newSelected.add(photoId);
    }
    setSelectedPhotos(newSelected);
  };

  const selectAll = () => {
    setSelectedPhotos(new Set(photos.map((p) => p.photoId)));
  };

  const deselectAll = () => {
    setSelectedPhotos(new Set());
  };

  const handleCreateCandidate = async () => {
    if (selectedPhotos.size === 0) {
      setError("Seleccioná al menos una foto");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const selectedPhotoArray = Array.from(selectedPhotos);
      const baseUrl = tenantSlug
        ? `/api/content?tenant_id=${tenantSlug}`
        : "/api/content";

      // Create a candidate for each selected photo
      const results = [];
      for (const photoId of selectedPhotoArray) {
        const photo = photos.find((p) => p.photoId === photoId);
        if (!photo) {
          continue;
        }
        const response = await fetch(baseUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceId: photo.sourceId,
            eventId: event.id,
            photoId: photoId,
            title: `${event.title} - Foto ${selectedPhotoArray.indexOf(photoId) + 1}`,
            summaryJson: {},
            selectedFormat,
            selectedTone,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create candidate");
        }

        results.push(await response.json());
      }

      // Redirect to content list
      const contentUrl = tenantSlug
        ? `/content?tenant_id=${tenantSlug}`
        : "/content";
      router.push(contentUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear candidato");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Detalle del evento</h1>
      <div className="rounded border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="text-xl font-medium">{event.title}</h2>
        <p className="mt-1 text-sm text-slate-300">
          Estado: {event.statusText}
        </p>
        <p className="text-sm text-slate-400">
          {event.venue ? `Lugar: ${event.venue}` : "Lugar sin definir"}
        </p>
        {event.eventDate ? (
          <p className="text-sm text-slate-400" suppressHydrationWarning={true}>
            Fecha:{" "}
            {new Intl.DateTimeFormat("es-AR", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(event.eventDate)}
          </p>
        ) : null}
      </div>

      <h3 className="text-lg font-semibold">Fotos ({photos.length})</h3>
      {photos.length === 0 ? (
        <p className="text-sm text-slate-400">
          Todavía no hay fotos para este evento.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={selectAll}
              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-600"
            >
              Seleccionar todas
            </button>
            <button
              onClick={deselectAll}
              className="rounded bg-slate-700 px-3 py-1.5 text-sm text-white hover:bg-slate-600"
            >
              Deseleccionar
            </button>
            <span className="text-sm text-slate-400">
              {selectedPhotos.size} seleccionada(s)
            </span>
          </div>

          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <li
                key={photo.photoId}
                className={`rounded border p-3 transition-colors ${
                  selectedPhotos.has(photo.photoId)
                    ? "border-indigo-500 bg-indigo-900/20"
                    : "border-slate-700 bg-slate-900/40"
                }`}
              >
                <label className="flex cursor-pointer gap-3">
                  <input
                    type="checkbox"
                    checked={selectedPhotos.has(photo.photoId)}
                    onChange={() => togglePhoto(photo.photoId)}
                    className="mt-1 h-4 w-4 accent-indigo-500"
                  />
                  <div className="flex-1">
                    <img
                      src={photo.photoUrl ?? ""}
                      alt={`Foto ${photo.photoId}`}
                      className="mb-2 w-full rounded bg-slate-800 object-cover"
                      loading="lazy"
                    />
                    <div className="text-xs text-slate-400">
                      {photo.width}x{photo.height}
                    </div>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}

      {selectedPhotos.size > 0 && (
        <div className="space-y-4 rounded border border-slate-700 bg-slate-900/60 p-4">
          <h4 className="text-lg font-semibold">
            Crear candidato de contenido
          </h4>

          <div className="flex flex-wrap gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Formato
              </label>
              <select
                value={selectedFormat}
                onChange={(e) =>
                  setSelectedFormat(e.target.value as FormatType)
                }
                className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
              >
                {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Tono
              </label>
              <select
                value={selectedTone}
                onChange={(e) => setSelectedTone(e.target.value)}
                className="rounded border border-slate-600 bg-slate-800 px-3 py-2 text-white"
              >
                {TONE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <p className="rounded border border-red-700/50 bg-red-700/10 p-3 text-sm text-red-200">
              {error}
            </p>
          )}

          <button
            onClick={handleCreateCandidate}
            disabled={isCreating}
            className="rounded bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {isCreating
              ? "Creando..."
              : `Crear ${selectedPhotos.size} candidato(s)`}
          </button>
        </div>
      )}
    </section>
  );
}
