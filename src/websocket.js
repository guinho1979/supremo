// src/websocket.js — Servidor WebSocket (chat em tempo real)
const WebSocket = require('ws');
const jwt       = require('jsonwebtoken');
const db        = require('./db');
const { logAction } = require('./modlog');

// Cache leve de flags de sistema (atualiza a cada 15s) — evita consulta por mensagem
let _sysFlags = {}, _sysFlagsAt = 0;
async function getSysFlags() {
  if (Date.now() - _sysFlagsAt < 15000) return _sysFlags;
  try {
    const { rows } = await db.query(
      "SELECT key, value FROM system_config WHERE key IN ('members_only','antiflood')"
    );
    const c = {}; rows.forEach(r => c[r.key] = r.value);
    _sysFlags = c; _sysFlagsAt = Date.now();
  } catch (e) {}
  return _sysFlags;
}

// Mapa de conexões: socket_id → { ws, nick, role, userId, roomSlug }
const clients = new Map();
// Salas de videochamada (sinalização WebRTC em malha, até 4 pessoas)
const callRooms = new Map(); // id -> { id, host, title, max, participants:Set(nick), createdAt }

// Auto-delete de mensagens antigas (a cada 1 minuto limpa mensagens > 10min)
function startMessageCleaner() {
  setInterval(async () => {
    try {
      await db.query(`
        UPDATE messages SET is_deleted = TRUE
        WHERE created_at < NOW() - INTERVAL '10 minutes'
          AND is_deleted = FALSE
      `);
    } catch (e) { /* silencioso */ }
  }, 60_000);
}

// Limpa presence de usuários que sumiram (ping > 2 min)
function startPresenceCleaner() {
  setInterval(async () => {
    try {
      await db.query(
        "DELETE FROM online_presence WHERE last_ping < NOW() - INTERVAL '2 minutes'"
      );
    } catch (e) { /* silencioso */ }
  }, 30_000);
}

function broadcast(roomSlug, payload, excludeId = null) {
  const msg = JSON.stringify(payload);
  clients.forEach((client, id) => {
    if (id !== excludeId && client.ws.readyState === WebSocket.OPEN
        && (client.roomSlug === roomSlug || client.spyRoom === roomSlug)) {
      client.ws.send(msg);
    }
  });
}

function broadcastAll(payload) {
  const msg = JSON.stringify(payload);
  clients.forEach(client => {
    if (client.ws.readyState === WebSocket.OPEN) client.ws.send(msg);
  });
}

// Entrega mensagens de uma sala aos "espiões" (staff monitorando), em canal separado
function broadcastSpy(roomSlug, data) {
  const msg = JSON.stringify({ event: 'spy_message', data: { ...data, room_slug: roomSlug } });
  clients.forEach(client => {
    if (client.spyRoom === roomSlug && client.ws.readyState === WebSocket.OPEN) client.ws.send(msg);
  });
}

// ── Helpers de videochamada ───────────────────────────────────
function vcSendToNick(nick, payload) {
  if (!nick) return;
  const s = JSON.stringify(payload);
  const n = String(nick).toLowerCase();
  clients.forEach(c => {
    if (c.nick && String(c.nick).toLowerCase() === n && c.ws && c.ws.readyState === WebSocket.OPEN) c.ws.send(s);
  });
}
function vcRoomsPublic() {
  const arr = [];
  callRooms.forEach(r => arr.push({
    id: r.id, host: r.host, title: r.title, max: r.max,
    count: r.participants.size, participants: Array.from(r.participants)
  }));
  return arr;
}
function vcBroadcastList() {
  const s = JSON.stringify({ event: 'vc_list', data: { rooms: vcRoomsPublic() } });
  clients.forEach(c => { if (c.inVideoLobby && c.ws && c.ws.readyState === WebSocket.OPEN) c.ws.send(s); });
}
function vcRemoveParticipant(id, nick) {
  const room = callRooms.get(id);
  if (!room) return;
  if (room.participants.delete(nick)) {
    room.participants.forEach(n => vcSendToNick(n, { event: 'vc_peer_left', data: { id, nick } }));
  }
  if (room.participants.size === 0) callRooms.delete(id);
  vcBroadcastList();
}

function sendOnlineCount() {
  db.query(`
    SELECT COUNT(*) AS total, COUNT(DISTINCT room_slug) AS rooms
    FROM online_presence WHERE last_ping > NOW() - INTERVAL '2 minutes'
  `).then(({ rows }) => {
    broadcastAll({
      event: 'online_count',
      data: { count: parseInt(rows[0].total), rooms: parseInt(rows[0].rooms) }
    });
  }).catch(() => {});
}

