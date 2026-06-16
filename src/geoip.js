// src/geoip.js — Geo-localização de IP + detecção de VPN/Proxy
// Usa ip-api.com (grátis, sem chave, com flags proxy/hosting) e ipwho.is como reserva.
// Resultados em cache por 24h.

const _geoCache = new Map();
const GEO_TTL = 24 * 60 * 60 * 1000;

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (/^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^(fc|fd)/i.test(ip)) return true;
  return false;
}

async function lookupGeo(ip) {
  if (!ip) return { ok: false, reason: 'sem-ip' };
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (isPrivateIp(ip))
    return { ok: true, local: 'Rede local / localhost', city: '', region: '', country: '', countryCode: '', asn: '', isp: '', org: '', vpn: false, proxy: false, hosting: false, mobile: false, connType: 'Rede local' };

  const cached = _geoCache.get(ip);
  if (cached && (Date.now() - cached.ts) < GEO_TTL) return cached.data;

  let out = null;

  // 1) ip-api.com (tem flags proxy/hosting/mobile)
  try {
    const r = await fetch('http://ip-api.com/json/' + encodeURIComponent(ip) +
      '?fields=status,country,countryCode,regionName,city,isp,org,as,proxy,hosting,mobile',
      { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    if (j && j.status === 'success') {
      out = {
        ok: true, city: j.city || '', region: j.regionName || '', country: j.country || '',
        countryCode: j.countryCode || '', asn: j.as || '', isp: j.isp || '', org: j.org || '',
        proxy: !!j.proxy, hosting: !!j.hosting, mobile: !!j.mobile, vpn: !!(j.proxy || j.hosting)
      };
    }
  } catch (e) {}

  // 2) ipwho.is (reserva — sem detecção de VPN)
  if (!out) {
    try {
      const r = await fetch('https://ipwho.is/' + encodeURIComponent(ip), { signal: AbortSignal.timeout(5000) });
      const j = await r.json();
      if (j && j.success) {
        out = {
          ok: true, city: j.city || '', region: j.region || '', country: j.country || '',
          countryCode: j.country_code || '',
          asn: (j.connection && j.connection.asn) ? ('AS' + j.connection.asn) : '',
          isp: (j.connection && (j.connection.isp || j.connection.org)) || '',
          org: (j.connection && j.connection.org) || '',
          proxy: false, hosting: false, mobile: false, vpn: false
        };
      }
    } catch (e) {}
  }

  if (!out) return { ok: false, reason: 'lookup-falhou' };

  out.local = [out.city, out.region, out.country].filter(Boolean).join(', ') || '—';
  out.connType = out.proxy ? 'VPN/Proxy' : out.hosting ? 'Datacenter/Hosting' : out.mobile ? 'Conexão móvel' : 'Residencial/comum';
  _geoCache.set(ip, { data: out, ts: Date.now() });
  return out;
}

module.exports = { lookupGeo, isPrivateIp };
