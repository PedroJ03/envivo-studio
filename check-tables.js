const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:Coronavirus2020.@db.hthwonnqnrkxqtmtugzm.supabase.co:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

pool.query('SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name', ['public'])
  .then(res => {
    console.log('Tablas existentes:');
    res.rows.forEach(row => console.log('  -', row.table_name));
  })
  .catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
