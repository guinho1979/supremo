/**
 * ═══════════════════════════════════════════════════════════════
 *  CHAT SUPREMO — Biblioteca de Ícones SVG  (icons.js)
 *  Versão 1.0
 *
 *  Como usar:
 *    <script src="icons.js"></script>
 *
 *    // Retorna string SVG:
 *    ICO.send()           → SVG padrão (20×20, currentColor)
 *    ICO.send(24)         → SVG 24×24
 *    ICO.send(20,'#fff')  → SVG com cor fixa
 *
 *    // Inserir no DOM:
 *    btn.innerHTML = ICO.send(18);
 *    btn.innerHTML = ICO.mic() + ' Gravar';
 *
 *  Padrão visual:
 *    • Tamanho padrão : 20×20
 *    • Cor padrão     : currentColor  (herda do CSS)
 *    • Stroke-width   : 1.8
 *    • Stroke-linecap / linejoin : round
 *    • viewBox        : 0 0 24 24
 *    • fill           : none  (outline-style, exceto ícones preenchidos)
 *    • aria-hidden    : true  (acessibilidade — texto do botão dá contexto)
 * ═══════════════════════════════════════════════════════════════
 */

(function (global) {
  'use strict';

  /** Wrapper SVG padrão */
  function svg(size, color, paths, extraAttrs) {
    var s = size || 20;
    var c = color || 'currentColor';
    var extra = extraAttrs || '';
    return (
      '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="' + c + '" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true" ' + extra + '>' +
      paths +
      '</svg>'
    );
  }

  /** SVG preenchido (fill-based icons) */
  function svgFill(size, color, paths, extraAttrs) {
    var s = size || 20;
    var c = color || 'currentColor';
    var extra = extraAttrs || '';
    return (
      '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" ' +
      'fill="' + c + '" stroke="none" ' +
      'aria-hidden="true" ' + extra + '>' +
      paths +
      '</svg>'
    );
  }

  var ICO = {

    /* ─────────────────────────────────────────────────────
       NAVEGAÇÃO & AÇÕES GERAIS
    ───────────────────────────────────────────────────── */

    /** Enviar mensagem */
    send: function (sz, col) {
      return svg(sz, col,
        '<line x1="22" y1="2" x2="11" y2="13"/>' +
        '<polygon points="22 2 15 22 11 13 2 9 22 2"/>'
      );
    },

    /** Menu / Configurações (hambúrguer) */
    menu: function (sz, col) {
      return svg(sz, col,
        '<line x1="3" y1="12" x2="21" y2="12"/>' +
        '<line x1="3" y1="6"  x2="21" y2="6"/>' +
        '<line x1="3" y1="18" x2="21" y2="18"/>'
      );
    },

    /** Fechar / Cancelar */
    close: function (sz, col) {
      return svg(sz, col,
        '<line x1="18" y1="6" x2="6" y2="18"/>' +
        '<line x1="6" y1="6" x2="18" y2="18"/>'
      );
    },

    /** Voltar (seta esquerda) */
    back: function (sz, col) {
      return svg(sz, col,
        '<polyline points="15 18 9 12 15 6"/>'
      );
    },

    /** Buscar / Pesquisar */
    search: function (sz, col) {
      return svg(sz, col,
        '<circle cx="11" cy="11" r="7"/>' +
        '<line x1="16.5" y1="16.5" x2="22" y2="22"/>'
      );
    },

    /** Ir para o final / Scroll down */
    scrollDown: function (sz, col) {
      return svg(sz, col,
        '<polyline points="6 9 12 15 18 9"/>'
      );
    },

    /** Mais opções (três pontos) */
    more: function (sz, col) {
      return svg(sz, col,
        '<circle cx="12" cy="5"  r="1" fill="' + (col || 'currentColor') + '" stroke="none"/>' +
        '<circle cx="12" cy="12" r="1" fill="' + (col || 'currentColor') + '" stroke="none"/>' +
        '<circle cx="12" cy="19" r="1" fill="' + (col || 'currentColor') + '" stroke="none"/>'
      );
    },

    /** Mais opções horizontal */
    moreH: function (sz, col) {
      return svg(sz, col,
        '<circle cx="5"  cy="12" r="1" fill="' + (col || 'currentColor') + '" stroke="none"/>' +
        '<circle cx="12" cy="12" r="1" fill="' + (col || 'currentColor') + '" stroke="none"/>' +
        '<circle cx="19" cy="12" r="1" fill="' + (col || 'currentColor') + '" stroke="none"/>'
      );
    },

    /** Publicar / Postar (seta diagonal para cima-direita) */
    publish: function (sz, col) {
      return svg(sz, col,
        '<line x1="22" y1="2" x2="11" y2="13"/>' +
        '<polygon points="22 2 15 22 11 13 2 9 22 2"/>'
      );
    },

    /** Salvar */
    save: function (sz, col) {
      return svg(sz, col,
        '<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>' +
        '<polyline points="17 21 17 13 7 13 7 21"/>' +
        '<polyline points="7 3 7 8 15 8"/>'
      );
    },

    /** Editar (lápis) */
    edit: function (sz, col) {
      return svg(sz, col,
        '<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>' +
        '<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>'
      );
    },

    /** Copiar */
    copy: function (sz, col) {
      return svg(sz, col,
        '<rect x="9" y="9" width="13" height="13" rx="2"/>' +
        '<path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>'
      );
    },

    /** Lixeira / Excluir */
    trash: function (sz, col) {
      return svg(sz, col,
        '<polyline points="3 6 5 6 21 6"/>' +
        '<path d="M19 6l-1 14H6L5 6"/>' +
        '<path d="M10 11v6M14 11v6"/>' +
        '<path d="M9 6V4h6v2"/>'
      );
    },

    /** Desfazer */
    undo: function (sz, col) {
      return svg(sz, col,
        '<polyline points="1 4 1 10 7 10"/>' +
        '<path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>'
      );
    },

    /** Responder mensagem */
    reply: function (sz, col) {
      return svg(sz, col,
        '<polyline points="9 17 4 12 9 7"/>' +
        '<path d="M20 18v-2a4 4 0 00-4-4H4"/>'
      );
    },

    /** Curtir / Like */
    like: function (sz, col) {
      return svg(sz, col,
        '<path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>' +
        '<path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>'
      );
    },

    /** Reportar / Bandeira */
    report: function (sz, col) {
      return svg(sz, col,
        '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>' +
        '<line x1="4" y1="22" x2="4" y2="15"/>'
      );
    },

    /* ─────────────────────────────────────────────────────
       USUÁRIO & SOCIAL
    ───────────────────────────────────────────────────── */

    /** Perfil de usuário */
    user: function (sz, col) {
      return svg(sz, col,
        '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>' +
        '<circle cx="12" cy="7" r="4"/>'
      );
    },

    /** Usuários online / grupo */
    users: function (sz, col) {
      return svg(sz, col,
        '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>' +
        '<circle cx="9" cy="7" r="4"/>' +
        '<path d="M23 21v-2a4 4 0 00-3-3.87"/>' +
        '<path d="M16 3.13a4 4 0 010 7.75"/>'
      );
    },

    /** Ver / Olho */
    eye: function (sz, col) {
      return svg(sz, col,
        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>' +
        '<circle cx="12" cy="12" r="3"/>'
      );
    },

    /** Ocultar / Olho fechado */
    eyeOff: function (sz, col) {
      return svg(sz, col,
        '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>' +
        '<path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>' +
        '<line x1="1" y1="1" x2="23" y2="23"/>'
      );
    },

    /** Bloquear usuário */
    block: function (sz, col) {
      return svg(sz, col,
        '<circle cx="12" cy="12" r="10"/>' +
        '<line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>'
      );
    },

    /** Banir (martelo) */
    ban: function (sz, col) {
      return svg(sz, col,
        '<path d="M15 4l5 5-10 10H5v-5L15 4z"/>' +
        '<line x1="5" y1="20" x2="10" y2="20"/>'
      );
    },

    /** Kickar / Boot (bota) */
    kick: function (sz, col) {
      return svg(sz, col,
        '<path d="M10 2H6l-4 9h6l-2 11 12-13H12l2-7z"/>'
      );
    },

    /** Mutar (microfone cortado) */
    mute: function (sz, col) {
      return svg(sz, col,
        '<line x1="1" y1="1" x2="23" y2="23"/>' +
        '<path d="M9 9v3a3 3 0 005.12 2.12"/>' +
        '<path d="M15 9.34V4a3 3 0 00-5.94-.6"/>' +
        '<path d="M17 16.95A7 7 0 015 12v-2"/>' +
        '<path d="M19 12a7 7 0 01-.11 1.23"/>' +
        '<line x1="12" y1="19" x2="12" y2="23"/>' +
        '<line x1="8" y1="23" x2="16" y2="23"/>'
      );
    },

    /** Shadowban / Fantasma */
    shadowban: function (sz, col) {
      return svg(sz, col,
        '<path d="M12 2a9 9 0 00-9 9v9h4v-4a5 5 0 0010 0v4h4v-9a9 9 0 00-9-9z"/>'
      );
    },

    /** Convidar para sala privada */
    invite: function (sz, col) {
      return svg(sz, col,
        '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>' +
        '<polyline points="22,6 12,13 2,6"/>'
      );
    },

    /** Mensagem privada / Cadeado */
    lock: function (sz, col) {
      return svg(sz, col,
        '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>' +
        '<path d="M7 11V7a5 5 0 0110 0v4"/>'
      );
    },

    /** Cadeado aberto */
    unlock: function (sz, col) {
      return svg(sz, col,
        '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>' +
        '<path d="M7 11V7a5 5 0 019.9-1"/>'
      );
    },

    /* ─────────────────────────────────────────────────────
       MÍDIA & CONTEÚDO
    ───────────────────────────────────────────────────── */

    /** Anexar arquivo (clipe) */
    attach: function (sz, col) {
      return svg(sz, col,
        '<path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>'
      );
    },

    /** Foto / Imagem */
    photo: function (sz, col) {
      return svg(sz, col,
        '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
        '<circle cx="8.5" cy="8.5" r="1.5"/>' +
        '<polyline points="21 15 16 10 5 21"/>'
      );
    },

    /** GIF / Filmagem */
    gif: function (sz, col) {
      return svg(sz, col,
        '<rect x="2" y="4" width="20" height="16" rx="2"/>' +
        '<path d="M10 10.5h-2v3h2"/>' +
        '<line x1="13" y1="10.5" x2="13" y2="13.5"/>' +
        '<path d="M17 10.5h-2v3h2M17 12h-1.5"/>'
      );
    },

    /** Emoji / Sorriso */
    emoji: function (sz, col) {
      return svg(sz, col,
        '<circle cx="12" cy="12" r="10"/>' +
        '<path d="M8 14s1.5 2 4 2 4-2 4-2"/>' +
        '<line x1="9" y1="9" x2="9.01" y2="9"/>' +
        '<line x1="15" y1="9" x2="15.01" y2="9"/>'
      );
    },

    /** Reação / Coração */
    reaction: function (sz, col) {
      return svg(sz, col,
        '<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>'
      );
    },

    /** Desenho / Paint */
    draw: function (sz, col) {
      return svg(sz, col,
        '<circle cx="13.5" cy="6.5" r=".5" fill="' + (col || 'currentColor') + '" stroke="none"/>' +
        '<path d="M21 7.5V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h3.5"/>' +
        '<path d="M17 10l-5 5-1.5 4 4-1.5 5-5a2.12 2.12 0 00-3-3z"/>'
      );
    },

    /** Microfone (gravar) */
    mic: function (sz, col) {
      return svg(sz, col,
        '<path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>' +
        '<path d="M19 10v2a7 7 0 01-14 0v-2"/>' +
        '<line x1="12" y1="19" x2="12" y2="23"/>' +
        '<line x1="8" y1="23" x2="16" y2="23"/>'
      );
    },

    /** Vídeo */
    video: function (sz, col) {
      return svg(sz, col,
        '<polygon points="23 7 16 12 23 17 23 7"/>' +
        '<rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>'
      );
    },

    /** YouTube */
    youtube: function (sz, col) {
      return svgFill(sz, col || '#ef4444',
        '<path d="M22.54 6.42a2.78 2.78 0 00-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46a2.78 2.78 0 00-1.95 1.96A29 29 0 001 12a29 29 0 00.46 5.58A2.78 2.78 0 003.41 19.54C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 001.95-1.96A29 29 0 0023 12a29 29 0 00-.46-5.58z"/>' +
        '<polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="#fff"/>'
      );
    },

    /** Play (player de áudio) */
    play: function (sz, col) {
      return svg(sz, col,
        '<polygon points="5 3 19 12 5 21 5 3"/>'
      );
    },

    /** Pausa */
    pause: function (sz, col) {
      return svg(sz, col,
        '<rect x="6" y="4" width="4" height="16"/>' +
        '<rect x="14" y="4" width="4" height="16"/>'
      );
    },

    /** Rádio */
    radio: function (sz, col) {
      return svg(sz, col,
        '<circle cx="12" cy="12" r="2"/>' +
        '<path d="M16.24 7.76a6 6 0 010 8.49"/>' +
        '<path d="M7.76 7.76a6 6 0 000 8.49"/>' +
        '<path d="M19.07 4.93a10 10 0 010 14.14"/>' +
        '<path d="M4.93 4.93a10 10 0 000 14.14"/>'
      );
    },

    /** Som ligado */
    volume: function (sz, col) {
      return svg(sz, col,
        '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
        '<path d="M19.07 4.93a10 10 0 010 14.14"/>' +
        '<path d="M15.54 8.46a5 5 0 010 7.07"/>'
      );
    },

    /** Mudo (volume off) */
    volumeOff: function (sz, col) {
      return svg(sz, col,
        '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
        '<line x1="23" y1="9" x2="17" y2="15"/>' +
        '<line x1="17" y1="9" x2="23" y2="15"/>'
      );
    },

    /* ─────────────────────────────────────────────────────
       MODERAÇÃO & ADMIN
    ───────────────────────────────────────────────────── */

    /** Admin / Moderação (escudo) */
    shield: function (sz, col) {
      return svg(sz, col,
        '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
      );
    },

    /** DJ (fones de ouvido) */
    dj: function (sz, col) {
      return svg(sz, col,
        '<path d="M3 18v-6a9 9 0 0118 0v6"/>' +
        '<path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3z"/>' +
        '<path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>'
      );
    },

    /** Painel DJ (sliders) */
    djPanel: function (sz, col) {
      return svg(sz, col,
        '<line x1="4" y1="21" x2="4" y2="14"/>' +
        '<line x1="4" y1="10" x2="4" y2="3"/>' +
        '<line x1="12" y1="21" x2="12" y2="12"/>' +
        '<line x1="12" y1="8"  x2="12" y2="3"/>' +
        '<line x1="20" y1="21" x2="20" y2="16"/>' +
        '<line x1="20" y1="12" x2="20" y2="3"/>' +
        '<line x1="1" y1="14" x2="7" y2="14"/>' +
        '<line x1="9" y1="8"  x2="15" y2="8"/>' +
        '<line x1="17" y1="16" x2="23" y2="16"/>'
      );
    },

    /** Anúncio / Megafone */
    announce: function (sz, col) {
      return svg(sz, col,
        '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>' +
        '<path d="M15.54 8.46a5 5 0 010 7.07"/>' +
        '<path d="M19.07 4.93a10 10 0 010 14.14"/>'
      );
    },

    /** Notificações PV (balão de chat) */
    bellPv: function (sz, col) {
      return svg(sz, col,
        '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>'
      );
    },

    /** Transmissão / Broadcast */
    broadcast: function (sz, col) {
      return svg(sz, col,
        '<circle cx="12" cy="12" r="2"/>' +
        '<path d="M16.24 7.76a6 6 0 010 8.49"/>' +
        '<path d="M7.76 16.24a6 6 0 010-8.49"/>' +
        '<path d="M19.07 4.93a10 10 0 010 14.14"/>' +
        '<path d="M4.93 19.07a10 10 0 010-14.14"/>'
      );
    },

    /** Configurações / Engrenagem */
    settings: function (sz, col) {
      return svg(sz, col,
        '<circle cx="12" cy="12" r="3"/>' +
        '<path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>'
      );
    },

    /* ─────────────────────────────────────────────────────
       FERRAMENTAS DE DESENHO (Paint)
    ───────────────────────────────────────────────────── */

    /** Pincel */
    brush: function (sz, col) {
      return svg(sz, col,
        '<path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 014.03 4.03l-8.06 8.07"/>' +
        '<path d="M7.07 14.94C5.79 16.22 3.88 17 2 17l1-4 2.06-2.06"/>' +
        '<circle cx="2" cy="20" r="1"/>'
      );
    },

    /** Borracha */
    eraser: function (sz, col) {
      return svg(sz, col,
        '<path d="M20 20H7L3 16l11-11 7 7z"/>' +
        '<line x1="6" y1="20" x2="20" y2="20"/>' +
        '<line x1="3" y1="16" x2="14" y2="5"/>'
      );
    },

    /** Balde de tinta */
    bucket: function (sz, col) {
      return svg(sz, col,
        '<path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 014.03 4.03l-8.06 8.07"/>' +
        '<path d="M12 12l-3 3-3-3 3-3"/>' +
        '<circle cx="20" cy="20" r="2"/>' +
        '<path d="M20 18V4"/>'
      );
    },

    /** Linha */
    line: function (sz, col) {
      return svg(sz, col,
        '<line x1="5" y1="19" x2="19" y2="5"/>'
      );
    },

    /** Retângulo */
    rect: function (sz, col) {
      return svg(sz, col,
        '<rect x="3" y="3" width="18" height="18" rx="2"/>'
      );
    },

    /** Círculo */
    circle: function (sz, col) {
      return svg(sz, col,
        '<circle cx="12" cy="12" r="10"/>'
      );
    },

    /** Texto (ferramenta) */
    textTool: function (sz, col) {
      return svg(sz, col,
        '<polyline points="4 7 4 4 20 4 20 7"/>' +
        '<line x1="9" y1="20" x2="15" y2="20"/>' +
        '<line x1="12" y1="4" x2="12" y2="20"/>'
      );
    },

    /* ─────────────────────────────────────────────────────
       STATUS
    ───────────────────────────────────────────────────── */

    /** Online (círculo verde preenchido) */
    online: function (sz, col) {
      return svgFill(sz, col || '#10b981',
        '<circle cx="12" cy="12" r="8"/>'
      );
    },

    /** Ausente (círculo amarelo preenchido) */
    away: function (sz, col) {
      return svgFill(sz, col || '#f59e0b',
        '<circle cx="12" cy="12" r="8"/>'
      );
    },

    /** Offline (círculo vermelho preenchido) */
    offline: function (sz, col) {
      return svgFill(sz, col || '#ef4444',
        '<circle cx="12" cy="12" r="8"/>'
      );
    },

    /** Sair / Porta */
    leave: function (sz, col) {
      return svg(sz, col,
        '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>' +
        '<polyline points="16 17 21 12 16 7"/>' +
        '<line x1="21" y1="12" x2="9" y2="12"/>'
      );
    },

    /* ─────────────────────────────────────────────────────
       VIDEOCHAMADA
    ───────────────────────────────────────────────────── */

    /** Câmera ligada */
    camera: function (sz, col) {
      return svg(sz, col,
        '<path d="M23 7l-7 5 7 5V7z"/>' +
        '<rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>'
      );
    },

    /** Câmera desligada */
    cameraOff: function (sz, col) {
      return svg(sz, col,
        '<path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2"/>' +
        '<path d="M7 5h7a2 2 0 012 2v3l7-4v10"/>' +
        '<line x1="1" y1="1" x2="23" y2="23"/>'
      );
    },

    /** Encerrar chamada */
    endCall: function (sz, col) {
      return svg(sz, col || '#ef4444',
        '<path d="M10.68 13.31a16 16 0 003.41 2.6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7 2 2 0 011.72 2v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.42 19.42 0 01-3.33-3.33 19.79 19.79 0 01-3.07-8.67A2 2 0 014.34 3h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 10.9"/>' +
        '<line x1="23" y1="1" x2="1" y2="23"/>'
      );
    },

    /* ─────────────────────────────────────────────────────
       EXTRAS / INTERFACE
    ───────────────────────────────────────────────────── */

    /** Estrela / VIP */
    star: function (sz, col) {
      return svg(sz, col,
        '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
      );
    },

    /** Coroa / Premium */
    crown: function (sz, col) {
      return svg(sz, col,
        '<path d="M2 20h20M5 20l2-8 5 4 5-4 2 8"/>' +
        '<circle cx="12" cy="8" r="2"/>' +
        '<circle cx="4"  cy="10" r="1.5"/>' +
        '<circle cx="20" cy="10" r="1.5"/>'
      );
    },

    /** Troféu / Conquista */
    trophy: function (sz, col) {
      return svg(sz, col,
        '<polyline points="8 21 12 17 16 21"/>' +
        '<path d="M7 4H17v7a5 5 0 01-10 0V4z"/>' +
        '<line x1="12" y1="17" x2="12" y2="12"/>' +
        '<path d="M17 6h3a1 1 0 011 1v2a4 4 0 01-4 4h-.5"/>' +
        '<path d="M7 6H4a1 1 0 00-1 1v2a4 4 0 004 4h.5"/>'
      );
    },

    /** Chave (VIP / acesso) */
    key: function (sz, col) {
      return svg(sz, col,
        '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>'
      );
    },

    /** Info */
    info: function (sz, col) {
      return svg(sz, col,
        '<circle cx="12" cy="12" r="10"/>' +
        '<line x1="12" y1="16" x2="12" y2="12"/>' +
        '<line x1="12" y1="8" x2="12.01" y2="8"/>'
      );
    },

    /** Aviso / Alerta */
    warning: function (sz, col) {
      return svg(sz, col,
        '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>' +
        '<line x1="12" y1="9" x2="12" y2="13"/>' +
        '<line x1="12" y1="17" x2="12.01" y2="17"/>'
      );
    },

    /** Estatísticas / Gráfico */
    stats: function (sz, col) {
      return svg(sz, col,
        '<line x1="18" y1="20" x2="18" y2="10"/>' +
        '<line x1="12" y1="20" x2="12" y2="4"/>' +
        '<line x1="6"  y1="20" x2="6"  y2="14"/>'
      );
    },

    /** Relógio */
    clock: function (sz, col) {
      return svg(sz, col,
        '<circle cx="12" cy="12" r="10"/>' +
        '<polyline points="12 6 12 12 16 14"/>'
      );
    },

    /** Compartilhar / Link externo */
    share: function (sz, col) {
      return svg(sz, col,
        '<path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>' +
        '<polyline points="16 6 12 2 8 6"/>' +
        '<line x1="12" y1="2" x2="12" y2="15"/>'
      );
    },

    /** Sala de bingo / Jogo */
    game: function (sz, col) {
      return svg(sz, col,
        '<rect x="2" y="6" width="20" height="12" rx="2"/>' +
        '<path d="M12 12h.01M8 12h.01M16 12h.01"/>'
      );
    },

    /** Adicionar / Plus */
    add: function (sz, col) {
      return svg(sz, col,
        '<line x1="12" y1="5" x2="12" y2="19"/>' +
        '<line x1="5" y1="12" x2="19" y2="12"/>'
      );
    },

    /** Check / Confirmado */
    check: function (sz, col) {
      return svg(sz, col,
        '<polyline points="20 6 9 17 4 12"/>'
      );
    },

    /** Histórico / Log */
    history: function (sz, col) {
      return svg(sz, col,
        '<polyline points="1 4 1 10 7 10"/>' +
        '<path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>'
      );
    },

    /** Imagem de perfil / Avatar */
    avatar: function (sz, col) {
      return svg(sz, col,
        '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>' +
        '<circle cx="12" cy="7" r="4"/>' +
        '<path d="M12 14v3"/>'
      );
    },

  };

  /* Expõe globalmente */
  global.ICO = ICO;

})(window);
