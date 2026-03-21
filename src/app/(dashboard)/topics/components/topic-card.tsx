"use client";

import { Calendar, AlertCircle } from "lucide-react";
import type { PendingTopic } from "@/lib/topics/types";

interface TopicCardProps {
  topic: PendingTopic;
  isSelected: boolean;
  onSelect: (topic: PendingTopic) => void;
  onDiscard: (topic: PendingTopic) => void;
  onToggleSelect: (topicId: string) => void;
}

const SOURCE_BADGE_COLORS: Record<string, string> = {
  ticketmaster: "bg-purple-900/50 text-purple-200 border-purple-700",
  eventbrite: "bg-pink-900/50 text-pink-200 border-pink-700",
  wikimedia: "bg-cyan-900/50 text-cyan-200 border-cyan-700",
  newsapi: "bg-blue-900/50 text-blue-200 border-blue-700",
  gnews: "bg-green-900/50 text-green-200 border-green-700",
  default: "bg-slate-700/50 text-slate-300 border-slate-600",
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  calendar_event: "bg-amber-900/50 text-amber-200 border-amber-700",
  content_feed_item: "bg-teal-900/50 text-teal-200 border-teal-700",
};

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Baja", color: "bg-slate-600 text-slate-200" },
  2: { label: "Normal", color: "bg-blue-600/50 text-blue-200" },
  3: { label: "Alta", color: "bg-orange-600/50 text-orange-200" },
  4: { label: "Urgente", color: "bg-red-600/50 text-red-200" },
};

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return dateStr;
  }
}

function getSourceBadgeColor(source: string): string {
  return (
    SOURCE_BADGE_COLORS[source.toLowerCase()] ?? SOURCE_BADGE_COLORS.default
  );
}

export function TopicCard({
  topic,
  isSelected,
  onSelect,
  onDiscard,
  onToggleSelect,
}: TopicCardProps) {
  const priorityInfo = PRIORITY_LABELS[topic.priority] ?? PRIORITY_LABELS[2];

  return (
    <article
      className={`rounded border bg-slate-900/60 p-4 transition-colors ${
        isSelected ? "border-indigo-500 bg-indigo-900/20" : "border-slate-800"
      }`}
    >
      <div className="flex gap-4">
        {/* Checkbox for bulk selection */}
        <div className="flex flex-col items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(topic.id)}
            className="h-5 w-5 accent-indigo-500"
          />
        </div>

        {/* Image */}
        <div className="flex-shrink-0">
          {topic.image ? (
            <img
              src={topic.image}
              alt={topic.title}
              className="h-24 w-24 rounded object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded bg-slate-800">
              <Calendar className="h-8 w-8 text-slate-600" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Badges Row */}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span
              className={`rounded border px-2 py-0.5 text-xs font-medium ${getSourceBadgeColor(
                topic.source,
              )}`}
            >
              {topic.source}
            </span>
            <span
              className={`rounded border px-2 py-0.5 text-xs font-medium ${
                TYPE_BADGE_COLORS[topic.sourceType] ??
                "bg-slate-700 text-slate-300"
              }`}
            >
              {topic.sourceType === "calendar_event" ? "Evento" : "Feed"}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${priorityInfo.color}`}
            >
              {priorityInfo.label}
            </span>
            {topic.isShared && (
              <span className="rounded bg-emerald-900/50 px-2 py-0.5 text-xs font-medium text-emerald-200">
                Compartido
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="truncate text-lg font-medium text-white">
            {topic.title}
          </h3>

          {/* Description */}
          {topic.description && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-400">
              {topic.description}
            </p>
          )}

          {/* Date and Type */}
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
            <span>{formatDate(topic.date)}</span>
            <span>·</span>
            <span className="capitalize">{topic.type.replace(/_/g, " ")}</span>
          </div>

          {/* Tags */}
          {topic.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {topic.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400"
                >
                  {tag}
                </span>
              ))}
              {topic.tags.length > 3 && (
                <span className="text-xs text-slate-500">
                  +{topic.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onSelect(topic)}
            className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Seleccionar
          </button>
          <button
            onClick={() => onDiscard(topic)}
            className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            Descartar
          </button>
        </div>
      </div>
    </article>
  );
}
