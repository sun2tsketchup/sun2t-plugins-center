// Betagon website + admin on Cloudflare Workers.
// Content, accounts, sessions and registrations live in D1 (binding DB), images in R2 (binding IMAGES),
// static files (public/assets, admin, Quill) are served from the ASSETS binding. See CLOUDFLARE.md.
import core from '../lib/core.js';
import mig from '../lib/migrate.js';
import { oldSite, GALLERY_MAX } from '../lib/old-site.js';
import seed from '../data/seed.json';
import layoutTpl from '../views/layout.html';
import homeTpl from '../views/home.html';
import postTpl from '../views/post.html';
import postsTpl from '../views/posts.html';
import courseTpl from '../views/course.html';
import productsTpl from '../views/products.html';
import contactTpl from '../views/contact.html';
import chatTpl from '../views/chat.html';
import { VERSION } from './version.js';

const TPL = { layout: layoutTpl, home: homeTpl, post: postTpl, posts: postsTpl, course: courseTpl, products: productsTpl, contact: contactTpl, chat: chatTpl };
const view = n => TPL[n];
const V = VERSION;
const COOKIE = 'btg_admin';
const SESSION_HOURS = 12;
const PBKDF2_ITER = 25000;

/* ---------------- responses ---------------- */
const BASE_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' };
const ADMIN_HEADERS = { 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex', 'Content-Security-Policy': core.ADMIN_CSP };
function withHeaders(res, extra) {
  const r = new Response(res.body, res);
  for (const [k, v] of Object.entries({ ...BASE_HEADERS, ...extra })) r.headers.set(k, v);
  return r;
}
const json = (obj, status = 200, headers = {}) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...ADMIN_HEADERS, ...BASE_HEADERS, ...headers } });
const html = (body, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ...BASE_HEADERS } });
const readCookie = (req, name) => {
  const m = (req.headers.get('Cookie') || '').split(/;\s*/).find(c => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
};
const cookie = (v, maxAge, secure) => `${COOKIE}=${v}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
const clientIp = req => req.headers.get('CF-Connecting-IP') || 'local';
async function readJson(req, limit) {
  const len = +(req.headers.get('Content-Length') || 0);
  if (len > limit) throw new core.Bad('Dữ liệu quá lớn.', 413);
  const text = await req.text();
  if (text.length > limit) throw new core.Bad('Dữ liệu quá lớn.', 413);
  try { return text ? JSON.parse(text) : {}; } catch { throw new core.Bad('Dữ liệu không hợp lệ.'); }
}

/* ---------------- D1 storage ---------------- */
let ready = false;
async function init(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 0)'),
    db.prepare('CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user TEXT NOT NULL, exp INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS hits (k TEXT NOT NULL, t INTEGER NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS hits_k ON hits (k, t)'),
    db.prepare('CREATE TABLE IF NOT EXISTS regs (id TEXT PRIMARY KEY, at TEXT NOT NULL, v TEXT NOT NULL)'),
  ]);
  ready = true;
}
async function kvGet(db, k) {
  const r = await db.prepare('SELECT v, rev FROM kv WHERE k = ?').bind(k).first();
  return r ? { v: JSON.parse(r.v), rev: r.rev } : null;
}
async function loadContent(db) {
  let r = await kvGet(db, 'content');
  if (!r) {
    const d = { ...seed, rev: 1 };
    delete d.registrations;
    await db.prepare('INSERT OR IGNORE INTO kv (k, v, rev) VALUES (?, ?, 1)').bind('content', JSON.stringify(d)).run();
    r = await kvGet(db, 'content');
  }
  const d = r.v; d.rev = r.rev;
  if (mig.pending(d) && !loadContent.migrating) {
    loadContent.migrating = true;
    try { return await saveContent(db, x => { mig.migrate(x); }); } finally { loadContent.migrating = false; }
  }
  return d;
}
// mutator may run more than once if two saves race
async function saveContent(db, mutator) {
  for (let i = 0; i < 5; i++) {
    const d = await loadContent(db), old = d.rev;
    mutator(d);
    d.rev = old + 1; d.updatedAt = new Date().toISOString();
    const res = await db.prepare('UPDATE kv SET v = ?, rev = ? WHERE k = ? AND rev = ?').bind(JSON.stringify(d), d.rev, 'content', old).run();
    if (res.meta.changes) return d;
  }
  throw new core.Bad('Máy chủ đang bận, thử lại sau.', 503);
}
async function kvPut(db, k, v) {
  await db.prepare('INSERT INTO kv (k, v, rev) VALUES (?, ?, 1) ON CONFLICT(k) DO UPDATE SET v = excluded.v, rev = kv.rev + 1').bind(k, JSON.stringify(v)).run();
}

/* ---------------- accounts ---------------- */
const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
const unhex = h => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)));
async function pbkdf2(password, salt, iter) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256));
}
async function hashPassword(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${PBKDF2_ITER}$${hex(salt)}$${await pbkdf2(pw, salt, PBKDF2_ITER)}`;
}
async function checkPassword(pw, stored) {
  const [kind, iter, salt, hash] = String(stored || '').split('$');
  if (kind !== 'pbkdf2') { await pbkdf2(pw, new Uint8Array(16), PBKDF2_ITER); return false; }
  const got = await pbkdf2(pw, unhex(salt), +iter);
  let diff = got.length ^ hash.length;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ (hash.charCodeAt(i) || 0);
  return diff === 0;
}
async function getUsers(db, env) {
  const r = await kvGet(db, 'users');
  if (r && r.v.length) return r.v;
  // first run: create "admin" from the ADMIN_PASSWORD secret
  const pw = String(env.ADMIN_PASSWORD || '');
  if (pw.length < 8) return [];
  const users = [{ username: env.ADMIN_USER || 'admin', hash: await hashPassword(pw), mustChange: true, createdAt: new Date().toISOString() }];
  await kvPut(db, 'users', users);
  return users;
}
async function tooMany(db, key, max, windowMs) {
  const r = await db.prepare('SELECT COUNT(*) AS n FROM hits WHERE k = ? AND t > ?').bind(key, Date.now() - windowMs).first();
  return r.n >= max;
}
const hit = (db, key) => db.prepare('INSERT INTO hits (k, t) VALUES (?, ?)').bind(key, Date.now()).run();
async function session(db, req) {
  const tok = readCookie(req, COOKIE);
  if (!tok) return null;
  const s = await db.prepare('SELECT user, exp FROM sessions WHERE token = ?').bind(tok).first();
  if (!s || s.exp < Date.now()) return null;
  return { user: s.user, token: tok };
}

