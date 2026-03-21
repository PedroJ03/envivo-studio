const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  console.log('🔄 Verificando base de datos...');
  
  const client = await pool.connect();
  
  try {
    // Check current state
    const tablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('📋 Tablas existentes:', tablesResult.rows.map(r => r.table_name).join(', ') || 'ninguna');
    
    // Check if tenants table exists
    const hasTenants = tablesResult.rows.some(r => r.table_name === 'tenants');
    
    if (hasTenants) {
      console.log('✅ La base de datos ya está migrada');
      
      // Check if tenant exists
      const tenantCheck = await client.query(`SELECT slug FROM tenants WHERE slug = 'envivo-tandil'`);
      if (tenantCheck.rows.length > 0) {
        console.log('✅ Tenant envivo-tandil existe');
      } else {
        console.log('🌱 Creando tenant envivo-tandil...');
        await client.query(`
          INSERT INTO tenants (slug, name, config_json)
          VALUES ('envivo-tandil', 'EnVivo Tandil', '{}')
        `);
        console.log('✅ Tenant creado');
      }
    } else {
      console.log('⚠️  No se encontró la tabla tenants');
      console.log('💡 Por favor ejecutá manualmente: npx drizzle-kit push');
      console.log('   (y seleccioná "Yes" cuando pregunte)');
    }
    
    console.log('\n🎉 Listo para usar!');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(() => process.exit(1));
