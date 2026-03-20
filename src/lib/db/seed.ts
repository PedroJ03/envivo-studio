import { eq } from "drizzle-orm";
import { closeDb, db } from "./client";
import { tenants } from "./schema";

async function main() {
  const tenantSlug = process.env.SEED_TENANT_SLUG ?? "envivo-tandil";

  const existing = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, tenantSlug));

  if (existing.length > 0) {
    console.info(`Tenant \"${tenantSlug}\" already exists. Nothing to do.`);
    return;
  }

  await db.insert(tenants).values({
    slug: tenantSlug,
    name: "Envivo Tandil",
    configJson: {
      locale: "es-AR",
      timezone: "America/Argentina/Buenos_Aires",
    },
  });

  console.info(`Seeded default tenant: ${tenantSlug}`);
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await closeDb().catch(() => {
      // no-op
    });
    process.exit(1);
  });
