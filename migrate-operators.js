require("dotenv").config({ path: ".env.local" });
const postgres = require("postgres");

const sql = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  console.log("🔄 Aplicando migración 0002_create_operators...");

  try {
    // Check if type exists
    const typeExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'operator_role'
      );
    `;

    if (!typeExists[0].exists) {
      await sql`CREATE TYPE operator_role AS ENUM ('superadmin', 'admin', 'operator')`;
      console.log("  ✓ Tipo operator_role creado");
    } else {
      console.log("  ℹ Tipo operator_role ya existe");
    }

    // Check if table exists
    const tableExists = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'operators'
      );
    `;

    if (!tableExists[0].exists) {
      await sql`
        CREATE TABLE operators (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          email text NOT NULL UNIQUE,
          name text NOT NULL,
          password_hash text NOT NULL,
          tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
          role operator_role DEFAULT 'operator',
          is_active boolean DEFAULT true,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )
      `;
      console.log("  ✓ Tabla operators creada");

      // Create indexes
      await sql`CREATE INDEX idx_operators_email ON operators(email)`;
      await sql`CREATE INDEX idx_operators_tenant ON operators(tenant_id)`;
      console.log("  ✓ Índices creados");
    } else {
      console.log("  ℹ Tabla operators ya existe");
    }

    console.log("\n✅ Migración completada");
  } catch (err) {
    console.error("❌ Error:", err.message);
    throw err;
  } finally {
    await sql.end();
  }
}

migrate().catch(() => process.exit(1));
