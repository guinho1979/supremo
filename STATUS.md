# Migração para backend real — status (Opção B)

Seu site original, visual intacto, ligado ao backend página por página.

## ✅ Ligado de verdade ao servidor
- **login.html** — login/cadastro/visitante reais (JWT). Sem o buraco de
  "qualquer senha = admin"; `dev-login.html` removido.
- **salas.html** — lista de salas vem do banco (tabela `rooms`).
- **recados.html** — COMPLETO: carrega do banco; publica texto + imagem/vídeo/
  áudio/YouTube + cor; reações multi-emoji (👍❤️😂😮😢😡); comentários com
  paginação; excluir post/comentário (autor ou staff); modal de quem reagiu.
- **perfil.html** — COMPLETO: carrega do servidor; salva nick, bio, idade,
  cidade, gênero, trabalho, interesses, emoji do nick; troca de avatar/foto
  (galeria, upload, emoji); áudio do perfil; e troca de senha real (bcrypt).
- **salas-privadas.html** — COMPLETO: criar sala privada, listar suas salas,
  excluir (dono), convidar usuários (escolhendo quem está online numa sala
  pública), receber/aceitar/recusar convites. Backend novo: `private_rooms`,
  `private_room_members`, `private_room_invites` (`patch-05.sql`).
- **Enquetes + Quizzes (backend)** — `patch-06.sql`: tabelas `polls`,
  `poll_votes`, `quizzes`, `quiz_answers`. Rotas em `/api/polls` e
  `/api/quizzes` (criar, votar/responder, encerrar, placar) com broadcast em
  tempo real via WebSocket. A interface entra junto com o chat (Bloco 6).
- **Rádio/DJ (backend)** — `patch-07.sql` (`radio_config`). Rotas `/api/radio`
  (ver no ar, colocar stream + faixa, parar). DJ/staff transmitem; broadcast
  `radio_update`/`radio_stop` em tempo real pra sala.
- **Modo espião (backend)** — staff pode monitorar uma sala via WebSocket
  (`spy_join`/`spy_leave`) recebendo o histórico recente e as mensagens ao vivo
  por um canal separado (`spy_message`/`spy_history`), sem aparecer na sala.
- **admin.html (parcial)** — núcleo da moderação ligado: lista de usuários
  (do banco), trocar cargo, trocar nick, banir/desbanir (temporário/permanente),
  logo do chat e palavras bloqueadas (anti-spam). Demais sub-recursos do painel
  (logs de IP, espiar PVs, NSFW, smiles, ações em massa, criar sala pública)
  seguem em demo — precisam de mais backend.
- **chat.html** — núcleo (histórico, enviar/receber, online, digitando) +
  enquetes, quizzes e rádio LIGADOS ao backend, com cards em tempo real.
  Faltam: mídia no chat (YouTube/TikTok/GIF/arquivo ainda locais), reações nas
  mensagens, e o painel de espião na própria tela (backend já existe).
- **chatprivado.html** — ligado: chat de SALA PRIVADA em tempo real (entra na
  sala priv_*, histórico, enviar/receber, online, digitando) + PV (mensagem
  direta a um nick) via WebSocket. `patch-08.sql` libera o histórico de salas
  privadas.
- **Mídia no chat** — YouTube/TikTok/Instagram/GIF/imagem/arquivo agora vão
  pelo WebSocket e aparecem pra todos (em chat.html e chatprivado.html).
- **Painel de espião (admin)** — botões de espiar sala agora conectam ao
  monitor real: histórico recente + mensagens ao vivo no painel, sem entrar
  na sala. Também cobre salas privadas.
- **Reações nas mensagens** — `patch-09.sql` (`message_reactions`) + rota
  `POST /api/messages/:id/react` (toggle) + broadcast `message_reaction`. No
  chat, reagir agora envia ao servidor e a contagem aparece pra todos em tempo
  real (chat.html e chatprivado.html). Obs.: reações só valem para mensagens de
  usuários registrados (mensagens de visitante não são salvas, então não têm id).
- **Salas públicas no admin** — backend novo (`POST/DELETE /api/admin/rooms`,
  só admin). No painel: a lista de salas agora vem do banco, com criar (nome +
  ícone) e excluir de verdade.
