(function(){
const $=s=>document.querySelector(s);
const on=(el,ev,fn)=>{if(el)el.addEventListener(ev,fn);};
const RMOTION=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Data: injected by the server from the admin-managed content ---------- */
const D=window.__BETAGON__||{};
const S=D.settings||{};
const courses=D.courses||[];
const DOW=['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
const today=new Date();today.setHours(0,0,0,0);
// upcoming classes only, soonest first; "soon" means within 7 days unless the admin set a status
const schedule=(D.schedule||[]).map(r=>{
  const dt=new Date(r.date+'T00:00:00');
  const days=Math.round((dt-today)/864e5);
  const status=r.status&&r.status!=='auto'?r.status:(days<=7?'soon':'open');
  return {...r,id:r.course,dt,days,status,d:String(dt.getDate()).padStart(2,'0')+'/'+String(dt.getMonth()+1).padStart(2,'0'),dow:DOW[dt.getDay()]};
}).filter(r=>!isNaN(r.dt)&&r.days>=0&&courses.some(c=>c.id===r.id)).sort((a,b)=>a.dt-b.dt);
const STATUS={soon:['Sắp khai giảng',' soon'],open:['Đang nhận đăng ký',''],full:['Đã đủ học viên',' full']};
const works=(D.works||[]).map(w=>({...w,sw:String(w.sw||'').split(',').map(x=>x.trim()).filter(Boolean)}));
const fbs=D.testimonials||[];
const lib=D.library||[];
const fmtDate=s=>{const d=new Date(s+'T00:00:00');return isNaN(d)?'':d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'});};
const posts=(D.posts||[]).map(p=>({...p,desc:p.excerpt,meta:`${p.readMins||5} phút đọc · ${fmtDate(p.date)}`}));

/* ---------- Helpers ---------- */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const safeUrl=u=>/^(https?:\/\/|\/uploads\/|\/assets\/)/i.test(String(u||''))?String(u):'';
const safeColor=c=>/^#[0-9a-f]{3,8}$/i.test(String(c||''))?c:'#5B6070';
function pattern(seed){
  // hexagon grid overlay for generated covers
  let s='<svg viewBox="0 0 160 90" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width=".6">';
  for(let r=0;r<6;r++)for(let q=0;q<10;q++){
    const x=q*18+(r%2?9:0)-((seed*7)%18),y=r*16-4,h='M'+x+','+(y-9)+'l8,5v9l-8,5l-8,-5v-9z';
    s+='<path d="'+h+'"/>';
  }
  return s+'</g></svg>';
}
const cover=(g,c1,c2,seed,img)=>safeUrl(img)
  ?`<div class="cover has-img" style="background:#222 url('${esc(safeUrl(img))}') center/cover no-repeat"></div>`
  :`<div class="cover" style="background:linear-gradient(135deg,${safeColor(c1)},${safeColor(c2)})">${pattern(seed)}<span class="glyph">${esc(g)}</span></div>`;
const price=c=>c.price?`${esc(c.price)}đ${c.old?`<s>${esc(c.old)}đ</s>`:''}`:'Liên hệ';

/* ---------- Courses ---------- */
const grid=$('#courseGrid');
function renderCourses(f){
  if(!grid)return;
  const list=courses.filter(c=>f==='all'||c.cat===f);
  grid.innerHTML=list.length?list.map((c,i)=>`
   <article class="course${c.cat==='combo'?' wide':''}">
     <div style="position:relative">${cover(c.g,c.c1,c.c2,i,c.image)}<span class="tag">${esc(c.level)}</span>${c.hot?`<span class="tag hot">${esc(c.hot)}</span>`:''}</div>
     <div class="course-body">
       <h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p>
       <div class="meta"><span>${esc(c.weeks)} tuần</span><span>${esc(c.sessions)} buổi</span><span>Thực hành tại phòng máy</span></div>
       <div class="course-foot"><span class="price">${price(c)}</span><a class="link-arrow" href="${esc(c.url||'#')}">Chi tiết →</a></div>
     </div>
   </article>`).join(''):'<p class="lead">Chưa có khóa học trong nhóm này.</p>';
}
renderCourses('all');
document.querySelectorAll('.filter[data-f]').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.filter[data-f]').forEach(x=>x.setAttribute('aria-pressed','false'));
  b.setAttribute('aria-pressed','true');renderCourses(b.dataset.f);
}));
if($('#f-course'))$('#f-course').innerHTML=courses.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')+'<option value="tuvan">Chưa chọn được, cần tư vấn</option>';

/* ---------- Course modal ---------- */
const modal=$('#modal');let lastFocus=null;
const DEFAULT_DETAILS=c=>[`${c.sessions} buổi, mỗi buổi 2 giờ, lịch tối hoặc cuối tuần`,'Đồ án cuối khóa có mentor chấm và góp ý','Xem lại video bài giảng trên hệ thống học online','Thực hành tại phòng máy, hỗ trợ sửa bài 24/7','Hỗ trợ trọn đời và dùng thư viện tài nguyên phần mềm','Chứng chỉ hoàn thành khóa học'];
on(grid,'click',e=>{
  const b=e.target.closest('[data-open]');if(b)openCourse(b.dataset.open,b);
});
function openCourse(id,from){
  const c=courses.find(x=>x.id===id);if(!c||!modal)return;lastFocus=from||null;
  const det=String(c.details||'').split('\n').map(x=>x.trim()).filter(Boolean);
  $('#mBody').innerHTML=cover(c.g,c.c1,c.c2,3,c.image)+`<div class="modal-body">
    <span class="eyebrow">${esc(c.level)} · ${esc(c.weeks)} tuần</span><h3 id="mTitle">${esc(c.name)}</h3><p style="color:var(--muted)">${esc(c.desc)}</p>
    <ul>${(det.length?det:DEFAULT_DETAILS(c)).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
    <div class="course-foot"><span class="price">${price(c)}</span><a class="btn btn-primary" href="#contact" data-pick="${esc(c.id)}">Đăng ký khóa này</a></div></div>`;
  modal.classList.remove('wide');modal.hidden=false;$('#mClose').focus();
}
function closeModal(){modal.hidden=true;modal.classList.remove('wide');lastFocus&&lastFocus.focus();}
on($('#mClose'),'click',closeModal);
on(modal,'click',e=>{
  if(e.target===modal)closeModal();
  const p=e.target.closest('[data-pick]');if(p&&$('#f-course')){$('#f-course').value=p.dataset.pick;modal.hidden=true;}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal&&!modal.hidden)closeModal();});

/* ---------- Student work ---------- */
const wg=$('#workGrid'),wf=$('#workFilters'),WPAGE=wg&&wg.dataset.sw?wg.dataset.sw.split(','):null,WLIMIT=wg&&+wg.dataset.limit||0,WSTEP=WLIMIT||9;let wFilter='all',wShown=WSTEP;
const glines=w=>[w.image,...String(w.gallery||'').split('\n')].map(x=>safeUrl(x.trim())).filter((x,i,a)=>x&&a.indexOf(x)===i);
if(wf){
  const ORD=['AutoCAD','SketchUp','D5 Render','3ds Max','Corona','Revit','Blender','Photoshop','Affinity'],rank=x=>{const i=ORD.indexOf(x);return i<0?99:i;};
  const sws=[...new Set(works.flatMap(w=>w.sw))].sort((a,b)=>rank(a)-rank(b));
  if(sws.length>1)wf.innerHTML=`<button class="filter" aria-pressed="true" data-w="all">Tất cả</button>`+sws.map(x=>`<button class="filter" aria-pressed="false" data-w="sw:${esc(x)}">${esc(x)}</button>`).join('');
}
const wMatch=w=>WPAGE?w.sw.some(x=>WPAGE.includes(x)):wFilter==='all'||(wFilter.startsWith('sw:')?w.sw.includes(wFilter.slice(3)):w.k===wFilter);
function renderWorks(){
  if(!wg)return;
  const list=works.filter(wMatch),show=list.slice(0,wShown);
  wg.innerHTML=show.map((w,i)=>{const n=glines(w).length;return `<article class="work${w.big&&wFilter==='all'&&!WPAGE&&i===0?' big':''}">
    <button class="work-open" data-work="${esc(w.uid)}" aria-label="Xem ảnh ${esc(w.name)} của ${esc(w.st)}"></button>
    <div style="position:relative">${cover(w.sw.join(' + '),w.c1,w.c2,i+4,glines(w)[0])}${n>1?`<span class="tag">${n} ảnh</span>`:n?'':'<span class="tag">Ảnh sản phẩm</span>'}</div>
    <div class="work-body"><h3>${esc(w.name)}</h3><p>${esc(w.desc)}</p>
    <div class="who"><b>${esc(w.st)}</b><span>· ${esc(w.course)}</span></div>
    <div class="sw">${w.sw.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div></article>`;}).join('')
    +(list.length>show.length&&!WLIMIT?`<div class="work-more"><button class="btn btn-primary" id="workMore">Xem thêm sản phẩm (còn ${list.length-show.length})</button></div>`:'');
}
renderWorks();
on(wf,'click',e=>{const b=e.target.closest('[data-w]');if(!b)return;
  wf.querySelectorAll('[data-w]').forEach(x=>x.setAttribute('aria-pressed','false'));
  b.setAttribute('aria-pressed','true');wFilter=b.dataset.w;wShown=WSTEP;renderWorks();});
/* home: product carousel */
const ws=$('#workSlider');
if(ws){
  const pick=[...works.filter(w=>w.big),...works.filter(w=>!w.big)].filter(w=>glines(w).length).slice(0,15);
  ws.innerHTML=pick.map((w,i)=>`<article class="work car-item">
    <button class="work-open" data-work="${esc(w.uid)}" aria-label="Xem ảnh ${esc(w.name)} của ${esc(w.st)}"></button>
    <div style="position:relative">${cover(w.sw.join(' + '),w.c1,w.c2,i+4,glines(w)[0])}${glines(w).length>1?`<span class="tag">${glines(w).length} ảnh</span>`:''}</div>
    <div class="work-body"><h3>${esc(w.name)}</h3><div class="who"><b>${esc(w.st)}</b></div><div class="sw">${w.sw.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div></article>`).join('');
  carousel(ws,ws.parentNode,$('#workDots'),0);
}
on(ws,'click',e=>openWork(e));
on(wg,'click',e=>{
  if(e.target.closest('#workMore')){wShown+=WSTEP;renderWorks();return;}
  openWork(e);
});
function openWork(e){
  const b=e.target.closest('[data-work]');if(!b||!modal)return;
  const w=works.find(x=>x.uid===b.dataset.work);if(!w)return;lastFocus=b;
  const imgs=glines(w);
  $('#mBody').innerHTML=`<div class="modal-body"><span class="eyebrow">${esc(w.course)}</span><h3 id="mTitle">${esc(w.name)}</h3>
    <p style="color:var(--muted)">${esc(w.desc)}</p></div>
    ${imgs.length?`<div class="gallery">${imgs.map((u,i)=>`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt="${esc(w.name)} – ảnh ${i+1}" loading="lazy"></a>`).join('')}</div>`
      :`<div class="modal-body" style="padding-top:0">${cover(w.sw.join(' + '),w.c1,w.c2,5,'')}<p style="color:var(--muted)">Ảnh sản phẩm đang được cập nhật.</p></div>`}`;
  modal.classList.add('wide');modal.hidden=false;$('#mClose').focus();
}