/* ---------------- registrations ---------------- */
async function allRegs(db) {
  const { results } = await db.prepare('SELECT v FROM regs ORDER BY at DESC LIMIT 5000').all();
  return results.map(r => JSON.parse(r.v));
}

/* ---------------- old website import (runs on the cron trigger) ---------------- */
const MAX_FETCH = 40; // free plan: 50 outgoing requests per run
async function fetchOld(url, asText) {
  const res = await fetch(url, { headers: { 'User-Agent': 'BetagonSite/1.0 (import)' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (res.status !== 200) throw new Error('HTTP ' + res.status);
  if (asText) return res.text();
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length > 10 * 1024 * 1024) throw new Error('ảnh quá lớn');
  return buf;
}
const foundPages = st => new Map(Object.entries(st.pages).filter(([, p]) => p.imgs).map(([u, p]) => [u, p.imgs]));
async function importStep(env) {
  const db = env.DB, old = oldSite(env.OLD_SITE_HOSTS);
  await init(db);
  const st = (await kvGet(db, 'import'))?.v || { pages: {}, imgs: {} };
  const d = await loadContent(db);
  const log = { pagesRead: 0, imagesCopied: 0, errors: 0 };
  // 1) read old work pages to find each work's photos
  const pending = old.sourcePages(d.works).filter(u => !(st.pages[u] && (st.pages[u].imgs || st.pages[u].tries >= 3)));
  if (pending.length) {
    await Promise.all(pending.slice(0, MAX_FETCH).map(async u => {
      const p = st.pages[u] || (st.pages[u] = { tries: 0 });
      try { p.imgs = old.pageImages(await fetchOld(u, true), u); log.pagesRead++; } catch (e) { p.tries++; log.errors++; }
    }));
    if (pending.length <= MAX_FETCH) {
      await saveContent(db, x => { log.galleries = old.applyGalleries(x.works, foundPages(st)); });
      st.cap = GALLERY_MAX;
    }
    await kvPut(db, 'import', st);
    return { ...log, pagesLeft: Math.max(0, pending.length - MAX_FETCH) };
  }
  // galleries made by an earlier version were cut at 8 photos: fill them up from the pages already read
  if ((st.cap || 8) < GALLERY_MAX && Object.keys(st.pages).length) {
    const below = st.cap || 8;
    await saveContent(db, x => { log.refilled = old.applyGalleries(x.works, foundPages(st), { refillBelow: below }); });
    st.cap = GALLERY_MAX;
    await kvPut(db, 'import', st);
    return log;
  }
  // 2) copy images that still point at the old website into R2
  const urls = old.imageUrls(d).filter(u => !(st.imgs[u] && st.imgs[u].tries >= 3));
  if (!urls.length) return { ...log, done: true };
  const map = new Map();
  await Promise.all(urls.slice(0, MAX_FETCH).map(async u => {
    const s = st.imgs[u] || (st.imgs[u] = { tries: 0 });
    try {
      const buf = await fetchOld(u);
      const kind = core.imageKind(buf);
      if (!kind) throw new Error('không phải ảnh');
      const name = 'old-' + hex(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(u))).slice(0, 16) + '.' + kind;
      await env.IMAGES.put(name, buf, { httpMetadata: { contentType: core.IMAGE_TYPES[kind] } });
      map.set(u, '/uploads/' + name); log.imagesCopied++;
    } catch (e) { s.tries++; log.errors++; }
  }));
  if (map.size) await saveContent(db, x => { for (const k of Object.keys(x)) if (k !== 'rev') x[k] = old.replaceDeep(x[k], map); });
  await kvPut(db, 'import', st);
  return { ...log, imagesLeft: Math.max(0, urls.length - MAX_FETCH) };
}

/* ---------------- router ---------------- */
async function handle(req, env, ctx) {
  const url = new URL(req.url), p = url.pathname, m = req.method, db = env.DB;
  const secure = url.protocol === 'https:';
  await init(db);

  // static files
  if (p.startsWith('/assets/')) return withHeaders(await env.ASSETS.fetch(req), { 'Cache-Control': 'public, max-age=604800' });
  if (p === '/favicon.ico') return Response.redirect(url.origin + '/assets/logo-mark.png', 302);
  if (p.startsWith('/uploads/')) {
    const name = p.slice(9);
    if (!/^[\w.-]+$/.test(name)) return new Response('Not found', { status: 404 });
    const obj = await env.IMAGES.get(name);
    if (!obj) return new Response('Not found', { status: 404 });
    return new Response(obj.body, { headers: { 'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'public, max-age=2592000', 'Content-Security-Policy': "default-src 'none'; img-src 'self'", ...BASE_HEADERS } });
  }
  if (p === '/admin' || p === '/admin/') return withHeaders(await env.ASSETS.fetch(new Request(url.origin + '/admin/index.html')), ADMIN_HEADERS);
  if (p === '/admin/export/registrations.csv') {
    if (!(await session(db, req))) return Response.redirect(url.origin + '/admin', 302);
    return new Response(core.registrationsCsv(await allRegs(db)), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="dang-ky-betagon.csv"', ...ADMIN_HEADERS } });
  }
  if (p.startsWith('/admin/')) {
    const r = await env.ASSETS.fetch(req);
    if (r.status !== 404) return withHeaders(r, ADMIN_HEADERS);
  }

  // public pages
  if (m === 'GET' && p === '/') return html(core.homePage(await loadContent(db), view, V));
  if (m === 'GET' && (p === '/bai-viet' || p === '/bai-viet/')) return html(core.postsPage(await loadContent(db), view, V));
  const pm = m === 'GET' && p.match(/^\/(khoa-hoc|san-pham)\/([a-z0-9-]+)\/?$/);
  if (pm) {
    const d = await loadContent(db);
    const out = pm[1] === 'khoa-hoc' ? core.coursePage(d, view, V, pm[2]) : core.productsPage(d, view, V, pm[2]);
    if (out) return html(out);
  }
  if (m === 'GET' && /^\/(gioi-thieu|lich-khai-giang|khoa-hoc|san-pham|feedback|thu-vien|hoi-dap|dang-ky)\/?$/.test(p)) {
    const out = core.blockPage(await loadContent(db), view, V, p);
    if (out) return html(out);
  }
  if (m === 'GET' && p.startsWith('/bai-viet/')) {
    let slug = ''; try { slug = decodeURIComponent(p.slice(10)); } catch { }
    const page = core.postPage(await loadContent(db), view, V, slug);
    if (page) return html(page);
  }

  // public API
  if (m === 'POST' && p === '/api/register') {
    const b = await readJson(req, 20000);
    if (b.website) return json({ ok: true }); // honeypot
    const key = 'reg:' + clientIp(req);
    if (await tooMany(db, key, 5, 10 * 60e3)) return json({ error: 'Bạn đã gửi nhiều lần, thử lại sau ít phút nhé.' }, 429);
    const r = core.newRegistration(b, (await loadContent(db)).courses);
    if (r.error) return json({ error: r.error }, 400);
    await db.batch([db.prepare('INSERT INTO regs (id, at, v) VALUES (?, ?, ?)').bind(r.reg.id, r.reg.at, JSON.stringify(r.reg)), db.prepare('INSERT INTO hits (k, t) VALUES (?, ?)').bind(key, Date.now())]);
    return json({ ok: true });
  }

  if (p.startsWith('/api/')) {
    if (req.headers.get('X-Betagon') !== '1') return json({ error: 'Yêu cầu không hợp lệ.' }, 403);
    if (m === 'POST' && p === '/api/login') {
      const b = await readJson(req, 20000), key = 'login:' + clientIp(req);
      if (await tooMany(db, key, 8, 15 * 60e3)) return json({ error: 'Đăng nhập sai quá nhiều lần. Thử lại sau 15 phút.' }, 429);
      const users = await getUsers(db, env);
      if (!users.length) return json({ error: 'Chưa có tài khoản admin. Hãy đặt biến ADMIN_PASSWORD (ít nhất 8 ký tự) trong Cloudflare rồi thử lại.' }, 503);
      const u = users.find(x => x.username === String(b.username || '').trim());
      const ok = await checkPassword(String(b.password || ''), u ? u.hash : '');
      if (!u || !ok) { await hit(db, key); return json({ error: 'Sai tên đăng nhập hoặc mật khẩu.' }, 401); }
      const token = core.randomHex(32);
      await db.batch([
        db.prepare('INSERT INTO sessions (token, user, exp) VALUES (?, ?, ?)').bind(token, u.username, Date.now() + SESSION_HOURS * 3600e3),
        db.prepare('DELETE FROM sessions WHERE exp < ?').bind(Date.now()),
        db.prepare('DELETE FROM hits WHERE t < ?').bind(Date.now() - 3600e3),
      ]);
      return json({ user: u.username, mustChange: !!u.mustChange }, 200, { 'Set-Cookie': cookie(token, SESSION_HOURS * 3600, secure) });
    }
    if (m === 'POST' && p === '/api/logout') {
      const tok = readCookie(req, COOKIE);
      if (tok) await db.prepare('DELETE FROM sessions WHERE token = ?').bind(tok).run();
      return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0, secure) });
    }
    if (p.startsWith('/api/admin/')) return adminApi(req, env, ctx, p.slice(10), m);
    return json({ error: 'Không tìm thấy.' }, 404);
  }

  const d = await loadContent(db);
  return html(core.notFoundPage(d, view, V), 404);
}

async function adminApi(req, env, ctx, p, m) {
  const db = env.DB;
  const s = await session(db, req);
  if (!s) return json({ error: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.' }, 401);
  const users = (await kvGet(db, 'users'))?.v || [];
  const me = users.find(u => u.username === s.user);
  const mustChange = !!(me && me.mustChange);
  if (mustChange && !['/me', '/password'].includes(p)) return json({ error: 'Bạn cần đổi mật khẩu trước.', mustChange: true }, 403);

  if (m === 'GET' && p === '/me') return json({ user: s.user, mustChange });
  if (m === 'POST' && p === '/password') {
    const b = await readJson(req, 20000);
    if (!me) return json({ error: 'Không tìm thấy tài khoản.' }, 404);
    if (!(await checkPassword(String(b.current || ''), me.hash))) return json({ error: 'Mật khẩu hiện tại chưa đúng.' }, 400);
    if (String(b.next || '').length < 8) return json({ error: 'Mật khẩu mới cần ít nhất 8 ký tự.' }, 400);
    me.hash = await hashPassword(String(b.next)); me.mustChange = false;
    await kvPut(db, 'users', users);
    await db.prepare('DELETE FROM sessions WHERE user = ? AND token != ?').bind(s.user, s.token).run();
    return json({ ok: true });
  }
  if (m === 'GET' && p === '/content') {
    const d = await loadContent(db);
    const n = await db.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN json_extract(v, '$.status') = 'new' THEN 1 ELSE 0 END) AS fresh FROM regs").first();
    return json({ rev: d.rev, updatedAt: d.updatedAt, data: d, newRegs: n.fresh || 0, totalRegs: n.total || 0, schema: core.SCHEMA, settingsSchema: core.SETTINGS, sections: core.SECTIONS });
  }
  if (m === 'PUT' && p.startsWith('/collection/')) {
    const name = p.slice(12), b = await readJson(req, 2e6);
    const d = await loadContent(db); core.checkRev(b, d);
    const saved = await saveContent(db, core.collectionUpdate(name, b, d));
    return json({ rev: saved.rev, items: saved[name], schedule: saved.schedule });
  }
  if (m === 'PUT' && p === '/settings') {
    const b = await readJson(req, 2e6);
    const d = await loadContent(db); core.checkRev(b, d);
    const settings = core.cleanSettings(b.settings || {}, d.settings);
    const saved = await saveContent(db, x => { x.settings = settings; });
    return json({ rev: saved.rev, settings: saved.settings });
  }
  if (m === 'POST' && p === '/upload') {
    let file;
    try { file = (await req.formData()).get('file'); } catch { return json({ error: 'Tải ảnh lên chưa được.' }, 400); }
    if (!file || typeof file === 'string') return json({ error: 'Chưa chọn ảnh.' }, 400);
    if (file.size > 5 * 1024 * 1024) return json({ error: 'Ảnh lớn hơn 5MB.' }, 400);
    const buf = new Uint8Array(await file.arrayBuffer());
    const kind = core.imageKind(buf);
    if (!kind) return json({ error: 'Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF.' }, 400);
    const name = core.uploadName(kind);
    await env.IMAGES.put(name, buf, { httpMetadata: { contentType: core.IMAGE_TYPES[kind] } });
    return json({ url: '/uploads/' + name });
  }
  if (m === 'GET' && p === '/registrations') return json({ items: await allRegs(db) });
  const rm = p.match(/^\/registrations\/([\w-]{1,40})$/);
  if (rm && m === 'PATCH') {
    const b = await readJson(req, 20000);
    const row = await db.prepare('SELECT v FROM regs WHERE id = ?').bind(rm[1]).first();
    if (!row) return json({ error: 'Không tìm thấy.' }, 404);
    const r = core.patchRegistration(JSON.parse(row.v), b);
    await db.prepare('UPDATE regs SET v = ? WHERE id = ?').bind(JSON.stringify(r), rm[1]).run();
    return json({ item: r });
  }
  if (rm && m === 'DELETE') {
    await db.prepare('DELETE FROM regs WHERE id = ?').bind(rm[1]).run();
    return json({ ok: true });
  }
  if (m === 'GET' && p === '/import') {
    const st = (await kvGet(db, 'import'))?.v || { pages: {}, imgs: {} };
    const d = await loadContent(db), old = oldSite(env.OLD_SITE_HOSTS);
    return json({ pagesLeft: old.sourcePages(d.works).filter(u => !(st.pages[u] && (st.pages[u].imgs || st.pages[u].tries >= 3))).length,
      imagesLeft: old.imageUrls(d).filter(u => !(st.imgs[u] && st.imgs[u].tries >= 3)).length });
  }
  if (m === 'POST' && p === '/import') return json(await importStep(env));
  return json({ error: 'Không tìm thấy.' }, 404);
}

export default {
  async fetch(req, env, ctx) {
    try { return await handle(req, env, ctx); }
    catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error(err && err.stack || err);
      return json({ error: status >= 500 ? 'Lỗi máy chủ, thử lại sau.' : err.message }, status);
    }
  },
  async scheduled(event, env, ctx) {
    if (env.SKIP_IMAGE_IMPORT === '1') return;
    const r = await importStep(env);
    if (!r.done) console.log('Chép dữ liệu web cũ:', JSON.stringify(r));
  },
};
