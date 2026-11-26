// Home page blocks. Each block is also a page of its own (menu links go there),
// and all of its text is edited in the admin under "Trang chủ".
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const rows = (txt, n) => String(txt || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
  const p = l.split('|').map(x => x.trim());
  while (p.length < n) p.push('');
  return p;
});

// k: setting/section key, path: own page, label: admin + menu name, sec: site-wide on/off switch it follows
const BLOCKS = [
  { k: 'banner', label: 'Ảnh trình chiếu đầu trang' },
  { k: 'hero3d', label: 'Giới thiệu + logo 3D' },
  { k: 'stats', label: 'Số liệu nổi bật' },
  { k: 'about', label: 'Về Betagon', path: '/gioi-thieu' },
  { k: 'schedule', label: 'Lịch khai giảng', path: '/lich-khai-giang', sec: 'schedule' },
  { k: 'courses', label: 'Khóa học', path: '/khoa-hoc', sec: 'courses' },
  { k: 'products', label: 'Sản phẩm khóa học', path: '/san-pham', sec: 'products' },
  { k: 'feedback', label: 'Feedback học viên', path: '/feedback', sec: 'feedback' },
  { k: 'library', label: 'Thư viện', path: '/thu-vien', sec: 'library' },
  { k: 'blog', label: 'Bài viết nổi bật', sec: 'blog' },
  { k: 'faq', label: 'Hỏi đáp', path: '/hoi-dap', sec: 'faq' },
  { k: 'contact', label: 'Đăng ký khóa học', path: '/dang-ky' },
];
// order from Thanh's sketch (2026-11-26): slideshow, products, sign-up, courses, feedback, posts, library
const DEFAULT_ORDER = ['banner', 'products', 'contact', 'courses', 'feedback', 'blog', 'library', 'hero3d', 'stats', 'schedule', 'faq', 'about'];
const DEFAULT_ON = { banner: 1, products: 1, contact: 1, courses: 1, feedback: 1, blog: 1, library: 1 };

