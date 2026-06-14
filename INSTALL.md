# Guia de Instalação e Deploy — Chat Supremo

Backend em **Node.js + Express + WebSocket** e banco **PostgreSQL**. O mesmo
servidor entrega o site (pasta `public/`), a API REST (`/api`) e o WebSocket
(`/ws`) — tudo na mesma origem, então **não precisa configurar URL de backend**
em lugar nenhum.

---

## 1. Requisitos

- **Node.js 18 ou superior** (`node -v`)
- **PostgreSQL 13 ou superior** (local ou gerenciado: Neon, Supabase, Railway, RDS…)
- Em produção: um domínio com **HTTPS** (obrigatório para o Face ID funcionar).

---

## 2. Instalação (passo a passo)

```bash
# 1) Entre na pasta do projeto (onde está o package.json)
cd chat-supremo

# 2) Instale as dependências
npm install

# 3) Crie o arquivo .env a partir do exemplo
cp .env.example .env
#    edite o .env (veja a seção 3)

# 4) Crie as tabelas + aplique todos os patches de uma vez
npm run db:migrate

# 5) Crie o usuário admin inicial (nick: admin / senha: admin123)
npm run db:admin

# 6) Suba o servidor
npm start
```

Pronto. O console vai mostrar:
```
✅ Banco de dados PostgreSQL conectado!
🚀 TopChat rodando na porta 3001
   Frontend: http://localhost:3001
```
Abra **http://localhost:3001** e entre com **admin / admin123**.
> ⚠ Troque a senha do admin no primeiro acesso (Perfil → trocar senha).

---

## 3. Configuração do `.env`

| Variável         | Para que serve                                                              |
|------------------|------------------------------------------------------------------------------|
| `PORT`           | Porta do servidor (padrão `3001`).                                          |
| `NODE_ENV`       | `production` **liga SSL** na conexão do banco. Em Postgres local sem SSL, use `development`. |
| `DATABASE_URL`   | Conexão do PostgreSQL. Ex.: `postgres://usuario:senha@localhost:5432/chatsupremo` |
| `JWT_SECRET`     | **Obrigatório.** Segredo dos tokens. Gere um valor longo e aleatório (abaixo). |
| `JWT_EXPIRES_IN` | Validade do token (padrão `7d`).                                            |
| `FRONTEND_URL`   | Domínio do site para o CORS. Em produção, o domínio real (não use `*`).     |

Gerar um `JWT_SECRET` forte:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Exemplo de `.env` para rodar **localmente**:
```
PORT=3001
NODE_ENV=development
DATABASE_URL=postgres://postgres:postgres@localhost:5432/chatsupremo
JWT_SECRET=cole-aqui-o-valor-gerado-acima
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3001
```

> Dica: crie o banco antes com `createdb chatsupremo` (ou pelo painel do seu Postgres gerenciado).

---

## 4. Banco de dados

`npm run db:migrate` roda, em ordem: `sql/schema.sql` e depois `sql/patch-01.sql`
… `sql/patch-12.sql`. Os scripts são **idempotentes** (`IF NOT EXISTS`), então é
seguro rodar de novo após uma atualização.

Se preferir aplicar manualmente via `psql`:
```bash
psql "$DATABASE_URL" -f sql/schema.sql
for n in 01 02 03 04 05 06 07 08 09 10 11 12; do
  psql "$DATABASE_URL" -f sql/patch-$n.sql
done
```

O que cada patch acrescenta (resumo): 01 índices/limpeza · 02–03 recados (mídia,
reações, comentários) · 04 campos de perfil · 05 salas privadas · 06 enquetes/quizzes
· 07 rádio · 08 histórico em sala privada · 09 reações nas mensagens · 10 logs de
acesso (IP) · 11 bloquear usuário · 12 Face ID. (Bingo usa tabelas já do schema.)

**Zerar tudo (apaga dados!):** `psql "$DATABASE_URL" -f sql/reset-clean.sql`

---

## 5. Deploy em produção (recomendado)

A forma mais comum é rodar o Node atrás do **Nginx** com HTTPS.

### 5.1. Manter o processo no ar (PM2)
```bash
npm install -g pm2
NODE_ENV=production pm2 start src/server.js --name chat-supremo
pm2 save && pm2 startup
```

### 5.2. Nginx como proxy reverso (HTTPS + WebSocket)
O ponto crítico é repassar o **upgrade do WebSocket** em `/ws`:
```nginx
server {
  server_name seu-dominio.com;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # necessário para o WebSocket (/ws)
    proxy_http_version 1.1;
    proxy_set_header Upgrade    $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
  }
}
```
Depois gere o certificado (HTTPS) com Certbot/Let's Encrypt:
```bash
sudo certbot --nginx -d seu-dominio.com
```

### 5.3. Pontos de atenção em produção
- **HTTPS é obrigatório para o Face ID** (WebAuthn só funciona em `https://` ou `localhost`).
- O servidor já usa `trust proxy`, então o **IP real** aparece nos logs de acesso
  (vem do `X-Forwarded-For` que o Nginx repassa).
- `NODE_ENV=production` liga SSL no banco — combine com um Postgres que aceite SSL
  (a maioria dos gerenciados exige). Em banco local sem SSL, use `development`.
- Ajuste `FRONTEND_URL` para o seu domínio (CORS).

---

## 6. Primeiro teste rápido

