// src/scripts/migrate.js
// Roda o schema e TODOS os patches (sql/patch-*.sql) em ordem.
// Uso: node src/scripts/migrate.js   (ou: npm run db:migrate)
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const db   = require('../db');

async function run(file) {
  const sql = fs.readFileSync(file, 'utf8');
  await db.query(sql);
  console.log('  ✓', path.basename(file));
}

async function main() {
  const dir = path.join(__dirname, '../../sql');
  console.log('\n📦 TopChat — Migração do banco\n');
  await run(path.join(dir, 'schema.sql'));
  const patches = fs.readdirSync(dir)
    .filter(f => /^patch-\d+\.sql$/.test(f))
    .sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)));
  for (const p of patches) await run(path.join(dir, p));
  console.log(`\n✅ Banco pronto (schema + ${patches.length} patches).\n`);
  process.exit(0);
}
main().catch(e => { console.error('❌', e.message); process.exit(1); });