// Default texts, filled into settings once (lib/migrate.js) so the admin shows them
const TEXT_DEFAULTS = {
  h_about_eyebrow: 'Về trung tâm',
  h_about_sign: 'Đội ngũ sáng lập Betagon',
  h_about_pillars: [
    'Tư duy trước, công cụ sau | Hiểu bài toán thiết kế cần gì, rồi mới chọn phần mềm và cách làm phù hợp. Đổi phần mềm, tư duy vẫn dùng được.',
    'Làm thực tế, làm đồ án | Mỗi khóa xoay quanh một đồ án thật: căn hộ, nhà phố, quán cà phê. Học xong bạn có hồ sơ hoàn chỉnh cho portfolio.',
    'Giảng viên giàu kinh nghiệm | Nhiều năm giảng dạy và làm thiết kế thực tế. Mỗi bài nộp đều được sửa trực tiếp trên file của bạn.',
  ].join('\n'),
  h_about_steps: [
    'TUẦN 1–2 | Hiểu logic công cụ | Phần mềm vận hành ra sao, vì sao làm theo trình tự này. Thiết lập file chuẩn studio.',
    'TUẦN 3–6 | Nhận đề bài thật | Phân tích hiện trạng, nhu cầu khách hàng, lên phương án cùng mentor.',
    'TUẦN 7–10 | Triển khai hồ sơ | Bản vẽ 2D, mô hình 3D và render trình bày theo đúng quy trình làm dự án.',
    'TUẦN 11–12 | Bảo vệ đồ án | Thuyết trình phương án trước mentor, nhận chứng chỉ và góp ý portfolio.',
  ].join('\n'),
  h_about_perks: [
    'Phòng máy thực hành | Học tại lớp có sẵn máy cấu hình cao, cài đủ phần mềm. Bạn không cần mang laptop.',
    'Sửa bài 24/7 | Gửi câu hỏi, gửi file bất cứ lúc nào. Đội ngũ hỗ trợ giải đáp thắc mắc và sửa bài cho bạn.',
    'Hỗ trợ trọn đời | Học xong vẫn được hỏi bài, góp ý đồ án và cập nhật kiến thức khi phần mềm ra phiên bản mới.',
    'Thư viện tài nguyên | Block CAD, model, vật liệu, plugin và file mẫu cho từng phần mềm, dùng trọn đời.',
  ].join('\n'),
  h_schedule_eyebrow: 'Lịch khai giảng', h_schedule_title: 'Các lớp sắp khai giảng.',
  h_schedule_lead: 'Chọn lớp có lịch phù hợp và bấm Đăng ký. Lịch được cập nhật hằng tuần.',
  h_courses_eyebrow: 'Khóa học', h_courses_title: 'Chọn công cụ cho bước thiết kế của bạn.',
  h_courses_lead: 'Học online hoặc tại lớp, lịch tối và cuối tuần. Bấm vào khóa học để xem chi tiết.',
  h_courses_path_eyebrow: 'Lộ trình gợi ý',
  h_courses_path_title: 'Từ con số 0 đến tự làm một hồ sơ thiết kế nội thất trong 6 tháng',
  h_courses_path: [
    'Tháng 1–2 | AutoCAD | Mặt bằng, mặt cắt, triển khai chi tiết',
    'Tháng 2–4 | SketchUp | Lên phương án không gian 3D',
    'Tháng 4–5 | D5 Render | Render trình bày phương án',
    'Tháng 6 | Đồ án tổng hợp | Hồ sơ hoàn chỉnh, bảo vệ trước mentor',
  ].join('\n'),
  h_products_eyebrow: 'Sản phẩm khóa học', h_products_title: 'Sản phẩm khóa học của học viên.',
  h_products_lead: 'Mỗi khóa học kết thúc bằng một đồ án hoàn chỉnh, làm từ đề bài thực tế. Đây là một số sản phẩm khóa học tiêu biểu.',
  h_feedback_eyebrow: 'Feedback học viên', h_feedback_title: 'Học viên nói gì về Betagon.', h_feedback_lead: '',
  h_feedback_score: '4.9', h_feedback_note: 'Từ 1.286 đánh giá sau khóa học',
  h_feedback_bars: '5★ | 91\n4★ | 7\n3★ | 2\n2★ | 0',
  h_library_eyebrow: 'Thư viện', h_library_title: 'Thư viện tài nguyên phần mềm.',
  h_library_lead: 'Tài nguyên cho từng phần mềm: block CAD, model, vật liệu, plugin, video, đề bài và file mẫu. Học viên Betagon được dùng trọn đời, không giới hạn lượt tải.',
  h_blog_eyebrow: 'Bài viết', h_blog_title: 'Bài viết nổi bật.', h_blog_lead: 'Tư duy thiết kế, mẹo dùng phần mềm và câu chuyện học viên.',
  h_products_all: 'Xem tất cả sản phẩm',
  h_faq_eyebrow: 'Hỏi đáp', h_faq_title: 'Bạn đang băn khoăn?',
  h_faq_lead: 'Không thấy câu hỏi của bạn? Nhắn cho tư vấn viên ở form đăng ký, chúng mình trả lời trong 2 giờ làm việc.',
  h_contact_eyebrow: 'Đăng ký', h_contact_title: 'Đăng ký khóa học.',
  h_contact_lead: 'Chọn khóa học và để lại thông tin. Betagon sẽ gọi lại để xác nhận lịch khai giảng, học phí và hình thức học phù hợp với bạn.',
};

