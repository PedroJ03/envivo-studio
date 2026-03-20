import dotenv from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { withTenantContext, withTenantConfigSet } from "./tenant";

dotenv.config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required. Create .env.local from .env.example.");
}

const queryClient = postgres(databaseUrl);

export const db = drizzle(queryClient, { schema });

export async function withTenantDb<T>(
  tenantId: string,
  fn: (tx: typeof db) => Promise<T>,
): Promise<T> {
  return withTenantContext(tenantId, async () => {
    return db.transaction(async (tx) => {
      await tx.execute(withTenantConfigSet(tenantId));
      return fn(tx as unknown as typeof db);
    });
  });
}

export async function closeDb(): Promise<void> {
  await queryClient.end();
}
