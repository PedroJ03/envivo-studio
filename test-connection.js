const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

console.log('Probando conexión con Transaction Pooler...');
pool.query('SELECT 1 as connection_test')
  .then((res) => {
    console.log('✅ ¡Conecta! La base de datos responde correctamente');
    console.log('Resultado:', res.rows[0]);
  })
  .catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(() => pool.end());