// Admin fields for the "Trang chủ" screen (same format as SETTINGS in schema.js)
const T = (k, l, t = 'text', extra = {}) => ({ k, l, t, ...extra });
const HOME_SETTINGS = [
  { group: 'Bố cục trang chủ', page: 'home', fields: [{ k: 'homeOrder', t: 'homeOrder', l: 'Mục hiện trên trang chủ và thứ tự', blocks: BLOCKS.map(b => [b.k, b.label, b.path || '', b.sec || '']) }] },
  { group: 'Giới thiệu + logo 3D (và slide giới thiệu khi chưa có ảnh trình chiếu)', page: 'home', fields: [
    T('badgeTag', 'Nhãn thông báo', 'text', { ph: 'Mới' }), T('badgeText', 'Nội dung thông báo'),
    T('sloganTop', 'Slogan (chữ nhỏ phía trên)', 'text', { help: 'Dấu · sẽ được tô màu.' }),
    T('heroTitle', 'Tiêu đề, dòng nhỏ phía trên', 'text', { ph: 'Học phần mềm' }),
    T('heroHighlight', 'Tiêu đề, dòng to tô màu', 'text', { ph: 'thực chiến.' }),
    T('heroLead', 'Đoạn giới thiệu', 'textarea'),
  ] },
  { group: 'Số liệu nổi bật', page: 'home', fields: [{ k: 'stats', t: 'stats', l: '4 số liệu nổi bật' }] },
  { group: 'Về Betagon', page: 'home', fields: [
    T('h_about_eyebrow', 'Chữ nhỏ trên tiêu đề'), T('aboutTitle', 'Tiêu đề'), T('aboutLead', 'Đoạn giới thiệu', 'textarea'),
    T('aboutQuote', 'Câu trích dẫn'), T('aboutQuoteHl', 'Phần trích dẫn tô màu'), T('h_about_sign', 'Người nói câu trích dẫn'),
    T('h_about_pillars', 'Thế mạnh (mỗi dòng: Tiêu đề | Mô tả)', 'textarea'),
    T('h_about_steps', 'Lộ trình một khóa (mỗi dòng: Thời gian | Tiêu đề | Mô tả)', 'textarea'),
    T('h_about_perks', 'Quyền lợi học viên (mỗi dòng: Tiêu đề | Mô tả)', 'textarea'),
  ] },
  ...[['schedule', 'Lịch khai giảng'], ['courses', 'Khóa học'], ['products', 'Sản phẩm khóa học'], ['feedback', 'Feedback học viên'],
    ['library', 'Thư viện'], ['blog', 'Bài viết nổi bật'], ['faq', 'Hỏi đáp'], ['contact', 'Đăng ký khóa học']].map(([k, g]) => ({
    group: g, page: 'home', fields: [
      T(`h_${k}_eyebrow`, 'Chữ nhỏ trên tiêu đề'), T(`h_${k}_title`, 'Tiêu đề'), T(`h_${k}_lead`, 'Đoạn mô tả', 'textarea'),
      ...(k === 'courses' ? [T('h_courses_path_eyebrow', 'Lộ trình gợi ý: chữ nhỏ'), T('h_courses_path_title', 'Lộ trình gợi ý: tiêu đề'),
        T('h_courses_path', 'Các chặng (mỗi dòng: Thời gian | Phần mềm | Mô tả). Để trống để ẩn lộ trình', 'textarea')] : []),
      ...(k === 'feedback' ? [T('h_feedback_score', 'Điểm đánh giá', 'text', { ph: '4.9' }), T('h_feedback_note', 'Ghi chú dưới điểm'),
        T('h_feedback_bars', 'Các thanh tỉ lệ (mỗi dòng: Nhãn | Phần trăm)', 'textarea')] : []),
    ],
  })),
];

// [{k,on}] in display order, always listing every block once
function homeOrder(s) {
  const saved = Array.isArray(s.homeOrder) ? s.homeOrder.filter(x => x && BLOCKS.some(b => b.k === x.k)) : [];
  const seen = new Set(saved.map(x => x.k));
  return [...saved.map(x => ({ k: x.k, on: !!x.on })), ...DEFAULT_ORDER.filter(k => !seen.has(k)).map(k => ({ k, on: !!DEFAULT_ON[k] }))]
    .filter((x, i, a) => a.findIndex(y => y.k === x.k) === i);
}
function cleanHomeOrder(v) { return homeOrder({ homeOrder: v }); }

// section header: on its own page the title is the h1 and gets a back link
function head(s, k, page, titleKey) {
  const eb = s[`h_${k}_eyebrow`], t = s[titleKey || `h_${k}_title`], lead = s[`h_${k}_lead`];
  return (page ? '<a class="back" href="/">← Trang chủ</a>' : '')
    + (eb ? `<span class="eyebrow">${esc(eb)}</span>` : '')
    + (t ? `<${page ? 'h1' : 'h2'} class="h2">${esc(t)}</${page ? 'h1' : 'h2'}>` : '')
    + (lead ? `<p class="lead">${esc(lead)}</p>` : '');
}
const secCls = (page, extra) => [page ? 'page-head' : '', extra || ''].filter(Boolean).join(' ');
const pad = page => (page ? '' : ' style="padding-top:0"');

