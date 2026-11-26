// Logic shared by the Node server (server.js) and the Cloudflare Worker (worker/index.js):
// templates, page building, input cleaning and validation. No file or network access here.
const sanitizeHtml = require('sanitize-html');
const { S: SCHEMA, SETTINGS, SECTIONS } = require('./schema');

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const isColor = c => /^#[0-9a-f]{3,8}$/i.test(String(c || ''));
const isImg = u => /^\/uploads\/[\w.-]+$/.test(String(u || '')) || /^https:\/\/[^\s"'<>]+$/i.test(String(u || ''));
const isUrl = u => /^https?:\/\/[^\s"'<>]+$/i.test(String(u || ''));
const slugify = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  (globalThis.crypto || require('crypto').webcrypto).getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}
const uid = p => p + '_' + randomHex(5);

// small template engine: {{x}} escaped, {{{x}}} raw, {{#if a.b}}...{{/if}}
function render(tpl, ctx) {
  const get = p => p.split('.').reduce((o, k) => (o == null ? o : o[k]), ctx);
  let out = tpl;
  let prev;
  do { prev = out; out = out.replace(/{{#if ([\w.]+)}}((?:(?!{{#if)[\s\S])*?){{\/if}}/g, (_, p, body) => (get(p) ? body : '')); } while (out !== prev);
  return out.replace(/{{{([\w.]+)}}}/g, (_, p) => { const v = get(p); return v == null ? '' : String(v); })
    .replace(/{{([\w.]+)}}/g, (_, p) => esc(get(p)));
}

const sections = require('./sections');
sections.setRender(render);

/* ---------------- post HTML sanitising ---------------- */
const POST_HTML = {
  allowedTags: ['p', 'br', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'img', 'figure', 'figcaption', 'hr', 'iframe'],
  allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'], iframe: ['src', 'allowfullscreen', 'frameborder'], '*': ['class'] },
  allowedClasses: { '*': ['ql-align-center', 'ql-align-right', 'ql-align-justify', 'ql-indent-1', 'ql-indent-2', 'ql-indent-3', 'ql-video', 'ql-syntax'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['https'] },
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tag, attr) => ({ tagName: 'a', attribs: { ...attr, ...(/^https?:/i.test(attr.href || '') ? { target: '_blank', rel: 'noopener noreferrer' } : {}) } }),
    h1: 'h2',
  },
  exclusiveFilter: f => f.tag === 'img' && !isImg(f.attribs.src),
};
const cleanPostHtml = html => sanitizeHtml(String(html || '').replace(/\uFEFF/g, ''), POST_HTML);

/* ---------------- cleaning admin input against the schema ---------------- */
class Bad extends Error { constructor(m, status = 400) { super(m); this.status = status; } }
function cleanField(f, v, data) {
  switch (f.t) {
    case 'number': { if (v === '' || v == null) return ''; let n = Number(v); if (!isFinite(n)) return ''; if (f.min != null) n = Math.max(f.min, n); if (f.max != null) n = Math.min(f.max, n); return n; }
    case 'bool': return !!v;
    case 'select': return f.opts.some(o => o[0] === v) ? v : f.opts[0][0];
    case 'color': return isColor(v) ? v : '';
    case 'image': return isImg(v) ? String(v) : '';
    case 'url': return isUrl(v) ? String(v).slice(0, 500) : '';
    case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
    case 'slug': return slugify(v);
    case 'course': return data.courses.some(c => c.id === v) ? v : '';
    case 'html': return cleanPostHtml(v).slice(0, 400000);
    case 'textarea': case 'lines': return String(v == null ? '' : v).trim().slice(0, 6000);
    default: return String(v == null ? '' : v).trim().slice(0, f.max || 400);
  }
}
function cleanCollection(name, items, data) {
  const sc = SCHEMA[name];
  if (!Array.isArray(items) || items.length > 500) throw new Bad('Dữ liệu không hợp lệ.');
  const out = items.map((it, i) => {
    if (!it || typeof it !== 'object') throw new Bad('Dữ liệu không hợp lệ.');
    const o = {};
    if (sc.key === 'uid') o.uid = /^[\w-]{1,40}$/.test(it.uid || '') ? it.uid : uid(name[0]);
    for (const f of sc.fields) {
      o[f.k] = cleanField(f, it[f.k], data);
      if (f.req && (o[f.k] === '' || o[f.k] == null)) throw new Bad(`${sc.label} #${i + 1}: cần nhập "${f.l}".`);
    }
    return o;
  });
  if (name === 'courses') {
    const ids = new Set();
    for (const c of out) { if (ids.has(c.id)) throw new Bad(`Mã khóa học "${c.id}" bị trùng.`); ids.add(c.id); }
  }
  if (name === 'posts') {
    const used = new Set();
    for (const p of out) {
      let s = p.slug || slugify(p.title) || 'bai-viet';
      for (let n = 2; used.has(s); n++) s = (p.slug || slugify(p.title)) + '-' + n;
      p.slug = s; used.add(s);
      if (!p.date) p.date = new Date().toISOString().slice(0, 10);
      if (!p.readMins) p.readMins = Math.max(1, Math.round(sanitizeHtml(p.content, { allowedTags: [] }).split(/\s+/).length / 220));
    }
  }
  return out;
}
function cleanSettings(input, cur) {
  const o = { ...cur };
  for (const g of SETTINGS) for (const f of g.fields) {
    if (!(f.k in input)) continue;
    const v = input[f.k];
    if (f.t === 'stats') o.stats = (Array.isArray(v) ? v : []).slice(0, 4).map(s => ({ v: String(s.v || '').slice(0, 20), s: String(s.s || '').slice(0, 6), l: String(s.l || '').slice(0, 80) }));
    else if (f.t === 'homeOrder') o.homeOrder = sections.cleanHomeOrder(v);
    else if (f.t === 'sections') o.sections = Object.fromEntries(SECTIONS.map(([k]) => [k, !!(v && v[k])]));
    else o[f.k] = cleanField(f, v, {});
  }
  return o;
}

// PUT /api/admin/collection/:name → returns a mutator for store.save
function collectionUpdate(name, body, d) {
  if (!SCHEMA[name]) throw new Bad('Không có mục này.', 404);
  const renames = name === 'courses' ? (body.items || []).filter(c => c && c._oldId && c._oldId !== c.id).map(c => [String(c._oldId), slugify(c.id)]) : [];
  const items = cleanCollection(name, body.items, d);
  return x => {
    x[name] = items;
    for (const [from, to] of renames) x.schedule.forEach(r => { if (r.course === from) r.course = to; });
    if (name === 'courses') x.schedule = x.schedule.filter(r => items.some(c => c.id === r.course)); // drop classes of deleted courses
  };
}
function checkRev(body, d) {
  if (body.rev != null && +body.rev !== d.rev) throw new Bad('Nội dung vừa được thay đổi ở một cửa sổ khác. Tải lại trang để xem bản mới nhất.', 409);
}

/* ---------------- public pages ---------------- */
function publicData(d) {
  return {
    settings: d.settings, courses: (d.courses || []).map(c => ({ ...c, url: courseUrl(c, d.courses) })), schedule: d.schedule, works: (d.works || []).map(({ sources, ...w }) => w), testimonials: d.testimonials, library: d.library,
    banners: undefined, posts: d.posts.filter(p => p.published).sort((a, b) => String(b.date).localeCompare(String(a.date))).map(({ content, ...p }) => p),
  };
}
const json4script = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, c => '\\u' + c.charCodeAt(0).toString(16));

/* ---- course & software pages ---- */
// short readable link: text before "(" -> "autocad", "3ds-max-pro", "photoshop-affinity-hau-ky"
function courseSlug(c, all) {
  const base = slugify(String(c.name || '').split('(')[0]) || slugify(c.id) || 'khoa-hoc';
  const clash = (all || []).some(o => o !== c && (slugify(String(o.name || '').split('(')[0]) || slugify(o.id)) === base);
  return clash ? `${base}-${slugify(c.id)}` : base;
}
const courseUrl = (c, all) => `/khoa-hoc/${courseSlug(c, all)}`;
const findCourse = (d, slug) => (d.courses || []).find(c => courseSlug(c, d.courses) === slug || c.id === slug);
const swUrl = sw => `/san-pham/${slugify(sw)}`;
function softwareList(d) {
  const count = {};
  (d.works || []).forEach(w => swOf(w).forEach(x => { count[x] = (count[x] || 0) + 1; }));
  const rank = x => { const i = SW_ORDER.indexOf(x); return i < 0 ? 99 : i; };
  return Object.keys(count).sort((a, b) => rank(a) - rank(b)).map(name => ({ name, n: count[name] }));
}

/* ---- top menu dropdowns ---- */
const SW_ORDER = ['AutoCAD', 'SketchUp', 'D5 Render', '3ds Max', 'Corona', 'Revit', 'Blender', 'Photoshop', 'Affinity'];
const COURSE_GROUPS = [['draw', 'Triển khai 2D'], ['model', 'Thiết kế 3D'], ['render', 'Render & hậu kỳ'], ['combo', 'Combo']];
const swOf = w => (Array.isArray(w.sw) ? w.sw : String(w.sw || '').split(',')).map(x => String(x).trim()).filter(Boolean);
const caret = '<svg class="caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
function dropdown(id, label, allHref, allText, cols, wide) {
  return `<li class="has-dd"><a class="dd-link" href="${allHref}">${label}</a><button type="button" class="dd-btn" aria-expanded="false" aria-controls="dd-${id}" aria-label="Mở danh sách ${label}">${caret}</button>`
    + `<div class="dd${wide ? ' dd-wide' : ''}" id="dd-${id}"><div class="dd-cols">${cols}</div><a class="dd-all" href="${allHref}">${allText} →</a></div></li>`;
}
function courseMenu(d, home) {
  const pre = home ? '' : '/';
  const cols = COURSE_GROUPS.map(([k, t]) => {
    const list = (d.courses || []).filter(c => c.cat === k);
    if (!list.length) return '';
    return `<div class="dd-col"><b>${esc(t)}</b>${list.map(c => `<a href="${courseUrl(c, d.courses)}">${esc(c.name)}</a>`).join('')}</div>`;
  }).join('');
  return dropdown('courses', 'Khóa học', '/khoa-hoc', 'Xem tất cả khóa học', cols, true);
}
function productMenu(d, home) {
  const pre = home ? '' : '/';
  const cols = `<div class="dd-col">${softwareList(d).map(x => `<a href="${swUrl(x.name)}">Sản phẩm ${esc(x.name)} <small>${x.n}</small></a>`).join('')}</div>`;
  return dropdown('products', 'Sản phẩm', '/san-pham', 'Xem tất cả sản phẩm', cols, false);
}

// view(name) returns the template text of views/<name>.html
function pageHtml(d, view, V, { title, description, body, home, image }) {
  const s = d.settings, sec = s.sections || {};
  const L = (h, t) => `<li><a href="${home ? h : '/' + h}">${t}</a></li>`;
  const A = (h, t) => `<li><a href="${h}">${t}</a></li>`;
  // menu from Thanh's sketch: Nhận tư vấn (Messenger) · Giới thiệu · Khóa học ▾ · Sản phẩm ▾ · Thư viện · Bài viết
  const advise = [s.chatMessenger, s.facebook, s.chatZalo, s.zalo].find(isUrl);
  const menu = [advise ? `<li><a class="menu-chat" href="${esc(advise)}" target="_blank" rel="noopener">Nhận tư vấn</a></li>` : A('/dang-ky', 'Nhận tư vấn'),
    A('/gioi-thieu', 'Giới thiệu'), sec.courses && courseMenu(d, home), sec.products && productMenu(d, home),
    sec.library && A('/thu-vien', 'Thư viện'), sec.blog && A('/bai-viet', 'Bài viết')].filter(Boolean).join('');
  const ICON = {
    facebook: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H7v4h3v6h4v-6h3l1-4h-4V8.5c0-.3.2-.5.5-.5z" fill="currentColor"/>',
    youtube: '<path d="M21.6 7.2a2.6 2.6 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 0 0 2.4 7.2 27 27 0 0 0 2 12a27 27 0 0 0 .4 4.8 2.6 2.6 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 0 0 1.8-1.8A27 27 0 0 0 22 12a27 27 0 0 0-.4-4.8zM10 15V9l5.2 3z" fill="currentColor"/>',
    tiktok: '<path d="M16.5 3h-3.2v11.6a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V8.8a6 6 0 1 0 5 5.8V8.7a7.3 7.3 0 0 0 4 1.2V6.7a4 4 0 0 1-4-3.7z" fill="currentColor"/>',
    zalo: '<text x="12" y="16" text-anchor="middle" font-size="9" font-weight="800" font-family="Arial,sans-serif" fill="currentColor">Zalo</text>',
  };
  const socials = [['facebook', 'Facebook'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['zalo', 'Zalo']]
    .filter(([k]) => isUrl(s[k])).map(([k, l]) => `<a href="${esc(s[k])}" target="_blank" rel="noopener" aria-label="${l}"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg></a>`).join('');
  const fi = p => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">${p}</svg>`;
  const phones = String(s.footerPhones || '').split('\n').map(x => x.trim()).filter(Boolean);
  const footContact = [
    ...(phones.length ? phones : [s.hotline].filter(Boolean)).map(p => `<li>${fi('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>')}<span>${esc(p)}</span></li>`),
    s.email && `<li>${fi('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>')}<span>${esc(s.email)}</span></li>`,
    s.address && `<li>${fi('<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>')}<span>${esc(s.address)}</span></li>`,
    s.hours && `<li>${fi('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}<span>${esc(s.hours)}</span></li>`,
  ].filter(Boolean).join('');
  const footNav = [['/', 'Trang chủ'], ['/gioi-thieu', 'Giới thiệu'], sec.courses && ['/khoa-hoc', 'Khóa học'], sec.products && ['/san-pham', 'Sản phẩm khóa học'],
    sec.schedule && ['/lich-khai-giang', 'Lịch khai giảng'], sec.library && ['/thu-vien', 'Thư viện'], sec.blog && ['/bai-viet', 'Bài viết'], ['/dang-ky', 'Liên hệ & đăng ký']]
    .filter(Boolean).map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join('');
  const comm = String(s.communityLinks || '').split('\n').map(x => x.split('|').map(y => y.trim())).filter(x => x[0] && isUrl(x[1]));
  const footCommunity = comm.length ? `<h4 class="foot-white">Khám phá cộng đồng ${esc(s.siteName)}</h4><ul class="foot-comm">${comm.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>` : '';
  const footerCourses = d.courses.filter(c => c.cat !== 'combo').slice(0, 7).map(c => `<li><a href="${courseUrl(c, d.courses)}">${esc(c.name.replace(/\s+(triển khai|thiết kế|trình bày|cho|Architecture|Renderer|hậu kỳ)\b.*$/u, ''))}</a></li>`).join('');
  const chat = sec.chatbot ? view('chat') : '';
  const accent = isColor(s.accent) && s.accent.toUpperCase() !== '#FF5B24' ? `<style>:root:not(#_){--accent:${s.accent}}</style>` : '';
  return render(view('layout'), {
    pageTitle: title, metaDescription: description || s.metaDescription, v: V, siteName: s.siteName, footerText: s.footerText,
    hotline: s.hotline, email: s.email, year: new Date().getFullYear(),
    ogImage: `<meta property="og:image" content="${esc(image && isImg(image) ? image : '/assets/logo-betagon.png')}">`,
    accentStyle: accent, menu, body, socials, footerCourses, chat, footContact, footNav, footCommunity,
    dataJson: json4script(publicData(d)),
    scripts: (home && sections.homeOrder(s).some(x => x.k === 'hero3d' && x.on) ? '<script src="/assets/vendor/three.min.js"></script>' : '') + `<script src="/assets/site.js?v=${V}"></script>`,
  });
}
function homePage(d, view, V) {
  const s = d.settings;
  const body = render(view('home'), {
    ...s, show: s.sections || {},
    sloganHtml: esc(s.sloganTop).replace(/ · /g, ' <i>·</i> '),
    softChips: String(s.software || '').split(',').map(x => x.trim()).filter(Boolean).map(x => `<span class="chip">${esc(x)}</span>`).join(''),
    statsHtml: (s.stats || []).map(x => `<div class="stat"><b>${esc(x.v)}${x.s ? `<em>${esc(x.s)}</em>` : ''}</b><span>${esc(x.l)}</span></div>`).join(''),
    blocks: sections.homeBlocks(d, view),
    faqHtml: d.faqs.map((f, i) => `<details${i ? '' : ' open'}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join(''),
  });
  return pageHtml(d, view, V, { title: `${s.siteName} Edu · ${s.heroTitle} ${s.heroHighlight}`.replace(/\.$/, ''), body, home: true });
}
function postsPage(d, view, V) {
  return pageHtml(d, view, V, { title: `Bài viết · ${d.settings.siteName} Edu`, description: 'Tư duy thiết kế, mẹo dùng phần mềm và câu chuyện học viên Betagon.', body: view('posts') });
}
function postPage(d, view, V, slug) {
  const p = d.posts.find(x => x.published && x.slug === slug);
  if (!p) return null;
  const dt = new Date(p.date + 'T00:00:00');
  const cover = isImg(p.cover)
    ? `<div class="article-cover" style="background:#222 url('${esc(p.cover)}') center/cover no-repeat"></div>`
    : `<div class="article-cover" style="background:linear-gradient(135deg,${isColor(p.c1) ? p.c1 : '#FF5B24'},${isColor(p.c2) ? p.c2 : '#F2A900'})"></div>`;
  const body = render(view('post'), {
    title: p.title, tag: p.tag, excerpt: p.excerpt, readMins: p.readMins || 5,
    date: isNaN(dt) ? '' : `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`,
    cover, content: cleanPostHtml(p.content), slug: p.slug,
  });
  return pageHtml(d, view, V, { title: `${p.title} · ${d.settings.siteName} Edu`, description: p.excerpt, body, image: p.cover });
}
function contactHtml(d, view) { return sections.block('contact', d, view, false); }
const fmtPrice = c => c.price ? `${esc(c.price)}đ${c.old ? `<s>${esc(c.old)}đ</s>` : ''}` : 'Liên hệ';
function coursePage(d, view, V, slug) {
  const c = findCourse(d, slug);
  if (!c) return null;
  const s = d.settings, img = isImg(c.image) ? c.image : '';
  const det = String(c.details || '').split('\n').map(x => x.trim()).filter(Boolean);
  const details = det.length ? det : [`${c.sessions} buổi, mỗi buổi 2 giờ, lịch tối hoặc cuối tuần`, 'Đồ án cuối khóa có mentor chấm và góp ý', 'Thực hành tại phòng máy, hỗ trợ sửa bài 24/7'];
  const sws = SW_ORDER.filter(x => String(c.name || '').toLowerCase().includes(x.toLowerCase().replace(' render', '')));
  const facts = [[c.weeks && `${c.weeks} tuần`, 'Thời lượng'], [c.sessions && `${c.sessions} buổi`, 'Số buổi'], [c.level, 'Trình độ'], ['Tại lớp + Online', 'Hình thức']]
    .filter(x => x[0]).map(([v, l]) => `<div><b>${esc(v)}</b><span>${l}</span></div>`).join('');
  const cover = img ? `<div class="cover has-img" style="background:#222 url('${esc(img)}') center/cover no-repeat"></div>`
    : `<div class="cover" style="background:linear-gradient(135deg,${isColor(c.c1) ? c.c1 : '#FF5B24'},${isColor(c.c2) ? c.c2 : '#F2A900'})"><span class="glyph">${esc(c.g)}</span></div>`;
  const works = sws.length ? `<section id="products" class="dark"><div class="wrap">
    <div class="sec-head"><div><span class="eyebrow">Sản phẩm khóa học</span><h2 class="h2">Sản phẩm học viên khóa ${esc(sws.join(' & '))}.</h2></div>
    <div class="filters sw-links">${sws.map(x => `<a class="btn" href="${swUrl(x)}">Xem tất cả sản phẩm ${esc(x)} →</a>`).join('')}</div></div>
    <div class="work-grid" id="workGrid" data-sw="${esc(sws.join(','))}" data-limit="6"></div></div></section>` : '';
  const body = render(view('course'), {
    id: c.id, name: c.name, desc: c.desc, eyebrow: `Khóa học · ${c.level || ''}`.replace(/ · $/, ''),
    facts, priceHtml: fmtPrice(c), coverHtml: cover, detailsHtml: details.map(x => `<li>${esc(x)}</li>`).join(''),
    worksHtml: works, contactHtml: contactHtml(d, view),
  });
  return pageHtml(d, view, V, { title: `${c.name} · Khóa học ${s.siteName}`, description: c.desc, body, image: img });
}
function productsPage(d, view, V, slug) {
  const list = softwareList(d), sw = list.find(x => slugify(x.name) === slug);
  if (!sw) return null;
  const s = d.settings;
  const first = (d.works || []).find(w => swOf(w).includes(sw.name) && isImg(w.image));
  const links = list.map(x => `<a class="filter" href="${swUrl(x.name)}" aria-pressed="${x === sw}">${esc(x.name)} <small>${x.n}</small></a>`).join('');
  const body = render(view('products'), {
    title: `Sản phẩm ${sw.name}.`, sw: sw.name, swLinks: links,
    lead: `${sw.n} sản phẩm của học viên Betagon làm bằng ${sw.name}, từ đề bài thực tế trong khóa học. Bấm vào từng sản phẩm để xem bộ ảnh.`,
  });
  return pageHtml(d, view, V, { title: `Sản phẩm ${sw.name} · ${s.siteName} Edu`, description: `${sw.n} sản phẩm khóa học ${sw.name} của học viên Betagon.`, body, image: first && first.image });
}
function blockPage(d, view, V, path) {
  const r = sections.blockPage(path, d, view);
  if (!r) return null;
  const s = d.settings, k = r.b.k;
  const title = k === 'about' ? `Về ${s.siteName}` : (s[`h_${k}_title`] || r.b.label).replace(/\.$/, '');
  return pageHtml(d, view, V, { title: `${title} · ${s.siteName} Edu`, description: s[`h_${k}_lead`] || (k === 'about' ? s.aboutLead : ''), body: r.body });
}
function notFoundPage(d, view, V) {
  return pageHtml(d, view, V, { title: 'Không tìm thấy trang', body: '<main><section><div class="wrap" style="text-align:center;padding:80px 0"><span class="eyebrow">404</span><h1 class="h2">Trang này không tồn tại.</h1><p class="lead" style="margin:16px auto 28px">Có thể đường dẫn đã cũ hoặc bài viết đã được gỡ.</p><a class="btn btn-primary" href="/">Về trang chủ</a></div></section></main>' });
}

/* ---------------- registrations ---------------- */
const REG_STATUS = ['new', 'called', 'enrolled', 'cancel'];
// returns { error } or { reg }
function newRegistration(b, courses) {
  const name = String(b.name || '').trim().slice(0, 100), phone = String(b.phone || '').replace(/[\s.]/g, '').slice(0, 15);
  if (!name) return { error: 'Bạn nhập họ tên giúp mình nhé.' };
  if (!/^(0|\+84)\d{9,10}$/.test(phone)) return { error: 'Số điện thoại chưa đúng.' };
  const c = courses.find(x => x.id === b.course);
  return { reg: {
    id: uid('r'), at: new Date().toISOString(), name, phone,
    email: String(b.email || '').trim().slice(0, 120), course: c ? c.id : 'tuvan', courseName: c ? c.name : 'Cần tư vấn',
    mode: String(b.mode || '').slice(0, 60), note: String(b.note || '').trim().slice(0, 1000), status: 'new', adminNote: '',
  } };
}
function patchRegistration(r, body) {
  if (REG_STATUS.includes(body.status)) r.status = body.status;
  if (typeof body.adminNote === 'string') r.adminNote = body.adminNote.slice(0, 1000);
  return r;
}
function registrationsCsv(regs) {
  const cell = v => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const when = iso => { const t = new Date(new Date(iso).getTime() + 7 * 3600e3); return isNaN(t) ? '' : t.toISOString().replace('T', ' ').slice(0, 16); };
  const rows = [['Thời gian', 'Họ tên', 'Điện thoại', 'Email', 'Khóa học', 'Hình thức', 'Ghi chú', 'Trạng thái', 'Ghi chú nội bộ']]
    .concat(regs.map(r => [when(r.at), r.name, r.phone, r.email, r.courseName, r.mode, r.note, r.status, r.adminNote]));
  return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}

/* ---------------- images ---------------- */
// detect image type from the first bytes (Uint8Array or Buffer)
function imageKind(b) {
  if (!b || b.length < 12) return null;
  const s = (i, n) => String.fromCharCode(...b.subarray(i, i + n));
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (s(0, 4) === 'GIF8') return 'gif';
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'webp';
  return null;
}
const IMAGE_TYPES = { png: 'image/png', jpg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
const uploadName = ext => `${new Date().toISOString().slice(0, 10)}-${randomHex(6)}.${ext}`;

const ADMIN_CSP = "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-src https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";

module.exports = {
  SCHEMA, SETTINGS, SECTIONS, esc, isColor, isImg, isUrl, slugify, uid, randomHex, render, cleanPostHtml, Bad,
  cleanCollection, cleanSettings, collectionUpdate, checkRev, publicData, homePage, postsPage, postPage, blockPage, coursePage, productsPage, courseUrl, notFoundPage,
  REG_STATUS, newRegistration, patchRegistration, registrationsCsv, imageKind, IMAGE_TYPES, uploadName, ADMIN_CSP,
};
