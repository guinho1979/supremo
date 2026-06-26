// ============================================================
//  Chat Supremo — Cliente real de API + WebSocket
//  Substitui o modo demo (localStorage) por chamadas ao servidor.
//  Por padrão fala com o MESMO domínio que serviu a página.
// ============================================================
(function () {
  var l = window.location;
  var wsp = l.protocol === 'https:' ? 'wss:' : 'ws:';
  window.TC_API_URL = window.TC_API_URL || (l.protocol + '//' + l.host + '/api');
  window.TC_WS_URL  = window.TC_WS_URL  || (wsp + '//' + l.host + '/ws');
})();

(function(){
var LS = {
  get: function (k, d) { try { return localStorage.getItem(k) || (d || ''); } catch (e) { return d || ''; } },
  set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  remove: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};

var API = {
  token: function () { return LS.get('tc_token'); },
  _headers: function () {
    var t = API.token();
    var h = { 'Content-Type': 'application/json' };
    if (t) h.Authorization = 'Bearer ' + t;
    return h;
  },
  _request: async function (method, path, body) {
    var opts = { method: method, headers: API._headers() };
    if (body) opts.body = JSON.stringify(body);
    var res = await fetch(window.TC_API_URL + path, opts);
    var data = {};
    try { data = await res.json(); } catch (e) {}
    if (res.status === 401 && API.token()) { API.clearSession(); }
    if (!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    return data;
  },
  get:    function (p)    { return API._request('GET', p); },
  post:   function (p, b) { return API._request('POST', p, b); },
  patch:  function (p, b) { return API._request('PATCH', p, b); },
  delete: function (p)    { return API._request('DELETE', p); },

  // ── Sessão: preenche TODAS as chaves que as páginas leem ──
  saveSession: function (token, user, type) {
    user = user || {};
    LS.set('tc_token', token);
    LS.set('tc_type', type || 'registered');
    LS.set('tc_nick', user.nick || '');
    LS.set('tc_role', user.role || 'user');
    LS.set('tc_avatar', user.avatar || '');
    LS.set('tc_photo', user.photo_url || '');
    LS.set('tc_nickcolor', user.nick_color || '');
    LS.set('tc_nick_color', user.nick_color || '');
    LS.set('tc_msgcolor', user.msg_color || '');
    LS.set('tc_msg_color', user.msg_color || '');
    LS.set('tc_nick_gradient', user.nick_gradient || '');
    LS.set('tc_status', user.status || 'online');
    if (user.id != null) LS.set('tc_user_id', String(user.id));
    LS.set('tc_session_start', String(Date.now()));
    LS.set('tc_user', JSON.stringify(user));
  },
  clearSession: function () {
    ['tc_token','tc_type','tc_nick','tc_role','tc_avatar','tc_photo','tc_nickcolor',
     'tc_nick_color','tc_msgcolor','tc_msg_color','tc_nick_gradient','tc_status',
     'tc_user_id','tc_session_start','tc_user','tc_spy_mode','tc_spy_room']
      .forEach(function (k) { LS.remove(k); });
  },
  isGuest: function () { return LS.get('tc_type') === 'guest'; },
  currentUser: function () { try { return JSON.parse(LS.get('tc_user', '{}')); } catch (e) { return {}; } },

  // ── Auth ──────────────────────────────────────────────
  login: async function (nick, password) {
    var d = await API.post('/auth/login', { nick: nick, password: password });
    if (d.banned) throw new Error('Esta conta está banida.');
    API.saveSession(d.token, d.user, 'registered');
    return d;
  },
  register: async function (nick, password, birthday) {
    var d = await API.post('/auth/register', { nick: nick, password: password, birthday: birthday || null });
    API.saveSession(d.token, d.user, 'registered');
    return d;
  },
  guest: async function (nick) {
    var d = await API.post('/auth/guest', { nick: nick });
    API.saveSession(d.token, d.user, 'guest');
    // Visitante: foto = ícone de usuário (👤) e nick na cor preta
    try {
      LS.set('tc_avatar', '👤');
      LS.set('tc_photo', '');
      LS.set('tc_nick_color', '#000000');
      LS.set('tc_nickcolor', '#000000');
    } catch (e) {}
    return d;
  },
  logout: async function () { try { await API.post('/auth/logout'); } catch (e) {} API.clearSession(); },
  me:            function ()      { return API.get('/auth/me'); },
  faceidEnroll:  function (secret) { return API.post('/auth/faceid/enroll', { secret: secret }); },
  faceidLogin:   async function (nick, secret) { var d = await API.post('/auth/faceid/login', { nick: nick, secret: secret }); API.saveSession(d.token, d.user, 'registered'); return d; },
  updateProfile: function (patch) { return API.patch('/auth/me', patch); },
  changePassword: function (current, new_password) { return API.patch('/auth/password', { current: current, new_password: new_password }); },
  reactMessage:  function (id, emoji) { return API.post('/messages/' + id + '/react', { emoji: emoji }); },
  getMessageReactions: function (id) { return API.get('/messages/' + id + '/reactions'); },
  delMessage:    function (id) { return API.delete('/messages/' + id); },
  dj: {
    request: function (song, artist, dedica) { return API.post('/dj/requests', { song: song, artist: artist, dedica: dedica }); },
    list:    function () { return API.get('/dj/requests'); },
    played:  function (id, status) { return API.post('/dj/requests/' + id + '/played', { status: status || 'tocado' }); },
    remove:  function (id) { return API.delete('/dj/requests/' + id); }
  },
  getUserProfile:function (nick)  { return API.get('/users/' + encodeURIComponent(nick)); },
  toggleFan:     function (nick)  { return API.post('/users/' + encodeURIComponent(nick) + '/fan'); },
  fansList:      function (nick)  { return API.get('/users/' + encodeURIComponent(nick) + '/fans'); },
  getRecentOnline:function ()     { return API.get('/users/recent'); },
  report:        function (nick, reason) { return API.post('/reports', { target_nick: nick, reason: reason || '' }); },
  getBlocks:     function ()      { return API.get('/blocks'); },
  blockUser:     function (nick)  { return API.post('/blocks', { nick: nick }); },
  unblockUser:   function (nick)  { return API.delete('/blocks/' + encodeURIComponent(nick)); },

  // ── Conteúdo ──────────────────────────────────────────
  getRooms:      function ()     { return API.get('/rooms'); },
  getMessages:   function (slug) { return API.get('/rooms/' + encodeURIComponent(slug) + '/messages'); },
  getOnline:     function ()     { return API.get('/online'); },
  getLastOnline: function ()     { return API.get('/online/last'); },
  getRecados:    function (page) { return API.get('/recados?page=' + (page || 1)); },
  postRecado:    function (content, extra) { return API.post('/recados', Object.assign({ content: content }, extra || {})); },
  likeRecado:    function (id)   { return API.post('/recados/' + id + '/like'); },
  reactRecado:   function (id, emoji) { return API.post('/recados/' + id + '/react', { emoji: emoji }); },
  commentRecado: function (id, content) { return API.post('/recados/' + id + '/comments', { content: content }); },
  delComment:    function (cid) { return API.delete('/recados/comments/' + cid); },
  delRecado:     function (id)  { return API.delete('/recados/' + id); },
  // ── Status (estilo WhatsApp, expira em 24h) ──
  getStatuses:   function ()      { return API.get('/status'); },
  postStatus:    function (extra)  { return API.post('/status', extra || {}); },
  delStatus:     function (id)     { return API.delete('/status/' + id); },
  report:        function (n, r, reason) { return API.post('/reports', { reported_nick: n, room_slug: r, reason: reason }); },
  getSystemConfig: function ()   { return API.get('/system/config'); },

  // ── DM ────────────────────────────────────────────────
  conversations: function ()     { return API.get('/private/conversations'); },
  roomUsers:     function (slug)  { return API.get('/online/room?slug=' + encodeURIComponent(slug)); },
  privateRooms: {
    list:    function ()          { return API.get('/private-rooms'); },
    create:  function (data)      { return API.post('/private-rooms', data); },
    del:     function (id)        { return API.delete('/private-rooms/' + id); },
    get:     function (id)        { return API.get('/private-rooms/' + id); },
    invite:  function (id, nick)  { return API.post('/private-rooms/' + id + '/invite', { to_nick: nick }); },
    invites: function ()          { return API.get('/private-rooms/invites'); },
    accept:  function (id)        { return API.post('/private-rooms/invites/' + id + '/accept'); },
    decline: function (id)        { return API.post('/private-rooms/invites/' + id + '/decline'); }
  },
  polls: {
    create: function (data)   { return API.post('/polls', data); },
    active: function (room)   { return API.get('/polls/active?room=' + encodeURIComponent(room)); },
    vote:   function (id, i)  { return API.post('/polls/' + id + '/vote', { option_index: i }); },
    close:  function (id)     { return API.post('/polls/' + id + '/close'); }
  },
  quizzes: {
    create: function (data)   { return API.post('/quizzes', data); },
    active: function (room)   { return API.get('/quizzes/active?room=' + encodeURIComponent(room)); },
    answer: function (id, i)  { return API.post('/quizzes/' + id + '/answer', { option_index: i }); },
    close:  function (id)     { return API.post('/quizzes/' + id + '/close'); },
    scores: function (room)   { return API.get('/quizzes/scores?room=' + encodeURIComponent(room)); }
  },
  radio: {
    get:  function (room) { return API.get('/radio?room=' + encodeURIComponent(room)); },
    set:  function (data) { return API.post('/radio', data); },
    stop: function (room) { return API.post('/radio/stop', { room_slug: room }); }
  },
  bingo: {
    state: function () { return API.get('/bingo/state'); },
    start: function () { return API.post('/bingo/start'); },
    card:  function () { return API.post('/bingo/card'); },
    draw:  function () { return API.post('/bingo/draw'); },
    claim: function () { return API.post('/bingo/bingo'); },
    reset: function () { return API.post('/bingo/reset'); }
  },
  dmHistory:     function (nick) { return API.get('/private/' + encodeURIComponent(nick)); },

  // ── Bingo ─────────────────────────────────────────────
  bingo: {
    active: function (room) { return API.get('/bingo/active?room=' + encodeURIComponent(room)); },
    create: function (room, prize) { return API.post('/bingo', { room_slug: room, prize: prize }); },
    get:    function (id) { return API.get('/bingo/' + id); },
    join:   function (id) { return API.post('/bingo/' + id + '/join'); },
    draw:   function (id) { return API.post('/bingo/' + id + '/draw'); },
    end:    function (id) { return API.post('/bingo/' + id + '/end'); }
  },

  // ── Admin ─────────────────────────────────────────────
  admin: {
    getUsers:   function (q) { return API.get('/admin/users?q=' + encodeURIComponent(q || '')); },
    getReports: function ()  { return API.get('/admin/reports'); },
    getBans:    function ()  { return API.get('/admin/bans'); },
    banUser:    function (nick, reason, type, exp) { return API.post('/admin/ban', { nick: nick, reason: reason, ban_type: type, expires_at: exp }); },
    unbanUser:  function (nick) { return API.post('/admin/unban', { nick: nick }); },
    getBanned:  function () { return API.get('/admin/banned'); },
    mute:       function (nick, minutes) { return API.post('/admin/mute', { nick: nick, minutes: minutes }); },
    unmute:     function (nick) { return API.post('/admin/unmute', { nick: nick }); },
    shadow:     function (nick, on) { return API.post('/admin/shadow', { nick: nick, on: on }); },
    getReports: function () { return API.get('/admin/reports'); },
    resolveReport: function (id) { return API.post('/admin/reports/' + id + '/resolve'); },
    setRole:    function (id, role) { return API.patch('/admin/users/' + id + '/role', { role: role }); },
    setNick:    function (id, nick) { return API.patch('/admin/users/' + id + '/nick', { nick: nick }); },
    getLogins:  function () { return API.get('/admin/logins'); },
    getBotKey:  function () { return API.get('/admin/bot-key'); },
    setBotKey:  function (key) { return API.post('/admin/bot-key', { key: key }); },
    createRoom: function (data) { return API.post('/admin/rooms', data); },
    deleteRoom: function (slug) { return API.delete('/admin/rooms/' + encodeURIComponent(slug)); },
    clearRoomMessages: function (slug) { return API.delete('/admin/rooms/' + encodeURIComponent(slug) + '/messages'); },
    setSystem:  function (key, value) { return API.patch('/admin/system', { key: key, value: value }); },
    resolveReport: function (id, status) { return API.patch('/admin/reports/' + id, { status: status }); },
    deleteRecado:  function (id) { return API.delete('/admin/recados/' + id); },
    pinRecado:     function (id) { return API.post('/admin/recados/' + id + '/pin'); },
    getSpamWords:  function () { return API.get('/admin/spam-words'); },
    setSpamWords:  function (words) { return API.post('/admin/spam-words', { words: words }); }
  }
};

// ─── WebSocket ─────────────────────────────────────────
function TCSocket() {
  this.ws = null; this.handlers = {}; this.ping = null;
  this.delay = 2000; this.connected = false; this.intentional = false;
}
TCSocket.prototype.connect = function () {
  var self = this, token = API.token();
  if (!token) return;
  this.intentional = false;
  var tab = '';
  try {
    tab = sessionStorage.getItem('tc_tab') || '';
    if (!tab) {
      tab = Math.random().toString(36).slice(2) + Date.now();
      try { sessionStorage.setItem('tc_tab', tab); } catch (e) {}
      try { if (sessionStorage.getItem('tc_tab') !== tab) { tab = localStorage.getItem('tc_tab') || tab; localStorage.setItem('tc_tab', tab); } } catch (e) {}
    }
  } catch (e) {
    try { tab = localStorage.getItem('tc_tab') || (Math.random().toString(36).slice(2) + Date.now()); localStorage.setItem('tc_tab', tab); } catch (e2) {}
  }
  var _spyc=''; try{ if(new URLSearchParams(location.search).get('spy')) _spyc='&spyconn=1'; }catch(e){}
  this.ws = new WebSocket(window.TC_WS_URL + '?token=' + encodeURIComponent(token) + (tab ? ('&tab=' + encodeURIComponent(tab)) : '') + _spyc);
  this.ws.onopen = function () {
    self.connected = true; self.delay = 2000;
    self.ping = setInterval(function () { self.send('ping'); }, 30000);
    self._emit('connected');
  };
  this.ws.onmessage = function (e) { try { var m = JSON.parse(e.data); self._emit(m.event, m.data); } catch (x) {} };
  this.ws.onclose = function (e) {
    self.connected = false; clearInterval(self.ping);
    self._emit('disconnected', { code: e.code });
    if (e.code === 4005) self._emit('session_replaced', {});
    if (!self.intentional && e.code !== 4001 && e.code !== 4002 && e.code !== 4005 && e.code !== 4006) {
      setTimeout(function () { self.connect(); }, self.delay);
      self.delay = Math.min(self.delay * 1.5, 30000);
    }
  };
  this.ws.onerror = function () {};
};
TCSocket.prototype.send = function (event, data) {
  if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ event: event, data: data || {} }));
};
TCSocket.prototype.join    = function (room) { this.send('join', { room: room }); };
TCSocket.prototype.message = function (content, opts) { this.send('message', Object.assign({ content: content }, opts || {})); };
TCSocket.prototype.private = function (to, content, opts) { this.send('private', Object.assign({ to_nick: to, content: content }, opts || {})); };
TCSocket.prototype.typing  = function () { this.send('typing'); };
TCSocket.prototype.status  = function (s) { this.send('status', { status: s }); };
TCSocket.prototype.kick    = function (nick) { this.send('admin_kick', { target_nick: nick }); };
TCSocket.prototype.spyJoin  = function (room) { this.send('spy_join', { room: room }); };
TCSocket.prototype.spyLeave = function () { this.send('spy_leave'); };
TCSocket.prototype.kickRoom = function (room) { this.send('admin_kick_room', { room: room }); };
TCSocket.prototype.on  = function (ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); return this; };
TCSocket.prototype.off = function (ev, fn) { if (this.handlers[ev]) this.handlers[ev] = this.handlers[ev].filter(function (h) { return h !== fn; }); };
TCSocket.prototype.offAll = function (ev) { if (ev) delete this.handlers[ev]; else this.handlers = {}; };
TCSocket.prototype._emit = function (ev, data) {
  (this.handlers[ev] || []).forEach(function (fn) { fn(data); });
  (this.handlers['*'] || []).forEach(function (fn) { fn(ev, data); });
};
TCSocket.prototype.disconnect = function () { this.intentional = true; clearInterval(this.ping); try { this.ws && this.ws.close(); } catch (e) {} };

window.API = API;
window.tcSocket = new TCSocket();
})();
