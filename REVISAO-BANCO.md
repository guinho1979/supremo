# Revisão do banco de dados — TopChat

Resultado da auditoria do `schema.sql` cruzado com todo o código de `src/`.

## 🔴 Erros (quebram de fato)

1. **`reset-clean.sql` referencia 6 tabelas inexistentes.**
   Ele faz `TRUNCATE` em `mod_logs`, `polls`, `poll_votes`, `quizzes`,
   `quiz_answers` e `contacts`, mas nenhuma delas existe no `schema.sql`.
   O script falha na primeira linha (`relation "mod_logs" does not exist`).
   → Corrigido no `reset-clean.sql` deste pacote.

2. **`reset-clean.sql` apagava as salas sem recriá-las.**
   Depois do reset o chat ficava sem nenhuma sala. → Corrigido (re-seed das 8 salas).

## 🟡 Inconsistências (funciona, mas atenção)

3. **`spam_words` não estava nos defaults.** É lida em `websocket.js` e
   `admin.js`. Funciona por causa do `INSERT ... ON CONFLICT`, mas só passa
   a existir após o primeiro save. → `patch-01.sql` cria com `[]`.

4. **`GET /api/auth/me` devolve o `id` errado.** O middleware seleciona
   `s.id` (id da sessão) e `u.id AS user_id`. O `/me` retorna `req.user`
   inteiro, então `user.id` é o id da SESSÃO — enquanto o `/login` devolve
   `user.id` = id do USUÁRIO. Se o front usar `user.id` vindo do `/me`, vai
   pegar o número errado. Recomendo padronizar (expor sempre o id do usuário).

5. **Sessões nunca são limpas.** Cada login cria uma linha em `sessions` e
   nada apaga as vencidas; a tabela cresce sem limite. → `patch-01.sql` limpa
   uma vez e o README mostra o cron.

## 🟢 Lacunas de implementação (schema ok, falta backend)

6. **Mensagens privadas sem endpoint de histórico.** O `websocket.js` salva
   em `private_messages`, mas não há `GET` para ler o histórico. A tela de
   chat privado não consegue carregar conversas antigas via API.

7. **Bingo sem backend.** As tabelas `bingo_games` / `bingo_cards` existem,
   mas nenhuma rota ou evento de WebSocket as usa. O `bingo.html` é só front.

8. **`multer` e a pasta `uploads/` não são usados.** O upload de foto é feito
   por base64 em `PATCH /api/auth/me`. Dá pra remover a dependência se quiser.

9. **`users.ip_banned` (TEXT[])** existe mas nunca é lido/escrito pelo código.

## ⚙️ Configuração / segurança

10. **`JWT_SECRET` é obrigatório** e não havia `.env.example`. Sem ele,
    `login`/`register` retornam 500. → Incluído `.env.example`.

11. **CORS com `origin:'*'` + `credentials:true` é inválido** nos navegadores.
    Como a auth é por Bearer token (não cookie), defina `FRONTEND_URL` ou
    remova `credentials`. → Documentado no `.env.example`.

12. **Senha admin padrão `admin123`** está fixa em 3 arquivos SQL. Troque já.

## O que está correto
Tipos, chaves estrangeiras, índice de `messages(room_slug, created_at)`,
`recado_likes` com PK composta, `online_presence` com upsert por `user_id`,
auto-delete de mensagens > 10 min e limpeza de presença — tudo coerente.
