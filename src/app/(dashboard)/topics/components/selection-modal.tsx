"use client";

import { useState, useEffect } from "react";
import { X, Calendar, AlertTriangle } from "lucide-react";
import type {
  PendingTopic,
  FormatConfig,
  FormatType,
  Tone,
  Urgency,
  CreateSelectionInput,
} from "@/lib/topics/types";
import { FORMAT_TYPES, TONES, URGENCY_LEVELS } from "@/lib/topics/types";

interface SelectionModalProps {
  open: boolean;
  topic: PendingTopic | null;
  onClose: () => void;
  onSubmit: (selection: CreateSelectionInput) => Promise<void>;
}

const FORMAT_LABELS: Record<FormatType, string> = {
  post: "Instagram Post",
  story: "Instagram Story",
  reel: "Instagram Reel",
};

const TONE_LABELS: Record<Tone, string> = {
  informative: "Informativo",
  opinion: "Opinión",
  nostalgic: "Nostálgico",
  humorous: "Humorístico",
  urgent: "Urgente",
};

const URGENCY_LABELS: Record<Urgency, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  breaking: "Urgente",
};

const URGENCY_COLORS: Record<Urgency, string> = {
  low: "bg-slate-700 border-slate-600 text-slate-300",
  medium: "bg-blue-900/50 border-blue-700 text-blue-200",
  high: "bg-orange-900/50 border-orange-700 text-orange-200",
  breaking: "bg-red-900/50 border-red-700 text-red-200",
};

export function SelectionModal({
  open,
  topic,
  onClose,
  onSubmit,
}: SelectionModalProps) {
  const [selectedFormats, setSelectedFormats] = useState<FormatType[]>([]);
  const [tones, setTones] = useState<Record<FormatType, Tone>>({
    post: "informative",
    story: "informative",
    reel: "urgent",
  });
  const [urgency, setUrgency] = useState<Urgency>("medium");
  const [targetPublishAt, setTargetPublishAt] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when topic changes
  useEffect(() => {
    if (topic) {
      setSelectedFormats([]);
      setTones({ post: "informative", story: "informative", reel: "urgent" });
      setUrgency("medium");
      setTargetPublishAt("");
      setError(null);
    }
  }, [topic]);

  const handleFormatToggle = (format: FormatType) => {
    setSelectedFormats((prev) =>
      prev.includes(format)
        ? prev.filter((f) => f !== format)
        : [...prev, format],
    );
  };

  const handleToneChange = (format: FormatType, tone: Tone) => {
    setTones((prev) => ({ ...prev, [format]: tone }));
  };

  const handleSubmit = async () => {
    if (!topic) return;

    if (selectedFormats.length === 0) {
      setError("Seleccioná al menos un formato");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formatConfigs: FormatConfig[] = selectedFormats.map(
        (format, index) => ({
          type: format,
          tone: tones[format],
          priority: index + 1,
        }),
      );

      await onSubmit({
        sourceType: topic.sourceType,
        sourceId: topic.id,
        formats: formatConfigs,
        targetPublishAt: targetPublishAt || undefined,
        urgency,
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear selección");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open || !topic) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h2 className="text-lg font-semibold">Seleccionar Tema</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-6">
          {/* Topic Preview */}
          <div className="flex gap-4 rounded border border-slate-800 bg-slate-800/50 p-4">
            {topic.image && (
              <img
                src={topic.image}
                alt={topic.title}
                className="h-32 w-32 flex-shrink-0 rounded object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-medium">{topic.title}</h3>
              {topic.description && (
                <p className="mt-1 text-sm text-slate-400 line-clamp-3">
                  {topic.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="h-3 w-3" />
                <span>{new Date(topic.date).toLocaleDateString("es-AR")}</span>
                <span>·</span>
                <span className="capitalize">{topic.source}</span>
              </div>
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Formatos a generar *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {FORMAT_TYPES.map((format) => (
                <label
                  key={format}
                  className={`flex cursor-pointer items-center justify-center rounded border p-3 transition-colors ${
                    selectedFormats.includes(format)
                      ? "border-indigo-500 bg-indigo-900/30 text-indigo-200"
                      : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedFormats.includes(format)}
                    onChange={() => handleFormatToggle(format)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">
                    {FORMAT_LABELS[format]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Tone per Format */}
          {selectedFormats.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-200">
                Tono para cada formato
              </label>
              <div className="space-y-3">
                {selectedFormats.map((format) => (
                  <div
                    key={format}
                    className="flex items-center gap-4 rounded border border-slate-800 bg-slate-800/30 p-3"
                  >
                    <span className="w-32 text-sm font-medium text-slate-300">
                      {FORMAT_LABELS[format]}
                    </span>
                    <select
                      value={tones[format]}
                      onChange={(e) =>
                        handleToneChange(format, e.target.value as Tone)
                      }
                      className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    >
                      {TONES.map((tone) => (
                        <option key={tone} value={tone}>
                          {TONE_LABELS[tone]}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Urgency */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Urgencia
            </label>
            <div className="grid grid-cols-4 gap-2">
              {URGENCY_LEVELS.map((level) => (
                <label
                  key={level}
                  className={`flex cursor-pointer items-center justify-center rounded border p-2 transition-colors ${
                    urgency === level
                      ? `${URGENCY_COLORS[level]} border-current`
                      : "border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="urgency"
                    value={level}
                    checked={urgency === level}
                    onChange={() => setUrgency(level)}
                    className="sr-only"
                  />
                  <div className="text-center">
                    {level === "breaking" && (
                      <AlertTriangle className="mx-auto mb-1 h-4 w-4" />
                    )}
                    <span className="text-xs font-medium">
                      {URGENCY_LABELS[level]}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Target Publish Date */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-200">
              Fecha de publicación objetivo (opcional)
            </label>
            <input
              type="datetime-local"
              value={targetPublishAt}
              onChange={(e) => setTargetPublishAt(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Dejá vacío para que el sistema calcule el mejor horario
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded border border-red-700/50 bg-red-700/10 p-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-700 p-4">
          <button
            onClick={onClose}
            className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || selectedFormats.length === 0}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSubmitting ? "Guardando..." : "Confirmar selección"}
          </button>
        </div>
      </div>
    </div>
  );
}
