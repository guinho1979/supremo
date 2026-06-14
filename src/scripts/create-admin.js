// src/scripts/create-admin.js
// Cria o usuário admin com nick "admin" e senha "admin123"
// Uso: node src/scripts/create-admin.js
require('dotenv').config();
const bcrypt = require('bcrypt');
const db     = require('../db');

async function main() {
  const nick     = 'admin';
  const password = 'admin123';

  console.log('\n🛡  TopChat — Criando Admin\n');
  console.log(`   Nick : ${nick}`);
  console.log(`   Senha: ${password}\n`);

  const hash = await bcrypt.hash(password, 12);

  await db.query(`
    INSERT INTO users (nick, password_hash, role, avatar)
    VALUES ($1, $2, 'admin', '👑')
    ON CONFLICT (nick) DO UPDATE
      SET password_hash = $2,
          role          = 'admin',
          avatar        = '👑',
          is_banned     = FALSE
  `, [nick, hash]);

  console.log('✅ Admin criado com sucesso!');
  console.log('   Acesse o painel em: /admin.html\n');
  process.exit(0);
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
