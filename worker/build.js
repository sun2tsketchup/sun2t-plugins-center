// Collects the static files the Cloudflare Worker serves into .cf-assets/ and stamps a version.
// Runs automatically before `wrangler deploy` / `wrangler dev` (see wrangler.jsonc).
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.cf-assets');
fs.rmSync(OUT, { recursive: true, force: true });
const copy = (from, to) => fs.cpSync(path.join(ROOT, from), path.join(OUT, to), { recursive: true });
copy('public/assets', 'assets');
copy('admin', 'admin');
let quill = path.join(ROOT, 'node_modules', 'quill', 'dist');
try { quill = path.dirname(require.resolve('quill/dist/quill.min.js', { paths: [ROOT] })); } catch { }
fs.mkdirSync(path.join(OUT, 'admin', 'vendor', 'quill'), { recursive: true });
for (const f of ['quill.min.js', 'quill.snow.css']) fs.copyFileSync(path.join(quill, f), path.join(OUT, 'admin', 'vendor', 'quill', f));
fs.writeFileSync(path.join(__dirname, 'version.js'), `export const VERSION = '${Date.now().toString(36)}';\n`);
console.log('Đã chuẩn bị file tĩnh cho Cloudflare trong .cf-assets/');