/* ---------- Carousels (banner slideshow, product row) ---------- */
// track scrolls horizontally with snap; arrows/dots move it; autoplay ms>0 pauses on hover/touch
function carousel(track,box,dots,ms){
  if(!track||!track.children.length)return;
  const items=()=>[...track.children];
  const per=()=>Math.max(1,Math.round(track.clientWidth/(items()[0].getBoundingClientRect().width||1)));
  const pages=()=>Math.max(1,Math.ceil(items().length/per()));
  const cur=()=>Math.round(track.scrollLeft/Math.max(1,track.clientWidth));
  const go=i=>{const n=pages();i=(i+n)%n;track.scrollTo({left:i*track.clientWidth,behavior:RMOTION?'auto':'smooth'});};
  function drawDots(){if(!dots)return;const n=pages();if(dots.children.length!==n)dots.innerHTML=Array.from({length:n},(_,i)=>`<button type="button" aria-label="Trang ${i+1}"></button>`).join('');
    [...dots.children].forEach((b,i)=>b.toggleAttribute('aria-current',i===cur()));dots.hidden=n<2;}
  const prev=box.querySelector('.sl-nav.prev'),next=box.querySelector('.sl-nav.next');
  on(prev,'click',()=>go(cur()-1));on(next,'click',()=>go(cur()+1));
  on(dots,'click',e=>{const b=e.target.closest('button');if(b)go([...dots.children].indexOf(b));});
  let t=null;track.addEventListener('scroll',()=>{clearTimeout(t);t=setTimeout(drawDots,80);},{passive:true});
  addEventListener('resize',drawDots);drawDots();
  if(ms&&!RMOTION&&pages()>1){let hold=false,timer=setInterval(()=>{if(!hold&&!document.hidden)go(cur()+1);},ms);
    ['mouseenter','touchstart','focusin'].forEach(ev=>box.addEventListener(ev,()=>hold=true,{passive:true}));
    ['mouseleave','touchend','focusout'].forEach(ev=>box.addEventListener(ev,()=>hold=false,{passive:true}));}
}
{const bt=$('#bannerTrack');if(bt)carousel(bt,bt.parentNode,bt.parentNode.querySelector('.sl-dots'),5500);}

/* ---------- Schedule ---------- */
if($('#schedList')){
  const only=$('#schedList').dataset.course,sched=only?schedule.filter(r=>r.id===only):schedule;
  $('#schedList').innerHTML=sched.length?sched.map(r=>{const c=courses.find(x=>x.id===r.id);const [dd,mm]=r.d.split('/');const st=STATUS[r.status]||STATUS.open;return `<div class="srow" role="listitem">
  <div class="sdate"><b>${dd}</b><span>Th ${+mm}</span></div>
  <div class="scourse"><b>${esc(c.name)}</b><span>${esc(c.weeks)} tuần · ${esc(c.sessions)} buổi · ${esc(c.level)}</span></div>
  <div class="stime"><b>${esc(r.time)}</b><span>${esc(r.hour)}</span></div>
  <div class="smode"><b>${esc(r.mode)}</b><span>Khai giảng ${esc(r.dow)}</span></div>
  <span class="pill${st[1]}">${st[0]}</span>
  ${r.status==='full'?'<span></span>':`<a class="btn btn-dark" href="#contact" data-pick="${esc(c.id)}">Đăng ký</a>`}</div>`;}).join(''):'<div class="srow srow-empty"><div></div><div class="scourse"><b>Lịch khai giảng mới đang được cập nhật</b><span>Để lại số điện thoại ở form đăng ký, Betagon sẽ báo bạn khi có lớp mới.</span></div></div>';
  $('#schedList').addEventListener('click',e=>{const p=e.target.closest('[data-pick]');if(p&&$('#f-course'))$('#f-course').value=p.dataset.pick;});
}

/* ---------- Feedback ---------- */
if($('#fbGrid'))$('#fbGrid').innerHTML=fbs.map(f=>`<figure class="fb" style="margin:0 0 16px">
  <div class="stars" aria-label="${esc(f.stars||5)} sao">${'★'.repeat(Math.max(1,Math.min(5,+f.stars||5)))}</div>
  <q style="margin-top:10px">${esc(f.q)}</q>
  ${f.out?`<span class="out">↗ ${esc(f.out)}</span>`:''}
  <figcaption class="fb-who"><span class="av" style="background:${safeColor(f.c)}">${esc(String(f.n||'').split(' ').slice(-2).map(w=>w[0]).join(''))}</span><div><b>${esc(f.n)}</b><span>${esc(f.r)}</span></div></figcaption></figure>`).join('');

