const { Pool } = require('pg');

// Forzar IPv4 en lugar de IPv6
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const pool = new Pool({
  connectionString: 'postgresql://postgres:Coronavirus2020.@db.hthwonnqnrkxqtmtugzm.supabase.co:6543/postgres',
  ssl: { rejectUnauthorized: false },
  family: 4  // Forzar IPv4
});

console.log('Intentando conexión forzando IPv4...');
pool.query('SELECT 1 as connection_test')
  .then((res) => {
    console.log('✅ Conecta! Resultado:', res.rows[0]);
  })
  .catch(e => {
    console.error('❌ Error:', e.message);
    if (e.message.includes('ENETUNREACH')) {
      console.error('\nProblema de red: Tu máquina no puede llegar a Supabase.');
      console.error('Posibles soluciones:');
      console.error('1. Verificar si hay firewall bloqueando el puerto 6543');
      console.error('2. Probar con una VPN');
      console.error('3. Usar PostgreSQL local para desarrollo');
    }
  })
  .finally(() => pool.end());