1. Entre como **admin / admin123**.
2. Abra uma sala no **Chat** em duas abas (uma com admin, outra com uma conta
   nova ou visitante) e troque mensagens — devem aparecer em tempo real nas duas.
3. Como admin/dj, no chat, teste os comandos:
   - `@enquete Pergunta? | opção 1 | opção 2`
   - `@quiz Pergunta? | opção | *correta | opção`
   - `@radio https://endereco-do-stream | Título`  (e `@radio off`)
4. No **/admin.html**: busque um usuário, troque cargo, banize/desbanize; crie uma
   sala pública; veja os acessos (com IP); use "espiar" uma sala.
5. **Bingo** (`/bingo.html`): como admin, inicie e sorteie; em outra aba (conta
   registrada) pegue a cartela e marque.

---

## 7. Problemas comuns

| Sintoma | Causa provável / solução |
|---|---|
| `❌ Falha ao conectar no banco` | `DATABASE_URL` errada, banco não criado, ou SSL: em local use `NODE_ENV=development`. |
| Erro de SSL no banco | Postgres local sem SSL + `NODE_ENV=production`. Use `development` local. |
| Mensagens não aparecem em tempo real | O proxy não está repassando o WebSocket. Confira os headers `Upgrade/Connection` no Nginx (seção 5.2). |
| "Entrar com Face ID" não aparece / falha | Precisa de **HTTPS** (ou `localhost`) e de um aparelho com biometria. |
| Tela em branco / erros no console (F12) | Veja a mensagem exata no console do navegador e no terminal do Node. |
| Login recusa "já conectado" | Comportamento esperado: a conta registrada só fica em um lugar; a nova conexão assume e a antiga cai. |

---

## 8. Resumo dos comandos

```bash
npm install            # dependências
cp .env.example .env   # configura (edite o .env)
npm run db:migrate     # cria tabelas + todos os patches
npm run db:admin       # cria admin/admin123
npm start              # produção
npm run dev            # desenvolvimento (reinicia ao salvar)
```

---

## 9. Chave do Bot (serviço externo)

A chave que o bot usa para chamar o serviço externo (ex.: API de IA) é definida
no painel admin → card **"🤖 Chave do Bot"**. Ela fica guardada de forma privada
e **nunca** aparece no site.

Para o seu bot (que roda por fora) pegar sempre a chave atual — assim você só
troca a chave no painel e o bot passa a usar a nova:

1. No `.env` do servidor, defina um segredo só do bot:
   ```
   BOT_SECRET=<gere com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   ```
2. O bot busca a chave nesse endpoint (mandando o segredo no header):
   ```bash
   curl https://seu-dominio.com/api/bot/key -H "x-bot-secret: SEU_BOT_SECRET"
   # → {"key":"a-chave-atual-do-painel"}
   ```
   Exemplo em Node no seu bot:
   ```js
   async function getBotKey(){
     const r = await fetch(process.env.SITE_URL + '/api/bot/key', {
       headers: { 'x-bot-secret': process.env.BOT_SECRET }
     });
     const { key } = await r.json();
     return key; // use esta key para chamar o serviço externo
   }
   ```
3. Dica: o bot pode buscar a chave ao iniciar e **rebuscar quando o serviço
   externo responder erro de autenticação** (ex.: 401) — assim, quando você
   atualiza a chave no painel, ele se recupera sozinho sem reiniciar.

> Se `BOT_SECRET` ficar vazio no `.env`, o endpoint `/api/bot/key` fica
> **desligado** (responde 403) — então ele só existe quando você quiser.

---

## 10. Deploy 1-clique na Render (servidor pago)

O projeto já inclui um `render.yaml` que cria tudo (serviço web + PostgreSQL +
variáveis). Passo a passo:

1. **Suba o projeto para um repositório no GitHub** (a Render lê o repo).
2. Em **dashboard.render.com → New → Blueprint**, conecte o repositório.
   A Render lê o `render.yaml` e mostra o que vai criar (1 web service + 1 banco).
3. Ela vai pedir o valor de **`FRONTEND_URL`** (a única variável manual). No primeiro
   deploy você ainda não sabe a URL final — pode colocar `https://chat-supremo.onrender.com`
   (ajuste depois para o domínio que aparecer, ou para seu domínio próprio).
4. Clique em **Apply / Create**. A Render vai: criar o banco, instalar dependências,
   **rodar as migrações** (`preDeployCommand`) e subir o servidor com **HTTPS automático**.
5. Quando ficar "Live", abra a URL. Para criar o admin, vá em **(seu serviço) → Shell**
   e rode uma vez:
   ```
   npm run db:admin
   ```
   Entre com **admin / admin123** e troque a senha.

Notas:
- **Região:** mantenha a mesma no serviço e no banco (já estão como `oregon` no
  `render.yaml`; troque ambos se preferir outra, ex.: `frankfurt`).
- **WebSocket e HTTPS** funcionam automaticamente no mesmo domínio — nada de Nginx.
- **Custo:** ~US$7/mês (web `starter`) + ~US$6/mês (Postgres `basic-256mb`).
- Se quiser **domínio próprio** (ex.: chatsupremo.net): em **Settings → Custom Domains**,
  adicione o domínio e aponte o DNS conforme a Render indicar; depois atualize
  `FRONTEND_URL` para esse domínio.
- Subir uma versão nova depois é só **git push** — a Render reimplanta sozinha e
  roda as migrações de novo (são seguras de repetir).
