const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Insertando datos de prueba...\n');
    
    // Get tenant ID
    const tenantResult = await client.query(`SELECT id FROM tenants WHERE slug = 'envivo-tandil'`);
    if (tenantResult.rows.length === 0) {
      console.log('❌ Tenant envivo-tandil no encontrado');
      return;
    }
    const tenantId = tenantResult.rows[0].id;
    console.log('✅ Tenant:', tenantId);
    
    // Create source
    const sourceResult = await client.query(`
      INSERT INTO sources (tenant_id, slug, name, kind)
      VALUES ($1, 'manual-test', 'Datos de Prueba', 'manual')
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [tenantId]);
    const sourceId = sourceResult.rows[0]?.id || (await client.query(`SELECT id FROM sources WHERE tenant_id = $1 AND slug = 'manual-test'`, [tenantId])).rows[0].id;
    console.log('✅ Source:', sourceId);
    
    // Create events
    const eventsData = [
      { title: 'Festival de Rock Tandil 2024', venue: 'Anfiteatro del Parque', date: '2024-12-15' },
      { title: 'Jazz en el Parque', venue: 'Parque Independencia', date: '2024-12-20' },
      { title: 'Noche de Folklore', venue: 'Teatro del Fuerte', date: '2024-12-22' }
    ];
    
    for (const event of eventsData) {
      await client.query(`
        INSERT INTO events (tenant_id, source_id, title, venue, event_date, status)
        VALUES ($1, $2, $3, $4, $5, 'active')
        ON CONFLICT DO NOTHING
      `, [tenantId, sourceId, event.title, event.venue, event.date]);
    }
    console.log('✅ 3 eventos creados');
    
    // Create personas
    const personasData = [
      { slug: 'dany', name: 'Dany Gimenez', content: 'Eres un experto musical apasionado...' },
      { slug: 'informativo', name: 'Informativo', content: 'Eres un periodista musical objetivo...' }
    ];
    
    for (const persona of personasData) {
      await client.query(`
        INSERT INTO personas (tenant_id, slug, name, skill_content_md, is_default)
        VALUES ($1, $2, $3, $4, false)
        ON CONFLICT DO NOTHING
      `, [tenantId, persona.slug, persona.name, persona.content]);
    }
    console.log('✅ 2 personas creadas');
    
    // Create templates
    const templatesData = [
      { slug: 'post-hero', name: 'Post Hero', format: 'post', component: 'FiloPost' },
      { slug: 'story-portrait', name: 'Story Portrait', format: 'story', component: 'FiloStory' },
      { slug: 'carousel-square', name: 'Carousel Square', format: 'carousel', component: 'FiloCarousel' }
    ];
    
    for (const tmpl of templatesData) {
      await client.query(`
        INSERT INTO templates (tenant_id, slug, name, format, component_key, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT DO NOTHING
      `, [tenantId, tmpl.slug, tmpl.name, tmpl.format, tmpl.component]);
    }
    console.log('✅ 3 templates creados');
    
    console.log('\n✨ Seed completado!');
    console.log('🌐 Probá: http://localhost:3000/events?tenant_id=envivo-tandil');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(() => process.exit(1));
