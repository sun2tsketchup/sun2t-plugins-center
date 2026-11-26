(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const isColor=c=>/^#[0-9a-f]{3,8}$/i.test(String(c||''));
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const fmtDate=s=>{const d=new Date(s+'T00:00:00');return isNaN(d)?(s||''):d.toLocaleDateString('vi-VN');};
const PALETTE=['#FF5B24','#F2A900','#E5383B','#2B59FF','#1FA463','#8E44D9','#0FA3A3','#14161C'];

let ST=null;        // content from the server
let dirty=false;    // unsaved edits in the current form
let quill=null;

/* ---------------- api ---------------- */
async function api(method,url,body,form){
  const opt={method,headers:{'X-Betagon':'1'},credentials:'same-origin'};
  if(form)opt.body=form;else if(body!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body);}
  let r;
  try{r=await fetch(url,opt);}catch(_){throw new Error('Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');}
  const j=await r.json().catch(()=>({}));
  if(r.status===401&&!url.endsWith('/login')){showGate('login');throw new Error(j.error||'Cần đăng nhập lại.');}
  if(r.status===403&&j.mustChange){showGate('pwd');throw new Error(j.error);}
  if(!r.ok)throw new Error(j.error||'Có lỗi xảy ra.');
  return j;
}
let toastT;
function toast(msg,bad){const t=$('#toast');t.textContent=msg;t.className='toast'+(bad?' bad':'');t.hidden=false;clearTimeout(toastT);toastT=setTimeout(()=>t.hidden=true,bad?5000:2600);}

/* ---------------- gate ---------------- */
function showGate(which){
  $('#app').hidden=true;$('#gate').hidden=false;
  $('#loginForm').hidden=which!=='login';$('#firstPwdForm').hidden=which!=='pwd';
  setTimeout(()=>{const f=which==='login'?$('#loginForm [name=password]'):$('#firstPwdForm [name=current]');f&&f.focus();},30);
}
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target,err=$('#loginErr'),b=f.querySelector('button');
  err.hidden=true;b.disabled=true;b.textContent='Đang đăng nhập...';
  try{
    const r=await api('POST','/api/login',{username:f.username.value,password:f.password.value});
    f.password.value='';
    if(r.mustChange)return showGate('pwd');
    await boot();
  }catch(x){err.textContent=x.message;err.hidden=false;}
  finally{b.disabled=false;b.textContent='Đăng nhập';}
});
$('#firstPwdForm').addEventListener('submit',async e=>{
  e.preventDefault();const f=e.target,err=$('#firstPwdErr');err.hidden=true;
  if(f.next.value!==f.again.value){err.textContent='Hai mật khẩu mới chưa khớp nhau.';err.hidden=false;return;}
  try{await api('POST','/api/admin/password',{current:f.current.value,next:f.next.value});f.reset();toast('Đã đổi mật khẩu.');await boot();}
  catch(x){err.textContent=x.message;err.hidden=false;}
});

/* ---------------- shell ---------------- */
const NAV=[
  {id:'dashboard',l:'Tổng quan',i:'◎'},
  {grp:'Nội dung'},
  {id:'home',l:'Trang chủ',i:'⌂'},
  {id:'c/banners',l:'Ảnh trình chiếu',i:'▭'},
  {id:'c/posts',l:'Bài viết',i:'✎'},
  {id:'c/courses',l:'Khóa học',i:'▦'},
  {id:'c/schedule',l:'Lịch khai giảng',i:'◷'},
  {id:'c/works',l:'Sản phẩm khóa học',i:'◇'},
  {id:'c/testimonials',l:'Feedback',i:'❝'},
  {id:'c/library',l:'Thư viện',i:'▤'},
  {id:'c/faqs',l:'Hỏi đáp',i:'?'},
  {grp:'Học viên'},
  {id:'regs',l:'Đăng ký học viên',i:'☎',badge:true},
  {grp:'Hệ thống'},
  {id:'settings',l:'Cài đặt website',i:'⚙'},
  {id:'account',l:'Tài khoản',i:'◉'},
];
function drawNav(cur){
  $('#nav').innerHTML=NAV.map(n=>n.grp?`<div class="grp">${n.grp}</div>`:
    `<a href="#/${n.id}" class="${cur===n.id||cur.startsWith(n.id+'/')?'on':''}"><span aria-hidden="true">${n.i}</span>${n.l}${n.badge&&ST.newRegs?`<span class="n">${ST.newRegs}</span>`:''}</a>`).join('');
}
function setTop(title,actions){$('#viewTitle').textContent=title;$('#topAct').innerHTML='';(actions||[]).forEach(a=>$('#topAct').appendChild(a));document.title=title+' · Quản trị Betagon';}
function btn(label,cls,fn,attrs){const b=document.createElement(attrs&&attrs.href?'a':'button');b.className='btn '+(cls||'');b.innerHTML=label;if(attrs)Object.entries(attrs).forEach(([k,v])=>b.setAttribute(k,v));if(fn)b.addEventListener('click',fn);if(!attrs||!attrs.href)b.type='button';return b;}
$('#burger').addEventListener('click',()=>$('#side').classList.toggle('open'));
$('#nav').addEventListener('click',e=>{if(e.target.closest('a'))$('#side').classList.remove('open');});
$('#logoutBtn').addEventListener('click',async()=>{try{await api('POST','/api/logout',{});}catch(_){}ST=null;showGate('login');});
addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
let lastHash=location.hash;
addEventListener('hashchange',()=>{
  if(dirty&&!confirm('Bạn có thay đổi chưa lưu. Rời trang này?')){history.replaceState(null,'',lastHash);return;}
  dirty=false;route();
});

