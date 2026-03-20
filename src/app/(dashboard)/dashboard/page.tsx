export default function DashboardHome() {
  return (
    <section className="w-full rounded-lg border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-2xl font-semibold">Dashboard shell (phase 1)</h2>
      <p className="mt-2 text-sm text-slate-300">
        Aquí van los módulos de eventos, candidatos y administración de contenido.
      </p>
      <ul className="mt-4 list-disc pl-5 text-sm text-slate-400">
        <li>Project setup: Drizzle + Postgres + migration baseline ready.</li>
        <li>Tenant model and candidate/content tables defined.</li>
        <li>Inngest endpoint registered and health check route available.</li>
      </ul>
    </section>
  );
}
