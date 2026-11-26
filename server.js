// Betagon Edu website + admin. Run: npm start  (see README.md)
const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const store = require('./lib/store');
const auth = require('./lib/auth');
const { S: SCHEMA, SETTINGS, SECTIONS } = require('./lib/schema');
const { importOldImages } = require('./lib/import-images');

const PORT = +process.env.PORT || 3000;
const ROOT = __dirname;
const UPLOADS = process.env.UPLOAD_DIR || path.join(ROOT, 'uploads');
const SECURE_COOKIE = process.env.COOKIE_SECURE === '1';
const V = Date.now().toString(36); // cache-buster for css/js
fs.mkdirSync(UPLOADS, { recursive: true });

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1');
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' });
  next();
});

/* ---------------- helpers ---------------- */
const core = require('./lib/core');
const { esc, isImg } = core;
const readCookie = (req, name) => {
  const m = (req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '='));
  return m ? decodeURIComponent(m.slice(name.length + 1)) : '';
};
const clientIp = req => req.ip || req.socket.remoteAddress || '';
const views = {};
const view = n => (process.env.NODE_ENV === 'production' && views[n]) || (views[n] = fs.readFileSync(path.join(ROOT, 'views', n + '.html'), 'utf8'));
const sendHtml = (res, html) => res.set('Cache-Control', 'no-cache').type('html').send(html);

/* ---------------- public pages ---------------- */
app.get('/', (req, res) => sendHtml(res, core.homePage(store.load(), view, V)));
app.get('/bai-viet', (req, res) => sendHtml(res, core.postsPage(store.load(), view, V)));
app.get('/khoa-hoc/:slug', (req, res, next) => {
  const html = core.coursePage(store.load(), view, V, req.params.slug);
  if (!html) return next();
  sendHtml(res, html);
});
app.get('/san-pham/:slug', (req, res, next) => {
  const html = core.productsPage(store.load(), view, V, req.params.slug);
  if (!html) return next();
  sendHtml(res, html);
});
app.get(['/gioi-thieu', '/lich-khai-giang', '/khoa-hoc', '/san-pham', '/feedback', '/thu-vien', '/hoi-dap', '/dang-ky'], (req, res, next) => {
  const html = core.blockPage(store.load(), view, V, req.path);
  if (!html) return next();
  sendHtml(res, html);
});
app.get('/bai-viet/:slug', (req, res, next) => {
  const html = core.postPage(store.load(), view, V, req.params.slug);
  html ? sendHtml(res, html) : next();
});

/* ---------------- static ---------------- */
app.use('/assets', express.static(path.join(ROOT, 'public', 'assets'), { maxAge: '7d' }));
app.use('/uploads', express.static(UPLOADS, { maxAge: '30d', setHeaders: r => r.set('Content-Security-Policy', "default-src 'none'; img-src 'self'") }));
app.get('/favicon.ico', (req, res) => res.redirect('/assets/logo-mark.png'));

/* ---------------- public API: registration ---------------- */
const regHits = new Map();
app.post('/api/register', express.json({ limit: '20kb' }), (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot: bots fill the hidden field
  const ip = clientIp(req), now = Date.now();
  const h = (regHits.get(ip) || []).filter(t => now - t < 10 * 60e3);
  if (h.length >= 5) return res.status(429).json({ error: 'Bạn đã gửi nhiều lần, thử lại sau ít phút nhé.' });
  const r = core.newRegistration(b, store.load().courses);
  if (r.error) return res.status(400).json({ error: r.error });
  h.push(now); regHits.set(ip, h);
  store.save(x => {
    x.registrations.unshift(r.reg);
    if (x.registrations.length > 5000) x.registrations.length = 5000;
  });
  res.json({ ok: true });
});

/* ---------------- admin ---------------- */
const COOKIE = 'btg_admin';
const setCookie = (res, v, maxAge) => res.append('Set-Cookie', `${COOKIE}=${v}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${SECURE_COOKIE ? '; Secure' : ''}`);
// every admin API call must carry this header; browsers won't add it cross-site without CORS approval
const csrf = (req, res, next) => (req.get('X-Betagon') === '1' ? next() : res.status(403).json({ error: 'Yêu cầu không hợp lệ.' }));
function requireAuth(req, res, next) {
  const tok = readCookie(req, COOKIE), s = auth.getSession(tok);
  if (!s) return res.status(401).json({ error: 'Phiên đăng nhập đã hết, vui lòng đăng nhập lại.' });
  req.user = s.user; req.token = tok;
  if (auth.mustChange(s.user) && !['/api/admin/password', '/api/admin/me'].includes(req.baseUrl + req.path)) return res.status(403).json({ error: 'Bạn cần đổi mật khẩu trước.', mustChange: true });
  next();
}
const adminHeaders = (req, res, next) => {
  res.set({ 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY', 'X-Robots-Tag': 'noindex',
    'Content-Security-Policy': core.ADMIN_CSP });
  next();
};
app.use('/admin', adminHeaders);
app.get(['/admin', '/admin/'], (req, res) => res.sendFile(path.join(ROOT, 'admin', 'index.html')));
app.use('/admin/vendor/quill', express.static(path.join(ROOT, 'node_modules', 'quill', 'dist')));
app.use('/admin', express.static(path.join(ROOT, 'admin'), { index: false }));