async function boot(){
  ST=await api('GET','/api/admin/content');
  $('#gate').hidden=true;$('#app').hidden=false;
  route();
}
function route(){
  lastHash=location.hash;
  const h=location.hash.replace(/^#\/?/,'')||'dashboard';
  const p=h.split('/');
  quill=null;dirty=false;
  drawNav(h);
  window.scrollTo(0,0);
  if(p[0]==='c'&&ST.schema[p[1]]){p[2]!=null?editItem(p[1],p[2]):listView(p[1]);}
  else if(p[0]==='regs')regsView();
  else if(p[0]==='settings')settingsView('');
  else if(p[0]==='home')settingsView('home');
  else if(p[0]==='account')accountView();
  else dashboard();
}
const go=h=>{if(location.hash==='#/'+h)route();else location.hash='#/'+h;};

/* ---------------- dashboard ---------------- */
async function dashboard(){
  const d=ST.data,now=today();
  const upcoming=d.schedule.filter(r=>r.date>=now).sort((a,b)=>a.date.localeCompare(b.date));
  setTop('Tổng quan',[btn('+ Viết bài mới','primary',()=>go('c/posts/new'))]);
  $('#view').innerHTML=`
  <div class="grid-stats">
    <a class="kpi hot" href="#/regs"><b>${ST.newRegs}</b><span>đăng ký mới chưa xử lý</span></a>
    <a class="kpi" href="#/c/posts"><b>${d.posts.filter(p=>p.published).length}</b><span>bài viết đang hiển thị</span></a>
    <a class="kpi" href="#/c/courses"><b>${d.courses.length}</b><span>khóa học</span></a>
    <a class="kpi" href="#/c/schedule"><b>${upcoming.length}</b><span>lớp sắp khai giảng</span></a>
  </div>
  <div class="card" id="dImport" hidden></div>
  <div class="card"><h2>Đăng ký mới nhất</h2><p class="muted">Học viên gửi từ form "Đăng ký khóa học" trên website.</p><div id="dRegs" class="list"><div class="empty">Đang tải...</div></div></div>
  <div class="card"><h2>Lớp sắp khai giảng</h2><p class="muted">Lớp đã qua ngày khai giảng sẽ tự ẩn khỏi website.</p>
    <div class="list">${upcoming.slice(0,5).map(r=>{const c=d.courses.find(x=>x.id===r.course);return `<div class="row"><span class="th" style="background:${esc(c&&isColor(c.c1)?c.c1:'#888')}">${esc(c?c.g:'')}</span><div class="tx"><b>${esc(c?c.name:r.course)}</b><span>${fmtDate(r.date)} · ${esc(r.time)} · ${esc(r.hour)} · ${esc(r.mode)}</span></div><div class="acts"></div></div>`;}).join('')||'<div class="empty">Chưa có lớp nào sắp khai giảng.</div>'}</div></div>`;
  importCard();
  try{
    const {items}=await api('GET','/api/admin/registrations');
    $('#dRegs').innerHTML=items.slice(0,5).map(r=>`<div class="row"><span class="th" style="background:var(--ink)">${esc(initials(r.name))}</span><div class="tx"><b>${esc(r.name)} · <a href="tel:${esc(r.phone)}" style="color:var(--accent);text-decoration:none">${esc(r.phone)}</a>${r.status==='new'?'<span class="pill new">Mới</span>':''}</b><span>${esc(r.courseName)} · ${new Date(r.at).toLocaleString('vi-VN')}</span></div><div class="acts"></div></div>`).join('')||'<div class="empty">Chưa có đăng ký nào.</div>';
  }catch(x){$('#dRegs').innerHTML=`<div class="empty">${esc(x.message)}</div>`;}
}
// progress of copying works and images from the old website (Cloudflare version only)
async function importCard(){
  const box=$('#dImport');if(!box)return;
  let st;try{st=await api('GET','/api/admin/import');}catch(_){return;}
  if(!st.pagesLeft&&!st.imagesLeft){box.hidden=true;return;}
  box.hidden=false;
  box.innerHTML=`<h2>Đang chép ảnh từ web cũ</h2><p class="muted" id="impTxt">Còn ${st.pagesLeft} trang tác phẩm và ${st.imagesLeft} ảnh. Web tự chép mỗi phút. Bấm "Chép liên tục" và để mở trang này để chép nhanh hơn. Chỉ đổi tên miền sau khi chép xong.</p><div><button class="btn primary" id="impNow">Chép liên tục</button></div>`;
  $('#impNow').onclick=async e=>{
    const b=e.target;if(b.dataset.run){b.dataset.run='';b.textContent='Chép liên tục';return;}
    b.dataset.run='1';b.textContent='Dừng';
    let fails=0;
    while(b.dataset.run&&document.body.contains(b)){
      try{
        const r=await api('POST','/api/admin/import');fails=0;
        const s=await api('GET','/api/admin/import');
        $('#impTxt').textContent=`Đang chép... còn ${s.pagesLeft} trang tác phẩm và ${s.imagesLeft} ảnh. Giữ trang này mở.`;
        if(r.done||(!s.pagesLeft&&!s.imagesLeft)){ST=await api('GET','/api/admin/content');toast('Đã chép xong ảnh từ web cũ.');route();return;}
      }catch(x){if(++fails>=5){toast(x.message,true);break;}await new Promise(r=>setTimeout(r,3000));}
    }
    if(document.body.contains(b)){b.dataset.run='';b.textContent='Chép liên tục';}
  };
}
const initials=n=>String(n||'').trim().split(/\s+/).slice(-2).map(w=>w[0]).join('').toUpperCase();

/* ---------------- collections ---------------- */
const fill=(tpl,o)=>String(tpl||'').replace(/{(\w+)}/g,(_,k)=>o[k]==null?'':o[k]).replace(/^[\s·đ]+|[\s·]+$/g,'').replace(/(\s·\s)+/g,' · ');
function itemTitle(name,o){const sc=ST.schema[name];let t=sc.title.includes('{')?fill(sc.title,o):o[sc.title];if(name==='schedule')t=fmtDate(o.date);return t||'(chưa có tên)';}
function itemSub(name,o){
  const sc=ST.schema[name];if(!sc.sub)return '';
  const x={...o};
  if(name==='schedule'){const c=ST.data.courses.find(c=>c.id===o.course);x.course=c?c.name:o.course;}
  if(name==='posts')x.date=fmtDate(o.date);
  if(name==='courses'&&!o.price)x.price='Liên hệ';
  return fill(sc.sub,x).replace('Liên hệđ','Liên hệ');
}
function thumb(name,o){
  const img=o.image||o.cover;
  if(img)return `<span class="th" style="background-image:url('${esc(img)}')"></span>`;
  if(name==='schedule'){const c=ST.data.courses.find(c=>c.id===o.course)||{};return `<span class="th" style="background:${esc(isColor(c.c1)?c.c1:'#888')}">${esc(c.g||'')}</span>`;}
  const c1=isColor(o.c1)?o.c1:isColor(o.c)?o.c:'#5B6070',c2=isColor(o.c2)?o.c2:c1;
  const g=o.g||o.ico||(name==='testimonials'?initials(o.n):name==='faqs'?'?':'');
  return `<span class="th" style="background:linear-gradient(135deg,${c1},${c2})">${esc(g)}</span>`;
}
const SORTED_BY_DATE={posts:1,schedule:1};
const LIST_FILTER={}; // remembered software filter per collection
const swList=o=>String(o.sw||'').split(',').map(x=>x.trim()).filter(Boolean);
function listView(name){
  const sc=ST.schema[name],canSort=!SORTED_BY_DATE[name],hasSw=name==='works';
  let work=ST.data[name].slice(),sorting=false,dragEl=null;
  const filt=()=>LIST_FILTER[name]||'all';
  const visible=()=>work.map((o,i)=>[o,i]).filter(([o])=>filt()==='all'||swList(o).includes(filt()));
  function top(){
    if(sorting)setTop(sc.label,[btn('Hủy','',()=>{work=ST.data[name].slice();sorting=false;dirty=false;render();}),btn('Lưu thứ tự','primary',save)]);
    else setTop(sc.label,[...(canSort&&work.length>1?[btn('⇅ Sắp xếp','',()=>{sorting=true;render();})]:[]),btn('+ Thêm mới','primary',()=>go(`c/${name}/new`))]);
  }
  async function save(e){
    const b=e.currentTarget;b.disabled=true;b.textContent='Đang lưu...';
    try{await saveCollection(name,work);dirty=false;sorting=false;work=ST.data[name].slice();toast('Đã lưu thứ tự.');render();}
    catch(x){toast(x.message,true);b.disabled=false;b.textContent='Lưu thứ tự';}
  }
  // put the visible items back into the slots they occupy in the full list, in their new order
  function applyVisibleOrder(newIdx){
    const slots=visible().map(([,i])=>i),copy=work.slice();
    slots.forEach((p,k)=>{work[p]=copy[newIdx[k]];});
    dirty=true;
  }
  function render(){
    top();
    const order=SORTED_BY_DATE[name]?work.map((o,i)=>[o,i]).sort((a,b)=>String(b[0].date).localeCompare(String(a[0].date))*(name==='schedule'?-1:1)):visible();
    const sws=hasSw?[...new Set(ST.data[name].flatMap(swList))]:[];
    $('#view').innerHTML=`${sc.help?`<p class="hint">${esc(sc.help)}</p>`:''}
    ${name==='posts'?'<p class="hint">Bài viết hiện trên website theo ngày đăng, mới nhất trước. Bài ở trạng thái "Bản nháp" sẽ không hiển thị.</p>':''}
    ${sorting?'<p class="hint sort-hint">Kéo thả từng dòng (giữ biểu tượng ⠿), hoặc dùng các nút ⤒ ↑ ↓ để đổi chỗ. Xong bấm <b>Lưu thứ tự</b> ở góc trên.</p>':''}
    ${sws.length>1?`<div class="filters list-filters">${['all',...sws].map(x=>`<button type="button" class="chip" data-f="${esc(x)}" aria-pressed="${filt()===x}">${x==='all'?'Tất cả':esc(x)} <small>${x==='all'?work.length:work.filter(o=>swList(o).includes(x)).length}</small></button>`).join('')}</div>`:''}
    <div class="list${sorting?' sorting':''}" id="list">${order.map(([o,i],k)=>`<div class="row" data-i="${i}"${sorting?' draggable="true"':''}>
      ${sorting?'<span class="grip" aria-hidden="true">⠿</span>':thumb(name,o)}
      <div class="tx"${sorting?'':` data-edit="${i}"`}><b>${esc(itemTitle(name,o))}${sc.flag?(o[sc.flag]?'<span class="pill on">Đã đăng</span>':'<span class="pill">Bản nháp</span>'):''}</b><span>${esc(itemSub(name,o))}</span></div>
      <div class="acts">${sorting?`<button class="btn sm icon" data-mv="top" aria-label="Lên đầu" ${k===0?'disabled':''}>⤒</button><button class="btn sm icon" data-mv="-1" aria-label="Lên trên" ${k===0?'disabled':''}>↑</button><button class="btn sm icon" data-mv="1" aria-label="Xuống dưới" ${k===order.length-1?'disabled':''}>↓</button>`
        :`<button class="btn sm" data-edit="${i}">Sửa</button>`}</div></div>`).join('')||'<div class="empty">Chưa có mục nào'+(filt()!=='all'?' thuộc '+esc(filt()):'')+'.</div>'}</div>`;
    const list=$('#list');
    document.querySelectorAll('.list-filters [data-f]').forEach(c=>c.addEventListener('click',()=>{LIST_FILTER[name]=c.dataset.f;render();}));
    list.addEventListener('click',e=>{
      const ed=e.target.closest('[data-edit]');if(ed&&!sorting)return go(`c/${name}/${ed.dataset.edit}`);
      const mv=e.target.closest('[data-mv]');if(!mv)return;
      const ids=[...list.querySelectorAll('.row')].map(r=>+r.dataset.i),k=ids.indexOf(+mv.closest('.row').dataset.i);
      const [it]=ids.splice(k,1);
      if(mv.dataset.mv==='top')ids.unshift(it);else ids.splice(k+ +mv.dataset.mv,0,it);
      applyVisibleOrder(ids);render();
    });
    if(!sorting)return;
    list.addEventListener('dragstart',e=>{dragEl=e.target.closest('.row');if(!dragEl)return;dragEl.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','');});
    list.addEventListener('dragover',e=>{
      if(!dragEl)return;e.preventDefault();
      const over=e.target.closest('.row');if(!over||over===dragEl)return;
      const r=over.getBoundingClientRect();
      list.insertBefore(dragEl,e.clientY>r.top+r.height/2?over.nextSibling:over);
    });
    list.addEventListener('drop',e=>e.preventDefault());
    list.addEventListener('dragend',()=>{
      if(!dragEl)return;dragEl.classList.remove('dragging');dragEl=null;
      applyVisibleOrder([...list.querySelectorAll('.row')].map(r=>+r.dataset.i));render();
    });
  }
  render();
}
async function saveCollection(name,items){
  const r=await api('PUT','/api/admin/collection/'+name,{rev:ST.rev,items});
  ST.rev=r.rev;ST.data[name]=r.items;if(r.schedule)ST.data.schedule=r.schedule;
  return r;
}
function newItem(name){
  const o={};const col=PALETTE[Math.floor(Math.random()*PALETTE.length)];
  ST.schema[name].fields.forEach(f=>{
    o[f.k]=f.t==='select'?f.opts[0][0]:f.t==='bool'?(name==='posts'?false:false):f.t==='date'?(name==='posts'?today():''):f.t==='course'?(ST.data.courses[0]||{}).id||'':f.t==='color'?col:'';
  });
  if(name==='testimonials')o.stars=5;
  if(name==='posts'){o.c2=PALETTE[(PALETTE.indexOf(col)+1)%PALETTE.length];o.content='';}
  if(name==='courses'){o.c2=PALETTE[(PALETTE.indexOf(col)+1)%PALETTE.length];o.level='Cơ bản';}
  return o;
}
function editItem(name,idx){
  const sc=ST.schema[name],isNew=idx==='new';
  const items=ST.data[name];
  const cur=isNew?newItem(name):items[+idx];
  if(!cur)return go('c/'+name);
  const back=btn('← Danh sách','',()=>go('c/'+name));
  const save=btn(isNew?'Thêm mới':'Lưu thay đổi','primary',doSave);
  const acts=[back];
  if(!isNew&&name==='posts'&&cur.published)acts.push(btn('Xem bài ↗','',null,{href:'/bai-viet/'+encodeURIComponent(cur.slug),target:'_blank',rel:'noopener'}));
  if(!isNew)acts.push(btn('Xóa','danger',askDelete));
  acts.push(save);
  setTop((isNew?'Thêm ':'Sửa ')+sc.label.toLowerCase(),acts);
  const html=sc.fields.filter(f=>f.t!=='html').map(f=>fieldHTML(f,cur[f.k])).join('');
  const htmlField=sc.fields.find(f=>f.t==='html');
  $('#view').innerHTML=`<div id="confirmBox"></div>
    ${htmlField?`<div class="card"><label class="full" style="margin-bottom:10px">${esc(htmlField.l)}</label><div class="editor-wrap"><div id="ed"></div></div></div>`:''}
    <form class="card form" id="form" novalidate>${html}</form>
    <div class="bar"><span class="sp"></span></div>`;
  $('.bar').appendChild(btn(isNew?'Thêm mới':'Lưu thay đổi','primary',doSave));
  bindFields($('#form'));
  if(htmlField){
    quill=makeEditor($('#ed'),cur[htmlField.k]||'');
    // posts: the editor is the main thing, so it goes first; the details form follows
  }
  const form=$('#form');
  function collect(){
    const o={...cur};
    sc.fields.forEach(f=>{if(f.t==='html'){o[f.k]=quill?quill.root.innerHTML:'';return;}o[f.k]=readField(form,f);});
    if(htmlField&&o[htmlField.k]==='<p><br></p>')o[htmlField.k]='';
    return o;
  }
  async function doSave(){
    const o=collect();
    const miss=sc.fields.find(f=>f.req&&(o[f.k]===''||o[f.k]==null));
    if(miss){toast(`Bạn cần nhập "${miss.l}".`,true);const el=form.querySelector(`[name="${miss.k}"]`);el&&el.focus();return;}
    const arr=items.slice();
    if(name==='courses'&&!isNew&&cur.id!==o.id)o._oldId=cur.id;
    if(isNew)(name==='posts'||name==='testimonials'?arr.unshift(o):arr.push(o));else arr[+idx]=o;
    $$('#topAct .btn.primary, .bar .btn.primary').forEach(b=>{b.disabled=true;b.textContent='Đang lưu...';});
    try{
      const r=await saveCollection(name,arr);
      dirty=false;toast(isNew?'Đã thêm mới.':'Đã lưu thay đổi.');
      if(name==='posts'){const i=isNew?0:+idx;history.replaceState(null,'','#/c/posts/'+i);editItem(name,String(i));}
      else go('c/'+name);
    }catch(x){toast(x.message,true);$$('#topAct .btn.primary, .bar .btn.primary').forEach(b=>{b.disabled=false;b.textContent=isNew?'Thêm mới':'Lưu thay đổi';});}
  }
  function askDelete(){
    const box=$('#confirmBox');
    const extra=name==='courses'?' Các lớp trong lịch khai giảng của khóa này cũng sẽ bị xóa.':'';
    box.innerHTML=`<div class="confirm"><span>Xóa “${esc(itemTitle(name,cur))}”? Không thể hoàn tác.${extra}</span><span class="sp" style="flex:1"></span></div>`;
    const c=box.firstChild;
    c.appendChild(btn('Hủy','sm',()=>box.innerHTML=''));
    c.appendChild(btn('Xóa','sm danger solid',async()=>{
      try{await saveCollection(name,items.filter((_,i)=>i!==+idx));dirty=false;toast('Đã xóa.');go('c/'+name);}catch(x){toast(x.message,true);}
    }));
    window.scrollTo({top:0,behavior:'smooth'});
  }
}

/* ---------------- fields ---------------- */
function fieldHTML(f,v){
  const help=f.help?`<small>${esc(f.help)}</small>`:'';
  const full=['textarea','lines','image','html','stats','sections'].includes(f.t)||f.k==='name'||f.k==='title'||f.k==='q';
  const wrap=(inner,cls='')=>`<label class="${full?'full ':''}${cls}">${esc(f.l)}${f.req?' *':''}${inner}${help}</label>`;
  const val=v==null?'':v;
  switch(f.t){
    case 'textarea':case 'lines':return wrap(`<textarea name="${f.k}" rows="${f.t==='lines'?5:3}">${esc(val)}</textarea>`);
    case 'number':return wrap(`<input name="${f.k}" type="number" inputmode="numeric" ${f.min!=null?`min="${f.min}"`:''} ${f.max!=null?`max="${f.max}"`:''} value="${esc(val)}">`);
    case 'date':return wrap(`<input name="${f.k}" type="date" value="${esc(val)}">`);
    case 'url':return wrap(`<input name="${f.k}" type="url" placeholder="https://..." value="${esc(val)}">`);
    case 'select':return wrap(`<select name="${f.k}">${f.opts.map(o=>`<option value="${esc(o[0])}"${o[0]===val?' selected':''}>${esc(o[1])}</option>`).join('')}</select>`);
    case 'course':return wrap(`<select name="${f.k}">${ST.data.courses.map(c=>`<option value="${esc(c.id)}"${c.id===val?' selected':''}>${esc(c.name)}</option>`).join('')}</select>`);
    case 'bool':return `<label class="switch"><input type="checkbox" name="${f.k}"${val?' checked':''}>${esc(f.l)}</label>`;
    case 'color':return wrap(`<span class="color"><input type="color" data-for="${f.k}" value="${isColor(val)&&val.length===7?esc(val):'#888888'}"><input name="${f.k}" value="${esc(val)}" placeholder="#FF5B24" maxlength="9"></span>`);
    case 'image':return `<div class="full" style="display:grid;gap:6px"><span style="font-size:13.5px;font-weight:600">${esc(f.l)}</span>
      <div class="img-field" data-img="${f.k}"><div class="img-prev${val?' has':''}" style="${val?`background-image:url('${esc(val)}')`:''}">${val?'':'Chưa có ảnh'}</div>
      <input type="hidden" name="${f.k}" value="${esc(val)}">
      <div class="img-btns"><button type="button" class="btn sm" data-up>Tải ảnh lên</button><button type="button" class="btn sm danger" data-clear ${val?'':'hidden'}>Bỏ ảnh</button>
      <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></div></div>${help}</div>`;
    default:return wrap(`<input name="${f.k}" value="${esc(val)}" ${f.ph?`placeholder="${esc(f.ph)}"`:''} ${f.max?`maxlength="${f.max}"`:''}>`);
  }
}
function readField(form,f){
  const el=form.querySelector(`[name="${f.k}"]`);if(!el)return '';
  if(f.t==='bool')return el.checked;
  if(f.t==='number')return el.value===''?'':+el.value;
  return el.value.trim?el.value.trim():el.value;
}
function bindFields(form){
  form.addEventListener('input',e=>{
    dirty=true;
    const c=e.target.closest('input[type=color]');if(c){form.querySelector(`[name="${c.dataset.for}"]`).value=c.value.toUpperCase();}
    else if(e.target.name){const p=form.querySelector(`input[type=color][data-for="${e.target.name}"]`);if(p&&/^#[0-9a-f]{6}$/i.test(e.target.value))p.value=e.target.value;}
  });
  form.addEventListener('change',()=>dirty=true);
  $$('[data-img]',form).forEach(box=>{
    const file=$('input[type=file]',box),hid=$('input[type=hidden]',box),prev=$('.img-prev',box),clr=$('[data-clear]',box),up=$('[data-up]',box);
    const set=u=>{hid.value=u;prev.style.backgroundImage=u?`url('${u}')`:'';prev.textContent=u?'':'Chưa có ảnh';prev.classList.toggle('has',!!u);clr.hidden=!u;dirty=true;};
    up.addEventListener('click',()=>file.click());
    clr.addEventListener('click',()=>set(''));
    file.addEventListener('change',async()=>{
      if(!file.files[0])return;up.disabled=true;up.textContent='Đang tải...';
      try{set(await uploadImage(file.files[0]));toast('Đã tải ảnh lên. Nhớ bấm Lưu.');}catch(x){toast(x.message,true);}
      finally{up.disabled=false;up.textContent='Tải ảnh lên';file.value='';}
    });
  });
}
async function uploadImage(f){
  if(f.size>5*1024*1024)throw new Error('Ảnh lớn hơn 5MB. Bạn giảm dung lượng ảnh rồi thử lại.');
  const fd=new FormData();fd.append('file',f);
  return (await api('POST','/api/admin/upload',undefined,fd)).url;
}
function makeEditor(el,html){
  const q=new Quill(el,{theme:'snow',placeholder:'Viết nội dung bài viết...',modules:{toolbar:{container:[[{header:[2,3,false]}],['bold','italic','underline','strike'],[{list:'ordered'},{list:'bullet'}],['blockquote','link','image','video'],[{align:[]}],['clean']],handlers:{
    image(){
      const inp=document.createElement('input');inp.type='file';inp.accept='image/png,image/jpeg,image/webp,image/gif';
      inp.onchange=async()=>{if(!inp.files[0])return;toast('Đang tải ảnh...');try{const u=await uploadImage(inp.files[0]);const r=q.getSelection(true);q.insertEmbed(r.index,'image',u,'user');q.setSelection(r.index+1);toast('Đã chèn ảnh.');}catch(x){toast(x.message,true);}};
      inp.click();
    }}}}});
  q.clipboard.dangerouslyPasteHTML(html||'');
  q.history.clear();q.blur();setTimeout(()=>window.scrollTo(0,0),0);
  q.on('text-change',(d,o,src)=>{if(src==='user')dirty=true;});
  // Vietnamese labels for the toolbar tooltips
  const T={'ql-bold':'In đậm','ql-italic':'In nghiêng','ql-underline':'Gạch chân','ql-strike':'Gạch ngang','ql-blockquote':'Trích dẫn','ql-link':'Chèn link','ql-image':'Chèn ảnh','ql-video':'Chèn video YouTube','ql-clean':'Xóa định dạng'};
  Object.entries(T).forEach(([c,t])=>$$('.'+c,el.parentNode).forEach(b=>b.title=t));
  $$('.ql-list',el.parentNode).forEach(b=>b.title=b.value==='ordered'?'Danh sách số':'Danh sách chấm');
  return q;
}

/* ---------------- settings ---------------- */
// [{b:[key,label,path,section],on}] in saved order, every block listed once
function homeOrderInit(saved,blocks){
  const out=[];(Array.isArray(saved)?saved:[]).forEach(x=>{const b=blocks.find(b=>b[0]===x.k);if(b&&!out.some(o=>o.b===b))out.push({b,on:!!x.on});});
  blocks.forEach(b=>{if(!out.some(o=>o.b===b))out.push({b,on:false});});
  return out;
}
function settingsView(page){
  const s=ST.data.settings,groups=ST.settingsSchema.filter(g=>(g.page||'')===page),home=page==='home';
  let order=null;
  setTop(home?'Trang chủ':'Cài đặt website',[...(home?[btn('Xem trang chủ ↗','',null,{href:'/',target:'_blank'})]:[]),btn(home?'Lưu trang chủ':'Lưu cài đặt','primary',save)]);
  $('#view').innerHTML=`${home?'<p class="hint">Chọn mục nào hiện trên trang chủ và kéo thả để đổi thứ tự. Bên dưới là chữ của từng mục: sửa xong bấm <b>Lưu trang chủ</b>. Mỗi mục cũng có trang riêng (link bên cạnh) để gửi cho học viên.</p>':''}<form id="form" style="display:grid;gap:20px" novalidate>${groups.map(g=>`<div class="card"><h2>${esc(g.group)}</h2><div class="form" style="margin-top:14px">${g.fields.map(f=>{
    if(f.t==='homeOrder'){order=homeOrderInit(s.homeOrder,f.blocks);return '<div class="full" id="homeOrder"></div>';}
    if(f.t==='stats')return `<div class="full stats-ed">${[0,1,2,3].map(i=>{const x=(s.stats||[])[i]||{};return `<div class="st"><input name="sv${i}" value="${esc(x.v)}" placeholder="4.200" aria-label="Số"><input name="ss${i}" value="${esc(x.s)}" placeholder="+" aria-label="Hậu tố"><input name="sl${i}" value="${esc(x.l)}" placeholder="học viên đã tốt nghiệp" aria-label="Mô tả"></div>`;}).join('')}<small style="color:var(--muted)">Mỗi dòng: con số · hậu tố (+, /5...) · mô tả.</small></div>`;
    if(f.t==='sections')return `<div class="full sections">${ST.sections.map(([k,l])=>`<label class="switch"><input type="checkbox" name="sec_${k}"${(s.sections||{})[k]?' checked':''}>${esc(l)}</label>`).join('')}</div>`;
    return fieldHTML(f,s[f.k]);
  }).join('')}</div></div>`).join('')}<div class="bar"><span class="sp"></span></div></form>`;
  $('#form .bar').appendChild(btn(home?'Lưu trang chủ':'Lưu cài đặt','primary',save));
  bindFields($('#form'));
  if(order)drawOrder();
  function drawOrder(){
    const box=$('#homeOrder'),secOff=k=>k&&!(s.sections||{})[k];
    box.innerHTML=`<div class="list sorting home-order" id="hoList">${order.map((x,i)=>{const b=x.b;return `<div class="row" draggable="true" data-i="${i}">
      <span class="grip" aria-hidden="true">⠿</span>
      <label class="switch ho-on"><input type="checkbox" data-on="${i}"${x.on?' checked':''}${secOff(b[3])?' disabled':''}></label>
      <div class="tx"><b>${esc(b[1])}${x.on&&!secOff(b[3])?'<span class="pill on">Đang hiện</span>':'<span class="pill">Ẩn</span>'}</b><span>${secOff(b[3])?'Đang tắt ở Cài đặt website':b[2]?`Trang riêng: <a href="${b[2]}" target="_blank">${location.host}${b[2]}</a>`:'Chỉ có trên trang chủ'}</span></div>
      <div class="acts"><button type="button" class="btn sm icon" data-mv="-1" aria-label="Lên trên" ${i===0?'disabled':''}>↑</button><button type="button" class="btn sm icon" data-mv="1" aria-label="Xuống dưới" ${i===order.length-1?'disabled':''}>↓</button></div></div>`;}).join('')}</div>`;
    const list=$('#hoList');let dragEl=null;
    list.addEventListener('change',e=>{const c=e.target.closest('[data-on]');if(c){order[+c.dataset.on].on=c.checked;dirty=true;drawOrder();}});
    list.addEventListener('click',e=>{const mv=e.target.closest('[data-mv]');if(!mv)return;const i=+mv.closest('.row').dataset.i,j=i+ +mv.dataset.mv;[order[i],order[j]]=[order[j],order[i]];dirty=true;drawOrder();});
    list.addEventListener('dragstart',e=>{dragEl=e.target.closest('.row');if(!dragEl)return;dragEl.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','');});
    list.addEventListener('dragover',e=>{if(!dragEl)return;e.preventDefault();const over=e.target.closest('.row');if(!over||over===dragEl)return;const r=over.getBoundingClientRect();list.insertBefore(dragEl,e.clientY>r.top+r.height/2?over.nextSibling:over);});
    list.addEventListener('drop',e=>e.preventDefault());
    list.addEventListener('dragend',()=>{if(!dragEl)return;dragEl=null;order=[...list.querySelectorAll('.row')].map(r=>order[+r.dataset.i]);dirty=true;drawOrder();});
  }
  async function save(){
    const form=$('#form'),o={};
    groups.forEach(g=>g.fields.forEach(f=>{
      if(f.t==='homeOrder')o.homeOrder=order.map(x=>({k:x.b[0],on:x.on}));
      else if(f.t==='stats')o.stats=[0,1,2,3].map(i=>({v:form['sv'+i].value.trim(),s:form['ss'+i].value.trim(),l:form['sl'+i].value.trim()})).filter(x=>x.v||x.l);
      else if(f.t==='sections')o.sections=Object.fromEntries(ST.sections.map(([k])=>[k,form['sec_'+k].checked]));
      else o[f.k]=readField(form,f);
    }));
    try{const r=await api('PUT','/api/admin/settings',{rev:ST.rev,settings:o});ST.rev=r.rev;ST.data.settings=r.settings;dirty=false;toast(home?'Đã lưu trang chủ. Website đã cập nhật.':'Đã lưu cài đặt. Website đã cập nhật.');}
    catch(x){toast(x.message,true);}
  }
}

/* ---------------- registrations ---------------- */
const RS={new:'Mới',called:'Đã liên hệ',enrolled:'Đã nhập học',cancel:'Không học'};
let regFilter='all';
async function regsView(){
  setTop('Đăng ký học viên',[btn('Tải file Excel (CSV)','',null,{href:'/admin/export/registrations.csv'})]);
  $('#view').innerHTML='<div class="empty">Đang tải...</div>';
  let items;
  try{items=(await api('GET','/api/admin/registrations')).items;}catch(x){$('#view').innerHTML=`<div class="empty">${esc(x.message)}</div>`;return;}
  const draw=()=>{
    const list=items.filter(r=>regFilter==='all'||r.status===regFilter);
    ST.newRegs=items.filter(r=>r.status==='new').length;drawNav('regs');
    $('#view').innerHTML=`<div class="filters">${[['all','Tất cả'],...Object.entries(RS)].map(([k,l])=>`<button class="chip" data-f="${k}" aria-pressed="${regFilter===k}">${l} (${k==='all'?items.length:items.filter(r=>r.status===k).length})</button>`).join('')}</div>
    <div class="list" id="regs">${list.map(r=>`<div class="reg" data-id="${esc(r.id)}">
      <div><b>${esc(r.name)}${r.status==='new'?'<span class="pill new">Mới</span>':''}</b><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>${r.email?` <span class="sub">· ${esc(r.email)}</span>`:''}<div class="sub">${new Date(r.at).toLocaleString('vi-VN')}</div></div>
      <div><b style="font-weight:600">${esc(r.courseName)}</b><div class="sub">${esc(r.mode)}</div>${r.note?`<div class="sub" style="margin-top:4px">“${esc(r.note)}”</div>`:''}</div>
      <div style="display:grid;gap:6px"><select data-st aria-label="Trạng thái">${Object.entries(RS).map(([k,l])=>`<option value="${k}"${r.status===k?' selected':''}>${l}</option>`).join('')}</select><textarea data-note placeholder="Ghi chú nội bộ" aria-label="Ghi chú nội bộ">${esc(r.adminNote)}</textarea></div>
      <div class="acts"><button class="btn sm danger" data-del>Xóa</button></div></div>`).join('')||'<div class="empty">Chưa có đăng ký nào ở mục này.</div>'}</div>`;
  };
  draw();
  $('#view').addEventListener('click',async e=>{
    const f=e.target.closest('[data-f]');if(f){regFilter=f.dataset.f;draw();return;}
    const row=e.target.closest('.reg');if(!row)return;const id=row.dataset.id;
    if(e.target.closest('[data-del]')){const a=row.querySelector('.acts');a.innerHTML='';a.appendChild(btn('Hủy','sm',()=>draw()));a.appendChild(btn('Xóa hẳn','sm danger solid',async()=>{try{await api('DELETE','/api/admin/registrations/'+encodeURIComponent(id));items=items.filter(r=>r.id!==id);draw();toast('Đã xóa đăng ký.');}catch(x){toast(x.message,true);}}));}
  });
  $('#view').addEventListener('change',async e=>{
    const row=e.target.closest('.reg');if(!row)return;const id=row.dataset.id,r=items.find(x=>x.id===id);
    const body=e.target.matches('[data-st]')?{status:e.target.value}:e.target.matches('[data-note]')?{adminNote:e.target.value}:null;if(!body)return;
    try{const j=await api('PATCH','/api/admin/registrations/'+encodeURIComponent(id),body);Object.assign(r,j.item);toast('Đã cập nhật.');if(body.status)draw();}catch(x){toast(x.message,true);}
  });
}

/* ---------------- account ---------------- */
function accountView(){
  setTop('Tài khoản',[]);
  $('#view').innerHTML=`<form class="card" id="pwd" style="max-width:520px;display:grid;gap:14px"><h2>Đổi mật khẩu</h2><p class="muted">Đổi mật khẩu sẽ đăng xuất các thiết bị khác đang đăng nhập.</p>
    <label>Mật khẩu hiện tại<input name="current" type="password" autocomplete="current-password" required></label>
    <label>Mật khẩu mới (ít nhất 8 ký tự)<input name="next" type="password" autocomplete="new-password" minlength="8" required></label>
    <label>Nhập lại mật khẩu mới<input name="again" type="password" autocomplete="new-password" minlength="8" required></label>
    <p class="err" hidden></p><div><button class="btn primary" type="submit">Đổi mật khẩu</button></div></form>`;
  $('#pwd').addEventListener('submit',async e=>{
    e.preventDefault();const f=e.target,err=$('.err',f);err.hidden=true;
    if(f.next.value!==f.again.value){err.textContent='Hai mật khẩu mới chưa khớp nhau.';err.hidden=false;return;}
    try{await api('POST','/api/admin/password',{current:f.current.value,next:f.next.value});f.reset();toast('Đã đổi mật khẩu.');}catch(x){err.textContent=x.message;err.hidden=false;}
  });
}

/* ---------------- start ---------------- */
boot().catch(()=>{if($('#app').hidden)showGate('login');});
})();
