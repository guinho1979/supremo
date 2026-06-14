// src/db.js — Pool de conexão com PostgreSQL
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no pool do banco:', err.message);
});

// Testa a conexão na inicialização
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Falha ao conectar no banco:', err.message);
  } else {
    console.log('✅ Banco de dados PostgreSQL conectado!');
    release();
  }
});

module.exports = pool;