const safeLink = u => (/^(\/(?!\/)|https?:\/\/)/i.test(String(u || '')) ? String(u) : '');
const isImgUrl = u => /^(https?:\/\/|\/uploads\/|\/assets\/)/i.test(String(u || ''));
const DOW = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
function upcoming(d, n) {
  const now = new Date(Date.now() + 7 * 3600e3), today = now.toISOString().slice(0, 10); // Vietnam time
  return (d.schedule || []).filter(r => r.date >= today && (d.courses || []).some(c => c.id === r.course))
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, n)
    .map(r => ({ r, c: d.courses.find(c => c.id === r.course), dt: new Date(r.date + 'T00:00:00Z') }));
}
// default first slide when no banner images are uploaded: a full-width poster built from the site data
function slideBrand(d) {
  const s = d.settings;
  const bg = (d.works || []).find(w => w.big && isImgUrl(w.image)) || (d.works || []).find(w => isImgUrl(w.image));
  const cs = (d.courses || []).filter(c => c.cat !== 'combo').slice(0, 8);
  const cats = ['Kiến trúc', 'Nội thất', 'Xây dựng', 'Diễn họa'];
  return `<a class="slide slide-brand" href="/khoa-hoc"${bg ? ` style="--bg:url('${esc(bg.image)}')"` : ''}>
    <div class="sb-top"><span>${cats[0]}</span><span>${cats[1]}</span><span class="sb-logo"><i class="logo-mark" aria-hidden="true"></i>${esc(s.siteName)}<small>EDU</small></span><span>${cats[2]}</span><span>${cats[3]}</span></div>
    <div class="sb-name">${esc(s.siteName)} EDU</div>
    <div class="sb-tag">Đào tạo phần mềm thiết kế 2D · 3D · Render</div>
    <div class="sb-courses">${cs.map(c => `<div><b>${esc(String(c.name).split('(')[0].replace(/\s+(hậu kỳ|Pro)$/i, '').trim())}</b><span>${c.weeks ? `${esc(c.weeks)} tuần` : ''}${c.sessions ? `<br>${esc(c.sessions)} buổi` : ''}</span></div>`).join('')}</div>
  </a>`;
}
function slideSchedule(d) {
  const list = upcoming(d, 4);
  if (!list.length) return '';
  const m = list[0].dt.getUTCMonth() + 1;
  return `<div class="slide slide-sched"><div class="wrap"><div class="slide-text">
    <span class="eyebrow">Lịch khai giảng</span><h2 class="slide-h2">Các lớp<br>sắp khai giảng.</h2>
    <a class="btn btn-primary" href="/lich-khai-giang">Xem lịch và đăng ký →</a></div>
    <div class="slide-classes">${list.map(({ r, c, dt }) => `<a class="sc" href="/khoa-hoc/${esc(c.id)}"><b>${String(dt.getUTCDate()).padStart(2, '0')}<small>Th ${dt.getUTCMonth() + 1}</small></b><span><strong>${esc(c.name)}</strong><em>${esc(DOW[dt.getUTCDay()])} · ${esc(r.time || '')} · ${esc(r.hour || '')}</em></span></a>`).join('')}</div>
  </div></div>`;
}