/* ---------- Library ---------- */
function renderLib(t){
  if(!$('#libGrid'))return;
  $('#libGrid').innerHTML=lib.filter(x=>t==='all'||x.t===t).map(x=>{const u=/^https?:\/\//i.test(x.link||'')?x.link:'';return `<${u?`a href="${esc(u)}" target="_blank" rel="noopener"`:'article'} class="res" style="text-decoration:none">
    <span class="ico" style="background:${safeColor(x.c)}">${esc(x.ico)}</span><h3>${esc(x.name)}</h3><p>${esc(x.desc)}</p>
    <div class="meta"><span>${esc(x.meta)}</span><span class="free">${u?'Tải về ↗':'Miễn phí'}</span></div></${u?'a':'article'}>`;}).join('');
}
renderLib('all');
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.setAttribute('aria-selected','false'));
  b.setAttribute('aria-selected','true');renderLib(b.dataset.t);
}));

/* ---------- Blog ---------- */
const thumb=(p,i)=>safeUrl(p.cover)?`<div class="thumb" style="background:#222 url('${esc(safeUrl(p.cover))}') center/cover no-repeat"><b>${esc(p.tag)}</b></div>`
  :`<div class="thumb" style="background:linear-gradient(135deg,${safeColor(p.c1)},${safeColor(p.c2)})">${pattern(i+2)}<b>${esc(p.tag)}</b></div>`;
const postHTML=(p,i)=>`<a class="post" href="/bai-viet/${encodeURIComponent(p.slug)}">${thumb(p,i)}
  <div><h3>${esc(p.title)}</h3>${p.desc&&i===0?`<p style="margin-top:8px">${esc(p.desc)}</p>`:''}<div class="meta" style="margin-top:8px">${esc(p.meta)}</div></div></a>`;
if($('#blogGrid'))$('#blogGrid').innerHTML=posts.length?postHTML(posts[0],0)+`<div class="side-posts">${posts.slice(1,4).map((p,i)=>postHTML(p,i+1)).join('')}</div>`:'<p class="lead">Chưa có bài viết.</p>';
// full list on /bai-viet
if($('#postList'))$('#postList').innerHTML=posts.map((p,i)=>`<a class="post" href="/bai-viet/${encodeURIComponent(p.slug)}">${thumb(p,i)}<div><h3>${esc(p.title)}</h3>${p.desc?`<p style="margin-top:8px">${esc(p.desc)}</p>`:''}<div class="meta" style="margin-top:8px">${esc(p.meta)}</div></div></a>`).join('')||'<p class="lead">Chưa có bài viết.</p>';

/* ---------- Chatbot: answers from the site's own data, no server needed ---------- */
// Links for human chat come from the admin settings
const CHAT_LINKS={zalo:S.chatZalo||'',messenger:S.chatMessenger||''};
(function(){
const fab=$('#chatFab'),box=$('#chat'),log=$('#chatLog'),inp=$('#chatIn');
if(!fab)return;
if(CHAT_LINKS.zalo){$('#chatZalo').href=CHAT_LINKS.zalo;$('#chatZalo').target='_blank';}
if(CHAT_LINKS.messenger){$('#chatMess').href=CHAT_LINKS.messenger;$('#chatMess').target='_blank';}
const fold=t=>t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
const has=(q,...w)=>w.some(x=>q.includes(x));
const BUILTIN_KEYS={cad:['autocad','cad'],rvt:['revit','bim'],su:['sketchup','sketch up','skp'],max:['3ds','3d max','3dmax','max'],bl:['blender'],co:['corona'],d5:['d5'],ps:['photoshop','affinity','hau ky','photo shop'],combo1:['combo noi that','combo thiet ke'],combo2:['combo 3ds','combo max','combo corona']};
// keywords per course: the admin's own list if given, otherwise the built-in list or the course name
const COURSE_KEYS=Object.fromEntries(courses.map(c=>[c.id,c.keywords?String(c.keywords).split(',').map(k=>fold(k.trim())).filter(Boolean):(BUILTIN_KEYS[c.id]||[fold(c.name)])]));
function findCourses(q){
  const ids=[];
  for(const[id,ks]of Object.entries(COURSE_KEYS))if(ks.some(k=>q.includes(k)))ids.push(id);
  if(ids.includes('combo2'))return ['combo2'];
  if(ids.includes('combo1'))return ['combo1'];
  return ids.filter(i=>!i.startsWith('combo'));
}
const next=id=>schedule.find(r=>r.id===id);
const regBtn=(id,label='Đăng ký khóa này')=>({act:label,pick:id});
function courseCard(c){
  const r=next(c.id);
  return `${c.name}\n• ${c.weeks} tuần, ${c.sessions} buổi, trình độ ${c.level.toLowerCase()}\n• Học phí: ${c.price}đ${c.old?` (giá gốc ${c.old}đ)`:''}\n• ${r?`Khai giảng ${r.d}, lịch ${r.time}, ${r.hour}, ${r.mode.toLowerCase()}`:'Lịch khai giảng: đang cập nhật'}\n${c.desc}`;
}
function answer(raw){
  const q=fold(raw);
  const cs=findCourses(q);
  if(/^(xin )?chao\b|^(hi|hello|alo)\b/.test(q)&&q.split(' ').length<=6)return {t:'Chào bạn! Mình là trợ lý của Betagon. Bạn muốn hỏi về khóa học, lịch khai giảng, học phí hay cách đăng ký?'};
  if(has(q,'tra gop','gop'))return {t:'Betagon hỗ trợ trả góp 0% trong 3 tháng qua thẻ tín dụng, hoặc chia 2 đợt đóng trực tiếp tại trung tâm.'};
  const priceQ=has(q,'hoc phi','bao nhieu','tien','chi phi')||/\bgia\b/.test(q);
  if(cs.length&&priceQ){
    return {t:cs.map(id=>{const c=courses.find(x=>x.id===id);return `${c.name}: ${c.price}đ${c.old?` (giá gốc ${c.old}đ)`:''}`;}).join('\n'),...(cs.length===1?regBtn(cs[0]):{})};
  }
  if(cs.length&&has(q,'lich','khai giang','khi nao','bao gio','ngay')){
    return {t:cs.map(id=>{const c=courses.find(x=>x.id===id),r=next(id);return r?`${c.name}: khai giảng ${r.d}, lịch ${r.time}, ${r.hour} (${r.mode.toLowerCase()})`:`${c.name}: lịch đang cập nhật`;}).join('\n'),...(cs.length===1?regBtn(cs[0]):{})};
  }
  if(cs.length===1){const c=courses.find(x=>x.id===cs[0]);return {t:courseCard(c),...regBtn(c.id)};}
  if(cs.length>1)return {t:cs.map(id=>courseCard(courses.find(x=>x.id===id))).join('\n\n')};
  if(has(q,'lich','khai giang','khi nao','bao gio','sap mo'))return {t:'Các lớp sắp khai giảng:\n'+schedule.slice(0,5).map(r=>{const c=courses.find(x=>x.id===r.id);return `• ${r.d}: ${c.name} (${r.time}, ${r.hour})`;}).join('\n'),act:'Xem toàn bộ lịch',href:'/lich-khai-giang'};
  if(priceQ)return {t:'Học phí các khóa:\n'+courses.map(c=>`• ${c.name}: ${c.price}đ`).join('\n')+'\nCó trả góp 0% trong 3 tháng.'};
  if(has(q,'bat dau','nguoi moi','chua biet','moi hoc','trai nganh','nen hoc'))return {t:'Nếu bạn mới bắt đầu, lộ trình gợi ý là AutoCAD → SketchUp → D5 Render, rồi làm đồ án tổng hợp. Combo Thiết kế nội thất gom đủ 3 phần mềm này trong 6 tháng.',...regBtn('combo1','Đăng ký combo này')};
  if(has(q,'phong may','may tinh','cau hinh','laptop','mang may'))return {t:'Học tại lớp có phòng máy thực hành cấu hình cao, cài sẵn đủ phần mềm, bạn không cần mang laptop. Nếu tự học ở nhà: AutoCAD, SketchUp cần Core i5, RAM 16GB. D5 Render, Corona, Blender nên có card RTX 3060 trở lên.'};
  if(has(q,'ho tro','24/7','sua bai','tron doi','hoi bai','thac mac'))return {t:'Học viên Betagon được hỗ trợ giải đáp thắc mắc và sửa bài 24/7. Sau khóa học vẫn được hỗ trợ trọn đời: hỏi bài, góp ý đồ án và cập nhật khi phần mềm ra phiên bản mới.'};
  if(has(q,'thu vien','tai nguyen','tai lieu','model','block','plugin','vat lieu'))return {t:'Học viên được dùng trọn đời thư viện tài nguyên cho từng phần mềm: block CAD, model, vật liệu, plugin, video, đề bài và file mẫu.',act:'Xem thư viện',href:'/thu-vien'};
  if(has(q,'online','tai lop','hinh thuc','offline','hoc o dau'))return {t:'Betagon có 2 hình thức: học tại lớp (có phòng máy thực hành) và học online. Lịch học thường vào buổi tối hoặc cuối tuần. Lịch cụ thể từng lớp có trong mục Lịch khai giảng.',act:'Xem lịch khai giảng',href:'/lich-khai-giang'};
  if(has(q,'giang vien','thay','co giao','mentor','nguoi day'))return {t:'Giảng viên Betagon có nhiều năm kinh nghiệm giảng dạy và làm thiết kế thực tế. Mỗi bài nộp đều được sửa trực tiếp trên file của bạn.'};
  if(has(q,'do an','tot nghiep','portfolio','san pham'))return {t:'Mỗi khóa học kết thúc bằng một đồ án hoàn chỉnh làm từ đề bài thực tế. Bạn có thể xem sản phẩm khóa học của học viên trong mục Sản phẩm khóa học.',act:'Xem sản phẩm khóa học',href:'/san-pham'};
  if(has(q,'chung chi','bang'))return {t:'Hoàn thành khóa học và bảo vệ đồ án, bạn nhận chứng chỉ hoàn thành khóa học của Betagon.'};
  if(has(q,'nghi','hoc bu','vang'))return {t:'Mọi buổi học đều được ghi hình để xem lại. Bạn cũng có thể học bù vào lớp khác cùng khóa trong 3 tháng.'};
  if(has(q,'viec lam','xin viec','gioi thieu viec'))return {t:'Học viên hoàn thành đồ án loại khá trở lên được giới thiệu tới các studio và công ty đối tác của Betagon.'};
  if(has(q,'dia chi','o dau','hotline','sdt','so dien thoai','lien he','email','zalo','facebook'))return {t:`Thông tin liên hệ Betagon:\n• Địa chỉ: ${S.address||''}\n• Hotline: ${S.hotline||''}\n• Email: ${S.email||''}\n• Giờ làm việc: ${S.hours||''}`};
  if(has(q,'dang ky','dang ki','ghi danh','tu van','goi lai'))return {t:'Bạn chọn khóa học và để lại họ tên, số điện thoại ở form đăng ký. Betagon sẽ gọi lại để xác nhận lịch và học phí.',act:'Mở form đăng ký',href:'/dang-ky'};
  if(has(q,'khoa hoc','khoa nao','day gi','phan mem','hoc gi'))return {t:'Betagon dạy 9 phần mềm:\n• 2D & BIM: AutoCAD, Revit\n• 3D: SketchUp, 3ds Max, Blender\n• Render: Corona, D5 Render\n• Hậu kỳ: Photoshop, Affinity\nVà 2 combo: Thiết kế nội thất, 3ds Max + Corona. Bạn hỏi tên phần mềm để xem chi tiết nhé.',act:'Xem các khóa học',href:'/khoa-hoc'};
  if(has(q,'cam on','thanks','ok','duoc roi'))return {t:'Không có gì ạ! Bạn cần hỏi thêm gì cứ nhắn mình nhé.'};
  return {t:'Câu này mình chưa trả lời được. Bạn thử hỏi về khóa học, lịch khai giảng, học phí, phòng máy hay hỗ trợ học viên nhé. Hoặc để lại số điện thoại, tư vấn viên sẽ gọi lại cho bạn.',act:'Để lại số điện thoại',href:'/dang-ky'};
}
function add(who,text,extra){
  const el=document.createElement('div');el.className='msg '+who;el.textContent=text;
  if(extra&&extra.act){
    const a=document.createElement('a');a.className='act';a.textContent=extra.act;const h=extra.href||'#contact';a.href=document.getElementById(h.slice(1))?h:'/'+h;
    a.addEventListener('click',()=>{if(extra.pick&&$('#f-course'))$('#f-course').value=extra.pick;if(innerWidth<=520)closeChat();});
    el.appendChild(document.createElement('br'));el.appendChild(a);
  }
  log.appendChild(el);log.scrollTop=log.scrollHeight;
}
function ask(text){
  text=text.trim();if(!text)return;
  add('me',text);
  const ty=document.createElement('div');ty.className='typing';ty.innerHTML='<i></i><i></i><i></i>';log.appendChild(ty);log.scrollTop=log.scrollHeight;
  setTimeout(()=>{ty.remove();const r=answer(text);add('bot',r.t,r);},450);
}
const CHIPS=['Lịch khai giảng','Học phí','Mới bắt đầu nên học gì?','Phòng máy','Hỗ trợ sửa bài','Đăng ký'];
$('#chatChips').innerHTML=CHIPS.map(c=>`<button type="button">${c}</button>`).join('');
$('#chatChips').addEventListener('click',e=>{const b=e.target.closest('button');if(b)ask(b.textContent);});
$('#chatForm').addEventListener('submit',e=>{e.preventDefault();ask(inp.value);inp.value='';});
let greeted=false;
function openChat(){box.hidden=false;fab.hidden=true;fab.setAttribute('aria-expanded','true');
  if(!greeted){greeted=true;add('bot','Chào bạn! Mình là trợ lý của Betagon. Bạn cần tìm khóa học, xem lịch khai giảng hay hỏi học phí? Chọn nhanh bên dưới hoặc gõ câu hỏi nhé.');}
  if(innerWidth>520)inp.focus();}
function closeChat(){box.hidden=true;fab.hidden=false;fab.setAttribute('aria-expanded','false');fab.focus();}
fab.addEventListener('click',openChat);$('#chatX').addEventListener('click',closeChat);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!box.hidden)closeChat();});
})();

/* ---------- Form: sends the registration to the admin ---------- */
on($('#regForm'),'submit',async e=>{
  e.preventDefault();
  const f=e.target,name=$('#f-name').value.trim(),phone=$('#f-phone').value.replace(/[\s.]/g,'');
  const err=$('#formErr'),ok=$('#formOk'),btn=f.querySelector('button[type=submit]');
  const fail=(m,el)=>{err.textContent=m;err.hidden=false;ok.hidden=true;if(el)el.focus();};
  if(!name)return fail('Bạn nhập họ tên giúp mình nhé.',$('#f-name'));
  if(!/^(0|\+84)\d{9,10}$/.test(phone))return fail('Số điện thoại chưa đúng. Ví dụ: 0912345678.',$('#f-phone'));
  err.hidden=true;btn.disabled=true;btn.textContent='Đang gửi...';
  const sel=$('#f-course');
  try{
    const r=await fetch('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,phone,email:$('#f-email').value.trim(),course:sel.value,courseName:sel.selectedOptions[0]?sel.selectedOptions[0].text:'',mode:$('#f-mode').value,note:$('#f-note').value.trim(),website:$('#f-web').value})});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.error||'Gửi chưa được, bạn thử lại sau ít phút nhé.');
    ok.textContent=`Cảm ơn ${name}! Betagon đã nhận đăng ký khóa "${sel.selectedOptions[0].text}" và sẽ gọi cho bạn qua số ${phone}.`;
    ok.hidden=false;f.reset();
  }catch(x){fail(x.message+(S.hotline?` Hoặc gọi hotline ${S.hotline}.`:''));}
  finally{btn.disabled=false;btn.textContent='Đăng ký khóa học';}
});

/* ---------- Nav ---------- */
const menu=$('#menu'),burger=$('#burger');
burger.addEventListener('click',()=>{const o=menu.classList.toggle('open');burger.setAttribute('aria-expanded',o);});
// dropdowns: click to open (hover also opens on desktop, via CSS)
function closeDD(except){menu.querySelectorAll('.has-dd.open').forEach(li=>{if(li!==except){li.classList.remove('open');li.querySelector('.dd-btn').setAttribute('aria-expanded','false');}});}
menu.addEventListener('click',e=>{
  const db=e.target.closest('.dd-btn');
  if(db){const li=db.parentNode,o=!li.classList.contains('open');closeDD(li);li.classList.toggle('open',o);db.setAttribute('aria-expanded',o);return;}
  const a=e.target.closest('a');if(!a)return;
  closeDD();menu.classList.remove('open');burger.setAttribute('aria-expanded','false');
  // same link twice does not fire hashchange, so route it here
  if(a.hash&&a.pathname===location.pathname&&a.hash===location.hash&&route()){e.preventDefault();}
});
document.addEventListener('click',e=>{if(!e.target.closest('.has-dd'))closeDD();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDD();});
// deep links from the menu: #khoa-hoc-<id> opens that course, #san-pham-<software> filters the works
function route(){
  let h='';try{h=decodeURIComponent(location.hash.slice(1));}catch(_){return false;}
  if(h.startsWith('khoa-hoc-')&&$('#courses')){
    const id=h.slice(9);if(!courses.some(c=>c.id===id))return false;
    $('#courses').scrollIntoView();openCourse(id,null);return true;
  }
  if(h.startsWith('san-pham-')&&wf){
    const b=[...wf.querySelectorAll('[data-w]')].find(x=>x.dataset.w==='sw:'+h.slice(9));
    if(b)b.click();$('#products').scrollIntoView();return true;
  }
  return false;
}
addEventListener('hashchange',route);
// course page: "Đăng ký khóa này" preselects the course; copy-link buttons
document.addEventListener('click',e=>{
  const pk=e.target.closest('[data-pick]');if(pk&&$('#f-course'))$('#f-course').value=pk.dataset.pick;
  const ct=e.target.closest('a[href="#contact"]');if(ct&&!$('#contact')){e.preventDefault();location.href='/dang-ky'+(pk?'?khoa='+encodeURIComponent(pk.dataset.pick):'');return;}
  const cp=e.target.closest('[data-copy]');if(!cp)return;
  const url=location.origin+location.pathname,done=()=>{const t=cp.textContent;cp.textContent='Đã sao chép link ✓';setTimeout(()=>cp.textContent=t,1800);};
  if(navigator.clipboard)navigator.clipboard.writeText(url).then(done,()=>prompt('Sao chép link:',url));else prompt('Sao chép link:',url);
});
{const cs=($('#schedList')&&$('#schedList').dataset.course)||new URLSearchParams(location.search).get('khoa');if(cs&&$('#f-course')&&courses.some(c=>c.id===cs))$('#f-course').value=cs;}
if(location.hash)setTimeout(route,60);
$('#themeBtn').addEventListener('click',()=>{
  const r=document.documentElement,cur=r.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
  r.dataset.theme=cur==='dark'?'light':'dark';
  try{localStorage.setItem('btg-theme',r.dataset.theme)}catch(_){}
});
try{const t=localStorage.getItem('btg-theme');if(t)document.documentElement.dataset.theme=t;}catch(_){}

/* ---------- Hero 3D viewport: Betagon logo cube (three.js) ---------- */
(function(){
const cv=$('#stage');
if(!cv)return;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!window.THREE){cv.hidden=true;$('#vpFallback').hidden=false;return;}
const T=THREE;
// Outlines traced from the logo artwork, already projected back onto each cube face:
// face L lies on Z=1 (x→X, y→Y), face R on X=1 (x→1-Z, y→Y), face T on Y=H (x→X, y→Z).
const LOGO={"H":1,"faces":[{"face":"T","shapes":[[[[0.0,0.0],[0.0,0.9191],[0.2035,0.9191],[0.2035,0.2031],[0.9096,0.2031],[0.9096,0.0]]]]},{"face":"L","shapes":[[[[0.0,0.9759],[0.0,0.0],[0.9187,0.0],[0.9187,0.4253],[0.8756,0.4923],[0.8278,0.5191],[0.8947,0.6],[0.9187,0.6601],[0.9187,0.8824],[0.8756,0.9759]],[[0.1938,0.7858],[0.7033,0.7858],[0.7249,0.7685],[0.7249,0.6302],[0.7033,0.6],[0.6651,0.5825],[0.1938,0.5825]],[[0.1938,0.3969],[0.7033,0.3969],[0.7249,0.3567],[0.7249,0.1976],[0.1938,0.1976]]]]},{"face":"R","shapes":[[[[0.9832,0.9842],[0.0766,0.9842],[0.0766,0.0],[0.9832,0.0],[0.9832,0.5846],[0.5407,0.5846],[0.5407,0.3979],[0.7919,0.3979],[0.7919,0.2005],[0.2727,0.2005],[0.2727,0.7842],[0.9832,0.7842]]]]}],"xmax":0.9187};
const H=LOGO.H,D=.085,MM=1000; // 1 unit = 1000mm

const renderer=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.toneMappingExposure=1.15;
const scene=new T.Scene();
const cam=new T.OrthographicCamera(-1,1,1,-1,-20,20);
const persp=new T.PerspectiveCamera(27,1,.1,60);let camR=6.8;
const vpEl=cv.closest('.viewport');
const target=new T.Vector3(0,H/2-.04,0);

// ---- geometry
const group=new T.Group();scene.add(group);
const parts=[];
function shapeFrom(rings){
  const sh=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));
  rings.slice(1).forEach(r=>sh.holes.push(new T.Path(r.map(p=>new T.Vector2(p[0],p[1])))));
  return sh;
}
LOGO.faces.forEach(f=>{
  f.shapes.forEach(rings=>{
    const g=new T.ExtrudeGeometry(shapeFrom(rings),{depth:D,bevelEnabled:false,curveSegments:1});
    const m=new T.Mesh(g,[new T.MeshBasicMaterial(),new T.MeshBasicMaterial()]);
    if(f.face==='L'){m.position.set(-.5,0,.5-D);}
    else if(f.face==='R'){m.rotation.y=Math.PI/2;m.position.set(.5-D,0,.5);}
    else{m.rotation.x=Math.PI/2;m.position.set(-.5,H,-.5);} // local y→world z, extrude local z→world -y
    m.castShadow=true;m.receiveShadow=true;
    const e=new T.LineSegments(new T.EdgesGeometry(g,25),new T.LineBasicMaterial());
    m.userData.y0=m.position.y;m.add(e);group.add(m);parts.push({m,e});
  });
});


// ---- software logos: each logo's own outline extruded into a thin slab, artwork on the face
const APPS=[{"name":"AutoCAD","img":"/assets/logos/autocad.png","shape":[[[-0.3177,0.5],[-0.3333,0.4948],[-0.3385,0.4844],[-0.3594,0.4792],[-0.3646,0.4688],[-0.3958,0.4583],[-0.4167,0.4375],[-0.4323,0.4375],[-0.4583,0.4115],[-0.474,0.4115],[-0.474,-0.2917],[-0.4583,-0.2917],[-0.4583,-0.2865],[-0.4375,-0.2812],[-0.4271,-0.2656],[-0.4167,-0.2656],[-0.4062,-0.2552],[-0.3906,-0.2552],[-0.3906,-0.4635],[-0.3854,-0.4635],[-0.3854,-0.474],[-0.3542,-0.5],[0.4688,-0.5],[0.4688,0.3438],[0.401,0.3438],[0.401,0.4531],[0.3958,0.4531],[0.3906,0.4844],[0.3646,0.4948],[0.3646,0.5]]],"side":"#781231"},{"name":"SketchUp","img":"/assets/logos/sketchup.png","shape":[[[-0.0312,0.5],[-0.0365,0.4948],[-0.0938,0.4896],[-0.1042,0.4792],[-0.1198,0.4792],[-0.1198,0.474],[-0.151,0.4635],[-0.1562,0.4531],[-0.1875,0.4427],[-0.1927,0.4323],[-0.2031,0.4323],[-0.2031,0.4271],[-0.224,0.4219],[-0.2292,0.4115],[-0.2604,0.401],[-0.2656,0.3906],[-0.2969,0.3802],[-0.3021,0.3698],[-0.3229,0.3646],[-0.3281,0.3542],[-0.349,0.349],[-0.3542,0.3385],[-0.3646,0.3385],[-0.3646,0.3333],[-0.3854,0.3281],[-0.3906,0.3177],[-0.4219,0.3073],[-0.4323,0.2917],[-0.4167,0.2865],[-0.4115,0.276],[-0.3802,0.2656],[-0.375,0.2552],[-0.3333,0.2396],[-0.3281,0.2292],[-0.3073,0.224],[-0.3021,0.2135],[-0.2812,0.2083],[-0.276,0.1979],[-0.2448,0.1875],[-0.2396,0.1771],[-0.2083,0.1667],[-0.2031,0.1562],[-0.1719,0.1458],[-0.1667,0.1354],[-0.1354,0.125],[-0.1146,0.1042],[-0.099,0.1042],[-0.0781,0.0833],[-0.0469,0.0729],[-0.0417,0.0625],[-0.0312,0.0625],[-0.0312,0.0573],[-0.0208,0.0573],[-0.0052,0.0417],[0.0208,0.0312],[0.0208,-0.4948],[0.0365,-0.4948],[0.0417,-0.4844],[0.0729,-0.474],[0.0781,-0.4635],[0.1094,-0.4531],[0.1146,-0.4427],[0.1354,-0.4375],[0.1406,-0.4271],[0.1615,-0.4219],[0.1667,-0.4115],[0.1979,-0.401],[0.2031,-0.3906],[0.2344,-0.3802],[0.2396,-0.3698],[0.2708,-0.3594],[0.276,-0.349],[0.2865,-0.349],[0.2865,-0.3438],[0.3073,-0.3385],[0.3125,-0.3281],[0.3229,-0.3281],[0.3281,-0.3177],[0.3385,-0.3177],[0.3958,-0.2604],[0.3958,-0.25],[0.4115,-0.2396],[0.4115,-0.2292],[0.4167,-0.2292],[0.4167,-0.2188],[0.4219,-0.2188],[0.4219,-0.2083],[0.4271,-0.2083],[0.4271,-0.1979],[0.4427,-0.1771],[0.4531,-0.1198],[0.4583,-0.1198],[0.4531,-0.1146],[0.4531,-0.1042],[0.4583,-0.1042],[0.4583,0.2812],[0.4479,0.2917],[0.4167,0.3021],[0.4115,0.3125],[0.3802,0.3229],[0.375,0.3333],[0.3438,0.3438],[0.3385,0.3542],[0.3177,0.3594],[0.3125,0.3698],[0.2917,0.375],[0.2865,0.3854],[0.276,0.3854],[0.276,0.3906],[0.2448,0.401],[0.2396,0.4115],[0.2083,0.4219],[0.2031,0.4323],[0.1719,0.4427],[0.1667,0.4531],[0.1354,0.4635],[0.1198,0.4792],[0.0677,0.4896],[0.0677,0.4948],[0.0365,0.4948],[0.0365,0.5]],[[-0.4531,0.2552],[-0.4583,0.2552],[-0.4583,0.1198],[-0.4479,0.1198],[-0.4427,0.1094],[-0.4115,0.099],[-0.4062,0.0885],[-0.3854,0.0833],[-0.3802,0.0729],[-0.349,0.0625],[-0.3438,0.0521],[-0.3125,0.0417],[-0.3073,0.0312],[-0.276,0.0208],[-0.2552,0.0],[-0.2396,0.0],[-0.2344,-0.0104],[-0.2135,-0.0156],[-0.2083,-0.026],[-0.1875,-0.0312],[-0.1823,-0.0417],[-0.1406,-0.0573],[-0.1406,-0.0677],[-0.1354,-0.0677],[-0.1354,-0.1094],[-0.151,-0.1094],[-0.1667,-0.0938],[-0.1771,-0.0938],[-0.1771,-0.0885],[-0.1979,-0.0833],[-0.2031,-0.0729],[-0.2344,-0.0625],[-0.2396,-0.0521],[-0.2604,-0.0469],[-0.2656,-0.0365],[-0.2969,-0.026],[-0.3021,-0.0156],[-0.3281,-0.0104],[-0.3281,-0.0156],[-0.349,-0.0208],[-0.3542,-0.0312],[-0.3854,-0.0417],[-0.3906,-0.0521],[-0.401,-0.0521],[-0.401,-0.0573],[-0.4115,-0.0573],[-0.4323,-0.0729],[-0.4271,-0.0833],[-0.3906,-0.099],[-0.3854,-0.1094],[-0.3698,-0.1094],[-0.349,-0.1302],[-0.3177,-0.1406],[-0.3125,-0.151],[-0.2812,-0.1615],[-0.276,-0.1719],[-0.2448,-0.1823],[-0.2396,-0.1927],[-0.2083,-0.2031],[-0.1875,-0.224],[-0.1771,-0.224],[-0.1771,-0.2292],[-0.1562,-0.2344],[-0.151,-0.2448],[-0.1406,-0.2448],[-0.1354,-0.25],[-0.1354,-0.2969],[-0.1771,-0.2812],[-0.1823,-0.2708],[-0.1927,-0.2708],[-0.2083,-0.2552],[-0.2292,-0.25],[-0.2344,-0.2396],[-0.2656,-0.2292],[-0.2708,-0.2188],[-0.3021,-0.2083],[-0.3073,-0.1979],[-0.3281,-0.1927],[-0.3333,-0.1823],[-0.375,-0.1667],[-0.3802,-0.1562],[-0.3906,-0.1562],[-0.3958,-0.1458],[-0.4271,-0.1354],[-0.4427,-0.1198],[-0.4583,-0.1198],[-0.4583,-0.1302],[-0.4531,-0.1302],[-0.4479,-0.1667],[-0.4375,-0.1771],[-0.4375,-0.1927],[-0.4323,-0.1927],[-0.4219,-0.224],[-0.4115,-0.2292],[-0.401,-0.2552],[-0.3854,-0.2656],[-0.3854,-0.276],[-0.3542,-0.3073],[-0.3281,-0.3177],[-0.3177,-0.3333],[-0.3073,-0.3333],[-0.2917,-0.349],[-0.25,-0.3646],[-0.2448,-0.375],[-0.224,-0.3802],[-0.2188,-0.3906],[-0.1771,-0.4062],[-0.1719,-0.4167],[-0.1406,-0.4271],[-0.1198,-0.4479],[-0.0885,-0.4583],[-0.0833,-0.4688],[-0.0729,-0.4688],[-0.0729,-0.474],[-0.0625,-0.474],[-0.0469,-0.4896],[-0.0208,-0.5],[-0.0208,0.0052],[-0.0312,0.0052],[-0.0365,0.0156],[-0.0677,0.026],[-0.0729,0.0365],[-0.0938,0.0417],[-0.099,0.0521],[-0.1198,0.0573],[-0.125,0.0677],[-0.1562,0.0781],[-0.1615,0.0885],[-0.1927,0.099],[-0.1979,0.1094],[-0.2292,0.1198],[-0.2344,0.1302],[-0.2656,0.1406],[-0.2865,0.1615],[-0.3281,0.1771],[-0.3333,0.1875],[-0.3542,0.1927],[-0.3594,0.2031],[-0.3906,0.2135],[-0.3958,0.224],[-0.4271,0.2344],[-0.4323,0.2448],[-0.4427,0.2448]]],"side":"#002e52"},{"name":"Revit","t":"R","bg":"#1565C0","fg":"#FFFFFF","side":"#0D3F78"},{"name":"3ds Max","img":"/assets/logos/3ds-max.png","shape":[[[-0.3177,0.5],[-0.3438,0.4896],[-0.349,0.4792],[-0.3698,0.474],[-0.375,0.4635],[-0.3958,0.4583],[-0.401,0.4479],[-0.4323,0.4375],[-0.4427,0.4219],[-0.474,0.4115],[-0.474,-0.2917],[-0.4583,-0.2917],[-0.4427,-0.276],[-0.4062,-0.2604],[-0.401,-0.25],[-0.3906,-0.25],[-0.3906,-0.4635],[-0.375,-0.4792],[-0.375,-0.4896],[-0.3646,-0.4896],[-0.3542,-0.5],[0.4688,-0.5],[0.4688,0.3438],[0.3958,0.3438],[0.3958,0.474],[0.3802,0.4896],[0.3698,0.4896],[0.3646,0.5]]],"side":"#2a5d71"},{"name":"Corona","img":"/assets/logos/corona.png","shape":[[[-0.2448,0.474],[-0.25,0.474],[-0.2552,0.4531],[-0.276,0.4531],[-0.276,0.4479],[-0.3177,0.4531],[-0.3177,0.4375],[-0.3438,0.4323],[-0.3438,0.4219],[-0.3542,0.4219],[-0.3594,0.4115],[-0.3646,0.4115],[-0.3698,0.4271],[-0.3854,0.4271],[-0.3854,0.4115],[-0.3698,0.4115],[-0.3698,0.401],[-0.3854,0.3958],[-0.3906,0.4062],[-0.4062,0.4062],[-0.401,0.3698],[-0.4115,0.3698],[-0.4115,0.3854],[-0.4271,0.3854],[-0.4271,0.3646],[-0.4167,0.3646],[-0.4167,0.349],[-0.4323,0.3385],[-0.4375,0.3177],[-0.4531,0.3177],[-0.4531,0.2969],[-0.4479,0.2969],[-0.4479,0.276],[-0.4583,0.2708],[-0.4531,0.2448],[-0.4635,0.25],[-0.474,0.2396],[-0.474,0.2292],[-0.4583,0.2292],[-0.4583,0.2031],[-0.4688,0.2031],[-0.4635,0.1823],[-0.4583,0.1823],[-0.4583,0.1562],[-0.4792,0.1562],[-0.4792,0.151],[-0.4635,0.151],[-0.4635,0.1354],[-0.4583,0.1354],[-0.4583,0.1094],[-0.474,0.1094],[-0.474,0.0938],[-0.4688,0.0885],[-0.4583,0.0938],[-0.4583,0.0625],[-0.474,0.0625],[-0.474,0.0469],[-0.4583,0.0469],[-0.4583,0.0208],[-0.4688,0.0156],[-0.4688,0.0],[-0.4583,0.0],[-0.4583,-0.026],[-0.4688,-0.026],[-0.4688,-0.0469],[-0.4583,-0.0469],[-0.4583,-0.0729],[-0.4635,-0.0729],[-0.4583,-0.1198],[-0.4635,-0.1198],[-0.4635,-0.1354],[-0.4688,-0.1354],[-0.4688,-0.1406],[-0.4583,-0.1406],[-0.4583,-0.1615],[-0.4688,-0.1667],[-0.4688,-0.1823],[-0.4583,-0.1823],[-0.4583,-0.2083],[-0.4635,-0.2135],[-0.4792,-0.2083],[-0.4792,-0.2188],[-0.474,-0.2188],[-0.4792,-0.2292],[-0.4583,-0.2292],[-0.4531,-0.2969],[-0.4427,-0.3021],[-0.4479,-0.3073],[-0.4427,-0.3229],[-0.4531,-0.3229],[-0.4531,-0.3438],[-0.4375,-0.3438],[-0.4323,-0.3385],[-0.4375,-0.3281],[-0.4323,-0.3281],[-0.4271,-0.3333],[-0.4323,-0.3646],[-0.4115,-0.3646],[-0.4115,-0.3854],[-0.3906,-0.3906],[-0.3854,-0.4115],[-0.3646,-0.4115],[-0.3646,-0.4323],[-0.3281,-0.4323],[-0.3281,-0.4375],[-0.3385,-0.4375],[-0.3333,-0.4531],[-0.3229,-0.4531],[-0.3177,-0.4375],[-0.3021,-0.4427],[-0.2865,-0.4583],[-0.2604,-0.4531],[-0.2604,-0.4583],[-0.2708,-0.4583],[-0.2708,-0.474],[-0.2604,-0.474],[-0.2604,-0.4792],[-0.25,-0.474],[-0.2552,-0.4531],[-0.25,-0.4583],[-0.2188,-0.4531],[-0.224,-0.474],[-0.2083,-0.474],[-0.2083,-0.4531],[-0.1771,-0.4531],[-0.1823,-0.474],[-0.1719,-0.474],[-0.1719,-0.4792],[-0.1615,-0.4792],[-0.1615,-0.4531],[-0.151,-0.4531],[-0.151,-0.4583],[-0.1354,-0.4531],[-0.1354,-0.4792],[-0.1146,-0.474],[-0.1146,-0.4531],[-0.0885,-0.4583],[-0.0833,-0.4792],[-0.0729,-0.4792],[-0.0781,-0.4531],[-0.0469,-0.4531],[-0.0365,-0.4792],[-0.026,-0.4792],[-0.026,-0.4531],[-0.0104,-0.4531],[-0.0104,-0.4583],[0.0104,-0.4531],[0.0104,-0.4635],[0.0,-0.4688],[0.0052,-0.4792],[0.0208,-0.4792],[0.0208,-0.4583],[0.0365,-0.4583],[0.0365,-0.4531],[0.0573,-0.4531],[0.0469,-0.4635],[0.0469,-0.474],[0.0677,-0.474],[0.0677,-0.4531],[0.0885,-0.4531],[0.0938,-0.474],[0.1042,-0.474],[0.1042,-0.4792],[0.1146,-0.474],[0.1146,-0.4635],[0.099,-0.4635],[0.099,-0.4531],[0.1146,-0.4531],[0.1146,-0.4583],[0.1354,-0.4583],[0.1354,-0.4531],[0.1771,-0.4583],[0.1823,-0.4531],[0.1927,-0.474],[0.2031,-0.474],[0.2031,-0.4531],[0.2292,-0.4531],[0.2344,-0.474],[0.25,-0.474],[0.25,-0.4583],[0.2656,-0.4583],[0.2656,-0.4531],[0.2812,-0.4531],[0.2812,-0.4479],[0.2917,-0.4479],[0.3021,-0.4583],[0.3177,-0.4531],[0.3177,-0.4427],[0.3385,-0.4375],[0.3438,-0.4219],[0.3542,-0.4219],[0.3594,-0.4115],[0.3698,-0.4167],[0.3698,-0.4323],[0.3854,-0.4323],[0.3802,-0.4271],[0.3854,-0.4115],[0.3698,-0.4167],[0.3646,-0.4062],[0.375,-0.4062],[0.375,-0.401],[0.3906,-0.401],[0.3854,-0.4115],[0.4062,-0.4062],[0.4062,-0.3958],[0.3958,-0.3906],[0.3958,-0.3802],[0.4062,-0.3802],[0.4062,-0.3698],[0.4115,-0.3698],[0.4115,-0.3854],[0.4271,-0.3906],[0.4323,-0.3698],[0.4271,-0.3646],[0.4167,-0.3698],[0.4115,-0.3594],[0.4219,-0.3542],[0.4219,-0.3438],[0.4375,-0.3385],[0.4323,-0.3281],[0.4427,-0.3177],[0.4531,-0.3177],[0.4583,-0.3438],[0.474,-0.3438],[0.474,-0.3229],[0.4531,-0.3177],[0.4583,-0.3125],[0.4531,-0.2969],[0.474,-0.2917],[0.4688,-0.276],[0.4583,-0.276],[0.4583,-0.25],[0.4635,-0.2448],[0.474,-0.25],[0.474,-0.2396],[0.4688,-0.2396],[0.474,-0.2292],[0.4583,-0.2292],[0.4583,-0.2031],[0.474,-0.2031],[0.474,-0.1875],[0.4583,-0.1875],[0.4583,-0.1615],[0.4635,-0.1615],[0.4583,-0.1146],[0.474,-0.1146],[0.474,-0.099],[0.4635,-0.1094],[0.4688,-0.0938],[0.4583,-0.0938],[0.4583,-0.0677],[0.474,-0.0677],[0.474,-0.0521],[0.4583,-0.0469],[0.4583,-0.026],[0.474,-0.0208],[0.474,-0.0052],[0.4583,-0.0052],[0.4583,0.0208],[0.4635,0.0208],[0.4583,0.0677],[0.474,0.0677],[0.474,0.0885],[0.4583,0.0885],[0.4583,0.1146],[0.4688,0.1146],[0.4688,0.1354],[0.4583,0.1354],[0.4583,0.1615],[0.474,0.1615],[0.474,0.1771],[0.4583,0.1823],[0.4583,0.2031],[0.4688,0.2031],[0.4635,0.2188],[0.474,0.2135],[0.474,0.224],[0.4583,0.224],[0.4583,0.25],[0.4792,0.25],[0.4792,0.2552],[0.474,0.2552],[0.474,0.2708],[0.4583,0.2708],[0.4583,0.2552],[0.4531,0.2552],[0.4531,0.2865],[0.4635,0.2969],[0.474,0.2969],[0.474,0.3125],[0.4583,0.3125],[0.4583,0.2969],[0.4479,0.2917],[0.4427,0.3177],[0.4531,0.3177],[0.4479,0.3229],[0.4531,0.3385],[0.4375,0.3385],[0.4375,0.3281],[0.4271,0.3333],[0.4323,0.3542],[0.4115,0.3646],[0.4115,0.3854],[0.3906,0.3854],[0.3854,0.4062],[0.3698,0.4062],[0.3646,0.4271],[0.3438,0.4271],[0.3333,0.4531],[0.3229,0.4531],[0.3229,0.4375],[0.2969,0.4427],[0.2969,0.4531],[0.2708,0.4531],[0.2708,0.474],[0.25,0.474],[0.25,0.4635],[0.2552,0.4635],[0.25,0.4531],[0.2292,0.4531],[0.224,0.474],[0.2135,0.474],[0.2031,0.4531],[0.1823,0.4531],[0.1823,0.474],[0.1615,0.4688],[0.1562,0.4531],[0.1354,0.4531],[0.1302,0.474],[0.1146,0.4688],[0.1146,0.4531],[0.0938,0.4531],[0.0885,0.474],[0.0677,0.474],[0.0677,0.4531],[0.0469,0.4531],[0.0417,0.474],[0.0208,0.4688],[0.026,0.4531],[0.0,0.4531],[-0.0052,0.474],[-0.0208,0.474],[-0.0208,0.4531],[-0.0469,0.4531],[-0.0469,0.474],[-0.0677,0.474],[-0.0625,0.4635],[-0.0729,0.4531],[-0.0938,0.4531],[-0.099,0.474],[-0.1146,0.4688],[-0.1146,0.4531],[-0.1406,0.4531],[-0.1354,0.474],[-0.1562,0.474],[-0.1615,0.4688],[-0.1562,0.4531],[-0.1823,0.4531],[-0.1823,0.474],[-0.2031,0.474],[-0.2031,0.4531],[-0.2292,0.4531],[-0.2292,0.4688]]],"side":"#642a1e"},{"name":"D5 Render","img":"/assets/logos/d5-render.png","shape":[[[-0.0052,0.5],[-0.0104,0.4948],[-0.0781,0.4948],[-0.0781,0.4896],[-0.099,0.4896],[-0.099,0.4844],[-0.1094,0.4896],[-0.1146,0.4792],[-0.1615,0.474],[-0.1615,0.4688],[-0.1771,0.4688],[-0.1927,0.4531],[-0.2135,0.4531],[-0.2135,0.4479],[-0.2344,0.4427],[-0.2448,0.4271],[-0.2708,0.4219],[-0.3021,0.3906],[-0.3177,0.3906],[-0.3177,0.3802],[-0.3802,0.3177],[-0.3906,0.3177],[-0.3906,0.3021],[-0.4219,0.2708],[-0.4271,0.2448],[-0.4427,0.2396],[-0.4583,0.1823],[-0.4688,0.1771],[-0.4688,0.1615],[-0.474,0.1615],[-0.4792,0.1198],[-0.4896,0.1198],[-0.4844,0.0938],[-0.4948,0.0885],[-0.5,-0.0365],[-0.4948,-0.0365],[-0.4948,-0.0885],[-0.4844,-0.0938],[-0.4896,-0.1198],[-0.4792,-0.1198],[-0.474,-0.1615],[-0.4688,-0.1615],[-0.4688,-0.1771],[-0.4583,-0.1823],[-0.4427,-0.2396],[-0.4271,-0.2448],[-0.4271,-0.2604],[-0.4062,-0.2812],[-0.4062,-0.2917],[-0.3906,-0.3021],[-0.3906,-0.3177],[-0.3802,-0.3177],[-0.3177,-0.3802],[-0.3177,-0.3906],[-0.3021,-0.3906],[-0.2708,-0.4219],[-0.2448,-0.4271],[-0.2344,-0.4427],[-0.224,-0.4427],[-0.2135,-0.4531],[-0.1927,-0.4531],[-0.1771,-0.4688],[-0.1406,-0.474],[-0.1406,-0.4792],[-0.1146,-0.4792],[-0.1094,-0.4896],[-0.099,-0.4844],[-0.099,-0.4896],[-0.0781,-0.4896],[-0.0781,-0.4948],[-0.0104,-0.4948],[-0.0104,-0.5],[0.0052,-0.5],[0.0052,-0.4948],[0.0833,-0.4948],[0.0833,-0.4896],[0.099,-0.4896],[0.099,-0.4844],[0.1146,-0.4896],[0.1146,-0.4792],[0.1615,-0.474],[0.1771,-0.4583],[0.2083,-0.4531],[0.2083,-0.4479],[0.2292,-0.4427],[0.2344,-0.4323],[0.2604,-0.4271],[0.2865,-0.401],[0.2969,-0.401],[0.3229,-0.3698],[0.3385,-0.3698],[0.3698,-0.3385],[0.3698,-0.3229],[0.4167,-0.276],[0.4219,-0.25],[0.4375,-0.2448],[0.4375,-0.2292],[0.4531,-0.2083],[0.4531,-0.1927],[0.4635,-0.1927],[0.474,-0.1354],[0.4844,-0.1302],[0.4792,-0.1094],[0.4896,-0.1042],[0.4896,-0.0729],[0.4948,-0.0729],[0.4948,0.0729],[0.4896,0.0729],[0.4896,0.1042],[0.4792,0.1094],[0.4844,0.1302],[0.474,0.1354],[0.4635,0.1927],[0.4531,0.1927],[0.4531,0.2083],[0.4375,0.2292],[0.4375,0.2448],[0.4219,0.25],[0.4167,0.276],[0.3958,0.2917],[0.3958,0.3021],[0.3698,0.3229],[0.3698,0.3385],[0.3385,0.3698],[0.3229,0.3698],[0.2969,0.401],[0.2865,0.401],[0.2604,0.4271],[0.2448,0.4271],[0.2448,0.4323],[0.2344,0.4323],[0.2292,0.4427],[0.2188,0.4427],[0.2083,0.4531],[0.1771,0.4583],[0.1615,0.474],[0.1146,0.4792],[0.1146,0.4896],[0.099,0.4844],[0.099,0.4896],[0.0833,0.4896],[0.0833,0.4948],[0.0052,0.4948],[0.0052,0.5]]],"side":"#44269d"},{"name":"Blender","img":"/assets/logos/blender.png","shape":[[[0.0104,0.4062],[-0.0156,0.3958],[-0.0312,0.3802],[-0.0312,0.3438],[0.0,0.3125],[0.0104,0.3125],[0.0208,0.2969],[0.0312,0.2969],[0.0417,0.2812],[0.0521,0.2812],[0.0625,0.2656],[0.0729,0.2656],[0.1042,0.2292],[-0.3177,0.2292],[-0.3281,0.2135],[-0.3438,0.2083],[-0.3438,0.1979],[-0.3594,0.1823],[-0.3594,0.1615],[-0.3385,0.1354],[-0.3125,0.1302],[-0.3125,0.125],[-0.1198,0.125],[-0.1198,0.1198],[-0.1302,0.1094],[-0.1406,0.1094],[-0.1458,0.099],[-0.1562,0.099],[-0.1771,0.0729],[-0.2031,0.0625],[-0.2135,0.0469],[-0.224,0.0469],[-0.2344,0.0312],[-0.2448,0.0312],[-0.2656,0.0052],[-0.276,0.0052],[-0.2812,-0.0052],[-0.3073,-0.0156],[-0.3229,-0.0365],[-0.3333,-0.0365],[-0.3698,-0.0729],[-0.3802,-0.0729],[-0.4062,-0.099],[-0.4167,-0.099],[-0.4583,-0.1406],[-0.4688,-0.1406],[-0.4896,-0.1615],[-0.4896,-0.1771],[-0.5,-0.1823],[-0.5,-0.224],[-0.4635,-0.2604],[-0.4062,-0.2552],[-0.3802,-0.2292],[-0.3698,-0.2292],[-0.3594,-0.2135],[-0.349,-0.2135],[-0.3385,-0.1979],[-0.3281,-0.1979],[-0.3125,-0.1771],[-0.3021,-0.1771],[-0.2708,-0.1406],[-0.2604,-0.1406],[-0.2448,-0.1198],[-0.2344,-0.1198],[-0.224,-0.1042],[-0.2135,-0.1042],[-0.1979,-0.0885],[-0.1979,-0.1302],[-0.1927,-0.1302],[-0.1927,-0.151],[-0.1875,-0.151],[-0.1771,-0.1979],[-0.1719,-0.1979],[-0.1562,-0.2396],[-0.1354,-0.2604],[-0.1354,-0.2708],[-0.0781,-0.3281],[-0.0677,-0.3281],[-0.0469,-0.349],[-0.0365,-0.349],[-0.0365,-0.3542],[-0.026,-0.3542],[-0.026,-0.3594],[-0.0156,-0.3594],[0.0052,-0.375],[0.0208,-0.375],[0.0312,-0.3854],[0.0469,-0.3854],[0.0469,-0.3906],[0.0781,-0.3906],[0.0781,-0.3958],[0.1094,-0.3958],[0.1094,-0.401],[0.1979,-0.401],[0.1979,-0.3958],[0.224,-0.3958],[0.224,-0.3906],[0.2552,-0.3906],[0.2552,-0.3854],[0.2708,-0.3854],[0.2917,-0.3698],[0.3125,-0.3698],[0.3281,-0.3542],[0.3646,-0.3385],[0.3698,-0.3281],[0.3802,-0.3281],[0.4427,-0.2656],[0.4479,-0.2448],[0.4583,-0.2396],[0.4583,-0.2292],[0.4635,-0.2292],[0.4635,-0.2188],[0.4688,-0.2188],[0.4688,-0.2083],[0.474,-0.2083],[0.474,-0.1979],[0.4896,-0.1771],[0.4896,-0.151],[0.4948,-0.151],[0.4948,-0.125],[0.5,-0.125],[0.5,-0.0469],[0.4948,-0.0469],[0.4896,0.0052],[0.4844,0.0052],[0.4844,0.0208],[0.4688,0.0417],[0.4688,0.0573],[0.4531,0.0677],[0.4479,0.0885],[0.4323,0.099],[0.4323,0.1094],[0.3958,0.1458],[0.3854,0.1458],[0.3698,0.1667],[0.3438,0.1771],[0.3177,0.2083],[0.3073,0.2083],[0.3021,0.2188],[0.276,0.2292],[0.2344,0.2708],[0.224,0.2708],[0.2135,0.2865],[0.1875,0.2969],[0.1458,0.3385],[0.1354,0.3385],[0.125,0.3542],[0.099,0.3646],[0.0677,0.3958],[0.0573,0.3958],[0.0469,0.4062]]],"side":"#80470e"},{"name":"Photoshop","img":"/assets/logos/photoshop.png","shape":[[[-0.3385,0.4896],[-0.3802,0.4792],[-0.3802,0.474],[-0.4115,0.4635],[-0.4167,0.4531],[-0.4271,0.4531],[-0.4635,0.4167],[-0.4635,0.4062],[-0.474,0.401],[-0.474,0.3906],[-0.4896,0.3698],[-0.4896,0.3542],[-0.4948,0.3542],[-0.4948,0.3333],[-0.5,0.3333],[-0.5,-0.3281],[-0.4948,-0.3281],[-0.4896,-0.3646],[-0.4844,-0.3646],[-0.474,-0.3958],[-0.4635,-0.401],[-0.4635,-0.4115],[-0.4271,-0.4479],[-0.4167,-0.4479],[-0.4115,-0.4583],[-0.401,-0.4583],[-0.3802,-0.474],[-0.3646,-0.474],[-0.3646,-0.4792],[-0.3438,-0.4792],[-0.3438,-0.4844],[0.3438,-0.4844],[0.3438,-0.4792],[0.3802,-0.474],[0.3802,-0.4688],[0.4115,-0.4583],[0.4167,-0.4479],[0.4271,-0.4479],[0.4635,-0.4115],[0.4635,-0.401],[0.474,-0.3958],[0.474,-0.3854],[0.4896,-0.3646],[0.4896,-0.349],[0.4948,-0.349],[0.4948,-0.3281],[0.5,-0.3281],[0.5,0.3333],[0.4948,0.3333],[0.4896,0.3698],[0.4844,0.3698],[0.474,0.401],[0.4635,0.4062],[0.4635,0.4167],[0.4271,0.4531],[0.4167,0.4531],[0.4115,0.4635],[0.401,0.4635],[0.3802,0.4792],[0.3646,0.4792],[0.3646,0.4844],[0.3438,0.4844],[0.3438,0.4896]]],"side":"#031d30"},{"name":"Affinity","img":"/assets/logos/affinity.png","shape":[[[-0.3021,0.5],[-0.3542,0.4896],[-0.3542,0.4844],[-0.3958,0.4688],[-0.4167,0.4479],[-0.4271,0.4479],[-0.4479,0.4271],[-0.4583,0.401],[-0.4688,0.3958],[-0.4688,0.3854],[-0.474,0.3854],[-0.474,0.375],[-0.4896,0.3542],[-0.4948,0.3177],[-0.5,0.3177],[-0.4948,0.3125],[-0.5,0.3073],[-0.5,-0.3073],[-0.4948,-0.3073],[-0.5,-0.3177],[-0.4948,-0.3177],[-0.4948,-0.3333],[-0.4896,-0.3333],[-0.4896,-0.3542],[-0.4844,-0.3542],[-0.4688,-0.3958],[-0.4479,-0.4167],[-0.4479,-0.4271],[-0.4271,-0.4479],[-0.401,-0.4583],[-0.3958,-0.4688],[-0.3854,-0.4688],[-0.3854,-0.474],[-0.375,-0.474],[-0.3542,-0.4896],[-0.3073,-0.4948],[-0.3073,-0.5],[0.3073,-0.5],[0.3073,-0.4948],[0.3542,-0.4896],[0.3542,-0.4844],[0.3958,-0.4688],[0.4167,-0.4479],[0.4271,-0.4479],[0.4479,-0.4271],[0.4583,-0.401],[0.4688,-0.3958],[0.4688,-0.3854],[0.474,-0.3854],[0.474,-0.375],[0.4896,-0.3542],[0.4948,-0.3177],[0.5,-0.3177],[0.4948,-0.3125],[0.5,-0.3073],[0.5,0.3073],[0.4948,0.3073],[0.5,0.3177],[0.4948,0.3177],[0.4896,0.3542],[0.4844,0.3542],[0.4688,0.3958],[0.4479,0.4167],[0.4479,0.4271],[0.4271,0.4479],[0.401,0.4583],[0.3958,0.4688],[0.3854,0.4688],[0.3854,0.474],[0.375,0.474],[0.3542,0.4896],[0.3073,0.4948],[0.3073,0.5]]],"side":"#54793a"}];
const TS=.36,TD=.04,RING=1.28;
function rrect(w,r){const h=w/2,sh=new T.Shape();sh.moveTo(-h+r,-h);sh.lineTo(h-r,-h);sh.quadraticCurveTo(h,-h,h,-h+r);sh.lineTo(h,h-r);sh.quadraticCurveTo(h,h,h-r,h);sh.lineTo(-h+r,h);sh.quadraticCurveTo(-h,h,-h,h-r);sh.lineTo(-h,-h+r);sh.quadraticCurveTo(-h,-h,-h+r,-h);return sh;}
function slab(a){
  const sh=a.shape?a.shape.map(r=>new T.Shape(r.map(p=>new T.Vector2(p[0]*TS,p[1]*TS)))):rrect(TS*.86,TS*.2);
  const g=new T.ExtrudeGeometry(sh,{depth:TD,bevelEnabled:false,curveSegments:6});g.translate(0,0,-TD/2);return g;
}
function srcCanvas(a,done){
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
  if(a.img){const im=new Image();im.onload=()=>{g.drawImage(im,0,0,256,256);done(c);};im.src=a.img;return;}
  g.fillStyle=a.bg;g.beginPath();g.roundRect?g.roundRect(18,18,220,220,44):g.rect(18,18,220,220);g.fill();
  g.fillStyle=a.fg;g.textAlign='center';g.textBaseline='middle';g.font='800 140px "Be Vietnam Pro",sans-serif';g.fillText(a.t,128,136);setTimeout(()=>done(c));
}
function lineCanvas(src){
  // 2D look: colour edges of the artwork become ink lines on paper, like a drawing
  const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.drawImage(src,0,0);
  const d=g.getImageData(0,0,256,256),px=d.data,L=new Float32Array(65536),A=new Uint8Array(65536);
  for(let k=0;k<65536;k++){A[k]=px[k*4+3];L[k]=(.2126*px[k*4]+.7152*px[k*4+1]+.0722*px[k*4+2])/255*(A[k]/255)+(1-A[k]/255);}
  const ink=new T.Color(tok('--ink')),pap=new T.Color(tok('--surface'));
  for(let y=1;y<255;y++)for(let x=1;x<255;x++){
    const k=y*256+x;
    const gx=L[k-255]+2*L[k+1]+L[k+257]-L[k-257]-2*L[k-1]-L[k+255],gy=L[k+255]+2*L[k+256]+L[k+257]-L[k-257]-2*L[k-256]-L[k-255];
    const e=Math.hypot(gx,gy)>.55,cc=e?ink:pap,o=k*4;
    px[o]=cc.r*255;px[o+1]=cc.g*255;px[o+2]=cc.b*255;px[o+3]=A[k]>20||e?255:0;
  }
  g.putImageData(d,0,0);return c;
}
function texOf(c){const tx=new T.CanvasTexture(c);tx.repeat.set(1/TS,1/TS);tx.offset.set(.5,.5);tx.anisotropy=4;return tx;}
const tiles=APPS.map((a,i)=>{
  // front arc facing the default camera, so every logo stays visible below the cube
  const ang=Math.PI/4+i/APPS.length*Math.PI*2;
  const geo=slab(a);
  const m=new T.Mesh(geo,[new T.MeshBasicMaterial({transparent:true,opacity:0}),new T.MeshBasicMaterial({transparent:true,opacity:0})]);
  m.position.set(Math.sin(ang)*RING,TS/2+.03,Math.cos(ang)*RING);m.castShadow=true;
  const e=new T.LineSegments(new T.EdgesGeometry(geo,30),new T.LineBasicMaterial());m.add(e);
  scene.add(m);
  const o={m,e,a,ang,src:null,tx:null,lx:null};
  srcCanvas(a,c=>{o.src=c;tileTextures();applyTheme();});
  return o;
});
function tileTextures(){tiles.forEach(o=>{if(!o.src)return;if(o.tx)o.tx.dispose();if(o.lx)o.lx.dispose();o.tx=texOf(o.src);o.lx=texOf(lineCanvas(o.src));});}

// ---- ground, grid, axes
const ground=new T.Mesh(new T.PlaneGeometry(8,8),new T.ShadowMaterial({opacity:.22}));
ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
let grid=null;
const axes=new T.Group();scene.add(axes);
[[[1.4,0,0],'--axis-x'],[[0,0,1.4],'--axis-y'],[[0,1.75,0],'--axis-z']].forEach(([p,v])=>{
  const g=new T.BufferGeometry().setFromPoints([new T.Vector3(-.5,0,-.5),new T.Vector3(p[0]-.5,p[1],p[2]-.5)]);
  const l=new T.Line(g,new T.LineDashedMaterial({dashSize:.05,gapSize:.035}));l.computeLineDistances();l.userData.v=v;axes.add(l);
});

// ---- lights: sun fixed in the world, so shadows stay put while the camera orbits
const hemi=new T.HemisphereLight(0xffffff,0x8a8f99,.55);scene.add(hemi);
const sun=new T.DirectionalLight(0xffffff,1.05);
sun.position.set(-2.2,4.2,2.8);sun.target.position.set(0,0,0);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-.0006;sun.shadow.radius=3;
Object.assign(sun.shadow.camera,{left:-2.4,right:2.4,top:2.4,bottom:-2.4,near:.5,far:12});
scene.add(sun,sun.target);

// ---- render studio (only in Render mode)
function cnv(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);return c;}
const envTex=new T.CanvasTexture(cnv(512,256,(g,w,h)=>{
  const bg=g.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#2a2d36');bg.addColorStop(.5,'#101116');bg.addColorStop(1,'#060709');g.fillStyle=bg;g.fillRect(0,0,w,h);
  const box=(x,y,bw,bh,c,b)=>{g.filter=`blur(${b}px)`;g.fillStyle=c;g.fillRect(x,y,bw,bh);};
  box(60,18,150,40,'#ffffff',6);box(300,24,120,30,'#f3f5ff',6);   // overhead softboxes
  box(0,70,40,110,'#ff7a3d',10);box(470,80,42,90,'#7fa8ff',12);    // warm + cool strips
  box(200,95,90,16,'#ffd9c2',5);g.filter='none';
}));
envTex.mapping=T.EquirectangularReflectionMapping;
let envMap=null;try{const pm=new T.PMREMGenerator(renderer);envMap=pm.fromEquirectangular(envTex).texture;pm.dispose();}catch(_){}
const fx=new T.Group();scene.add(fx);
const radial=(stops)=>new T.CanvasTexture(cnv(256,256,(g,w)=>{const r=g.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);stops.forEach(([o,c])=>r.addColorStop(o,c));g.fillStyle=r;g.fillRect(0,0,w,w);}));
const floor=new T.Mesh(new T.CircleGeometry(3.4,72),new T.MeshStandardMaterial({color:0x0d0e12,roughness:.5,metalness:.5,transparent:true,
  alphaMap:radial([[0,'#fff'],[.55,'#fff'],[1,'#000']])}));
floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;fx.add(floor);
const glowMat=new T.MeshBasicMaterial({map:radial([[0,'rgba(255,255,255,1)'],[.35,'rgba(255,255,255,.35)'],[1,'rgba(255,255,255,0)']]),transparent:true,blending:T.AdditiveBlending,depthWrite:false,opacity:.5,toneMapped:false});
const glow=new T.Mesh(new T.PlaneGeometry(3.2,3.2),glowMat);glow.rotation.x=-Math.PI/2;glow.position.y=.003;fx.add(glow);
const trackMat=new T.MeshBasicMaterial({transparent:true,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false});
[[RING,.007,.9],[RING+.5,.004,.35],[.95,.004,.5]].forEach(([r,w,o])=>{const m=new T.Mesh(new T.RingGeometry(r-w,r+w,128),trackMat.clone());m.material.opacity=o;m.rotation.x=-Math.PI/2;m.position.y=.006;fx.add(m);});
const NP=RM?0:150,pp=new Float32Array(NP*3),pv=new Float32Array(NP);
for(let k=0;k<NP;k++){const a=Math.random()*Math.PI*2,r=.5+Math.random()*1.9;pp[k*3]=Math.cos(a)*r;pp[k*3+1]=Math.random()*2.4;pp[k*3+2]=Math.sin(a)*r;pv[k]=.0015+Math.random()*.004;}
const pGeo=new T.BufferGeometry();pGeo.setAttribute('position',new T.BufferAttribute(pp,3));
const dots=new T.Points(pGeo,new T.PointsMaterial({size:.045,map:radial([[0,'rgba(255,255,255,1)'],[.4,'rgba(255,255,255,.5)'],[1,'rgba(255,255,255,0)']]),transparent:true,blending:T.AdditiveBlending,depthWrite:false,opacity:.85,toneMapped:false}));
fx.add(dots);
const rim=new T.DirectionalLight(0xffd6bf,1.1);rim.position.set(2.5,2.6,-3.2);
const fill=new T.DirectionalLight(0x8fb2ff,.45);fill.position.set(-3.5,1.2,-1);
const roam=new T.PointLight(0xff6a2b,1.4,4.5,2);
fx.add(rim,fill,roam);

// ---- dimensions (DIM): extension lines, dimension line, oblique ticks, HTML label
const dims=new T.Group();scene.add(dims);
const labels=[];
const dimLayer=$('#dimLayer');
function dim(a,b,off,txt){
  a=new T.Vector3(...a);b=new T.Vector3(...b);off=new T.Vector3(...off);
  const a2=a.clone().add(off),b2=b.clone().add(off),dir=b2.clone().sub(a2).normalize(),n=off.clone().normalize();
  const ext=.035,tk=.03,pts=[];
  pts.push(a.clone().add(n.clone().multiplyScalar(.03)),a2.clone().add(n.clone().multiplyScalar(ext)));
  pts.push(b.clone().add(n.clone().multiplyScalar(.03)),b2.clone().add(n.clone().multiplyScalar(ext)));
  pts.push(a2.clone().sub(dir.clone().multiplyScalar(.04)),b2.clone().add(dir.clone().multiplyScalar(.04)));
  const t=dir.clone().add(n).normalize().multiplyScalar(tk);
  [a2,b2].forEach(p=>pts.push(p.clone().sub(t),p.clone().add(t)));
  dims.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial()));
  const el=document.createElement('span');el.className='dim-label';el.textContent=txt;dimLayer.appendChild(el);
  labels.push({el,p:a2.clone().add(b2).multiplyScalar(.5)});
}
const X1=LOGO.xmax-.5;
dim([-.5,0,.5],[X1,0,.5],[0,0,.32],String(Math.round((LOGO.xmax)*MM)));
dim([.5,0,.5],[.5,0,-.5],[.32,0,0],String(MM));
dim([-.5,0,.5],[-.5,H,.5],[-.24,0,.24],String(Math.round(H*MM)));
dim([-.5,H,-.5],[-.5,H,-.5+D],[-.26,0,0],String(Math.round(D*MM)));

// ---- modes & theme
let mode='render';
function tok(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim()||'#888';}
function applyTheme(){
  const ink=new T.Color(tok('--ink')),surf=new T.Color(tok('--surface')),line=new T.Color(tok('--line')),acc=new T.Color(tok('--accent'));
  const dark=surf.getHSL({}).l<.4;
  if(grid)scene.remove(grid);
  grid=new T.GridHelper(4,20,line,line);grid.position.y=-.0005;grid.material.transparent=true;grid.material.opacity=mode==='render'?.55:1;scene.add(grid);
  axes.children.forEach(l=>{l.material.color.set(tok(l.userData.v));});
  dims.children.forEach(l=>l.material.color.copy(acc));
  ground.material.opacity=dark?.5:.22;
  parts.forEach(({m,e})=>{
    m.material.forEach(x=>x.dispose());
    if(mode==='plan'){
      const b=new T.MeshBasicMaterial({color:surf,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
      m.material=[b,b];e.material.color.copy(ink);e.material.opacity=1;e.material.transparent=false;e.visible=true;
    }else if(mode==='wire'){
      // solid grey faces, sides a shade deeper; orange outlines tie it to the brand
      const po={polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1};
      const glass=new T.MeshStandardMaterial({color:dark?0x9AA2B2:0x8C93A1,roughness:.5,metalness:0,...po});
      const sideM=new T.MeshStandardMaterial({color:dark?0x6F7787:0x5F6675,roughness:.5,...po});
      m.material=[glass,sideM];e.material.color.copy(acc);e.material.transparent=true;e.material.opacity=.95;e.visible=true;
    }else{
      const cap=new T.MeshPhysicalMaterial({color:0x1b1d23,roughness:.18,metalness:.6,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.6});
      const side=new T.MeshPhysicalMaterial({color:acc,roughness:.3,metalness:.1,clearcoat:.6,clearcoatRoughness:.25,emissive:acc,emissiveIntensity:.3,toneMapped:false});
      m.material=[cap,side];e.visible=false;
    }
  });
  tiles.forEach(o=>{
    if(!o.tx)return;
    o.m.material.forEach(x=>x.dispose());
    const po={polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1};
    if(mode==='plan'){
      o.m.material=[new T.MeshBasicMaterial({map:o.lx,...po}),new T.MeshBasicMaterial({color:surf,...po})];
      o.e.material.color.copy(ink);o.e.visible=true;
    }else{
      o.m.material=[new T.MeshBasicMaterial({map:o.tx,toneMapped:false,...po}),new T.MeshStandardMaterial({color:new T.Color(o.a.side),roughness:.35,metalness:.2,...po})];
      o.e.visible=mode==='wire'||(dark&&mode!=='render');o.e.material.color.copy(mode==='wire'?acc:line);
    }
  });
  dims.visible=false;dimLayer.hidden=true;
  axes.visible=mode==='wire';
  const R=mode==='render';
  ground.visible=false;grid.visible=!R;fx.visible=R;
  scene.environment=R?envMap:null;
  renderer.toneMapping=R?T.ACESFilmicToneMapping:T.NoToneMapping;
  glowMat.color.copy(acc);roam.color.copy(acc);dots.material.color.copy(acc).lerp(new T.Color(0xffffff),.35);
  fx.children.forEach(c=>{if(c.geometry&&c.geometry.type==='RingGeometry')c.material.color.copy(acc);});
  sun.intensity=R?1.25:.8;hemi.intensity=R?.25:.9;
  if(vpEl)vpEl.classList.toggle('is-render',R);
}
applyTheme();
new MutationObserver(()=>{tileTextures();applyTheme();}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{tileTextures();applyTheme();});}catch(_){}
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{tileTextures();applyTheme();});

// ---- camera orbit (isometric start)
let az=RM?Math.PI/4:Math.PI/4-1.5,el=Math.atan(1/Math.SQRT2),drag=null,spin=!RM,t=0,ringRot=0;
const T0=performance.now()/1000;
const ease=x=>1-Math.pow(1-Math.max(0,Math.min(1,x)),3);
const back=x=>{x=Math.max(0,Math.min(1,x));const c=1.7;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2);};
function place(){
  const w=cv.clientWidth,h=cv.clientHeight;
  if(!w||!h)return;
  renderer.setSize(w,h,false);
  const half=1.55,asp=w/h;
  if(asp>=1){cam.left=-half*asp;cam.right=half*asp;cam.top=half;cam.bottom=-half;}
  else{cam.left=-half;cam.right=half;cam.top=half/asp;cam.bottom=-half/asp;}
  cam.updateProjectionMatrix();
  persp.aspect=asp;persp.updateProjectionMatrix();
  camR=1.62*(asp>=1?1:1/asp)/Math.tan(persp.fov*Math.PI/360);
}
function frame(){
  if(!drag&&spin){t+=.01;az+=(Math.PI/4+Math.sin(t)*.45-az)*.04;}
  const now=performance.now()/1000,age=now-T0,R=mode==='render';
  if(spin&&!drag)ringRot+=.0022;
  // intro: logo pieces drop in one after another, logos pop out around it
  parts.forEach(({m},i)=>{m.position.y=m.userData.y0+(RM?0:(1-ease((age-.15-i*.11)/.9))*1.6);});
  group.position.y=R&&!RM?Math.sin(now*1.2)*.035+.03:0;
  tiles.forEach((o,i)=>{
    const a=o.ang+ringRot,s=RM?1:Math.max(.001,back((age-.7-i*.07)/.6));
    o.m.position.set(Math.sin(a)*RING,TS/2+.03+(RM?0:Math.sin(now*1.4+i*.8)*.03),Math.cos(a)*RING);
    o.m.scale.setScalar(s);o.m.rotation.y=az;
  });
  if(R&&!RM){
    roam.position.set(Math.sin(now*.7)*1.7,1.25,Math.cos(now*.7)*1.7);
    for(let k=0;k<NP;k++){pp[k*3+1]+=pv[k];if(pp[k*3+1]>2.4)pp[k*3+1]=0;}
    pGeo.attributes.position.needsUpdate=true;dots.rotation.y=now*.03;
    glowMat.opacity=.42+Math.sin(now*1.6)*.08;
  }
  const C=R?persp:cam,r=R?camR:6;
  C.position.set(target.x+r*Math.cos(el)*Math.sin(az),target.y+r*Math.sin(el),target.z+r*Math.cos(el)*Math.cos(az));
  C.lookAt(target);
  if(cv.width!==Math.round(cv.clientWidth*renderer.getPixelRatio()))place();
  renderer.render(scene,C);
  if(mode==='plan'){
    const w=cv.clientWidth,h=cv.clientHeight;
    labels.forEach(({el,p})=>{const v=p.clone().project(cam);el.style.transform=`translate(${(v.x*.5+.5)*w}px,${(-v.y*.5+.5)*h}px) translate(-50%,-50%)`;});
  }
  requestAnimationFrame(frame);
}
place();frame();
addEventListener('resize',place);
cv.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY,az,el];cv.setPointerCapture(e.pointerId);cv.style.cursor='grabbing';});
cv.addEventListener('pointermove',e=>{if(!drag)return;az=drag[2]-(e.clientX-drag[0])*.008;el=Math.max(.02,Math.min(1.45,drag[3]+(e.clientY-drag[1])*.008));});
cv.addEventListener('pointerup',()=>{drag=null;cv.style.cursor='grab';t=Math.asin(Math.max(-1,Math.min(1,(az-Math.PI/4)/.45)))||0;});
document.querySelectorAll('.tool').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.mode==='spin'){spin=!spin;b.textContent='Tự xoay: '+(spin?'Bật':'Tắt');b.classList.toggle('on',spin);return;}
  document.querySelectorAll('.tool[data-mode]:not(#spinBtn)').forEach(x=>x.classList.remove('on'));b.classList.add('on');mode=b.dataset.mode;applyTheme();
}));
if(spin)$('#spinBtn').classList.add('on');
})();
})();
