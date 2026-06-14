// src/scripts/setup-db.js
// Uso: node src/scripts/setup-db.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db   = require('../db');

async function main() {
  console.log('\n📦 TopChat — Setup do Banco de Dados\n');
  const sql = fs.readFileSync(path.join(__dirname, '../../sql/schema.sql'), 'utf8');
  await db.query(sql);
  console.log('✅ Schema criado com sucesso!\n');
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