function block(k, d, view, page) {
  const s = d.settings;
  switch (k) {
    case 'banner': {
      const imgs = (d.banners || []).filter(b => isImgUrl(b.image));
      const slides = imgs.length
        ? imgs.map((b, i) => { const l = safeLink(b.link), tag = l ? 'a' : 'div';
          return `<${tag} class="slide slide-img"${l ? ` href="${esc(l)}"${/^https?:/i.test(l) ? ' target="_blank" rel="noopener"' : ''}` : ''}><img src="${esc(b.image)}" alt="${esc(b.caption || b.title || 'Betagon')}"${i ? ' loading="lazy"' : ''}>${b.caption ? `<span class="slide-cap">${esc(b.caption)}</span>` : ''}</${tag}>`; })
        : [slideBrand(d), slideSchedule(d)].filter(Boolean);
      return `<section class="banner" aria-label="Ảnh trình chiếu" aria-roledescription="carousel"><div class="slides" id="bannerTrack">${slides.join('')}</div>
        ${slides.length > 1 ? `<button class="sl-nav prev" type="button" aria-label="Ảnh trước">‹</button><button class="sl-nav next" type="button" aria-label="Ảnh sau">›</button><div class="sl-dots" role="tablist">${slides.map((_, i) => `<button type="button" aria-label="Ảnh ${i + 1}"${i ? '' : ' aria-current="true"'}></button>`).join('')}</div>` : ''}</section>`;
    }
    case 'hero3d':
      return require_render(view('hero'), { ...s, sloganHtml: esc(s.sloganTop).replace(/ · /g, ' <i>·</i> ') });
    case 'stats':
      return (s.stats || []).length ? `<div class="stats" aria-label="Số liệu Betagon"><div class="wrap">${(s.stats || []).map(x => `<div class="stat"><b>${esc(x.v)}${x.s ? `<em>${esc(x.s)}</em>` : ''}</b><span>${esc(x.l)}</span></div>`).join('')}</div></div>` : '';
    case 'about': {
      const hex = ['--axis-x', '--axis-y', '--axis-z', '--accent', '--sun'];
      const pil = rows(s.h_about_pillars, 2), steps = rows(s.h_about_steps, 3), perks = rows(s.h_about_perks, 2);
      return `<section id="about"${page ? ' class="page-head"' : ''}><div class="wrap"><div class="about-grid"><div>
        ${head(s, 'about', page, 'aboutTitle')}
        ${s.aboutLead ? `<p class="lead">${esc(s.aboutLead)}</p>` : ''}
        ${s.aboutQuote ? `<p class="about-quote">“${esc(s.aboutQuote)} <span>${esc(s.aboutQuoteHl)}</span>.”</p>` : ''}
        ${s.h_about_sign ? `<p class="lead" style="margin-top:10px;font-size:14.5px">${esc(s.h_about_sign)}</p>` : ''}
      </div><div class="pillars">${pil.map(([t, p], i) => `<div class="pillar"><span class="hex" style="background:var(${hex[i % hex.length]})">${String(i + 1).padStart(2, '0')}</span><div><h3>${esc(t)}</h3><p>${esc(p)}</p></div></div>`).join('')}</div></div>
      ${steps.length ? `<div class="method" aria-label="Lộ trình một khóa học">${steps.map(([a, b, c]) => `<div class="step"><small>${esc(a)}</small><h3>${esc(b)}</h3><p>${esc(c)}</p></div>`).join('')}</div>` : ''}
      ${perks.length ? `<div class="perks" aria-label="Quyền lợi học viên">${perks.map(([a, b]) => `<div class="perk"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join('')}</div>` : ''}
      </div></section>`;
    }
    case 'schedule':
      return `<section id="schedule" class="${secCls(page)}"${pad(page)}><div class="wrap"><div class="sec-head"><div>${head(s, 'schedule', page)}</div></div>
        <div class="sched" id="schedList" role="list"></div></div></section>`;
    case 'courses': {
      const path = rows(s.h_courses_path, 3);
      return `<section id="courses" class="${secCls(page)}"${pad(page)}><div class="wrap"><div class="sec-head"><div>${head(s, 'courses', page)}</div>
        <div class="filters" role="group" aria-label="Lọc khóa học">
          <button class="filter" aria-pressed="true" data-f="all">Tất cả</button><button class="filter" aria-pressed="false" data-f="draw">Triển khai 2D</button>
          <button class="filter" aria-pressed="false" data-f="model">Thiết kế 3D</button><button class="filter" aria-pressed="false" data-f="render">Render &amp; hậu kỳ</button>
          <button class="filter" aria-pressed="false" data-f="combo">Combo</button></div></div>
        <div class="course-grid" id="courseGrid"></div>
        ${path.length ? `<div class="path">${s.h_courses_path_eyebrow ? `<span class="eyebrow">${esc(s.h_courses_path_eyebrow)}</span>` : ''}${s.h_courses_path_title ? `<h3 style="margin-top:10px">${esc(s.h_courses_path_title)}</h3>` : ''}
          <div class="path-track">${path.map(([a, b, c]) => `<div class="path-node"><small>${esc(a)}</small><b>${esc(b)}</b><span>${esc(c)}</span></div>`).join('')}</div></div>` : ''}
        </div></section>`;
    }
    case 'products':
      if (!page) return `<section id="products" class="dark products-home"><div class="wrap"><div class="sec-head"><div>${head(s, 'products', false)}</div>
        <a class="btn btn-ghost" href="/san-pham">${esc(s.h_products_all || 'Xem tất cả sản phẩm')} →</a></div>
        <div class="carousel"><div class="car-track" id="workSlider"></div>
        <button class="sl-nav prev" type="button" aria-label="Sản phẩm trước">‹</button><button class="sl-nav next" type="button" aria-label="Sản phẩm sau">›</button></div>
        <div class="sl-dots car-dots" id="workDots"></div></div></section>`;
      return `<section id="products" class="${secCls(page, 'dark')}"><div class="wrap"><div class="sec-head"><div>${head(s, 'products', page)}</div>
        <div class="filters" role="group" aria-label="Lọc theo phần mềm" id="workFilters"></div></div>
        <div class="work-grid" id="workGrid"></div></div></section>`;
    case 'feedback': {
      const bars = rows(s.h_feedback_bars, 2);
      return `<section id="feedback" class="${secCls(page)}"><div class="wrap"><div class="sec-head"><div>${head(s, 'feedback', page)}</div></div>
        <div class="fb-wrap">${s.h_feedback_score ? `<div class="score"><b>${esc(s.h_feedback_score)}</b><div class="stars" aria-label="5 sao">★★★★★</div><p>${esc(s.h_feedback_note)}</p>
          <div class="bars">${bars.map(([l, v]) => { const n = Math.max(0, Math.min(100, parseFloat(v) || 0)); return `<div class="bar"><span>${esc(l)}</span><i><u style="width:${n}%"></u></i><span>${n}%</span></div>`; }).join('')}</div></div>` : ''}
          <div class="fb-grid" id="fbGrid"></div></div></div></section>`;
    }
    case 'library':
      return `<section id="library" class="${secCls(page)}"${pad(page)}><div class="wrap"><div class="sec-head"><div>${head(s, 'library', page)}</div>
        <div class="tabs" role="tablist" aria-label="Loại tài nguyên">
          <button class="tab" role="tab" aria-selected="true" data-t="all" id="tab-all">Tất cả</button><button class="tab" role="tab" aria-selected="false" data-t="ebook" id="tab-ebook">Ebook</button>
          <button class="tab" role="tab" aria-selected="false" data-t="video" id="tab-video">Video</button><button class="tab" role="tab" aria-selected="false" data-t="model" id="tab-model">File mẫu &amp; đề bài</button>
          <button class="tab" role="tab" aria-selected="false" data-t="cheat" id="tab-cheat">Phím tắt</button></div></div>
        <div class="lib-grid" id="libGrid" role="tabpanel"></div></div></section>`;
    case 'blog':
      return `<section id="blog" style="padding-top:0"><div class="wrap"><div class="sec-head"><div>${head(s, 'blog', false)}</div>
        <a class="btn" href="/bai-viet">Xem tất cả bài viết</a></div><div class="blog-grid" id="blogGrid"></div></div></section>`;
    case 'faq':
      return `<section id="faq" class="${secCls(page)}"${pad(page)}><div class="wrap faq-grid"><div>${head(s, 'faq', page)}</div>
        <div>${(d.faqs || []).map((f, i) => `<details${i ? '' : ' open'}><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</div></div></section>`;
    case 'contact':
      return require_render(view('contact'), { ...s, head: head(s, 'contact', page), cls: page ? 'page-head' : '' }, page);
    default: return '';
  }
}
let require_render = null; // set by core.js (avoids a require cycle)
function setRender(fn) { require_render = (tpl, ctx) => fn(tpl, ctx); }

const enabled = (b, s) => !b.sec || (s.sections || {})[b.sec];
function homeBlocks(d, view) {
  const s = d.settings;
  return homeOrder(s).filter(x => x.on).map(x => BLOCKS.find(b => b.k === x.k)).filter(b => b && enabled(b, s)).map(b => block(b.k, d, view, false)).join('\n');
}
// own page for a block; pages that lead to a sign-up also carry the form
function blockPage(path, d, view) {
  const b = BLOCKS.find(x => x.path && (x.path === path || x.path + '/' === path));
  if (!b || !enabled(b, d.settings)) return null;
  const withForm = ['schedule', 'courses'].includes(b.k);
  return { b, body: `<main id="top">${block(b.k, d, view, true)}${withForm ? block('contact', d, view, false) : ''}</main>` };
}

module.exports = { BLOCKS, TEXT_DEFAULTS, HOME_SETTINGS, homeOrder, cleanHomeOrder, block, homeBlocks, blockPage, setRender, enabled };
