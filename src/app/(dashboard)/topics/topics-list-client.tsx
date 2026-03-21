"use client";

import { useState, useEffect, useCallback } from "react";
import { FilterBar } from "./components/filter-bar";
import { TopicCard } from "./components/topic-card";
import { SelectionModal } from "./components/selection-modal";
import type {
  PendingTopic,
  FilterOptions,
  CreateSelectionInput,
  PendingTopicsResponse,
} from "@/lib/topics/types";

interface TopicsListClientProps {
  initialTopics: PendingTopic[];
  tenantId: string | null;
}

const DEFAULT_FILTERS: FilterOptions = {};

export function TopicsListClient({
  initialTopics,
  tenantId,
}: TopicsListClientProps) {
  const [topics, setTopics] = useState<PendingTopic[]>(initialTopics);
  const [selectedTopicIds, setSelectedTopicIds] = useState<Set<string>>(
    new Set(),
  );
  const [filters, setFilters] = useState<FilterOptions>(DEFAULT_FILTERS);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection modal state
  const [selectionModal, setSelectionModal] = useState<{
    open: boolean;
    topic: PendingTopic | null;
  }>({ open: false, topic: null });

  // Fetch topics when filters change (with debounce)
  useEffect(() => {
    const fetchTopics = async () => {
      if (!tenantId) return;

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: pagination.page.toString(),
          limit: "20",
        });

        if (filters.source) params.append("source", filters.source);
        if (filters.type) params.append("type", filters.type);
        if (filters.dateFrom) params.append("date_from", filters.dateFrom);
        if (filters.dateTo) params.append("date_to", filters.dateTo);

        const response = await fetch(
          `/api/topics/pending?${params.toString()}${tenantId ? `&tenant_id=${tenantId}` : ""}`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch topics");
        }

        const data: PendingTopicsResponse = await response.json();
        setTopics(data.topics);
        setPagination({ page: data.page, totalPages: data.totalPages });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar temas");
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(fetchTopics, 300);
    return () => clearTimeout(debounceTimer);
  }, [filters, pagination.page, tenantId]);

  const handleFiltersChange = useCallback((newFilters: FilterOptions) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 })); // Reset to page 1 when filters change
  }, []);

  const handleSelectTopic = useCallback((topic: PendingTopic) => {
    setSelectionModal({ open: true, topic });
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectionModal({ open: false, topic: null });
  }, []);

  const handleSubmitSelection = useCallback(
    async (selection: CreateSelectionInput) => {
      const response = await fetch("/api/topics/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create selection");
      }

      // Remove the selected topic from the list
      setTopics((prev) => prev.filter((t) => t.id !== selection.sourceId));
      setSelectedTopicIds((prev) => {
        const next = new Set(prev);
        next.delete(selection.sourceId);
        return next;
      });
    },
    [],
  );

  const handleDiscardTopic = useCallback(async (topic: PendingTopic) => {
    if (!confirm(`¿Descartar "${topic.title}"?`)) return;

    try {
      const response = await fetch("/api/topics/discard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceType: topic.sourceType,
          sourceId: topic.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to discard topic");
      }

      // Remove the discarded topic from the list
      setTopics((prev) => prev.filter((t) => t.id !== topic.id));
      setSelectedTopicIds((prev) => {
        const next = new Set(prev);
        next.delete(topic.id);
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al descartar tema");
    }
  }, []);

  const handleToggleSelect = useCallback((topicId: string) => {
    setSelectedTopicIds((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }, []);

  const handleBulkSelect = useCallback(() => {
    // For bulk select, we'd open a modal to configure common settings
    // For now, just show how many are selected
    alert(
      `${selectedTopicIds.size} temas seleccionados. Implementar selección masiva.`,
    );
  }, [selectedTopicIds]);

  const handlePageChange = useCallback((newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <FilterBar filters={filters} onFiltersChange={handleFiltersChange} />

      {/* Bulk Actions */}
      {selectedTopicIds.size > 0 && (
        <div className="flex items-center justify-between rounded border border-indigo-700/50 bg-indigo-900/20 p-3">
          <span className="text-sm text-indigo-200">
            {selectedTopicIds.size} tema(s) seleccionado(s)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedTopicIds(new Set())}
              className="rounded px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            >
              Limpiar selección
            </button>
            <button
              onClick={handleBulkSelect}
              className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Selección masiva
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded border border-red-700/50 bg-red-700/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded border border-slate-800 bg-slate-900/60 p-4"
            >
              <div className="flex gap-4">
                <div className="h-24 w-24 rounded bg-slate-800" />
                <div className="flex-1 space-y-3">
                  <div className="h-4 w-48 rounded bg-slate-800" />
                  <div className="h-3 w-full rounded bg-slate-800" />
                  <div className="h-3 w-3/4 rounded bg-slate-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && topics.length === 0 && !error && (
        <div className="rounded border border-slate-800 bg-slate-900/40 p-12 text-center">
          <p className="text-lg text-slate-400">No hay temas pendientes</p>
          <p className="mt-2 text-sm text-slate-500">
            {Object.keys(filters).length > 0
              ? "Probá cambiando los filtros"
              : "Los temas seleccionados aparecerán aquí"}
          </p>
        </div>
      )}

      {/* Topics Grid */}
      {!isLoading && topics.length > 0 && (
        <>
          <div className="space-y-4">
            {topics.map((topic) => (
              <TopicCard
                key={`${topic.sourceType}-${topic.id}`}
                topic={topic}
                isSelected={selectedTopicIds.has(topic.id)}
                onSelect={handleSelectTopic}
                onDiscard={handleDiscardTopic}
                onToggleSelect={handleToggleSelect}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Anterior
              </button>
              <span className="text-sm text-slate-400">
                Página {pagination.page} de {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="rounded border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

      {/* Selection Modal */}
      <SelectionModal
        open={selectionModal.open}
        topic={selectionModal.topic}
        onClose={handleCloseModal}
        onSubmit={handleSubmitSelection}
      />
    </div>
  );
}