const api = express.Router();
api.use(adminHeaders, csrf, express.json({ limit: '2mb' }));
api.post('/login', async (req, res) => {
  const r = await auth.login(req.body.username, req.body.password, clientIp(req));
  if (r.error) return res.status(r.status).json({ error: r.error });
  setCookie(res, r.token, 12 * 3600);
  res.json({ user: r.user, mustChange: r.mustChange });
});
api.post('/logout', (req, res) => { auth.logout(readCookie(req, COOKIE)); setCookie(res, '', 0); res.json({ ok: true }); });

api.use('/admin', requireAuth);
api.get('/admin/me', (req, res) => res.json({ user: req.user, mustChange: auth.mustChange(req.user) }));
api.post('/admin/password', async (req, res) => {
  const r = await auth.changePassword(req.user, req.body.current, req.body.next, req.token);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json({ ok: true });
});
api.get('/admin/content', (req, res) => {
  const d = store.load();
  res.json({ rev: d.rev, updatedAt: d.updatedAt, data: { ...d, registrations: undefined }, newRegs: d.registrations.filter(r => r.status === 'new').length, totalRegs: d.registrations.length, schema: SCHEMA, settingsSchema: SETTINGS, sections: SECTIONS });
});
api.put('/admin/collection/:name', (req, res) => {
  const name = req.params.name;
  const d = store.load(); core.checkRev(req.body, d);
  const saved = store.save(core.collectionUpdate(name, req.body, d));
  res.json({ rev: saved.rev, items: saved[name], schedule: saved.schedule });
});
api.put('/admin/settings', (req, res) => {
  const d = store.load(); core.checkRev(req.body, d);
  const settings = core.cleanSettings(req.body.settings || {}, d.settings);
  const saved = store.save(x => { x.settings = settings; });
  res.json({ rev: saved.rev, settings: saved.settings });
});

// image upload: png / jpeg / webp / gif only, checked by file signature, max 5MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
api.post('/admin/upload', (req, res) => upload.single('file')(req, res, err => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Ảnh lớn hơn 5MB.' : 'Tải ảnh lên chưa được.' });
  const f = req.file; if (!f) return res.status(400).json({ error: 'Chưa chọn ảnh.' });
  const kind = core.imageKind(f.buffer);
  if (!kind) return res.status(400).json({ error: 'Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF.' });
  const name = core.uploadName(kind);
  fs.writeFileSync(path.join(UPLOADS, name), f.buffer);
  res.json({ url: '/uploads/' + name });
}));

// registrations
api.get('/admin/registrations', (req, res) => res.json({ items: store.load().registrations }));
api.patch('/admin/registrations/:id', (req, res) => {
  let found = null;
  store.save(x => {
    const r = x.registrations.find(y => y.id === req.params.id); if (!r) return;
    found = core.patchRegistration(r, req.body);
  });
  found ? res.json({ item: found }) : res.status(404).json({ error: 'Không tìm thấy.' });
});
api.delete('/admin/registrations/:id', (req, res) => { store.save(x => { x.registrations = x.registrations.filter(y => y.id !== req.params.id); }); res.json({ ok: true }); });
app.use('/api', api);

// CSV export is a plain link (GET, no custom header), so it only needs the session cookie (SameSite=Strict)
app.get('/admin/export/registrations.csv', (req, res) => {
  if (!auth.getSession(readCookie(req, COOKIE))) return res.redirect('/admin');
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="dang-ky-betagon.csv"' });
  res.send(core.registrationsCsv(store.load().registrations));
});

/* ---------------- errors ---------------- */
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Không tìm thấy.' });
  res.status(404);
  sendHtml(res, core.notFoundPage(store.load(), view, V));
});
app.use((err, req, res, next) => {
  const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Lỗi máy chủ, thử lại sau.' : err.message });
});

store.load();
const firstPwd = auth.ensureAdmin();
app.listen(PORT, () => {
  console.log(`Betagon đang chạy tại http://localhost:${PORT}  ·  Trang quản trị: http://localhost:${PORT}/admin`);
  if (firstPwd) console.log(`\n  Tài khoản admin đầu tiên:  admin  /  ${firstPwd}\n  (Đăng nhập rồi đổi mật khẩu ngay. Mật khẩu này chỉ hiện một lần.)\n`);
});

// copy images still hosted on the old website (only while betagon.vn still serves the old site)
if (process.env.SKIP_IMAGE_IMPORT !== '1') setTimeout(() => importOldImages(UPLOADS).catch(e => console.warn('Lỗi chép ảnh:', e.message)), 1500);
