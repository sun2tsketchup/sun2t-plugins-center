// Pure helpers for copying content from the old betagon.vn website (shared by Node and the Cloudflare Worker).
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const IMG_EXT = /\.(jpe?g|png|webp|gif)$/i;
const GALLERY_MAX = 40; // ảnh tối đa mỗi đồ án
const SKIP_IMG = /z3278070932240_/i; // ảnh chung của web cũ (ảnh chia sẻ mạng xã hội)
const encParens = u => u.replace(/\(/g, '%28').replace(/\)/g, '%29');

function oldSite(hostsCsv) {
  const HOSTS = String(hostsCsv || 'betagon.vn,www.betagon.vn').split(',').map(h => h.trim()).filter(Boolean);
  const URL_RE = new RegExp(`https?://(?:${HOSTS.map(escRe).join('|')})/Uploads/[^\\s"'<>)\\\\]+`, 'g');
  const isOld = u => { try { return HOSTS.includes(new URL(u).host); } catch { return false; } };

  function pageImages(html, pageUrl) {
    const body = html.replace(/<head[\s\S]*?<\/head>/i, '');
    const out = [];
    for (const m of body.matchAll(/\b(?:src|data-src|data-original|href)\s*=\s*["']([^"']+)["']/gi)) {
      let u; try { u = new URL(m[1].trim().replace(/&amp;/g, '&'), pageUrl); } catch { continue; }
      if (!HOSTS.includes(u.host) || !/\/Uploads\//i.test(u.pathname) || !IMG_EXT.test(u.pathname) || SKIP_IMG.test(u.pathname)) continue;
      if (/\/(logo|banner|icon|slide)/i.test(u.pathname)) continue;
      u.hash = '';
      const href = encParens(u.href);
      if (!out.includes(href)) out.push(href);
    }
    return out;
  }

  // old pages still to read: works without a gallery that list old-site source pages
  const sourcePages = works => [...new Set((works || []).filter(w => !String(w.gallery || '').trim() && String(w.sources || '').trim())
    .flatMap(w => String(w.sources).split('\n').map(x => x.trim()).filter(isOld)))];

  // found: Map(pageUrl -> [imageUrl]). Fills image + gallery of works in place; returns how many were updated.
  // refillBelow: also refill works whose gallery was cut at an older, smaller limit (cover + gallery == refillBelow).
  function applyGalleries(works, found, { max = GALLERY_MAX, refillBelow = 0 } = {}) {
    const freq = new Map();
    for (const list of found.values()) for (const u of list) freq.set(u, (freq.get(u) || 0) + 1);
    // images on many pages are site chrome, not student work
    const common = new Set([...freq].filter(([, n]) => n >= 4 && found.size >= 8).map(([u]) => u));
    let updated = 0;
    for (const w of works || []) {
      if (!String(w.sources || '').trim()) continue;
      const lines = String(w.gallery || '').split('\n').filter(x => x.trim()).length;
      const refill = lines && refillBelow && lines + 1 === refillBelow;
      if (lines && !refill) continue;
      const srcs = String(w.sources).split('\n').map(s => s.trim()).filter(s => found.has(s));
      const imgs = [...new Set(srcs.flatMap(s => found.get(s)).filter(u => !common.has(u)))].slice(0, max);
      if (!imgs.length || (refill && imgs.length <= refillBelow)) continue;
      if (refill) { w.gallery = imgs.slice(1).join('\n'); updated++; continue; }
      if (!w.image) w.image = imgs[0];
      w.gallery = imgs.filter(u => u !== w.image).join('\n');
      updated++;
    }
    return updated;
  }

  function replaceDeep(v, map) {
    if (typeof v === 'string') return v.replace(URL_RE, u => map.get(u) || u);
    if (Array.isArray(v)) return v.map(x => replaceDeep(x, map));
    if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = replaceDeep(v[k], map); return v; }
    return v;
  }
  const imageUrls = d => [...new Set(JSON.stringify(d).match(URL_RE) || [])];

  return { HOSTS, URL_RE, isOld, pageImages, sourcePages, applyGalleries, replaceDeep, imageUrls };
}

module.exports = { oldSite, GALLERY_MAX };
