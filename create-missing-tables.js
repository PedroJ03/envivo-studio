const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function createMissingTables() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Creando tablas faltantes...\n');
    
    // Check which tables exist
    const tablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const existingTables = tablesResult.rows.map(r => r.table_name);
    
    console.log('Tablas existentes:', existingTables.join(', '));
    
    // Create personas table if missing
    if (!existingTables.includes('personas')) {
      console.log('\n📋 Creando tabla personas...');
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
      await client.query(`CREATE INDEX idx_personas_tenant_slug ON personas(tenant_id, slug)`);
      console.log('  ✅ personas creada');
    }
    
    // Create templates table if missing
    if (!existingTables.includes('templates')) {
      console.log('\n📋 Creando tabla templates...');
      await client.query(`
        CREATE TABLE templates (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          slug text NOT NULL,
          name text NOT NULL,
          format text NOT NULL DEFAULT 'post',
          component_key text NOT NULL,
          preview_url text,
          is_active boolean DEFAULT true,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now()
        )
      `);
      await client.query(`CREATE INDEX idx_templates_tenant_slug ON templates(tenant_id, slug)`);
      console.log('  ✅ templates creada');
    }
    
    // Create content_states table (note: plural to avoid conflict with content_state enum)
    if (!existingTables.includes('content_states')) {
      console.log('\n📋 Creando tabla content_states...');
      await client.query(`
        CREATE TABLE content_states (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          candidate_content_id uuid NOT NULL REFERENCES candidate_content(id) ON DELETE CASCADE,
          state text NOT NULL DEFAULT 'draft',
          actor text,
          rejection_reason text,
          metadata_json jsonb DEFAULT '{}',
          ig_post_id text,
          created_at timestamptz DEFAULT now()
        )
      `);
      await client.query(`CREATE INDEX idx_content_states_tenant_content ON content_states(tenant_id, candidate_content_id)`);
      console.log('  ✅ content_states creada');
    }
    
    // Create generated_outputs table (plural for consistency)
    if (!existingTables.includes('generated_outputs')) {
      console.log('\n📋 Creando tabla generated_outputs...');
      await client.query(`
        CREATE TABLE generated_outputs (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          content_state_id uuid NOT NULL REFERENCES content_states(id) ON DELETE CASCADE,
          candidate_content_id uuid NOT NULL REFERENCES candidate_content(id) ON DELETE CASCADE,
          file_url text NOT NULL,
          sort_order integer DEFAULT 0,
          width integer NOT NULL,
          height integer NOT NULL,
          metadata_json jsonb DEFAULT '{}',
          created_at timestamptz DEFAULT now()
        )
      `);
      await client.query(`CREATE INDEX idx_generated_outputs_tenant_state ON generated_outputs(tenant_id, content_state_id)`);
      console.log('  ✅ generated_outputs creada');
    }
    
    console.log('\n✨ ¡Tablas faltantes creadas!');
    console.log('⚠️  Nota: Las tablas se llaman content_states y generated_outputs (plural)');
    console.log('    para evitar conflicto con los enums existentes.');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

createMissingTables().catch(() => process.exit(1));