- **NSFW** — a configuração (ativo + limiar) agora é salva no servidor
  (`system_config`) e recarregada no painel. A análise em si continua no
  navegador do usuário (NSFWJS), como já era.
- **Logs de acesso com IP** — `patch-10.sql` (`login_logs`). Cada login,
  cadastro e entrada de visitante grava nick, tipo, IP e navegador. No painel,
  a aba de Controle/Acessos mostra os acessos reais das últimas 24h (com IP).
- **Smiles personalizados** — admin salva no servidor (`system_config`); o chat
  carrega e renderiza `:nome:` como imagem/emoji (chat e chat privado).
- **Ações em massa** — expulsar todos de uma sala (kick por sala via WebSocket)
  e limpar todas as mensagens de uma sala (apaga no banco e limpa pra todos).
  O chat reage ao ser expulso (sai da sala) e à limpeza (esvazia a tela).
- **Visitantes com id rotativo** — cada entrada de visitante recebe um id único
  gerado na hora (muda a cada login), presente no token, salvo no app e exibido
  na lista de online. Não dá privilégios de registrado (o `user_id` segue vazio,
  então os bloqueios de "visitante não pode" continuam valendo).
- **Apelido único + "última conexão vence"** — cadastro e visitante são
  recusados se o apelido já é de um registrado ou está online (outra pessoa não
  toma o nick). Já o DONO de uma conta registrada sempre consegue entrar: ao
  conectar, a sessão antiga com aquele nick cai automaticamente (código 4005,
  sem reconectar) e a nova assume — resolve o caso de ficar "travado" por uma
  conexão presa. Heartbeat (30s) também limpa conexões mortas.
- **Bingo** — backend novo (`/api/bingo`, usa as tabelas `bingo_games`/`bingo_cards`
  que já existiam no schema). O servidor sorteia e valida a vitória; em tempo real:
  operador (staff) inicia/sorteia/reinicia, jogadores recebem cartela do servidor,
  marcam e cantam bingo (validado no servidor). Visitante só assiste.
- **Logout no servidor** — sair agora encerra a sessão no banco (não só no
  navegador) em salas, salas privadas, chat e chat privado.
- **Bloquear usuário (real)** — `patch-11.sql` (`user_blocks`). Bloqueio
  persiste no servidor, carrega ao entrar e as mensagens do bloqueado ficam
  ocultas (chat e chat privado). Desbloquear também grava.
- **Reply/citação (real)** — a citação (quem + trecho) vai pelo WebSocket e a
  resposta aparece com o balão citado para todos.
- **Face ID (real)** — `patch-12.sql` (`device_credentials`). Cadastrar com
  Face ID cria a conta de verdade e enrola um segredo de dispositivo (protegido
  pela biometria do aparelho); o login por Face ID valida esse segredo no
  servidor e recebe um token real (funciona inclusive depois de logout).
- **Chave do Bot (admin)** — card "🤖 Chave do Bot" no painel (no dashboard):
  vê a chave atual mascarada, revela e troca por uma nova quando expirar.
  Guardada em `system_config` (`bot_api_key`) e **filtrada do endpoint público**
  `/system/config` (segredos com sufixo _key/_secret/_token/password nunca vazam).
  Rotas só-admin: GET/POST `/api/admin/bot-key`.
- **Restos de demo eliminados** — `patch-13.sql` (`user_fans`). Agora são reais:
  ver perfil de outro usuário (busca bio/idade/cidade/etc. do servidor via
  `GET /api/users/:nick`), o botão "Ser fã" (persiste), o painel espião dentro do
  chat e o preview de salas (mostram mensagens/online reais), e a página
  "Últimos Online" (`ulogin.html`, via `GET /api/users/recent`). Removida a
  auto-resposta falsa do PV.
- **Código morto removido** — tiradas as últimas sobras de demo: `DEMO_IPS`/
  `gerarDemoLogs` do admin (logs já eram reais), a senha fixa `admin123` do bingo
  (operador agora é por cargo de staff) e as mensagens falsas do espião da
  salas-privadas (vira estado vazio honesto).
