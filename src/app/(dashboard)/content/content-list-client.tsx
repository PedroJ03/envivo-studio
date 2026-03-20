"use client";

import { useState } from "react";
import Link from "next/link";

type ContentStatus = "all" | "draft" | "generating" | "generated" | "reviewed" | "approved" | "published" | "rejected" | "failed";

type ContentItem = {
  id: string;
  title: string;
  selectedFormat: "post" | "story" | "carousel";
  selectedTone: string | null;
  status: ContentStatus;
  createdAt: string;
};

type ContentListResponse = ContentItem[];

const STATUS_LABELS: Record<ContentStatus, string> = {
  all: "Todos",
  draft: "Borrador",
  generating: "Generando",
  generated: "Generado",
  reviewed: "Revisado",
  approved: "Aprobado",
  published: "Publicado",
  rejected: "Rechazado",
  failed: "Fallido",
};

const STATUS_BADGE_CLASSES: Record<ContentStatus, string> = {
  all: "bg-slate-700 text-slate-200",
  draft: "bg-slate-600 text-slate-200",
  generating: "bg-yellow-600/30 text-yellow-300",
  generated: "bg-blue-600/30 text-blue-300",
  reviewed: "bg-purple-600/30 text-purple-300",
  approved: "bg-emerald-600/30 text-emerald-300",
  published: "bg-green-600/30 text-green-300",
  rejected: "bg-red-600/30 text-red-300",
  failed: "bg-red-900/40 text-red-400",
};

interface ContentListClientProps {
  initialContent: ContentListResponse;
}

export function ContentListClient({ initialContent }: ContentListClientProps) {
  const [activeTab, setActiveTab] = useState<ContentStatus>("all");
  const [content] = useState<ContentListResponse>(initialContent);

  const filteredContent = activeTab === "all"
    ? content
    : content.filter((item) => item.status === activeTab);

  const tabs: ContentStatus[] = [
    "all", "draft", "generating", "generated", "reviewed", "approved", "published", "rejected", "failed",
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contenido</h1>
        <Link
          href="/events"
          className="rounded bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500"
        >
          Crear contenido
        </Link>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-700 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded-t px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-indigo-500 bg-slate-800 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            {STATUS_LABELS[tab]}
          </button>
        ))}
      </div>

      {filteredContent.length === 0 ? (
        <div className="rounded border border-slate-800 bg-slate-900/40 p-8 text-center">
          <p className="text-slate-400">
            {activeTab === "all"
              ? "No hay contenido todavía."
              : `No hay contenido en estado "${STATUS_LABELS[activeTab]}".`}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredContent.map((item) => (
            <li
              key={item.id}
              className="rounded border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-lg font-medium">{item.title}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Formato: {item.selectedFormat} · Tono: {item.selectedTone ?? "Sin definir"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Creado: {new Date(item.createdAt).toLocaleString("es-AR")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-semibold ${STATUS_BADGE_CLASSES[item.status]}`}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                  <Link
                    href={`/content/${item.id}`}
                    className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500"
                  >
                    Revisar
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
