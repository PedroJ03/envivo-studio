const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function typeExists(client, typeName) {
  const result = await client.query(
    `
    SELECT EXISTS (
      SELECT 1 FROM pg_type WHERE typname = $1
    );
  `,
    [typeName],
  );
  return result.rows[0].exists;
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = $1
    );
  `,
    [tableName],
  );
  return result.rows[0].exists;
}

async function runMigration() {
  console.log("🔄 Verificando y aplicando migraciones...");

  const client = await pool.connect();

  try {
    // Create types
    console.log("📝 Creando tipos...");

    if (!(await typeExists(client, "candidate_status"))) {
      await client.query(
        `CREATE TYPE candidate_status AS ENUM ('candidate', 'selected', 'rejected', 'archived')`,
      );
      console.log("  ✓ candidate_status");
    }

    if (!(await typeExists(client, "content_format"))) {
      await client.query(
        `CREATE TYPE content_format AS ENUM ('post', 'story', 'carousel')`,
      );
      console.log("  ✓ content_format");
    }

    if (!(await typeExists(client, "content_state"))) {
      await client.query(
        `CREATE TYPE content_state AS ENUM ('draft', 'approved', 'generating', 'generated', 'reviewed', 'published', 'rejected', 'failed')`,
      );
      console.log("  ✓ content_state");
    }

    if (!(await typeExists(client, "source_kind"))) {
      await client.query(
        `CREATE TYPE source_kind AS ENUM ('manual', 'upload', 'scraped')`,
      );
      console.log("  ✓ source_kind");
    }

    if (!(await typeExists(client, "operator_role"))) {
      await client.query(
        `CREATE TYPE operator_role AS ENUM ('superadmin', 'admin', 'operator')`,
      );
      console.log("  ✓ operator_role");
    }

    // Create tables
    console.log("📝 Creando tablas...");

    if (!(await tableExists(client, "tenants"))) {
      await client.query(`
        CREATE TABLE tenants (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          slug text NOT NULL UNIQUE,
          name text NOT NULL,
          ig_account_id text,
          ig_access_token text,
          config_json jsonb DEFAULT '{}',
          is_active boolean DEFAULT true,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )
      `);
      console.log("  ✓ tenants");
    }

    if (!(await tableExists(client, "sources"))) {
      await client.query(`
        CREATE TABLE sources (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          kind source_kind DEFAULT 'manual',
          slug text NOT NULL,
          name text NOT NULL,
          source_url text,
          metadata_json jsonb DEFAULT '{}',
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )
      `);
      console.log("  ✓ sources");
    }

    if (!(await tableExists(client, "events"))) {
      await client.query(`
        CREATE TABLE events (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
          title text NOT NULL,
          event_date timestamptz,
          venue text,
          status text DEFAULT 'active',
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )
      `);
      console.log("  ✓ events");
    }

    if (!(await tableExists(client, "photos"))) {
      await client.query(`
        CREATE TABLE photos (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
          original_url text NOT NULL,
          storage_key text NOT NULL,
          width integer NOT NULL,
          height integer NOT NULL,
          metadata_json jsonb DEFAULT '{}',
          created_at timestamptz DEFAULT now()
        )
      `);
      console.log("  ✓ photos");
    }

    if (!(await tableExists(client, "candidate_content"))) {
      await client.query(`
        CREATE TABLE candidate_content (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          source_id uuid NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
          event_id uuid REFERENCES events(id) ON DELETE SET NULL,
          photo_id uuid REFERENCES photos(id) ON DELETE SET NULL,
          status candidate_status DEFAULT 'candidate',
          title text NOT NULL,
          summary_json jsonb DEFAULT '{}',
          selected_format content_format DEFAULT 'post',
          selected_tone text,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )
      `);
      console.log("  ✓ candidate_content");
    }

    if (!(await tableExists(client, "content_state"))) {
      await client.query(`
        CREATE TABLE content_state (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          candidate_content_id uuid NOT NULL REFERENCES candidate_content(id) ON DELETE CASCADE,
          state content_state DEFAULT 'draft',
          actor text,
          rejection_reason text,
          metadata_json jsonb DEFAULT '{}',
          ig_post_id text,
          created_at timestamptz DEFAULT now()
        )
      `);
      console.log("  ✓ content_state");
    }

    if (!(await tableExists(client, "generated_output"))) {
      await client.query(`
        CREATE TABLE generated_output (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          content_state_id uuid NOT NULL REFERENCES content_state(id) ON DELETE CASCADE,
          candidate_content_id uuid NOT NULL REFERENCES candidate_content(id) ON DELETE CASCADE,
          file_url text NOT NULL,
          sort_order integer DEFAULT 0,
          width integer NOT NULL,
          height integer NOT NULL,
          metadata_json jsonb DEFAULT '{}',
          created_at timestamptz DEFAULT now()
        )
      `);
      console.log("  ✓ generated_output");
    }

    if (!(await tableExists(client, "personas"))) {
      await client.query(`
        CREATE TABLE personas (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          slug text NOT NULL,
          name text NOT NULL,
          skill_content_md text NOT NULL,
          is_default boolean DEFAULT false,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )
      `);
      console.log("  ✓ personas");
    }

    if (!(await tableExists(client, "templates"))) {
      await client.query(`
        CREATE TABLE templates (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          slug text NOT NULL,
          name text NOT NULL,
          format content_format DEFAULT 'post',
          component_key text NOT NULL,
          preview_url text,
          is_active boolean DEFAULT true,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )
      `);
      console.log("  ✓ templates");
    }

    if (!(await tableExists(client, "operators"))) {
      await client.query(`
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
      `);
      console.log("  ✓ operators");
    }

    // Create indexes
    console.log("📝 Creando índices...");
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_sources_tenant ON sources(tenant_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_events_tenant ON events(tenant_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_photos_tenant ON photos(tenant_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_candidate_tenant ON candidate_content(tenant_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_content_state_tenant ON content_state(tenant_id)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_operators_email ON operators(email)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_operators_tenant ON operators(tenant_id)`,
    );
    console.log("  ✓ índices creados");

    // Seed initial tenant
    console.log("🌱 Verificando tenant inicial...");
    const tenantCheck = await client.query(
      `SELECT id FROM tenants WHERE slug = 'envivo-tandil'`,
    );

    let tenantId;
    if (tenantCheck.rows.length === 0) {
      const result = await client.query(`
        INSERT INTO tenants (slug, name, config_json)
        VALUES ('envivo-tandil', 'EnVivo Tandil', '{}')
        RETURNING id
      `);
      tenantId = result.rows[0].id;
      console.log("✅ Tenant envivo-tandil creado");
    } else {
      tenantId = tenantCheck.rows[0].id;
      console.log("✅ Tenant envivo-tandil ya existe");
    }

    // Seed initial admin user
    console.log("🌱 Verificando usuario admin inicial...");
    const adminCheck = await client.query(
      `SELECT id FROM operators WHERE email = 'admin@envivo.local'`,
    );

    if (adminCheck.rows.length === 0) {
      // Password: 'admin' hashed with bcrypt (12 rounds)
      // This is a default for development only - change in production!
      const defaultPasswordHash =
        "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6";

      await client.query(`
        INSERT INTO operators (email, name, password_hash, tenant_id, role, is_active)
        VALUES ('admin@envivo.local', 'Admin', '${defaultPasswordHash}', '${tenantId}', 'admin', true)
      `);
      console.log("✅ Admin user creado: admin@envivo.local / admin");
    } else {
      console.log("✅ Admin user ya existe");
    }

    console.log("\n🎉 ¡Base de datos lista!");
  } catch (err) {
    console.error("❌ Error:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(() => process.exit(1));