- **URL mascarada** — todas as páginas trocam o endereço para a raiz ("/")
  assim que carregam (via history.replaceState). O usuário navega e a barra de
  endereço sempre mostra só o domínio. (Recarregar/voltar leva ao início, pois o
  caminho real fica oculto.)
- **Moderação completa (real)** — `patch-14.sql`. Antes eram botões falsos:
  agora **Kick** (expulsa via WebSocket), **Mutar** (silencia por X minutos, o
  servidor bloqueia o envio), **Shadowban** (mensagens da pessoa só aparecem pra
  ela; staff vê no espião), **lista de Banidos** real com **Desbanir**, e
  **Denúncias** reais (usuário denuncia no chat → aparecem no painel pra resolver).
- **Sem botões falsos alcançáveis** — varredura final feita. O painel admin
  embutido no chat (que era todo demo) agora não abre mais: o botão 🛡️ leva ao
  admin.html real. Os fakes restantes são código morto inalcançável.
- **api.js** — cliente real compartilhado (REST + WebSocket), isolado em IIFE.

## ⏳ Ainda em modo demo — próximos blocos
- compartilhamento de arquivos (backend novo)
- ✅ Tudo da lista de passes finos foi ligado. Pendências conhecidas menores:
  reply/citação envia só o texto (não amarra à msg original no servidor);
  reações só em mensagens de usuários registrados.

## Banco de dados — ordem de execução
```
psql $DATABASE_URL -f sql/schema.sql
psql $DATABASE_URL -f sql/patch-01.sql
psql $DATABASE_URL -f sql/patch-02.sql   # mídia/cor nos recados
psql $DATABASE_URL -f sql/patch-03.sql   # reações + comentários
psql $DATABASE_URL -f sql/patch-04.sql   # campos de perfil
psql $DATABASE_URL -f sql/patch-05.sql   # salas privadas + convites
psql $DATABASE_URL -f sql/patch-06.sql   # enquetes + quizzes
psql $DATABASE_URL -f sql/patch-07.sql   # rádio/DJ
psql $DATABASE_URL -f sql/patch-08.sql   # histórico em salas privadas
psql $DATABASE_URL -f sql/patch-09.sql   # reações nas mensagens
psql $DATABASE_URL -f sql/patch-10.sql   # logs de acesso (IP)
psql $DATABASE_URL -f sql/patch-11.sql   # bloquear usuário
psql $DATABASE_URL -f sql/patch-12.sql   # Face ID (credencial de dispositivo)
psql $DATABASE_URL -f sql/patch-13.sql   # fãs (seguidores)
psql $DATABASE_URL -f sql/patch-14.sql   # mutar, shadowban, denúncias
```

## Como testar os recados
1. Suba o backend (`npm start`) com o banco migrado.
2. Abra `/login.html`, crie conta e entre.
3. Vá em Recados: publique texto e uma imagem, reaja com emojis diferentes,
   comente, e exclua. Faça login como admin pra excluir recado de outro.


## Como testar o perfil (Bloco 2)
1. Rode também `sql/patch-04.sql`.
2. Entre, vá em Perfil: edite bio/cidade/idade/etc. e salve → recarregue a
   página: os dados voltam do servidor.
3. Troque o avatar (galeria/upload/emoji) e a senha. Saia e entre com a senha
   nova pra confirmar.


## Como testar salas privadas (Bloco 3)
1. Rode `sql/patch-05.sql`.
2. Entre como usuário premium/dj/mod/admin (a UI libera o recurso a esses cargos).
3. Crie uma sala → você entra direto. Volte e ela aparece na sua lista.
4. Com OUTRA conta logada e online numa sala pública (ex.: Geral), use
   "Convidar" → escolha a sala pública → clique no usuário online.
5. Na conta convidada, em poucos segundos aparece o convite → aceitar entra na sala.

> Obs.: ao "Entrar" numa sala privada o site ainda abre o chatprivado.html em
> modo demo — o chat privado em si é o Bloco 6.


## Bloco 4 (Enquetes + Quizzes) — backend pronto
Rotas: POST /api/polls, GET /api/polls/active?room=, POST /api/polls/:id/vote,
POST /api/polls/:id/close; e equivalentes em /api/quizzes (+ /quizzes/scores).
Criar exige cargo dj/mod/supervisor/admin. A tela (dentro do chat) vem no Bloco 6;
por ora dá pra validar que o servidor sobe sem erros após rodar o patch-06.


