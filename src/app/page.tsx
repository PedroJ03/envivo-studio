import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-start justify-center gap-6 px-6 py-20">
        <p className="text-sm uppercase tracking-widest text-slate-400">EnVivo Core</p>
        <h1 className="text-4xl font-bold">Bienvenido a envivo-studio</h1>
        <p className="max-w-2xl text-base text-slate-300">
          Foundation for a multi-tenant content pipeline: Drizzle + PostgreSQL, Inngest,
          Next.js 15 App Router and tenant-scoped models.
        </p>
        <div className="flex gap-3">
            <Button asChild>
              <Link href="/dashboard">Open dashboard shell</Link>
            </Button>
          <Button asChild variant="secondary">
            <a href="/api/health">Check API health</a>
          </Button>
        </div>
      </main>
    </div>
  );
}