// Setup do servidor WebSocket
function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  startMessageCleaner();
  startPresenceCleaner();
  setInterval(sendOnlineCount, 10_000);

  // Heartbeat: derruba conexões mortas (libera o apelido)
  const heartbeat = setInterval(() => {
    wss.clients.forEach(sock => {
      if (sock.isAlive === false) { try { sock.terminate(); } catch (e) {} return; }
      sock.isAlive = false;
      try { sock.ping(); } catch (e) {}
    });
  }, 30_000);
  wss.on('close', () => clearInterval(heartbeat));

  wss.on('connection', async (ws, req) => {
    // Autenticar via query param ?token=...
    const url    = new URL(req.url, 'http://localhost');
    const token  = url.searchParams.get('token');
    const tabId  = url.searchParams.get('tab') || '';
    const isSpyConn = url.searchParams.get('spyconn') === '1';
    const socketId = Math.random().toString(36).slice(2) + Date.now();
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    let userInfo = null;

    if (token) {
      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        userInfo = { userId: payload.userId, guestId: payload.guestId || null, nick: payload.nick, role: payload.role, type: payload.type || 'registered' };
      } catch (e) {
        ws.close(4001, 'Token inválido');
        return;
      }
    } else {
      ws.close(4001, 'Token obrigatório');
      return;
    }

    // "Última conexão vence": derruba sessões anteriores com o mesmo nick,
    // MAS só de outra aba/dispositivo (tab diferente). Conexões de ESPIÃO (somente
    // leitura) não disputam sessão: não derrubam ninguém e não são derrubadas.
    if (userInfo.nick && !isSpyConn) {
      const nlow = String(userInfo.nick).toLowerCase();
      clients.forEach((c) => {
        if (c.isSpyConn) return; // nunca derruba uma conexão de espião
        if (c.nick && String(c.nick).toLowerCase() === nlow && c.ws && c.ws.readyState === WebSocket.OPEN) {
          // Só trata como "outro dispositivo" (session_replaced/4005) quando AMBAS as abas
          // são conhecidas e DIFERENTES. Caso contrário (mesma aba, refresh, ou tab ausente),
          // fecha em silêncio com 4006 — sem deslogar o usuário.
          if (tabId && c.tabId && c.tabId !== tabId) {
            try { c.ws.send(JSON.stringify({ event: 'session_replaced', data: {} })); } catch (e) {}
            try { c.ws.close(4005, 'Sessão substituída'); } catch (e) {}
          } else {
            try { c.ws.close(4006, 'Reconexão da mesma aba'); } catch (e) {}
          }
        }
      });
    }

    clients.set(socketId, { ws, tabId, isSpyConn, ...userInfo, roomSlug: null });
    if (userInfo.userId) {
      try {
        const { rows: [uf] } = await db.query('SELECT muted_until, shadow_banned FROM users WHERE id = $1', [userInfo.userId]);
        const c = clients.get(socketId);
        if (uf && c) { c.mutedUntil = uf.muted_until; c.shadowBanned = !!uf.shadow_banned; }
      } catch (e) {}
    }

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      const client = clients.get(socketId);
      if (!client) return;

      // ── JOIN ROOM ──────────────────────────────────────────
      if (msg.event === 'join') {
        const { room } = msg.data || {};
        if (!room) return;

        // Sair da sala anterior
        if (client.roomSlug) {
          broadcast(client.roomSlug, {
            event: 'user_left',
            data: { nick: client.nick, role: client.role }
          }, socketId);
        }

        client.roomSlug = room;

        // Atualizar presence no banco
        if (client.userId) {
          await db.query(`
            INSERT INTO online_presence (user_id, nick, room_slug, socket_id, last_ping)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (user_id) DO UPDATE
            SET room_slug = $3, socket_id = $4, last_ping = NOW()
          `, [client.userId, client.nick, room, socketId]).catch(() => {});
        }

        // Histórico NÃO é mais enviado automaticamente ao entrar na sala.
        // O usuário só vê as últimas mensagens se clicar no link "Últimas
        // mensagens" (evento 'request_history', tratado mais abaixo).


        // Anunciar entrada
        broadcast(room, {
          event: 'user_joined',
          data: { nick: client.nick, role: client.role, id: client.userId || client.guestId || null }
        }, socketId);

        // Lista de usuários na sala
        const roomUsers = [];
        clients.forEach(c => {
          if (c.roomSlug === room) {
            roomUsers.push({ nick: c.nick, role: c.role, id: c.userId || c.guestId || null });
          }
        });
        ws.send(JSON.stringify({ event: 'room_users', data: { users: roomUsers } }));
        return;
      }

      // ── REQUEST HISTORY (link "Últimas mensagens") ──────────
      // Diferente do antigo carregamento automático: só roda quando o
      // usuário clica explicitamente no link, e sempre na sala atual dele.
      if (msg.event === 'request_history') {
        if (!client.roomSlug) return;

        let msgTtl = 0;
        try {
          const { rows: mc } = await db.query(
            "SELECT value FROM system_config WHERE key = 'msg_ttl'"
          );
          if (mc.length) msgTtl = Math.max(parseInt(mc[0].value) || 0, 0);
        } catch (e) {}

        let histWhere = 'room_slug = $1 AND is_deleted = FALSE';
        const histParams = [client.roomSlug];
        if (msgTtl > 0) {
          histParams.push(String(msgTtl));
          histWhere += ` AND created_at > NOW() - ($${histParams.length} || ' minutes')::interval`;
        }
        // Sempre as últimas 30, independente da configuração geral de limite —
        // é exatamente o que o link "Últimas mensagens" promete mostrar.
        const { rows: histDesc } = await db.query(`
          SELECT m.id, m.nick, m.role, m.content, m.msg_type, m.media_url, m.reply_to, m.created_at,
                 COALESCE((
                   SELECT json_agg(json_build_object('emoji', mr.emoji, 'nick', u.nick))
                   FROM message_reactions mr
                   JOIN users u ON u.id = mr.user_id
                   WHERE mr.message_id = m.id
                 ), '[]') AS reactions
          FROM messages m
          WHERE ${histWhere}
          ORDER BY created_at DESC
          LIMIT 30
        `, histParams).catch(() => ({ rows: [] }));
        const history = histDesc.reverse();

        ws.send(JSON.stringify({ event: 'history', data: { messages: history } }));
        return;
      }

      // ── CHAT MESSAGE ───────────────────────────────────────
      if (msg.event === 'message') {
        const { content, msg_type = 'text', media_url = '', reply_to = null, quoted_nick = null, quoted_text = null, quoted_depth = 0 } = msg.data || {};

        if (!content && !media_url) return;
        if (content && content.length > 2000) return;

        // Silenciado (mute)
        if (client.mutedUntil && new Date(client.mutedUntil) > new Date()) {
          ws.send(JSON.stringify({ event: 'error', data: { message: 'Você está silenciado no momento.' } }));
          return;
        }

        // Visitantes podem enviar áudio, gif e desenho — demais mídias bloqueadas
        if (client.type === 'guest' && msg_type !== 'text') {
          var _gtype = String(msg_type).replace('media:', '');
          var _gallow = ['audio', 'gif', 'draw', 'drawing', 'desenho'];
          if (_gallow.indexOf(_gtype) === -1) {
            ws.send(JSON.stringify({ event: 'error', data: { message: 'Visitantes só podem enviar áudio, gif e desenho.' } }));
            return;
          }
        }

        // Flags de sistema (cache)
        const _flags = await getSysFlags();

        // Modo "somente membros": visitante não envia nenhuma mensagem
        if (client.type === 'guest' && _flags.members_only === 'true') {
          ws.send(JSON.stringify({ event: 'error', data: { message: 'Somente membros podem enviar mensagens no momento.' } }));
          return;
        }

        // Anti-flood (ligado por padrão; só desliga se antiflood === 'false')
        if (_flags.antiflood !== 'false') {
          const _now = Date.now();
          client._msgTimes = (client._msgTimes || []).filter(t => _now - t < 7000);
          if (client._msgTimes.length >= 5) {
            ws.send(JSON.stringify({ event: 'error', data: { message: 'Você está enviando mensagens rápido demais. Aguarde alguns segundos.' } }));
            return;
          }
          client._msgTimes.push(_now);
        }

        // Anti-Spam: substituir palavras bloqueadas por ***
        let filteredContent = content || '';
        try {
          const { rows: spamRows } = await db.query(
            "SELECT value FROM system_config WHERE key = 'spam_words'"
          ).catch(() => ({ rows: [] }));
          if (spamRows.length && spamRows[0].value) {
            const blocked = JSON.parse(spamRows[0].value);
            blocked.forEach(word => {
              if (!word) return;
              const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              const re = new RegExp(escaped, 'gi');
              filteredContent = filteredContent.replace(re, '***');
            });
          }
        } catch(e) { /* ignora erro de filtro */ }

        // Salvar no banco — inclui visitantes (guests). Antes, só mensagens
        // de usuários registrados eram salvas (client.userId), então as de
        // visitantes nunca existiam no banco e "desapareciam" assim que ele
        // saía da sala. Agora todo mundo é salvo; user_id fica NULL para
        // visitantes (a coluna aceita NULL), e o nick/role continuam
        // desnormalizados na própria mensagem, então o histórico funciona
        // igual para os dois casos. A expiração automática (10 min) cuida
        // de removê-las depois, como já acontece com as demais mensagens.
        let savedId = null;
        {
          const { rows: [saved] } = await db.query(`
            INSERT INTO messages (room_slug, user_id, nick, role, content, msg_type, media_url, reply_to)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
          `, [client.roomSlug, client.userId || null, client.nick, client.role, filteredContent, msg_type, media_url, reply_to]).catch(() => ({ rows: [{}] }));
          savedId = saved?.id;
        }

        const payload = {
          event: 'message',
          data: {
            id:         savedId,
            nick:       client.nick,
            role:       client.role,
            content:    filteredContent,
            msg_type,
            media_url,
            reply_to,
            quoted_nick,
            quoted_text,
            quoted_depth,
            created_at: new Date().toISOString()
          }
        };

        // Broadcast para toda a sala (incluindo quem enviou)
        if (client.shadowBanned) {
          ws.send(JSON.stringify(payload));            // só o próprio autor vê
          broadcastSpy(client.roomSlug, payload.data); // staff ainda vê no espião
        } else {
          broadcast(client.roomSlug, payload, socketId);
          broadcastSpy(client.roomSlug, payload.data);
          ws.send(JSON.stringify(payload)); // eco para o próprio usuário
        }
        return;
      }

      // ── PRIVATE MESSAGE ────────────────────────────────────
      if (msg.event === 'private') {
        const { to_nick, content, msg_type = 'text', media_url = '', quoted_nick = null, quoted_text = null } = msg.data || {};
        if (!to_nick || (!content && !media_url)) return;

        // Encontrar destinatário conectado
        let targetSocket = null;
        clients.forEach((c, id) => { if (c.nick === to_nick) targetSocket = c; });

        // Salvar no banco (sempre — mesmo quando remetente ou destinatário
        // são visitantes; from_nick/to_nick não dependem de cadastro)
        let targetUserId = null;
        try {
          const { rows: [target] } = await db.query('SELECT id FROM users WHERE nick = $1', [to_nick]);
          if (target) targetUserId = target.id;
        } catch (e) {}

        await db.query(`
          INSERT INTO private_messages (from_user_id, to_user_id, from_nick, to_nick, content, msg_type, media_url, quoted_nick, quoted_text)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [client.userId || null, targetUserId, client.nick, to_nick, content || '', msg_type, media_url, quoted_nick, quoted_text]).catch((e) => { console.error('Erro ao salvar PV:', e.message); });

        const pmPayload = {
          event: 'private',
          data: { from_nick: client.nick, role: client.role, content: content || '', msg_type, media_url, quoted_nick, quoted_text, created_at: new Date().toISOString() }
        };

        if (targetSocket?.ws.readyState === WebSocket.OPEN) {
          targetSocket.ws.send(JSON.stringify(pmPayload));
        }

        ws.send(JSON.stringify({ event: 'private_sent', data: pmPayload.data }));
        return;
      }

      // ── TYPING ────────────────────────────────────────────
      if (msg.event === 'typing') {
        broadcast(client.roomSlug, {
          event: 'typing',
          data: { nick: client.nick }
        }, socketId);
        return;
      }

      // ── QUIZ (host transmite a pergunta; respostas voltam pra sala) ──
      if (msg.event === 'quiz_start') {
        broadcast(client.roomSlug, { event: 'quiz_start', data: { ...(msg.data || {}), host: client.nick } });
        return;
      }
      if (msg.event === 'quiz_answer') {
        broadcast(client.roomSlug, { event: 'quiz_answer', data: { id: (msg.data && msg.data.id), correct: !!(msg.data && msg.data.correct), nick: client.nick } });
        return;
      }

      // ── VIDEOCHAMADA (sinalização WebRTC em malha, máx 4) ──
      if (msg.event === 'vc_hello') {
        client.inVideoLobby = true;
        ws.send(JSON.stringify({ event: 'vc_list', data: { rooms: vcRoomsPublic() } }));
        return;
      }
      if (msg.event === 'vc_list_req') {
        ws.send(JSON.stringify({ event: 'vc_list', data: { rooms: vcRoomsPublic() } }));
        return;
      }
      if (msg.event === 'vc_create') {
        if (!client.userId || client.role === 'guest') { ws.send(JSON.stringify({ event: 'vc_error', data: { message: 'Visitantes não podem criar chamadas.' } })); return; }
        const max = Math.min(4, Math.max(2, parseInt((msg.data && msg.data.max) || 4, 10) || 4));
        const title = String((msg.data && msg.data.title) || ('Chamada de ' + client.nick)).slice(0, 40);
        const id = 'vc_' + Math.random().toString(36).slice(2, 10);
        callRooms.set(id, { id, host: client.nick, title, max, participants: new Set([client.nick]), createdAt: Date.now() });
        client.inVideoLobby = true;
        ws.send(JSON.stringify({ event: 'vc_created', data: { id, max, title, host: client.nick } }));
        // toca o "telefone" para todos os outros usuários online
        const ring = JSON.stringify({ event: 'vc_ring', data: { id, host: client.nick, title, max } });
        const me = String(client.nick).toLowerCase();
        clients.forEach(c => {
          if (c.ws && c.ws.readyState === WebSocket.OPEN && c.nick && String(c.nick).toLowerCase() !== me) c.ws.send(ring);
        });
        vcBroadcastList();
        return;
      }
      if (msg.event === 'vc_join') {
        if (!client.userId || client.role === 'guest') { ws.send(JSON.stringify({ event: 'vc_error', data: { message: 'Visitantes não podem entrar em chamadas.' } })); return; }
        const id = msg.data && msg.data.id;
        const room = callRooms.get(id);
        if (!room) { ws.send(JSON.stringify({ event: 'vc_error', data: { message: 'Esta chamada não existe mais.' } })); return; }
        const already = room.participants.has(client.nick);
        if (!already && room.participants.size >= room.max) {
          ws.send(JSON.stringify({ event: 'vc_full', data: { id } })); return;
        }
        const existing = Array.from(room.participants).filter(n => String(n).toLowerCase() !== String(client.nick).toLowerCase());
        room.participants.add(client.nick);
        client.inVideoLobby = true;
        ws.send(JSON.stringify({ event: 'vc_joined', data: { id, peers: existing, host: room.host, title: room.title, max: room.max } }));
        existing.forEach(n => vcSendToNick(n, { event: 'vc_peer_joined', data: { id, nick: client.nick } }));
        vcBroadcastList();
        return;
      }
      if (msg.event === 'vc_signal') {
        const { id, to, data } = msg.data || {};
        if (!to) return;
        vcSendToNick(to, { event: 'vc_signal', data: { id, from: client.nick, data } });
        return;
      }
      if (msg.event === 'vc_leave') {
        const id = msg.data && msg.data.id;
        if (id) vcRemoveParticipant(id, client.nick);
        return;
      }

      // ── PING (keep-alive + atualiza presence) ─────────────
      if (msg.event === 'ping') {
        if (client.userId) {
          await db.query(
            'UPDATE online_presence SET last_ping = NOW() WHERE user_id = $1', [client.userId]
          ).catch(() => {});
        }
        ws.send(JSON.stringify({ event: 'pong' }));
        return;
      }

      // ── STATUS ────────────────────────────────────────────
      if (msg.event === 'status') {
        const { status } = msg.data || {};
        if (client.userId) {
          await db.query('UPDATE users SET status = $1 WHERE id = $2', [status, client.userId]).catch(() => {});
        }
        broadcast(client.roomSlug, {
          event: 'user_status',
          data: { nick: client.nick, status }
        }, socketId);
        return;
      }

      // ── ADMIN: KICK ───────────────────────────────────────
      // ── SPY / MONITOR (staff) ──────────────────────────────
      if (msg.event === 'spy_join') {
        if (!['admin','supervisor','mod'].includes(client.role)) {
          ws.send(JSON.stringify({ event: 'error', data: { message: 'Sem permissão para monitorar.' } }));
          return;
        }
        const room = (msg.data && msg.data.room) || '';
        client.spyRoom = room;
        try {
          const { rows } = await db.query(
            `SELECT id, nick, role, content, msg_type, media_url, created_at
             FROM messages
             WHERE room_slug = $1 AND is_deleted = FALSE
               AND created_at > NOW() - INTERVAL '10 minutes'
             ORDER BY created_at DESC LIMIT 50`, [room]
          );
          ws.send(JSON.stringify({ event: 'spy_history', data: { room_slug: room, messages: rows.reverse() } }));
        } catch (e) {}
        return;
      }
      if (msg.event === 'spy_leave') {
        client.spyRoom = null;
        return;
      }

      if (msg.event === 'admin_kick_room') {
        if (!['admin','supervisor','mod'].includes(client.role)) return;
        const room = (msg.data && msg.data.room) || '';
        clients.forEach((c) => {
          if (c.roomSlug === room && !['admin','supervisor','mod'].includes(c.role) && c.ws.readyState === WebSocket.OPEN) {
            c.ws.send(JSON.stringify({ event: 'kicked', data: { by: client.nick, room } }));
            c.ws.close(4002, 'Room cleared by moderator');
          }
        });
        return;
      }

      if (msg.event === 'admin_kick') {
        if (!['admin','supervisor','mod'].includes(client.role)) return;
        const { target_nick } = msg.data || {};
        clients.forEach((c, id) => {
          if (c.nick === target_nick && c.ws.readyState === WebSocket.OPEN) {
            if (['admin','supervisor','mod'].includes(c.role)) return; // não kicka equipe
            c.ws.send(JSON.stringify({ event: 'kicked', data: { by: client.nick } }));
            c.ws.close(4002, 'Kicked by moderator');
          }
        });
        try { logAction({ actor_nick: client.nick, actor_role: client.role, action: 'kick', target_nick: target_nick || '', detail: '' }); } catch (e) {}
        return;
      }
    });

    ws.on('close', async () => {
      const client = clients.get(socketId);
      if (client) {
        clients.delete(socketId);
        // Se ainda existe OUTRA conexão aberta do mesmo usuário (ex.: refresh/reconexão
        // da mesma aba), o usuário continua online: NÃO avisa saída nem apaga a presença.
        let stillOnline = false;
        if (!client.isSpyConn && client.nick) {
          const n = String(client.nick).toLowerCase();
          for (const c of clients.values()) {
            if (c.nick && String(c.nick).toLowerCase() === n && c.ws && c.ws.readyState === WebSocket.OPEN) { stillOnline = true; break; }
          }
        }
        if (!stillOnline) {
          // sai de qualquer videochamada que estava
          if (client.nick) {
            const leaving = [];
            callRooms.forEach((room, id) => { if (room.participants.has(client.nick)) leaving.push(id); });
            leaving.forEach(id => vcRemoveParticipant(id, client.nick));
          }
          if (client.roomSlug) {
            broadcast(client.roomSlug, {
              event: 'user_left',
              data: { nick: client.nick, role: client.role }
            }, socketId);
          }
          if (client.userId) {
            await db.query('DELETE FROM online_presence WHERE user_id = $1', [client.userId]).catch(() => {});
            await db.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [client.userId]).catch(() => {});
          }
        }
      }
      sendOnlineCount();
    });

    ws.on('error', () => clients.delete(socketId));

    // Confirmar conexão
    ws.send(JSON.stringify({
      event: 'connected',
      data: { nick: userInfo.nick, role: userInfo.role, socket_id: socketId }
    }));

    sendOnlineCount();
  });

  console.log('🔌 WebSocket servidor iniciado em /ws');
  return wss;
}

function isNickOnline(nick) {
  if (!nick) return false;
  const n = String(nick).toLowerCase();
  for (const c of clients.values()) {
    if (c.nick && String(c.nick).toLowerCase() === n && c.ws && c.ws.readyState === WebSocket.OPEN) return true;
  }
  return false;
}

function setModFlags(nick, flags) {
  if (!nick) return;
  const n = String(nick).toLowerCase();
  clients.forEach((c) => {
    if (c.nick && String(c.nick).toLowerCase() === n) {
      if ('mutedUntil' in flags) c.mutedUntil = flags.mutedUntil;
      if ('shadowBanned' in flags) c.shadowBanned = flags.shadowBanned;
    }
  });
}

module.exports = setupWebSocket;
module.exports.isNickOnline = isNickOnline;
module.exports.setModFlags = setModFlags;
module.exports.broadcastToRoom = broadcast;
module.exports.broadcastAll    = broadcastAll;
module.exports.onlineCount     = () => clients.size;
