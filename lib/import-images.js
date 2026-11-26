// Copies images that still live on the old Betagon website into uploads/, then
// rewrites the content to point at the local copies. Runs in the background at
// startup, so it must run while betagon.vn still points at the old site.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./store');

const { oldSite } = require('./old-site');
const { URL_RE, isOld, pageImages, sourcePages, applyGalleries, replaceDeep, imageUrls } = oldSite(process.env.OLD_SITE_HOSTS);
const MAX = 10 * 1024 * 1024;
const SIG = [['png', b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47], ['jpg', b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['gif', b => b.slice(0, 4).toString('latin1') === 'GIF8'], ['webp', b => b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP']];

function download(url, hops = 0) {
  url = String(url);
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https:') ? require('https') : require('http');
    const req = mod.get(url, { headers: { 'User-Agent': 'BetagonSite/1.0 (image import)' }, timeout: 20000 }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && hops < 3) {
        res.resume();
        return resolve(download(new URL(res.headers.location, url).href, hops + 1));
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      const chunks = []; let n = 0;
      res.on('data', c => { n += c.length; if (n > MAX) { req.destroy(new Error('too large')); } else chunks.push(c); });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}


let sharp = null;
try { sharp = require('sharp'); } catch { /* optional: images are copied without resizing */ }
async function shrink(buf, ext) {
  if (!sharp || ext === 'gif') return { buf, ext };
  try {
    const img = sharp(buf, { failOn: 'none' }).rotate();
    const meta = await img.metadata();
    const r = img.resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true });
    const out = ext === 'png' && meta.hasAlpha ? { buf: await r.png({ compressionLevel: 9, palette: true }).toBuffer(), ext: 'png' }
      : { buf: await r.jpeg({ quality: 80, mozjpeg: true }).toBuffer(), ext: 'jpg' };
    return out.buf.length < buf.length ? out : { buf, ext };
  } catch { return { buf, ext }; }
}

// Đọc các trang tác phẩm trên web cũ (trường "sources") để lấy bộ ảnh của từng đồ án.
async function resolveGalleries(stateFile) {
  let state = {}; try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { }
  const done = new Set(state.pages || []);
  const d = store.load();
  const pages = sourcePages(d.works).filter(u => !done.has(u));
  if (!pages.length) return 0;
  console.log(`Đang đọc ${pages.length} trang tác phẩm trên web cũ...`);
  const found = new Map(); const queue = pages.slice(); let failed = 0;
  async function worker() {
    for (let u; (u = queue.shift());) {
      try { found.set(u, pageImages((await download(u)).toString('utf8'), u)); }
      catch (e) { failed++; console.warn('  Không đọc được', u, '-', e.message); }
    }
  }
  await Promise.all([1, 2, 3, 4].map(worker));
  let updated = 0;
  store.save(x => { updated = applyGalleries(x.works, found); });
  for (const u of found.keys()) done.add(u);
  try { fs.writeFileSync(stateFile, JSON.stringify({ pages: [...done] })); } catch { }
  console.log(`Đã lấy bộ ảnh cho ${updated} đồ án.${failed ? ` ${failed} trang lỗi, sẽ thử lại lần khởi động sau.` : ''}`);
  return updated;
}

let running = false;
async function importOldImages(uploadDir) {
  if (running) return null;
  running = true;
  try {
    try { await resolveGalleries(path.join(uploadDir, '.old-site-pages.json')); }
    catch (e) { console.warn('Lỗi đọc trang tác phẩm cũ:', e.message); }
    const d = store.load();
    const urls = imageUrls(d);
    if (!urls.length) return { found: 0, copied: 0, failed: 0 };
    console.log(`Đang chép ${urls.length} ảnh từ web cũ về máy chủ...`);
    const map = new Map(); let failed = 0;
    const queue = urls.slice();
    async function worker() {
      for (let u; (u = queue.shift());) {
        try {
          const buf = await download(u);
          const kind = SIG.find(([, t]) => t(buf));
          if (!kind) throw new Error('không phải ảnh');
          const small = await shrink(buf, kind[0]);
          const name = 'old-' + crypto.createHash('sha1').update(u).digest('hex').slice(0, 16) + '.' + small.ext;
          fs.writeFileSync(path.join(uploadDir, name), small.buf);
          map.set(u, '/uploads/' + name);
        } catch (e) { failed++; console.warn('  Không chép được', u, '-', e.message); }
      }
    }
    await Promise.all([1, 2, 3, 4].map(worker));
    if (map.size) store.save(x => { for (const k of Object.keys(x)) if (k !== 'rev') x[k] = replaceDeep(x[k], map); });
    console.log(`Đã chép ${map.size}/${urls.length} ảnh từ web cũ.${failed ? ` ${failed} ảnh lỗi, sẽ thử lại lần khởi động sau.` : ''}`);
    return { found: urls.length, copied: map.size, failed };
  } finally { running = false; }
}

module.exports = { importOldImages };
