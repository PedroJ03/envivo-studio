envivo-studio foundation setup

This repository contains the first batch for the EnVivo multi-tenant content platform.

## Included in this foundation

- Next.js 15 + TypeScript (strict)
- Drizzle ORM + PostgreSQL tooling (`drizzle-kit`, schema + migration baseline)
- Tenant-aware DB utility (`src/lib/db/tenant.ts`) and starter `withTenantDb`
- Candidate/content tables:
  - `tenants`
  - `sources`
  - `events`
  - `photos`
  - `candidate_content`
  - `content_state`
  - `generated_output`
- Inngest bootstrap route at `/api/inngest`
- NextAuth configuration scaffold (credentials provider, tenant claim in session)
- Shadcn-style base UI + shared utility (`src/components/ui/button.tsx`, `src/lib/utils.ts`)
- Tenant health check route and dashboard layout shell

## Setup

```bash
cp .env.example .env.local
npm install
npm run db:generate
npm run db:push        # requires a running PostgreSQL + DATABASE_URL
npm run db:seed
npm run dev
```

## Scripts

- `npm run lint` — ESLint
- `npm run format` — Prettier check
- `npm run typecheck` — TypeScript strict checks
- `npm run test` — Vitest suite
- `npm run test:tenant` — tenant isolation baseline test
- `npm run db:generate` — generate Drizzle migrations
- `npm run db:push` — apply migrations
- `npm run db:seed` — seed default tenant (`envivo-tandil`)
