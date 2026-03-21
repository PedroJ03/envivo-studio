"use client";

import { Search, X } from "lucide-react";
import type { SourceType, FilterOptions } from "@/lib/topics/types";

interface FilterBarProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  sources?: string[];
}

const SOURCE_OPTIONS = [
  { value: "", label: "Todas las fuentes" },
  { value: "ticketmaster", label: "Ticketmaster" },
  { value: "eventbrite", label: "Eventbrite" },
  { value: "wikimedia", label: "Wikimedia" },
  { value: "newsapi", label: "NewsAPI" },
  { value: "gnews", label: "GNews" },
];

const TYPE_TABS: { value: SourceType | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "calendar_event", label: "Eventos" },
  { value: "content_feed_item", label: "Feed" },
];

export function FilterBar({
  filters,
  onFiltersChange,
  sources = [],
}: FilterBarProps) {
  const handleSourceChange = (source: string) => {
    onFiltersChange({ ...filters, source: source || undefined });
  };

  const handleTypeChange = (type: SourceType | "all") => {
    onFiltersChange({ ...filters, type: type === "all" ? undefined : type });
  };

  const handleDateFromChange = (dateFrom: string) => {
    onFiltersChange({ ...filters, dateFrom: dateFrom || undefined });
  };

  const handleDateToChange = (dateTo: string) => {
    onFiltersChange({ ...filters, dateTo: dateTo || undefined });
  };

  const handleSearchChange = (search: string) => {
    // Search is handled via the /api/topics/pending endpoint via title filter
    // For now we'll store it but not use it since the API doesn't support text search yet
    onFiltersChange({ ...filters });
  };

  const handleClearFilters = () => {
    onFiltersChange({});
  };

  const hasActiveFilters =
    filters.source || filters.type || filters.dateFrom || filters.dateTo;

  return (
    <div className="space-y-4 rounded border border-slate-800 bg-slate-900/40 p-4">
      {/* Search and Type Tabs Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar temas..."
            className="w-full rounded border border-slate-700 bg-slate-800 pl-10 pr-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Type Tabs */}
        <div className="flex rounded border border-slate-700 bg-slate-800 p-1">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleTypeChange(tab.value)}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                filters.type === tab.value ||
                (!filters.type && tab.value === "all")
                  ? "bg-indigo-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Source Dropdown */}
        <div className="min-w-[180px]">
          <select
            value={filters.source ?? ""}
            onChange={(e) => handleSourceChange(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Desde:</span>
          <input
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) => handleDateFromChange(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Hasta:</span>
          <input
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) => handleDateToChange(e.target.value)}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={handleClearFilters}
            className="flex items-center gap-1 rounded px-3 py-2 text-sm text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
            Limpiar filtros
          </button>
        )}
      </div>
    </div>
  );
}
