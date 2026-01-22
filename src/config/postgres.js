const { Pool } = require('pg');
require('dotenv').config();

// Configuración de conexión a PostgreSQL (BD de n8n)
const pgPool = new Pool({
  host: process.env.PG_HOST, 
  port: process.env.PG_PORT, 
  database: process.env.PG_DB,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  max: 5, // Máximo de conexiones en el pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Manejo de errores del pool
pgPool.on('error', (err, client) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err);
  process.exit(-1);
});

// Función helper para ejecutar queries
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pgPool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Query ejecutada', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Error ejecutando query PostgreSQL:', error);
    throw error;
  }
};

module.exports = {
  pgPool,
  query
};
