import Link from "next/link";
import { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/70">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <h1 className="text-lg font-semibold">envivo-studio</h1>
          <nav className="flex items-center gap-4 text-sm text-slate-200">
            <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/">
              Dashboard
            </Link>
            <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/events">
              Eventos
            </Link>
            <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/content">
              Contenido
            </Link>
            <Link className="rounded px-2 py-1 hover:bg-slate-800" href="/api/health">
              Health
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl p-6">{children}</main>
    </div>
  );
}