## Bloco 5 (Rádio + Espião) — backend pronto
- Rádio: GET /api/radio?room=, POST /api/radio {room_slug,stream_url,title},
  POST /api/radio/stop. DJ/staff transmitem.
- Espião (WebSocket, staff): tcSocket.spyJoin(room) recebe spy_history e depois
  spy_message ao vivo; tcSocket.spyLeave() para. Interface no Bloco 6.


## Bloco 6a (admin.html) — moderação ligada
Funciona de verdade: aba de usuários (busca/lista vêm do banco), trocar cargo,
trocar nick, banir (com duração) e desbanir, logo do chat e lista anti-spam.
Teste logado como admin. Obs.: trocar cargo/nick exige permissão (admin/sup) —
o servidor valida e mostra erro se faltar.


## ⚠ Correção importante (afeta TODAS as páginas)
O api.js declarava um `LS` global que colidia com o `LS` de cada página e
quebrava o script no navegador (o check de sintaxe não pegava por ser arquivo
separado). Agora o api.js está isolado em IIFE e só expõe `API` e `tcSocket`.
Vale re-testar as páginas já ligadas (login, salas, recados, perfil, salas
privadas, admin) — elas só funcionam de fato com esta correção.

## Bloco 6b (chat.html — núcleo)
Ao abrir o chat de uma sala: o histórico vem do banco, mensagens enviadas vão
pelo WebSocket e aparecem pra todos em tempo real, e o painel de online reflete
quem está na sala. Teste com duas contas em abas diferentes na mesma sala.


## Bloco 6c (enquetes/quizzes/rádio no chat)
Como o chat não tinha UI de criação (e renderizava num elemento inexistente),
fiz uma integração própria por COMANDOS (staff/DJ), com cards no #msgArea e
atualização ao vivo:
- `@enquete Pergunta? | opção 1 | opção 2 | ...`  → todos votam, % ao vivo.
- `@quiz Pergunta? | opção | *correta | opção`     → marque a certa com *.
- `@radio https://stream.url | Título`  (e `@radio off`) → toca pra sala.
Quem entra depois já recebe a enquete/quiz/rádio ativos. Criar exige cargo
dj/mod/supervisor/admin (o servidor valida).


## Bloco 6d (chatprivado.html)
Entrar numa sala privada (pelo salas-privadas) agora abre um chat real em tempo
real (com patch-08, o histórico persiste). A barra de PV manda mensagem direta
a um usuário (entregue pelo WebSocket). Teste com duas contas numa sala privada.


## Passe fino — mídia + espião
- Mídia: cole um link do YouTube/TikTok/Instagram, mande GIF/imagem/arquivo —
  todos na sala recebem (antes só você via).
- Espião (admin): aba de espiar → clique numa sala → veja o histórico e o que
  for digitado ao vivo, sem aparecer na sala. Funciona logado como staff.


## Passe fino — salas públicas + NSFW (admin)
- Salas: aba de salas → lista vem do banco; crie com nome + ícone; exclua.
  (Criar/excluir exige cargo admin — o servidor valida.)
- NSFW: ajuste ativo/limiar e salve → fica gravado no servidor e volta ao reabrir.


## Passe fino — logs de acesso (IP)
Abra a aba Controle/Acessos: lista os logins reais das últimas 24h (nick, tipo,
data/hora, IP, e o navegador/dispositivo deduzido do user-agent). Requer
`app.set('trust proxy')` (já configurado) para o IP real atrás de proxy.


## Bloco final — Bingo + logout
- Bingo (`bingo.html`): logado como staff você vê o controle de operador
  (iniciar/sortear/reiniciar); os números saem pra todos em tempo real; cada
  jogador recebe a cartela do servidor e o "BINGO!" é validado no servidor.
  Não precisa de patch SQL novo (as tabelas já estão no schema).
- Logout: encerra a sessão no servidor antes de redirecionar.

## Ainda em aberto (menores)
- Banir vários usuários selecionados de uma vez; DJ ao vivo por microfone.
