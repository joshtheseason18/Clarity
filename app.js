// ══ AUDIO ══════════════════════════════════
const AC=new(window.AudioContext||window.webkitAudioContext)();
function playDone(){
  if(AC.state==='suspended')AC.resume();
  [[523.25,0],[659.25,.09],[783.99,.18]].forEach(([f,d])=>{
    const o=AC.createOscillator(),g=AC.createGain();
    o.connect(g);g.connect(AC.destination);o.type='sine';
    o.frequency.setValueAtTime(f,AC.currentTime+d);
    g.gain.setValueAtTime(0,AC.currentTime+d);
    g.gain.linearRampToValueAtTime(.15,AC.currentTime+d+.02);
    g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+d+.38);
    o.start(AC.currentTime+d);o.stop(AC.currentTime+d+.42);
  });
}
function playUndo(){
  if(AC.state==='suspended')AC.resume();
  const o=AC.createOscillator(),g=AC.createGain();
  o.connect(g);g.connect(AC.destination);o.type='sine';
  o.frequency.setValueAtTime(400,AC.currentTime);
  o.frequency.linearRampToValueAtTime(280,AC.currentTime+.18);
  g.gain.setValueAtTime(.09,AC.currentTime);
  g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+.22);
  o.start(AC.currentTime);o.stop(AC.currentTime+.25);
}

// ══ THEME / DARK MODE ══════════════════════
let currentTheme=localStorage.getItem('clarity_theme')||'emerald';
let isDark=localStorage.getItem('clarity_dark')==='true';

function applyTheme(t){
  currentTheme=t;
  document.documentElement.setAttribute('data-theme',t);
  document.querySelectorAll('.theme-swatch').forEach(s=>s.classList.toggle('active',s.id==='sw-'+t));
  localStorage.setItem('clarity_theme',t);
}
function setTheme(t){applyTheme(t);}

function applyDark(d){
  isDark=d;
  document.documentElement.setAttribute('data-dark',d?'true':'false');
  const track=document.getElementById('darkToggle');
  if(track)track.classList.toggle('on',d);
  const icon=document.getElementById('modeIcon');
  if(icon)icon.textContent=d?'☀️':'🌙';
  localStorage.setItem('clarity_dark',d?'true':'false');
}
function toggleDark(){applyDark(!isDark);}

// Apply saved on load
applyTheme(currentTheme);
applyDark(isDark);
// Time format button state applied after DOM ready

// ══ DRAWER ══════════════════════════════════
function openDrawer(){
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
}
function closeDrawer(){
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
}

// ══ SUGGESTIONS TAB VISIBILITY ═══════════════
let suggTabVisible=localStorage.getItem('clarity_sugg_tab')!=='false';
function applySuggTabVisibility(){
  const tab=document.getElementById('suggTab');
  const panel=document.getElementById('panel-suggestions');
  const toggle=document.getElementById('suggToggle');
  if(tab)tab.style.display=suggTabVisible?'':'none';
  if(panel&&!suggTabVisible){panel.classList.remove('active');if(activeSide==='suggestions'){activeSide='braindump';switchSide('braindump');}}
  if(toggle)toggle.classList.toggle('on',suggTabVisible);
}
function toggleSuggTab(){
  suggTabVisible=!suggTabVisible;
  localStorage.setItem('clarity_sugg_tab',suggTabVisible?'true':'false');
  applySuggTabVisibility();
}
function dismissSuggestions(){
  suggTabVisible=false;
  localStorage.setItem('clarity_sugg_tab','false');
  applySuggTabVisibility();
  showToast('Ideas tab hidden — re-enable in Settings');
}

// ══ SPLASH ══════════════════════════════════
function enterApp(){
  const splash=document.getElementById('splash');
  splash.classList.add('hiding');
  setTimeout(()=>{splash.style.display='none';renderAll();renderTip();},500);
}

// ══ CONSTANTS ══════════════════════════════
const MONTHS_LONG=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_S=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_S=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DLONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const CAT_COLORS=['#3b82f6','#8b5cf6','#10b981','#ec4899','#14b8a6','#f59e0b','#ef4444','#f97316','#06b6d4','#84cc16','#a855f7','#64748b'];

// ══ STATE ═══════════════════════════════════
let curView='month';
let curYear=new Date().getFullYear();
let cursor=new Date();cursor.setDate(1);cursor.setHours(0,0,0,0);
let selDate=new Date();
let sidebarOpen=true,activeSide='braindump';
// Close sidebar by default on mobile
let catFilter='all',showDone=false;
let tasks=[],brainDump=[];
let categories=[
  {id:'work',name:'Work',color:'#3b82f6',locked:true},
  {id:'personal',name:'Personal',color:'#8b5cf6',locked:true},
  {id:'health',name:'Health',color:'#10b981',locked:true},
];

function genId(){return Math.random().toString(36).slice(2,10)}
function save(){
  localStorage.setItem('clarity_t3',JSON.stringify(tasks));
  localStorage.setItem('clarity_bd3',JSON.stringify(brainDump));
  localStorage.setItem('clarity_cats',JSON.stringify(categories));
}
function load(){
  try{tasks=JSON.parse(localStorage.getItem('clarity_t3')||'[]')}catch{tasks=[]}
  try{brainDump=JSON.parse(localStorage.getItem('clarity_bd3')||'[]')}catch{brainDump=[]}
  try{const c=JSON.parse(localStorage.getItem('clarity_cats'));if(c&&c.length)categories=c;}catch{}
}
load();

// Seed sample Brain Dump for first-time users
if(!tasks.length&&!brainDump.length&&!localStorage.getItem('clarity_t3')){
  brainDump=[
    {id:genId(),name:'Plan out my week',priority:'high',category:'work',notes:'Block time for priorities before the week fills up.'},
    {id:genId(),name:'Try dragging this card to a day →',priority:'none',category:'none',notes:'Grab this card and drop it on any day in the calendar!'},
    {id:genId(),name:'Grocery run',priority:'medium',category:'personal',notes:'Milk, eggs, bread, fruit'},
    {id:genId(),name:'30 min workout',priority:'low',category:'health',notes:'Even a short walk counts.'},
    {id:genId(),name:'Reply to emails',priority:'medium',category:'work',notes:''},
  ];
  save();
}

// ══ HELPERS ═════════════════════════════════
function dk(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function pad(n){return String(n).padStart(2,'0')}
function fromDk(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function isToday(d){return dk(d)===dk(new Date())}
let useMilitary=localStorage.getItem('clarity_military')==='true';
function fmtT(t){
  if(!t)return'';
  const[h,m]=t.split(':').map(Number);
  if(useMilitary)return pad(h)+':'+pad(m);
  return(h%12||12)+':'+pad(m)+(h>=12?' PM':' AM');
}
function setTimeFormat(mil){
  useMilitary=mil;
  localStorage.setItem('clarity_military',mil?'true':'false');
  document.getElementById('tfBtn12').classList.toggle('active',!mil);
  document.getElementById('tfBtn24').classList.toggle('active',mil);
  renderAll();
}
function sk(h,m){return pad(h)+':'+pad(m)}
function slots(){const a=[];for(let h=0;h<24;h++){a.push({h,m:0});a.push({h,m:30})}return a}
function addDays(d,n){const r=new Date(d);r.setDate(r.getDate()+n);return r}
function wkStart(d){const r=new Date(d);r.setDate(r.getDate()-r.getDay());r.setHours(0,0,0,0);return r}
function recurLbl(t){if(!t.recur)return'';return`Every ${t.recurN} ${t.recurU}${t.recurN>1?'s':''}`}
function catById(id){return categories.find(c=>c.id===id)}
function catColor(id){const c=catById(id);return c?c.color:'var(--border2)'}
function hexToRgb(hex){
  if(!hex||!hex.startsWith('#'))return null;
  const h=hex.replace('#','');
  if(h.length===3){const r=parseInt(h[0]+h[0],16),g=parseInt(h[1]+h[1],16),b=parseInt(h[2]+h[2],16);return r+','+g+','+b;}
  if(h.length===6){const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return r+','+g+','+b;}
  return null;
}
function taskBlockBg(catId){
  const c=catById(catId);
  const rgb=c&&c.color?hexToRgb(c.color):null;
  return rgb?'rgba('+rgb+',.14)':'rgba(var(--accent-rgb),.13)';
}

function expandedTasks(start,end){
  const s=new Date(start);s.setHours(0,0,0,0);
  const e=new Date(end);e.setHours(23,59,59,999);
  const out=[];const seen=new Set();
  tasks.forEach(t=>{
    if(t.scheduled&&t.date){
      const td=fromDk(t.date);
      if(td>=s&&td<=e){
        const del=(t.deletedOccurrences||[]).includes(t.date);
        if(!del){
          const key=t.id+'|'+t.date;
          if(!seen.has(key)){seen.add(key);
            const doneOv=(t.doneOverrides||[]).includes(t.date);
            out.push({...t,done:t.done||doneOv,_instanceDate:t.date});
          }
        }
      }
      if(t.recur){
        let base=fromDk(t.date);
        // Fast-forward: estimate starting i to skip past occurrences before range
        let iStart=1;
        const daysBetween=Math.floor((s-base)/(86400000));
        if(daysBetween>0){
          let step=t.recurU==='day'?t.recurN:t.recurU==='week'?t.recurN*7:t.recurN*30;
          if(step>0)iStart=Math.max(1,Math.floor(daysBetween/step)-1);
        }
        for(let i=iStart;i<=730;i++){
          let next=new Date(base);
          if(t.recurU==='day')next.setDate(next.getDate()+t.recurN*i);
          else if(t.recurU==='week')next.setDate(next.getDate()+t.recurN*7*i);
          else next.setMonth(next.getMonth()+t.recurN*i);
          if(next>e)break;
          if(next>=s){
            const ndk=dk(next);
            const del2=(t.deletedOccurrences||[]).includes(ndk);
            if(!del2){
              const key2=t.id+'|'+ndk;
              if(!seen.has(key2)){seen.add(key2);
                const doneOv2=(t.doneOverrides||[]).includes(ndk);
                out.push({...t,date:ndk,done:doneOv2,_virtual:true,_instanceDate:ndk});
              }
            }
          }
        }
      }
    }
  });
  return out;
}
function tasksOn(dateKey){const d=fromDk(dateKey);return expandedTasks(d,d).filter(t=>t.date===dateKey)}
function tasksSlot(dateKey,h,m){return tasksOn(dateKey).filter(t=>t.time===sk(h,m))}

function buildCatOptions(selId,val){
  const sel=document.getElementById(selId);if(!sel)return;
  sel.innerHTML=`<option value="none">None</option>`+categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  if(val)sel.value=val;
}
function buildAllCatSelects(val){buildCatOptions('fCat',val);buildCatOptions('bdCat','none')}

// ══ VIEW SWITCHING ══════════════════════════
function switchView(v){
  const wasView=curView;
  curView=v;
  const tabs=['year','month','week','day','categories'];
  document.querySelectorAll('.nav-tab').forEach((b,i)=>b.classList.toggle('active',tabs[i]===v));
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  renderAll();
  if((v==='week'||v==='day')&&wasView!==v){setTimeout(scrollToNow,80);}
}
function switchSide(tab){
  activeSide=tab;
  document.querySelectorAll('.side-tab').forEach((b,i)=>b.classList.toggle('active',['braindump','priority','focus','suggestions','journal'][i]===tab));
  document.querySelectorAll('.side-panel').forEach(p=>p.classList.remove('active'));
  const panel=document.getElementById('panel-'+tab);
  if(panel)panel.classList.add('active');
  if(tab==='priority')renderPri();
  if(tab==='suggestions')renderSuggestions();
  if(tab==='journal')openJournalForDate(dk(selDate));
  if(tab==='focus')switchSideFocus();
}
function toggleSidebar(){
  sidebarOpen=!sidebarOpen;
  document.getElementById('sidebar').classList.toggle('collapsed',!sidebarOpen);
  // Mobile backdrop
  const bd=document.getElementById('sidebarBackdrop');
  if(bd)bd.classList.toggle('open',sidebarOpen);
}

// ══ NAVIGATION ═══════════════════════════════
function navPrev(){
  if(curView==='year')curYear--;
  else if(curView==='month')cursor.setMonth(cursor.getMonth()-1);
  else if(curView==='week'){selDate=addDays(selDate,-7);cursor=new Date(selDate);cursor.setDate(1);}
  else if(curView==='day')selDate=addDays(selDate,-1);
  renderAll();
}
function navNext(){
  if(curView==='year')curYear++;
  else if(curView==='month')cursor.setMonth(cursor.getMonth()+1);
  else if(curView==='week'){selDate=addDays(selDate,7);cursor=new Date(selDate);cursor.setDate(1);}
  else if(curView==='day')selDate=addDays(selDate,1);
  renderAll();
}
function goToday(){curYear=new Date().getFullYear();selDate=new Date();cursor=new Date();cursor.setDate(1);cursor.setHours(0,0,0,0);renderAll()}

// ══ RENDER ALL ═══════════════════════════════
function renderAll(){
  updateLabel();
  if(curView==='year')renderYear();
  else if(curView==='month')renderMonth();
  else if(curView==='week')renderWeek();
  else if(curView==='day')renderDay();
  else renderCat();
  renderBD();renderCatChips();buildAllCatSelects();
  if(activeSide==='priority')renderPri();
  if(activeSide==='suggestions')renderSuggestions();
  if(activeSide==='journal')openJournalForDate(dk(selDate));
  updateOverdueBadge();
  // Slight defer so DOM is painted before measuring scroll positions
  setTimeout(()=>{renderNowLine();},0);
}
function updateLabel(){
  const el=document.getElementById('curLabel');
  if(curView==='year')el.textContent=String(curYear);
  else if(curView==='month')el.textContent=MONTHS_LONG[cursor.getMonth()]+' '+cursor.getFullYear();
  else if(curView==='week'){const mon=wkStart(selDate),sun=addDays(mon,6);el.textContent=MONTHS_S[mon.getMonth()]+' '+mon.getDate()+' – '+MONTHS_S[sun.getMonth()]+' '+sun.getDate()+', '+sun.getFullYear();}
  else if(curView==='day')el.textContent=DLONG[selDate.getDay()]+', '+MONTHS_S[selDate.getMonth()]+' '+selDate.getDate();
  else el.textContent='All Tasks';
}

// ══ YEAR ═════════════════════════════════════
function renderYear(){
  const todayKey=dk(new Date());
  const yStart=new Date(curYear,0,1),yEnd=new Date(curYear,11,31);
  const allYT=expandedTasks(yStart,yEnd);
  let html='';
  for(let mo=0;mo<12;mo++){
    const first=new Date(curYear,mo,1).getDay(),dim=new Date(curYear,mo+1,0).getDate(),dip=new Date(curYear,mo,0).getDate();
    const dayCount={};
    allYT.forEach(t=>{if(t.date){const d=fromDk(t.date);if(d.getFullYear()===curYear&&d.getMonth()===mo)dayCount[d.getDate()]=(dayCount[d.getDate()]||0)+1;}});
    const total=Object.values(dayCount).reduce((a,b)=>a+b,0);
    const hasToday=todayKey.startsWith(`${curYear}-${pad(mo+1)}-`);
    html+=`<div class="year-month-card${hasToday?' has-today':''}" onclick="onYearMonthClick(${curYear},${mo})">
      <div class="ym-header"><div class="ym-name">${MONTHS_LONG[mo]}</div><div class="ym-count${total>0?' has-tasks':''}">${total>0?total+' task'+(total!==1?'s':''):''}</div></div>
      <div class="ym-days-hdr">${DAYS_S.map(d=>`<div class="ym-day-lbl">${d[0]}</div>`).join('')}</div>
      <div class="ym-cal-grid">`;
    for(let i=0;i<first;i++)html+=`<div class="ym-day other"></div>`;
    for(let d=1;d<=dim;d++){
      const key=`${curYear}-${pad(mo+1)}-${pad(d)}`,n=dayCount[d]||0,isT=key===todayKey;
      let dotCls=n===1?'d1':n===2?'d2':n<=4?'d3':n>4?'d4':'';
      html+=`<div class="ym-day${isT?' today':''}${n>0?' has-tasks':''}" onclick="event.stopPropagation();onYearDayClick('${key}')">${d}${n>0&&!isT?`<span class="ym-dot ${dotCls}"></span>`:''}</div>`;
    }
    const rem=(first+dim)%7;if(rem>0)for(let i=0;i<7-rem;i++)html+=`<div class="ym-day other"></div>`;
    html+=`</div></div>`;
  }
  document.getElementById('yearGrid').innerHTML=html;
}
function onYearMonthClick(y,mo){cursor=new Date(y,mo,1);selDate=new Date(y,mo,1);switchView('month')}
function onYearDayClick(key){selDate=fromDk(key);switchView('day')}

// ══ MONTH ════════════════════════════════════
function renderMonth(){
  const y=cursor.getFullYear(),mo=cursor.getMonth(),first=new Date(y,mo,1).getDay(),dim=new Date(y,mo+1,0).getDate(),dip=new Date(y,mo,0).getDate(),todayKey=dk(new Date());
  let html=`<div class="month-grid-hdr">${DAYS_S.map(d=>`<div class="month-day-name">${d}</div>`).join('')}</div><div class="month-grid">`;
  let cells=[];
  for(let i=first-1;i>=0;i--)cells.push({date:new Date(y,mo-1,dip-i),cur:false});
  for(let d=1;d<=dim;d++)cells.push({date:new Date(y,mo,d),cur:true});
  let nx=1;while(cells.length<42)cells.push({date:new Date(y,mo+1,nx++),cur:false});
  cells.forEach(({date,cur})=>{
    const key=dk(date),isTod=key===todayKey;
    const dt=tasksOn(key),shown=dt.slice(0,3);
    let cls='month-cell'+((!cur)?' other-month':'')+(isTod?' today':'');
    let chips=shown.map(t=>{
      const cc=catColor(t.category);
      let c='m-chip'+(t.done?' done':'');
      if(t.priority==='high')c+=' pri-high';else if(t.priority==='medium')c+=' pri-medium';
      return`<span class="${c}" style="border-left-color:${cc}" draggable="true"
        ondragstart="onTaskDragStart(event,'${t.id}','${t._instanceDate||key}')" ondragend="onTaskDragEnd(event)"
        onclick="openEdit('${t.id}','${t._instanceDate||key}',event)">${t.name}${t.recur?' ↻':''}</span>`;
    }).join('')+(dt.length>3?`<span class="more-chip">+${dt.length-3}</span>`:'');
    html+=`<div class="${cls}" onclick="onMCell('${key}')" ondragover="onDO(event,'${key}')" ondragleave="onDL(event)" ondrop="onDropDate(event,'${key}')">
      <div><span class="cell-num-circle">${date.getDate()}</span></div>${chips}</div>`;
  });
  document.getElementById('monthGrid').innerHTML=html+'</div>';
}
function onMCell(k){selDate=fromDk(k);switchView('day')}

// ══ WEEK ════════════════════════════════════
function renderWeek(){
  const mon=wkStart(selDate),days=Array.from({length:7},(_,i)=>addDays(mon,i)),todayKey=dk(new Date());
  let hdr=`<div class="wk-gutter"></div>`;
  days.forEach(d=>{const k=dk(d);hdr+=`<div class="wk-day-head${k===todayKey?' today':''}" onclick="onWkDay('${k}')"><div class="wdh-name">${DAYS_S[d.getDay()]}</div><div class="wdh-num">${d.getDate()}</div></div>`;});
  document.getElementById('weekHdr').innerHTML=hdr;
  const sl=slots();
  const WK_SLOT_H=42;
  let g=`<div class="wk-time-col">${sl.map(s=>`<div class="time-lbl">${s.m===0?fmtT(sk(s.h,s.m)):''}</div>`).join('')}</div>`;
  days.forEach(d=>{
    const k=dk(d);
    // Slots (no tasks inside — tasks go in overlay)
    let colSlots=sl.map(s=>{
      const sk2=sk(s.h,s.m);
      return`<div class="wk-slot${s.m===30?' half':''}" onclick="onWkSlot('${k}','${sk2}',event)"
        ondragover="onDO(event,'${k}','${sk2}')" ondragleave="onDL(event)" ondrop="onDropSlot(event,'${k}','${sk2}')"></div>`;
    }).join('');
    // Task overlay
    const dayTasks=tasksOn(k);
    let taskBlocks=dayTasks.map(t=>{
      if(!t.time)return'';
      const [th,tm]=t.time.split(':').map(Number);
      const topPx=(th*60+tm)/30*WK_SLOT_H;
      const dur=t.duration||30;
      const hPx=Math.max(14,dur/30*WK_SLOT_H-1);
      const cc=catColor(t.category);
      const isDone=t.done||(t.doneOverrides||[]).includes(t._instanceDate||k);
      return`<div class="wk-task-block${isDone?' done-block':''}" data-id="${t.id}"
        draggable="true" ondragstart="onTaskDragStart(event,'${t.id}','${t._instanceDate||k}')" ondragend="onTaskDragEnd(event)"
        style="top:${topPx}px;height:${hPx}px;border-left-color:${cc};background:${taskBlockBg(t.category)}"
        onclick="openEdit('${t.id}','${t._instanceDate||k}',event)">
        <div style="display:flex;align-items:center;gap:2px;min-width:0">
          <div class="task-check${isDone?' checked':''}" onclick="toggleDone('${t.id}','${t._instanceDate||k}',event,this)"></div>
          <span class="wk-task-block-name task-lbl">${t.name}</span>${t.recur?'<span class="recur-icon">↻</span>':''}
        </div>
        ${dur>30?`<div class="wk-task-block-dur">${durLabel(dur)}</div>`:''}
        <div class="task-resize-handle" data-rid="${t.id}" onmousedown="onResizeStart(event,'${t.id}','${t._instanceDate||k}','week')"></div>
      </div>`;
    }).join('');
    // Routine bands for this day
    const WK_SLOT_H_R=42;
    let routineBandsHtml='';
    getRoutineForDay(k).forEach(b=>{
      const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
      const[sh,sm]=b.start.split(':').map(Number);
      const[eh,em]=b.end.split(':').map(Number);
      const topPx=(sh*60+sm)/30*WK_SLOT_H_R;
      const hPx=(eh*60+em)/30*WK_SLOT_H_R-topPx;
      routineBandsHtml+=`<div style="position:absolute;top:${topPx}px;height:${hPx}px;left:0;right:0;background:${rt.color};opacity:.06;border-radius:3px;pointer-events:none;z-index:0"></div>`;
    });
    g+=`<div class="wk-day-col">${colSlots}<div class="wk-task-layer">${routineBandsHtml}${taskBlocks}</div></div>`;
  });
  document.getElementById('weekGrid').innerHTML=g;
}
function onWkDay(k){selDate=fromDk(k);switchView('day')}
function onWkSlot(k,t,e){if(e.target.closest('.wk-task-block,.now-line,.task-check,.task-resize-handle'))return;openNew(k,t)}

// ══ DAY ═════════════════════════════════════
function renderDay(){
  const key=dk(selDate);
  document.getElementById('dayTitle').textContent=DLONG[selDate.getDay()]+', '+MONTHS_LONG[selDate.getMonth()]+' '+selDate.getDate();
  const _dayTasks=tasksOn(dk(selDate));
  const _dayTotal=_dayTasks.length;
  const _dayDone=_dayTasks.filter(t=>t.done||(t.doneOverrides||[]).includes(dk(selDate))).length;
  const _dayProgress=_dayTotal>0?' · '+_dayDone+'/'+_dayTotal+' done':'';
  document.getElementById('daySub').textContent=selDate.getFullYear()+(isToday(selDate)?' · Today':'')+_dayProgress;
  const sl=slots();
  const DAY_SLOT_H=52;
  // Slots grid (just for click-to-add, no tasks inside)
  let html=sl.map(s=>{
    const sk2=sk(s.h,s.m);
    return`<div class="day-time-lbl">${s.m===0?fmtT(sk2):''}</div>
    <div class="day-slot${s.m===30?' half':''}" onclick="onDaySlot('${key}','${sk2}',event)"
      ondragover="onDO(event,'${key}','${sk2}')" ondragleave="onDL(event)" ondrop="onDropSlot(event,'${key}','${sk2}')"></div>`;
  }).join('');
  // Task overlay blocks
  const taskBlocks=_dayTasks.filter(t=>t.time).map(t=>{
    const [th,tm]=t.time.split(':').map(Number);
    const topPx=(th*60+tm)/30*DAY_SLOT_H;
    const dur=t.duration||30;
    const hPx=Math.max(20,dur/30*DAY_SLOT_H-2);
    const cc=catColor(t.category);
    const idate=t._instanceDate||key;
    const isDone=t.done||(t.doneOverrides||[]).includes(idate);
    return`<div class="day-task-block${isDone?' done-block':''}" data-id="${t.id}"
      draggable="true" ondragstart="onTaskDragStart(event,'${t.id}','${idate}')" ondragend="onTaskDragEnd(event)"
      style="top:${topPx}px;height:${hPx}px;border-left-color:${cc};background:${taskBlockBg(t.category)}"
      onclick="openEdit('${t.id}','${idate}',event)">
      <div class="day-task-block-check">
        <div class="task-check${isDone?' checked':''}" onclick="toggleDone('${t.id}','${idate}',event,this)"></div>
        <span class="day-task-block-name task-lbl">${t.name}</span>
        ${t.recur?`<span class="recur-icon" title="${recurLbl(t)}">↻</span>`:''}
      </div>
      ${dur>15?`<div class="day-task-block-dur">${durLabel(dur)}${t.notes?` · <span style="font-size:9px;opacity:.7">${t.notes.slice(0,40)}</span>`:''}${!isDone?` <button onclick="event.stopPropagation();startFocusForTask('${t.id}','${idate}')" style="background:var(--accent);color:#fff;border:none;border-radius:4px;font-size:8px;font-weight:700;padding:1px 6px;cursor:pointer;margin-left:4px;font-family:'DM Sans',sans-serif">▶ Focus</button>`:''}</div>`:''}
      <div class="task-resize-handle" data-rid="${t.id}" onmousedown="onResizeStart(event,'${t.id}','${idate}','day')"></div>
    </div>`;
  }).join('');
  document.getElementById('dayTimeline').innerHTML=html;
  // Routine blocks as background bands
  const routineBands=getRoutineForDay(key);
  if(routineBands.length){
    const bandLayer=document.createElement('div');
    bandLayer.style.cssText='position:absolute;top:0;left:72px;right:0;pointer-events:none;z-index:1';
    routineBands.forEach(b=>{
      const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
      const[sh,sm]=b.start.split(':').map(Number);
      const[eh,em]=b.end.split(':').map(Number);
      const topPx=(sh*60+sm)/30*DAY_SLOT_H;
      const botPx=(eh*60+em)/30*DAY_SLOT_H;
      const hPx=botPx-topPx;
      const band=document.createElement('div');
      band.style.cssText=`position:absolute;top:${topPx}px;height:${hPx}px;left:0;right:0;background:${rt.color};opacity:.06;border-radius:6px;border-left:3px solid ${rt.color}`;
      const lbl=document.createElement('div');
      lbl.style.cssText=`position:absolute;top:${topPx+3}px;right:8px;font-size:9px;font-weight:600;color:${rt.color};opacity:.55;letter-spacing:.3px`;
      lbl.textContent=(b.customName||rt.label).toUpperCase();
      bandLayer.appendChild(band);
      bandLayer.appendChild(lbl);
    });
    document.getElementById('dayTimeline').style.position='relative';
    document.getElementById('dayTimeline').appendChild(bandLayer);
  }
  // Task overlay blocks
  const overlay=document.createElement('div');
  overlay.className='day-task-layer';overlay.innerHTML=taskBlocks;
  document.getElementById('dayTimeline').appendChild(overlay);
  // Empty state
  if(!_dayTotal){
    const empty=document.createElement('div');
    empty.className='day-empty-state';
    empty.innerHTML=`<div class="day-empty-icon">📭</div><div class="day-empty-text">Nothing scheduled yet<br><span style="font-size:11px">Click a time slot or press <strong>N</strong> to add a task</span></div>`;
    document.getElementById('dayTimeline').appendChild(empty);
  }
}
function onDaySlot(k,t,e){if(e.target.closest('.day-task-block,.now-line,.task-check,.task-resize-handle'))return;openNew(k,t)}

// ══ CATEGORIES ════════════════════════════════
function renderCatChips(){
  const wrap=document.getElementById('catChips');if(!wrap)return;
  let html=`<div class="cat-chip all-chip${catFilter==='all'?' active':''}" onclick="setCF('all')">All</div>`;
  categories.forEach(c=>{
    const isActive=catFilter===c.id;
    html+=`<div class="cat-chip${isActive?' active':''}" style="${isActive?`background:${c.color}`:'background:var(--surface2)'};${isActive?'':'color:var(--text2)'}" onclick="setCF('${c.id}')">
      ${c.name}${!c.locked?`<button class="cat-chip-del" onclick="delCat('${c.id}',event)">×</button>`:''}
    </div>`;
  });
  wrap.innerHTML=html;
}
function setCF(f){catFilter=f;renderCatChips();renderCat()}
function toggleSD(){
  showDone=!showDone;
  const btn=document.getElementById('sdBtn');
  if(btn){btn.textContent=showDone?'Hide Completed':'Show Completed';btn.classList.toggle('on',showDone);}
  renderCat();
}
// How many future expanded occurrences to check when deciding "infinite" recurrence
const RECUR_INFINITE_THRESHOLD = 4;

function isInfiniteHabit(task){
  // A task counts as an "infinite habit" if it recurs and has 4+ upcoming instances
  if(!task.recur) return false;
  const today=new Date();today.setHours(0,0,0,0);
  const far=addDays(today,365);
  const upcoming=expandedTasks(today,far).filter(t=>t.id===task.id&&!t.done);
  return upcoming.length>=RECUR_INFINITE_THRESHOLD;
}

function renderCat(){
  const today=new Date();today.setHours(0,0,0,0);
  let all=expandedTasks(addDays(today,-365),addDays(today,180));
  brainDump.forEach(t=>all.push({...t,scheduled:false,_instanceDate:null}));
  const seen=new Set();all=all.filter(t=>{const k=t.id+'|'+(t._instanceDate||'bd');if(seen.has(k))return false;seen.add(k);return true;});
  if(catFilter!=='all')all=all.filter(t=>(t.category||'none')===catFilter);

  // Separate infinite habits (collapse them) from normal tasks
  const infiniteHabitIds=new Set(
    tasks.filter(t=>isInfiniteHabit(t)).map(t=>t.id)
  );

  // For "All" filter: pull one representative row per infinite habit (the earliest upcoming)
  const habitMap=new Map(); // taskId → earliest pending instance
  const normalTasks=[];

  all.forEach(t=>{
    if(infiniteHabitIds.has(t.id)){
      if(!t.done){
        const existing=habitMap.get(t.id);
        if(!existing||(t.date&&(!existing.date||t.date<existing.date))){
          habitMap.set(t.id,t);
        }
      }
      // completed instances of habits are ignored from the list entirely
    } else {
      normalTasks.push(t);
    }
  });

  const habits=[...habitMap.values()];
  const pending=normalTasks.filter(t=>!t.done);
  const done=normalTasks.filter(t=>t.done);

  let html='';

  // ── Habits section ──────────────────────────────────────
  if(habits.length){
    html+=`<div class="cat-section">
      <div class="cat-sec-title">🔁 Recurring Habits <span style="font-weight:400;opacity:.6;margin-left:4px">${habits.length}</span></div>`;
    habits.forEach(t=>{html+=catHabitRow(t)});
    html+=`</div>`;
  }

  // ── To Do section ────────────────────────────────────────
  html+=`<div class="cat-section"><div class="cat-sec-title">📋 To Do <span style="font-weight:400;opacity:.6;margin-left:4px">${pending.length}</span></div>`;
  if(!pending.length)html+=`<div class="cat-empty">All clear! 🎉</div>`;
  pending.forEach(t=>{html+=catRow(t)});
  html+=`</div>`;

  if(showDone){
    html+=`<div class="cat-section"><div class="cat-sec-title" style="color:var(--accent)">✅ Completed <span style="font-weight:400;opacity:.6;margin-left:4px">${done.length}</span></div>`;
    if(!done.length)html+=`<div class="cat-empty">Nothing completed yet</div>`;
    done.forEach(t=>{html+=catRow(t)});
    html+=`</div>`;
  }

  const el=document.getElementById('catContent');if(el)el.innerHTML=html;
}

function calcStreak(t){
  if(!t.recur||!t.doneOverrides)return 0;
  const dones=new Set(t.doneOverrides);
  let streak=0;
  const today=new Date();today.setHours(0,0,0,0);
  // Walk backwards from today checking if each expected occurrence was completed
  for(let i=0;i<90;i++){
    const d=addDays(today,-i);
    const key=dk(d);
    if(dones.has(key))streak++;
    else if(i>0)break; // allow today to be unchecked (day isn't over)
  }
  return streak;
}

function catHabitRow(t){
  const cc=catColor(t.category);
  const idate=t._instanceDate||t.date||'';
  const lbl=recurLbl(t);
  const futureCount=expandedTasks(new Date(),addDays(new Date(),365))
    .filter(x=>x.id===t.id&&!x.done).length;
  const countLabel=futureCount>=52?'ongoing forever':'~'+futureCount+' times this year';

  // Calculate streak
  const streak=calcStreak(t);
  const streakHtml=streak>1
    ?`<span class="streak-badge${streak>=7?' fire':''}">🔥 ${streak} day streak</span>`
    :'';

  // Build the change note if this task was rescheduled via "all future occurrences"
  const changeNote = t._changeNote
    ? `<div class="cat-habit-change-note">⏱ ${t._changeNote}</div>`
    : t._origTime
      ? `<div class="cat-habit-change-note">⏱ Originally at ${fmtT(t._origTime)} · now at ${fmtT(t.time)} going forward</div>`
      : '';

  return`<div class="cat-habit-row" style="border-left-color:${cc};cursor:grab"
    draggable="true"
    ondragstart="onTaskDragStart(event,'${t.id}','${idate}')" ondragend="onTaskDragEnd(event)"
    onclick="openCatEdit('${t.id}','${idate}',event)">
    <div class="cat-habit-icon">↻</div>
    <div class="cat-task-info" style="flex:1;min-width:0">
      <div class="cat-task-name">${t.name}</div>
      <div class="cat-habit-desc">Recurring habit · ${lbl} · <span class="cat-habit-count">${countLabel}</span> ${streakHtml}</div>
      ${changeNote}
      <div class="cat-task-meta" style="margin-top:3px">
        ${t.priority&&t.priority!=='none'?`<span class="mbadge ${t.priority}">${t.priority}</span>`:''}
        ${t.category&&t.category!=='none'?`<span class="mbadge" style="background:${cc}1a;color:${cc}">${catById(t.category)?.name||t.category}</span>`:''}
        ${t.date?`<span style="font-size:10px;color:var(--text3)">Next: ${t.date}${t.time?' @ '+fmtT(t.time):''}</span>`:''}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0">
      <div class="cat-habit-check-wrap">
        <div class="task-check${t.done?' checked':''}" title="Mark today done"
          onclick="event.stopPropagation();toggleDone('${t.id}','${idate}',event,this)"></div>
        <div class="cat-habit-today-lbl">Today</div>
      </div>
      <div class="cat-edit-hint" onclick="event.stopPropagation();openCatEdit('${t.id}','${idate}',event)">Edit</div>
    </div>
  </div>`;
}

function catRow(t){
  const cc=catColor(t.category);
  const isBd=brainDump.find(b=>b.id===t.id);
  const idate=t._instanceDate||t.date||'';
  let cls='cat-task-row'+(t.done?' done':'');
  // Brain dump items open the BD detail modal, scheduled tasks open the task edit modal
  const clickHandler=isBd
    ?`openBDDetail('${t.id}')`
    :`openCatEdit('${t.id}','${idate}',event)`;
  return`<div class="${cls}" style="border-left-color:${cc};cursor:${isBd?'pointer':'grab'}"
    ${!isBd?`draggable="true" ondragstart="onTaskDragStart(event,'${t.id}','${idate}')" ondragend="onTaskDragEnd(event)"`:''}
    onclick="${clickHandler}">
    <div class="task-check${t.done?' checked':''}" onclick="event.stopPropagation();toggleDone('${t.id}','${idate}',event,this)"></div>
    <div class="cat-task-info" style="flex:1;min-width:0">
      <div class="cat-task-name" style="${t.done?'text-decoration:line-through;opacity:.6':''}" ondblclick="event.stopPropagation();inlineRename(this,'${t.id}',${!!isBd})">${t.name}</div>
      <div class="cat-task-meta">
        ${t.date?`<span>${t.date}${t.time?' @ '+fmtT(t.time):''}</span>`:''}
        ${!t.scheduled&&isBd?`<span>Brain Dump</span>`:''}
        ${t.priority&&t.priority!=='none'?`<span class="mbadge ${t.priority}">${t.priority}</span>`:''}
        ${t.category&&t.category!=='none'?`<span class="mbadge" style="background:${cc}1a;color:${cc}">${catById(t.category)?.name||t.category}</span>`:''}
        ${t.recur?`<span class="mbadge recur">↻ ${recurLbl(t)}</span>`:''}
      </div>
    </div>
    <div class="cat-edit-hint" onclick="event.stopPropagation();${clickHandler}">Edit</div>
  </div>`;
}

// ══ MY ROUTINE ══════════════════════════════════
function rIcon(letter,color){
  return`<svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="11" cy="11" r="10" fill="${color}" opacity=".15"/><circle cx="11" cy="11" r="10" stroke="${color}" stroke-width="1.2" opacity=".4"/><text x="11" y="15" text-anchor="middle" font-size="10" font-weight="600" font-family="DM Sans,sans-serif" fill="${color}">${letter}</text></svg>`;
}
const ROUTINE_TYPES={
  work:{icon:()=>rIcon('W','#3b82f6'),label:'Work',color:'#3b82f6',busy:true},
  class:{icon:()=>rIcon('C','#8b5cf6'),label:'Class',color:'#8b5cf6',busy:true},
  gym:{icon:()=>rIcon('G','#10b981'),label:'Gym / Exercise',color:'#10b981',busy:true},
  meals:{icon:()=>rIcon('M','#f59e0b'),label:'Meals',color:'#f59e0b',busy:true},
  sleep:{icon:()=>rIcon('Z','#64748b'),label:'Sleep',color:'#64748b',busy:true},
  commute:{icon:()=>rIcon('D','#6366f1'),label:'Commute',color:'#6366f1',busy:true},
  church:{icon:()=>rIcon('+','#a855f7'),label:'Church',color:'#a855f7',busy:true},
  family:{icon:()=>rIcon('F','#ec4899'),label:'Family Time',color:'#ec4899',busy:true},
  free:{icon:()=>rIcon('·','#10b981'),label:'Free Time',color:'#10b981',busy:false},
  focus:{icon:()=>rIcon('!','#f43f5e'),label:'Focus / Deep Work',color:'#f43f5e',busy:true},
  selfcare:{icon:()=>rIcon('S','#14b8a6'),label:'Self-Care',color:'#14b8a6',busy:true},
  custom:{icon:()=>rIcon('?','#78716c'),label:'Custom',color:'#78716c',busy:true},
};
let routineBlocks=[];
try{routineBlocks=JSON.parse(localStorage.getItem('clarity_routine')||'[]')}catch{routineBlocks=[]}
function saveRoutine(){localStorage.setItem('clarity_routine',JSON.stringify(routineBlocks))}
function onRoutineTypeChange(){
  const v=document.getElementById('routineType').value;
  document.getElementById('routineName').style.display=v==='custom'?'':'none';
}
function renderRoutineList(){
  const el=document.getElementById('routineList');if(!el)return;
  if(!routineBlocks.length){el.innerHTML='<div style="font-size:11px;color:var(--text3);font-style:italic;padding:4px 0">No blocks yet — add your class schedule, work hours, etc.</div>';return;}
  el.innerHTML=routineBlocks.map((b,i)=>{
    const dayLabels=['S','M','T','W','T','F','S'];
    const daysStr=b.days.map(d=>dayLabels[d]).join(' ');
    const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
    const busyLabel=b.type==='free'?'<span style="color:var(--accent);font-weight:600">FREE</span>':'<span style="opacity:.5">BUSY</span>';
    return`<div class="routine-block" style="border-left:3px solid ${rt.color}">
      ${rt.icon()}
      <div class="routine-block-label">${b.customName||rt.label}</div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:1px">
        <div class="routine-block-time">${fmtT(b.start)} – ${fmtT(b.end)}</div>
        <div style="font-size:8px;letter-spacing:.5px">${busyLabel} · ${daysStr}</div>
      </div>
      <button class="routine-block-del" onclick="delRoutine(${i})">✕</button>
    </div>`;
  }).join('');
}
function toggleRoutineDay(btn){btn.classList.toggle('on')}
function addRoutineBlock(){
  const type=document.getElementById('routineType').value;
  const customName=type==='custom'?document.getElementById('routineName').value.trim():'';
  if(type==='custom'&&!customName){document.getElementById('routineName').focus();return;}
  const start=document.getElementById('routineStart').value;
  const end=document.getElementById('routineEnd').value;
  const dayBtns=document.querySelectorAll('#routineDays .routine-day-btn');
  const days=[];dayBtns.forEach((b,i)=>{if(b.classList.contains('on'))days.push(i);});
  if(!days.length){showToast('Select at least one day');return;}
  routineBlocks.push({type,customName,start,end,days});
  saveRoutine();renderRoutineList();
  document.getElementById('routineName').value='';
  showToast('Routine block added');
}
function delRoutine(i){routineBlocks.splice(i,1);saveRoutine();renderRoutineList();}

// Get routine blocks for a specific day (0=Sun..6=Sat)
function getRoutineForDay(dateKey){
  const d=fromDk(dateKey);
  const dow=d.getDay();
  return routineBlocks.filter(b=>b.days.includes(dow));
}
function routineContextStr(dateKey){
  const blocks=getRoutineForDay(dateKey);
  if(!blocks.length)return'';
  const busy=blocks.filter(b=>b.type!=='free');
  const free=blocks.filter(b=>b.type==='free');
  let str='';
  if(busy.length)str+='\n\nUser\'s routine — BUSY blocks (do NOT schedule over these):\n'+
    busy.map(b=>`${b.start} - ${b.end}: ${b.customName||(ROUTINE_TYPES[b.type]?.label||b.type)}`).join('\n');
  if(free.length)str+='\n\nUser\'s FREE blocks (prefer scheduling here):\n'+
    free.map(b=>`${b.start} - ${b.end}: Free time`).join('\n');
  return str;
}

// ══ FOCUS TIMER ═════════════════════════════════
let _focusTaskId=null,_focusDate=null;
let _focusDur=25,_focusRemaining=25*60,_focusTotal=25*60;
let _focusRunning=false,_focusInterval=null;
let _focusSessions=0;

function switchSideFocus(){
  populateFocusPicker();
  if(_focusTaskId){
    document.getElementById('focusEmpty').style.display='none';
    document.getElementById('focusActive').style.display='';
  } else {
    document.getElementById('focusEmpty').style.display='';
    document.getElementById('focusActive').style.display='none';
  }
}
function populateFocusPicker(){
  const sel=document.getElementById('focusTaskPicker');if(!sel)return;
  const key=dk(selDate);
  const dayTasks=tasksOn(key).filter(t=>!t.done);
  sel.innerHTML='<option value="">— Select a task —</option>'+
    dayTasks.map(t=>`<option value="${t.id}|${t._instanceDate||key}">${t.time?fmtT(t.time)+' ':''} ${t.name}</option>`).join('');
}
function onFocusPickTask(val){
  if(!val)return;
  const[id,idate]=val.split('|');
  startFocusForTask(id,idate);
}
function startFocusForTask(id,dateKey){
  const t=tasks.find(t=>t.id===id);if(!t)return;
  _focusTaskId=id;_focusDate=dateKey;
  const dur=t.duration||30;
  _focusDur=dur;_focusRemaining=dur*60;_focusTotal=dur*60;
  _focusRunning=false;_focusSessions=0;
  clearInterval(_focusInterval);
  document.getElementById('focusEmpty').style.display='none';
  document.getElementById('focusActive').style.display='';
  document.getElementById('focusTaskName').textContent=t.name;
  const meta=[t.time?fmtT(t.time):'',catById(t.category)?.name||'',durLabel(dur)].filter(Boolean).join(' · ');
  document.getElementById('focusTaskMeta').textContent=meta;
  document.getElementById('focusPlayBtn').textContent='Start';
  updateFocusDisplay();
  buildFocusDurButtons(dur);
  if(!sidebarOpen)toggleSidebar();
  switchSide('focus');
}
function buildFocusDurButtons(sel){
  const row=document.getElementById('focusDurRow');
  const opts=[15,25,30,45,60,90];
  row.innerHTML=opts.map(d=>`<button class="dur-opt${d===sel?' selected':''}" onclick="setFocusDur(${d})">${durLabel(d)}</button>`).join('');
}
function setFocusDur(m){
  if(_focusRunning)return;
  _focusDur=m;_focusRemaining=m*60;_focusTotal=m*60;
  buildFocusDurButtons(m);
  updateFocusDisplay();
}
function updateFocusDisplay(){
  const mins=Math.floor(_focusRemaining/60);
  const secs=_focusRemaining%60;
  document.getElementById('focusTimeDisplay').textContent=pad(mins)+':'+pad(secs);
  const pct=_focusTotal>0?(_focusTotal-_focusRemaining)/_focusTotal:0;
  const circ=326.73;
  document.getElementById('focusArc').setAttribute('stroke-dashoffset',circ-(circ*pct));
}
function toggleFocusTimer(){
  if(_focusRunning){
    // Pause
    _focusRunning=false;
    clearInterval(_focusInterval);
    document.getElementById('focusPlayBtn').textContent='Resume';
  } else {
    // Start/Resume
    _focusRunning=true;
    document.getElementById('focusPlayBtn').textContent='Pause';
    document.getElementById('focusDurRow').style.opacity='.4';
    document.getElementById('focusDurRow').style.pointerEvents='none';
    _focusInterval=setInterval(()=>{
      _focusRemaining--;
      updateFocusDisplay();
      if(_focusRemaining<=0){
        clearInterval(_focusInterval);
        _focusRunning=false;
        onFocusComplete();
      }
    },1000);
  }
}
function addFocusTime(){
  _focusRemaining+=15*60;
  _focusTotal+=15*60;
  _focusDur+=15;
  // Also update the task's duration
  const t=tasks.find(t=>t.id===_focusTaskId);
  if(t)t.duration=_focusDur;
  save();
  updateFocusDisplay();
  showToast('+15 min added');
}
function resetFocusTimer(){
  clearInterval(_focusInterval);
  _focusRunning=false;
  // Reset to the task's original duration, stay on task
  const t=tasks.find(t=>t.id===_focusTaskId);
  const dur=t?t.duration||30:_focusDur;
  _focusDur=dur;_focusRemaining=dur*60;_focusTotal=dur*60;
  document.getElementById('focusPlayBtn').textContent='Start';
  document.getElementById('focusDurRow').style.opacity='';
  document.getElementById('focusDurRow').style.pointerEvents='';
  buildFocusDurButtons(dur);
  updateFocusDisplay();
}
function endFocusSession(){
  clearInterval(_focusInterval);
  _focusRunning=false;
  const elapsed=_focusTotal-_focusRemaining;
  if(elapsed>60){
    _focusSessions++;
    document.getElementById('focusSessionCount').textContent=`${_focusSessions} session${_focusSessions>1?'s':''} completed today`;
  }
  // Check overflow and offer reflow
  const t=tasks.find(t=>t.id===_focusTaskId);
  if(t&&elapsed>t.duration*60){
    const overflowMins=Math.ceil((elapsed-t.duration*60)/60);
    t.duration=Math.ceil(elapsed/60);
    save();
    offerReflow(t,overflowMins);
  }
  resetFocusUI();
}
function onFocusComplete(){
  playDone();
  _focusSessions++;
  document.getElementById('focusSessionCount').textContent=`${_focusSessions} session${_focusSessions>1?'s':''} completed today`;
  // Mark task done
  const t=tasks.find(t=>t.id===_focusTaskId);
  if(t){
    if(t.recur&&_focusDate){
      if(!t.doneOverrides)t.doneOverrides=[];
      if(!t.doneOverrides.includes(_focusDate))t.doneOverrides.push(_focusDate);
    } else {
      t.done=true;
    }
    save();renderAll();
  }
  // Show break suggestion
  const isLongBreak=_focusSessions%4===0;
  const breakMins=isLongBreak?15:5;
  document.getElementById('focusActive').innerHTML=`
    <div class="focus-break-msg">
      <div class="focus-break-msg-icon">${isLongBreak?'🌿':'☕'}</div>
      <div class="focus-break-msg-text">${isLongBreak?'Long break — 15 min':'Nice work! Take a 5 min break'}</div>
      <div class="focus-break-msg-sub">${t?'"'+t.name+'" marked complete':'Session finished'}</div>
    </div>
    <div class="focus-controls" style="margin-top:12px">
      <button class="focus-btn primary" onclick="resetFocusUI()">Done</button>
    </div>
    <div class="focus-session-count">${_focusSessions} session${_focusSessions>1?'s':''} today</div>`;
}
function resetFocusUI(){
  _focusTaskId=null;_focusDate=null;_focusRunning=false;
  clearInterval(_focusInterval);
  document.getElementById('focusDurRow').style.opacity='';
  document.getElementById('focusDurRow').style.pointerEvents='';
  switchSideFocus();
}

// ══ REFLOW (cascade after overrun) ══════════════
let _reflowTask=null,_reflowOverflow=0;
function offerReflow(task,overflowMins){
  _reflowTask=task;_reflowOverflow=overflowMins;
  document.getElementById('reflowSub').textContent=
    `"${task.name}" ran ${overflowMins} min over. Your remaining tasks may be affected.`;
  // Show preview of affected tasks
  const dateKey=task.date;
  const affected=tasksOn(dateKey).filter(t=>t.id!==task.id&&t.time&&t.time>task.time).sort((a,b)=>a.time.localeCompare(b.time));
  const preview=document.getElementById('reflowPreview');
  if(affected.length){
    preview.innerHTML=affected.map(t=>{
      const[h,m]=t.time.split(':').map(Number);
      const newMins=h*60+m+overflowMins;
      const newTime=pad(Math.floor(newMins/60)%24)+':'+pad(newMins%60);
      return`<div class="reflow-task">
        <span style="flex:1;font-weight:500">${t.name}</span>
        <span class="reflow-old">${fmtT(t.time)}</span>
        <span class="reflow-arrow">→</span>
        <span class="reflow-new">${fmtT(newTime)}</span>
      </div>`;
    }).join('');
  } else {
    preview.innerHTML='<div style="font-size:11px;color:var(--text3);font-style:italic">No tasks after this one to adjust.</div>';
  }
  document.getElementById('reflowOverlay').classList.add('open');
}
function closeReflow(){document.getElementById('reflowOverlay').classList.remove('open')}
function doReflow(mode){
  if(!_reflowTask){closeReflow();return;}
  const dateKey=_reflowTask.date;
  const affected=tasks.filter(t=>t.scheduled&&t.date===dateKey&&t.id!==_reflowTask.id&&t.time&&t.time>_reflowTask.time);
  affected.sort((a,b)=>a.time.localeCompare(b.time));
  if(mode==='push'){
    affected.forEach(t=>{
      const[h,m]=t.time.split(':').map(Number);
      const newMins=h*60+m+_reflowOverflow;
      t.time=pad(Math.floor(newMins/60)%24)+':'+pad(newMins%60);
    });
    showToast(`${affected.length} task${affected.length!==1?'s':''} pushed back ${_reflowOverflow}m`);
  } else if(mode==='trim'&&affected.length){
    const next=affected[0];
    next.duration=Math.max(15,(next.duration||30)-_reflowOverflow);
    const[h,m]=next.time.split(':').map(Number);
    const newMins=h*60+m+_reflowOverflow;
    next.time=pad(Math.floor(newMins/60)%24)+':'+pad(newMins%60);
    showToast(`"${next.name}" trimmed to ${durLabel(next.duration)}`);
  }
  save();renderAll();closeReflow();
  _reflowTask=null;_reflowOverflow=0;
}

// ══ SHARE MY DAY ════════════════════════════════
function shareMyDay(){
  const key=dk(selDate);
  const dayTasks=tasksOn(key).filter(t=>t.time).sort((a,b)=>a.time.localeCompare(b.time));
  const d=selDate;
  const title=DLONG[d.getDay()]+', '+MONTHS_LONG[d.getMonth()]+' '+d.getDate();
  
  const W=400,rowH=36,padTop=80,padBot=30;
  const H=padTop+Math.max(dayTasks.length,3)*rowH+padBot;
  const canvas=document.createElement('canvas');
  canvas.width=W*2;canvas.height=H*2;
  const ctx=canvas.getContext('2d');
  ctx.scale(2,2);
  
  // Background
  ctx.fillStyle=isDark?'#1a1a1a':'#fafaf9';
  ctx.fillRect(0,0,W,H);
  
  // Header
  ctx.fillStyle=isDark?'#f5f5f4':'#1c1917';
  ctx.font='600 20px DM Sans,sans-serif';
  ctx.fillText(title,20,35);
  ctx.fillStyle=isDark?'#78716c':'#a8a29e';
  ctx.font='400 12px DM Sans,sans-serif';
  const doneCount=dayTasks.filter(t=>t.done||(t.doneOverrides||[]).includes(key)).length;
  ctx.fillText(dayTasks.length+' tasks · '+doneCount+' done',20,54);
  
  // Divider
  ctx.strokeStyle=isDark?'#2e2e2e':'#e7e5e4';
  ctx.beginPath();ctx.moveTo(20,66);ctx.lineTo(W-20,66);ctx.stroke();
  
  // Tasks
  dayTasks.forEach((t,i)=>{
    const y=padTop+i*rowH;
    const isDone=t.done||(t.doneOverrides||[]).includes(key);
    // Time
    ctx.fillStyle=isDark?'#10b981':'#059669';
    ctx.font='700 11px DM Sans,sans-serif';
    ctx.fillText(fmtT(t.time),20,y+14);
    // Name
    ctx.fillStyle=isDone?(isDark?'#78716c':'#a8a29e'):(isDark?'#f5f5f4':'#1c1917');
    ctx.font=(isDone?'400':'500')+' 13px DM Sans,sans-serif';
    ctx.fillText(t.name.slice(0,35)+(t.name.length>35?'…':''),90,y+14);
    // Duration
    ctx.fillStyle=isDark?'#78716c':'#a8a29e';
    ctx.font='400 10px DM Sans,sans-serif';
    ctx.fillText(durLabel(t.duration||30),90,y+28);
    // Done check
    if(isDone){
      ctx.fillStyle='#10b981';
      ctx.font='12px sans-serif';
      ctx.fillText('✓',W-30,y+16);
    }
  });
  
  if(!dayTasks.length){
    ctx.fillStyle=isDark?'#78716c':'#a8a29e';
    ctx.font='italic 13px DM Sans,sans-serif';
    ctx.fillText('Nothing scheduled',W/2-50,padTop+20);
  }
  
  // Footer
  ctx.fillStyle=isDark?'#3a3a3a':'#d6d3d1';
  ctx.font='400 9px DM Sans,sans-serif';
  ctx.fillText('Made with Clarity',W/2-35,H-12);
  
  canvas.toBlob(blob=>{
    if(navigator.share&&navigator.canShare){
      const file=new File([blob],'my-day-'+key+'.png',{type:'image/png'});
      navigator.share({title:'My schedule — '+title,files:[file]}).catch(()=>{});
    } else {
      const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);
      a.download='clarity-'+key+'.png';
      a.click();URL.revokeObjectURL(a.href);
      showToast('Schedule image downloaded');
    }
  },'image/png');
}

// ══ SMART RESCHEDULE ════════════════════════════
function checkOverdueTasks(){
  const todayKey=dk(new Date());
  const yesterday=dk(addDays(new Date(),-1));
  const overdue=tasks.filter(t=>
    t.scheduled&&t.date&&t.date<todayKey&&!t.done&&!t.recur&&
    !(t._smartRescheduleOffered||[]).includes(t.date)
  );
  if(!overdue.length)return;
  // Show for the first overdue task
  const t=overdue[0];
  offerSmartReschedule(t);
}
function offerSmartReschedule(t){
  const todayKey=dk(new Date());
  const tomorrowKey=dk(addDays(new Date(),1));
  let html=`
    <div style="text-align:center;margin-bottom:4px">
      <div style="font-size:24px;margin-bottom:4px">⏰</div>
      <div class="modal-title">"${t.name}" is overdue</div>
      <div class="modal-sub">Scheduled for ${t.date} — what would you like to do?</div>
    </div>
    <div class="reschedule-opts">
      <div class="reschedule-opt" onclick="smartReschedule('${t.id}','${todayKey}')">
        <div class="reschedule-opt-title">Move to today</div>
        <div class="reschedule-opt-sub">Reschedule to today at the same time</div>
      </div>
      <div class="reschedule-opt" onclick="smartReschedule('${t.id}','${tomorrowKey}')">
        <div class="reschedule-opt-title">Move to tomorrow</div>
        <div class="reschedule-opt-sub">Push it to tomorrow</div>
      </div>
      <div class="reschedule-opt" onclick="smartRescheduleDismiss('${t.id}')">
        <div class="reschedule-opt-title" style="opacity:.6">Leave it</div>
        <div class="reschedule-opt-sub">Keep it where it is — I'll handle it</div>
      </div>
    </div>`;
  
  let overlay=document.getElementById('smartRescheduleOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='smartRescheduleOverlay';
    overlay.className='modal-overlay';
    overlay.onclick=function(e){if(e.target===this)this.classList.remove('open')};
    overlay.innerHTML='<div class="modal" onclick="event.stopPropagation()" style="max-width:400px" id="smartRescheduleContent"></div>';
    document.body.appendChild(overlay);
  }
  document.getElementById('smartRescheduleContent').innerHTML=html;
  overlay.classList.add('open');
}
function smartReschedule(id,newDate){
  const t=tasks.find(t=>t.id===id);
  if(t){t.date=newDate;save();renderAll();}
  document.getElementById('smartRescheduleOverlay').classList.remove('open');
  showToast('Moved to '+newDate);
  // Check for more overdue
  setTimeout(checkOverdueTasks,500);
}
function smartRescheduleDismiss(id){
  const t=tasks.find(t=>t.id===id);
  if(t){
    if(!t._smartRescheduleOffered)t._smartRescheduleOffered=[];
    t._smartRescheduleOffered.push(t.date);
    save();
  }
  document.getElementById('smartRescheduleOverlay').classList.remove('open');
  setTimeout(checkOverdueTasks,500);
}
// Check on app open (after splash)
const _origEnterApp=enterApp;
window.enterApp=function(){
  _origEnterApp();
  setTimeout(checkOverdueTasks,1500);
};

// ══ CANVAS LMS IMPORT ════════════════════════════
function importCanvas(){
  const raw=document.getElementById('canvasInput').value.trim();
  if(!raw){showToast('Paste your assignments first');return;}
  const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean);
  let added=0;
  const monthMap={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  lines.forEach(line=>{
    // Try to parse "Name — Due Apr 15 at 11:59pm" or "Name - Due: April 15, 2026"
    let name=line,dateStr='',timeStr='23:59';
    // Split on common separators
    const parts=line.split(/\s*[—–-]\s*(?:due:?\s*)/i);
    if(parts.length>=2){
      name=parts[0].trim();
      const rest=parts.slice(1).join(' ').trim();
      // Parse date from rest
      const dateMatch=rest.match(/(\w{3,9})\.?\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?/i);
      if(dateMatch){
        const mon=dateMatch[1].toLowerCase().slice(0,3);
        const day=parseInt(dateMatch[2]);
        const year=dateMatch[3]?parseInt(dateMatch[3]):new Date().getFullYear();
        if(monthMap[mon]!==undefined){
          dateStr=year+'-'+pad(monthMap[mon]+1)+'-'+pad(day);
        }
      }
      // Parse time
      const timeMatch=rest.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
      if(timeMatch){
        let h=parseInt(timeMatch[1]),m=parseInt(timeMatch[2]);
        if(timeMatch[3]){
          if(timeMatch[3].toLowerCase()==='pm'&&h!==12)h+=12;
          if(timeMatch[3].toLowerCase()==='am'&&h===12)h=0;
        }
        timeStr=pad(h)+':'+pad(m);
      }
    }
    if(!name)return;
    if(!dateStr)dateStr=dk(addDays(new Date(),7)); // default to 1 week out
    tasks.push({
      id:genId(),name,date:dateStr,time:timeStr,duration:60,
      priority:'high',category:'work',notes:'Imported from Canvas',
      scheduled:true,done:false,recur:false,recurN:1,recurU:'day',
      doneOverrides:[],deletedOccurrences:[]
    });
    added++;
  });
  save();renderAll();
  document.getElementById('canvasInput').value='';
  showToast(`${added} assignment${added!==1?'s':''} imported`);
  closeDrawer();
}

// ══ WEEKLY PLANNING MODE ═════════════════════════
function openWeekPlan(){
  const today=new Date();today.setHours(0,0,0,0);
  // Next week Mon-Sun (or this week if it's Sunday/Monday)
  const dow=today.getDay();
  const nextMon=dow===0?addDays(today,1):dow===1?today:addDays(today,8-dow);
  const days=Array.from({length:7},(_,i)=>addDays(nextMon,i));

  document.getElementById('wpDateRange').textContent=
    MONTHS_S[days[0].getMonth()]+' '+days[0].getDate()+' – '+
    MONTHS_S[days[6].getMonth()]+' '+days[6].getDate()+', '+days[6].getFullYear();

  // Load saved intention
  const intentionKey='clarity_intention_'+dk(days[0]);
  document.getElementById('wpIntention').value=localStorage.getItem(intentionKey)||'';

  const todayKey=dk(today);
  const grid=document.getElementById('wpGrid');
  grid.innerHTML=days.map(d=>{
    const key=dk(d);
    const isToday=key===todayKey;
    const dayTasks=tasksOn(key).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
    const routine=getRoutineForDay(key);

    let content='';
    // Show routine blocks
    routine.forEach(b=>{
      const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
      content+=`<div class="wp-routine">${fmtT(b.start)}–${fmtT(b.end)} ${b.customName||rt.label}</div>`;
    });
    // Show tasks
    if(dayTasks.length){
      dayTasks.slice(0,5).forEach(t=>{
        const isDone=t.done||(t.doneOverrides||[]).includes(t._instanceDate);
        content+=`<div class="wp-task-mini${isDone?' done':''}" style="border-left-color:${catColor(t.category)}">${t.time?fmtT(t.time)+' ':''}${t.name}</div>`;
      });
      if(dayTasks.length>5)content+=`<div style="font-size:8px;color:var(--text3);text-align:center">+${dayTasks.length-5} more</div>`;
    } else if(!routine.length){
      content+=`<div class="wp-empty">Open</div>`;
    }

    return`<div class="wp-day${isToday?' today':''}" onclick="closeWeekPlan();selDate=fromDk('${key}');switchView('day')">
      <div class="wp-day-hdr">${DAYS_S[d.getDay()]}</div>
      <div class="wp-day-date">${MONTHS_S[d.getMonth()]} ${d.getDate()}</div>
      ${content}
    </div>`;
  }).join('');

  document.getElementById('weekPlanOverlay').classList.add('open');
}
function closeWeekPlan(){document.getElementById('weekPlanOverlay').classList.remove('open')}
function saveWeekIntention(){
  const today=new Date();today.setHours(0,0,0,0);
  const dow=today.getDay();
  const nextMon=dow===0?addDays(today,1):dow===1?today:addDays(today,8-dow);
  const key='clarity_intention_'+dk(nextMon);
  const val=document.getElementById('wpIntention').value.trim();
  if(val)localStorage.setItem(key,val);
  else localStorage.removeItem(key);
  closeWeekPlan();
  showToast(val?'Weekly intention saved':'Intention cleared');
}

// ══ WEEKLY WRAP-UP ══════════════════════════════
function openWrapup(){
  const today=new Date();today.setHours(0,0,0,0);
  // Calculate week: Mon-Sun ending most recently
  const dow=today.getDay();
  const sunEnd=dow===0?today:addDays(today,-dow);
  const monStart=addDays(sunEnd,-6);
  
  document.getElementById('wrapupDateRange').textContent=
    MONTHS_S[monStart.getMonth()]+' '+monStart.getDate()+' – '+
    MONTHS_S[sunEnd.getMonth()]+' '+sunEnd.getDate()+', '+sunEnd.getFullYear();

  // Gather all tasks in the week
  const weekTasks=expandedTasks(monStart,sunEnd);
  const completed=weekTasks.filter(t=>t.done||(t.doneOverrides||[]).includes(t._instanceDate));
  const total=weekTasks.length;
  const doneCount=completed.length;

  // Habit hit rate
  const habitTasks=weekTasks.filter(t=>t.recur);
  const habitDone=habitTasks.filter(t=>t.done||(t.doneOverrides||[]).includes(t._instanceDate));
  const habitRate=habitTasks.length?Math.round(habitDone.length/habitTasks.length*100):0;

  // Most productive day
  const dayCounts={};
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  completed.forEach(t=>{
    if(t._instanceDate){
      const d=fromDk(t._instanceDate);
      const dn=dayNames[d.getDay()];
      dayCounts[dn]=(dayCounts[dn]||0)+1;
    }
  });
  let bestDay='—',bestCount=0;
  Object.entries(dayCounts).forEach(([d,c])=>{if(c>bestCount){bestDay=d;bestCount=c;}});

  // Per-day bar chart
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const maxDay=Math.max(1,...days.map(d=>dayCounts[d]||0));
  const barsHtml=days.map(d=>{
    const c=dayCounts[d]||0;
    const pct=Math.round(c/maxDay*100);
    return`<div class="wrapup-bar-row">
      <span class="wrapup-bar-label">${d}</span>
      <div class="wrapup-bar-track"><div class="wrapup-bar-fill" style="width:${pct}%"></div></div>
      <span class="wrapup-bar-val">${c}</span>
    </div>`;
  }).join('');

  // Motivational message
  const msgs=[
    doneCount===0?'Fresh start ahead — this week is yours.':
    doneCount<5?'Building momentum. Every task counts.':
    doneCount<15?'Solid week. You showed up consistently.':
    'Incredible output. You crushed it this week.'
  ];

  document.getElementById('wrapupContent').innerHTML=`
    <div class="wrapup-stat-grid">
      <div class="wrapup-stat"><div class="wrapup-stat-num">${doneCount}</div><div class="wrapup-stat-label">Tasks Done</div></div>
      <div class="wrapup-stat"><div class="wrapup-stat-num">${total-doneCount}</div><div class="wrapup-stat-label">Remaining</div></div>
      <div class="wrapup-stat"><div class="wrapup-stat-num">${habitRate}%</div><div class="wrapup-stat-label">Habit Hit Rate</div></div>
      <div class="wrapup-stat"><div class="wrapup-stat-num">${bestDay}</div><div class="wrapup-stat-label">Most Productive</div></div>
    </div>
    <div style="font-size:11px;font-weight:600;color:var(--text2);margin-top:4px">Daily breakdown</div>
    ${barsHtml}
    <div class="wrapup-msg">${msgs[0]}</div>`;

  document.getElementById('wrapupOverlay').classList.add('open');
}
function closeWrapup(){document.getElementById('wrapupOverlay').classList.remove('open')}

// ══ AI SCHEDULE ═════════════════════════════════
let _aiTasks=[];

function openAISchedule(){
  document.getElementById('aiDate').value=dk(selDate);
  document.getElementById('aiInput').value='';
  document.getElementById('aiPreviewWrap').style.display='none';
  document.getElementById('aiError').style.display='none';
  document.getElementById('aiGenBtn').style.display='';
  document.getElementById('aiAcceptBtn').style.display='none';
  document.getElementById('aiGenLabel').style.display='';
  document.getElementById('aiGenLabel').textContent='Generate Schedule';
  document.getElementById('aiSpinner').style.display='none';
  _aiTasks=[];
  document.getElementById('aiScheduleOverlay').classList.add('open');
  setTimeout(()=>{
    const ta=document.getElementById('aiInput');
    ta.focus();autoExpand(ta);
  },150);
}
function fillAIFromBD(){
  if(!brainDump.length){showToast('Brain Dump is empty');return;}
  const ta=document.getElementById('aiInput');
  const existing=ta.value.trim();
  const bdText=brainDump.map(t=>{
    let line='• '+t.name;
    if(t.priority&&t.priority!=='none')line+=` (${t.priority} priority)`;
    if(t.notes)line+=` - ${t.notes}`;
    return line;
  }).join('\n');
  ta.value=existing?(existing+'\n'+bdText):bdText;
  autoExpand(ta);
}
// Bullet point behavior for AI input
function closeAISchedule(){
  document.getElementById('aiScheduleOverlay').classList.remove('open');
}

async function generateAISchedule(){
  const input=document.getElementById('aiInput').value.trim();
  if(!input){document.getElementById('aiInput').focus();return;}
  const dateVal=document.getElementById('aiDate').value;
  const startTime=document.getElementById('aiStartTime').value||'08:00';
  const d=fromDk(dateVal);
  const dayName=DLONG[d.getDay()];

  // Get existing tasks for that day
  const existing=tasksOn(dateVal).filter(t=>t.time).map(t=>
    `${fmtT(t.time)} - ${t.name} (${durLabel(t.duration||30)})`
  );
  const existingStr=existing.length
    ?`\n\nAlready scheduled:\n${existing.join('\n')}`
    :'';

  // Get routine blocks for this day
  const routineStr=routineContextStr(dateVal);

  // Show spinner
  document.getElementById('aiGenLabel').style.display='none';
  document.getElementById('aiSpinner').style.display='';
  document.getElementById('aiError').style.display='none';
  document.getElementById('aiPreviewWrap').style.display='none';

  const prompt=`You are a scheduling assistant. The user wants to plan their ${dayName}, ${dateVal}. Their day starts at ${startTime}.${existingStr}${routineStr}

The user says:
"${input}"

Create a realistic schedule. Assign each task a specific start time (24h format HH:MM), estimated duration in minutes (15 min increments), and a priority (high/medium/low/none). Also assign a category from: work, personal, health, or none.

Rules:
- Don't overlap with existing tasks or routine blocks
- Leave reasonable gaps (meals, breaks)
- Put time-specific requests where asked ("at noon", "in the morning")
- Estimate realistic durations
- Order by logical flow of the day

Respond with ONLY a JSON array, no markdown, no backticks, no explanation:
[{"name":"Task","time":"HH:MM","duration":30,"priority":"medium","category":"work"}]`;

  try{
    const response=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        model:"claude-sonnet-4-20250514",
        max_tokens:1000,
        messages:[{role:"user",content:prompt}]
      })
    });
    const data=await response.json();
    const text=data.content.map(i=>i.text||'').join('');
    const clean=text.replace(/```json|```/g,'').trim();
    _aiTasks=JSON.parse(clean);

    // Show preview
    const preview=document.getElementById('aiPreview');
    preview.innerHTML=_aiTasks.map((t,i)=>
      `<div class="ai-preview-task">
        <span style="font-size:11px;font-weight:700;color:var(--text3);min-width:18px">${i+1}.</span>
        <span class="ai-preview-time">${fmtT(t.time)}</span>
        <span class="ai-preview-name">${t.name}</span>
        <span class="ai-preview-dur">${durLabel(t.duration||30)}</span>
      </div>`
    ).join('');
    document.getElementById('aiPreviewWrap').style.display='';
    document.getElementById('aiGenBtn').style.display='';
    document.getElementById('aiGenLabel').textContent='Regenerate';
    document.getElementById('aiAcceptBtn').style.display='';
  }catch(err){
    document.getElementById('aiError').textContent='Something went wrong — try again. '+err.message;
    document.getElementById('aiError').style.display='';
  }
  document.getElementById('aiGenLabel').style.display='';
  document.getElementById('aiSpinner').style.display='none';
}

function acceptAISchedule(){
  const dateVal=document.getElementById('aiDate').value;
  _aiTasks.forEach(t=>{
    tasks.push({
      id:genId(),
      name:t.name,
      date:dateVal,
      time:t.time,
      duration:t.duration||30,
      priority:t.priority||'none',
      category:t.category||'none',
      notes:'',
      scheduled:true,
      done:false,
      recur:false,recurN:1,recurU:'day',
      doneOverrides:[],deletedOccurrences:[]
    });
  });
  save();closeAISchedule();
  selDate=fromDk(dateVal);
  switchView('day');
  renderAll();
  showToast(`${_aiTasks.length} tasks added to your schedule`);
  _aiTasks=[];
}

// ══ INLINE RENAME (dbl-click in categories) ════
function inlineRename(el,id,isBd){
  const orig=el.textContent;
  const input=document.createElement('input');
  input.value=orig;
  input.style.cssText='width:100%;padding:2px 6px;border:1.5px solid var(--accent);border-radius:5px;font-family:inherit;font-size:12px;font-weight:500;color:var(--text);background:var(--bg);outline:none;box-shadow:0 0 0 3px rgba(var(--accent-rgb),.12)';
  el.textContent='';
  el.appendChild(input);
  input.focus();input.select();
  function commit(){
    const val=input.value.trim();
    if(val&&val!==orig){
      const t=isBd?brainDump.find(t=>t.id===id):tasks.find(t=>t.id===id);
      if(t){t.name=val;save();}
    }
    renderAll();
  }
  input.addEventListener('blur',commit);
  input.addEventListener('keydown',function(e){
    if(e.key==='Enter'){e.preventDefault();input.blur();}
    if(e.key==='Escape'){input.value=orig;input.blur();}
  });
}

// ══ BRAIN DUMP ════════════════════════════════
// openCatEdit — unified click-to-edit from the Categories view
function openCatEdit(id, instanceDate, e){
  if(e) e.stopPropagation();
  const t=tasks.find(t=>t.id===id);
  if(!t)return;
  // Re-use the existing task edit modal
  const fakeEvent={stopPropagation:()=>{}};
  openEdit(id, instanceDate, fakeEvent);
}

function addBD(){
  const name=document.getElementById('bdInput').value.trim();if(!name)return;
  brainDump.push({id:genId(),name,priority:document.getElementById('bdPri').value,category:document.getElementById('bdCat').value});
  const ta=document.getElementById('bdInput');
  ta.value='';
  ta.style.height='';  // reset to CSS min-height
  document.getElementById('bdPri').value='none';
  document.getElementById('bdCat').value='none';
  save();renderBD();if(activeSide==='priority')renderPri();
}
document.getElementById('bdInput').addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();addBD()}
});
function renderBD(){
  const list=document.getElementById('bdList');if(!list)return;
  if(!brainDump.length){list.innerHTML=`<div class="bd-hint">Drag tasks to any day or time slot →</div>`;return}
  list.innerHTML=brainDump.map(t=>{
    const cc=catColor(t.category);
    let badges='';
    if(t.priority&&t.priority!=='none')badges+=`<span class="bd-badge pri-${t.priority}">${t.priority}</span>`;
    if(t.category&&t.category!=='none'){const cat=catById(t.category);badges+=`<span class="bd-badge" style="background:${cc}1a;color:${cc}">${cat?cat.name:t.category}</span>`;}
    if(t.notes)badges+=`<span class="bd-badge" style="background:var(--surface3);color:var(--text3)">has notes</span>`;
    return`<div class="bd-card" draggable="true" style="border-left-color:${cc}"
      ondragstart="onBDS(event,'${t.id}')" ondragend="onBDE(event)"
      onclick="openBDDetail('${t.id}')">
      <div class="bd-name">${t.name}</div>
      <div class="bd-meta">${badges}<button class="bd-del" onclick="event.stopPropagation();delBD('${t.id}')">Remove</button></div>
    </div>`;
  }).join('');
}
function delBD(id){brainDump=brainDump.filter(t=>t.id!==id);save();renderBD()}

// ══ PRIORITY BOARD ════════════════════════════
function renderPri(){
  const board=document.getElementById('priBoard');if(!board)return;
  const all=[...tasks,...brainDump.map(t=>({...t,scheduled:false}))];
  const secs=[{k:'high',l:'High',d:'high'},{k:'medium',l:'Medium',d:'medium'},{k:'low',l:'Low',d:'low'},{k:'none',l:'No Priority',d:'none'}];
  board.innerHTML=secs.map(sec=>{
    const items=all.filter(t=>(t.priority||'none')===sec.k);
    return`<div><div class="pri-sec-title"><span class="pri-dot ${sec.d}"></span>${sec.l} (${items.length})</div>
    ${!items.length?`<div class="pri-empty">None yet</div>`:items.map(t=>{
      const isBd=brainDump.find(b=>b.id===t.id);
      return`<div class="pri-item${t.done?' done':''}" style="cursor:pointer" onclick="cyclePriority('${t.id}',event)" title="Click to change priority">
        <div class="task-check${t.done?' checked':''}" onclick="event.stopPropagation();toggleDone('${t.id}','${t.date||''}',event,this)"></div>
        <div style="flex:1;min-width:0"><div class="pri-name">${t.name}</div>
        <div class="pri-date">${t.date||''}${t.time?' @ '+fmtT(t.time):''}${isBd?' · Brain Dump':!t.scheduled?' · Unscheduled':''}${t.recur?' · ↻ '+recurLbl(t):''}</div></div>
        <span style="font-size:9px;color:var(--text3);opacity:.5;flex-shrink:0">▲▼</span>
      </div>`;
    }).join('')}</div>`;
  }).join('');
}
const PRI_CYCLE=['none','low','medium','high'];
function cyclePriority(id,e){
  e.stopPropagation();
  const t=tasks.find(t=>t.id===id)||brainDump.find(t=>t.id===id);
  if(!t)return;
  const cur=t.priority||'none';
  const idx=PRI_CYCLE.indexOf(cur);
  t.priority=PRI_CYCLE[(idx+1)%PRI_CYCLE.length];
  save();renderAll();
}

// ══ DRAG & DROP ════════════════════════════════
let dragBdId=null,dragTaskId=null,dragInstanceDate=null;
function onBDS(e,id){dragBdId=id;dragTaskId=null;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','bd:'+id);setTimeout(()=>e.target.classList.add('dragging'),0)}
function onBDE(e){e.target.classList.remove('dragging');dragBdId=null}
function onTaskDragStart(e,id,idate){
  dragTaskId=id;dragInstanceDate=idate;dragBdId=null;
  e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','task:'+id);
  setTimeout(()=>{const el=e.target.closest('.day-task,.slot-task,.m-chip,.cat-task-row,.cat-habit-row,.wk-task-block,.day-task-block');if(el)el.classList.add('dragging-task');},0);
  e.stopPropagation();
}
function onTaskDragEnd(){document.querySelectorAll('.dragging-task').forEach(el=>el.classList.remove('dragging-task'));dragTaskId=null;dragInstanceDate=null}
function onDO(e){if(!dragBdId&&!dragTaskId)return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';e.currentTarget.classList.add('drag-over')}
function onDL(e){e.currentTarget.classList.remove('drag-over')}
function snapFlash(el){if(!el)return;el.classList.remove('snap-flash');void el.offsetWidth;el.classList.add('snap-flash');setTimeout(()=>el.classList.remove('snap-flash'),600)}
// ══ SLOT VALIDATION ══════════════════════════
const MAX_TASKS_PER_SLOT = 2;

function tasksInSlot(dateKey, time){
  // All non-done tasks scheduled at this exact date+time
  return tasks.filter(t=>t.scheduled&&t.date===dateKey&&t.time===time&&!t.done);
}

function slotFull(dateKey, time, excludeId){
  const existing=tasksInSlot(dateKey,time).filter(t=>t.id!==excludeId);
  return existing.length>=MAX_TASKS_PER_SLOT;
}

function duplicateInSlot(dateKey, time, taskName, excludeId){
  return tasksInSlot(dateKey,time).some(t=>
    t.id!==excludeId &&
    t.name.toLowerCase().trim()===taskName.toLowerCase().trim()
  );
}

function showWarnToast(msg){
  let el=document.getElementById('slotWarnToast');
  if(!el){
    el=document.createElement('div');
    el.id='slotWarnToast';
    el.className='slot-warn-toast';
    document.body.appendChild(el);
  }
  el.textContent=msg;
  clearTimeout(el._t);
  el.classList.add('show');
  el._t=setTimeout(()=>el.classList.remove('show'),2800);
}

// ══ RECUR RESCHEDULE DIALOG ═══════════════════
let _rrTaskId=null,_rrInstanceDate=null,_rrNewDate=null,_rrNewTime=null;

function openRecurReschedule(taskId,instanceDate,newDate,newTime){
  _rrTaskId=taskId;_rrInstanceDate=instanceDate;
  _rrNewDate=newDate;_rrNewTime=newTime;
  const t=tasks.find(t=>t.id===taskId);if(!t)return;
  const sub=`"${t.name}" · ${recurLbl(t)}`;
  document.getElementById('recurRescheduleSub').textContent=sub;
  document.getElementById('recurRescheduleOverlay').classList.add('open');
}

function closeRecurReschedule(){
  document.getElementById('recurRescheduleOverlay').classList.remove('open');
  _rrTaskId=_rrInstanceDate=_rrNewDate=_rrNewTime=null;
  renderAll();  // re-render so dragged item snaps back visually
}

function doRecurReschedule(mode){
  const t=tasks.find(t=>t.id===_rrTaskId);if(!t){closeRecurReschedule();return;}

  if(mode==='this'){
    // Carve out just this one occurrence, leave all others intact
    if(!t.deletedOccurrences)t.deletedOccurrences=[];
    if(!t.deletedOccurrences.includes(_rrInstanceDate))
      t.deletedOccurrences.push(_rrInstanceDate);
    const isDone=(t.doneOverrides||[]).includes(_rrInstanceDate)||(!t._virtual&&t.done);
    tasks.push({
      ...t,id:genId(),
      date:_rrNewDate||_rrInstanceDate,
      time:_rrNewTime||t.time||'09:00',
      recur:false,done:isDone,
      doneOverrides:[],deletedOccurrences:[]
    });

  } else {
    // "All future occurrences" — preserve everything BEFORE _rrInstanceDate untouched.
    // Strategy: split the task in two.
    //  1. Freeze the original task: mark _rrInstanceDate and all future occurrences as
    //     deleted on the OLD task (so past occurrences remain intact on the calendar).
    //  2. Create a brand-new recurring task starting at _rrNewDate / _rrNewTime,
    //     inheriting all other properties. Store _origTime so the category note shows
    //     what changed.

    const origTime = t.time;
    const origDate = t.date;

    // --- Freeze the old task from _rrInstanceDate forward ---
    if(!t.deletedOccurrences) t.deletedOccurrences = [];

    // Walk every occurrence from the base date; delete any that falls on or after _rrInstanceDate
    let base = fromDk(origDate);
    for(let i = 0; i <= 730; i++){
      const candidate = new Date(base);
      if(t.recurU==='day')   candidate.setDate(candidate.getDate() + t.recurN * i);
      else if(t.recurU==='week') candidate.setDate(candidate.getDate() + t.recurN * 7 * i);
      else                   candidate.setMonth(candidate.getMonth() + t.recurN * i);
      const cdk = dk(candidate);
      if(cdk >= _rrInstanceDate && !t.deletedOccurrences.includes(cdk)){
        t.deletedOccurrences.push(cdk);
      }
      // Stop well past a reasonable horizon
      if(candidate > addDays(new Date(), 760)) break;
    }

    // --- Create the new forward-looking recurring task ---
    const newStartDate = _rrNewDate || _rrInstanceDate;
    const newTime      = _rrNewTime || origTime;

    // Build a descriptive change note only when something actually changed
    const timeChanged = newTime !== origTime;
    const dateChanged = newStartDate !== _rrInstanceDate;
    let changeNote = '';
    if(timeChanged && dateChanged){
      changeNote = `Rescheduled from ${fmtT(origTime)} · starts ${newStartDate}`;
    } else if(timeChanged){
      changeNote = `Time changed from ${fmtT(origTime)} to ${fmtT(newTime)}`;
    } else if(dateChanged){
      changeNote = `Day pattern shifted from ${_rrInstanceDate}`;
    }

    tasks.push({
      ...t,
      id:   genId(),
      date: newStartDate,
      time: newTime,
      _origTime:  timeChanged ? origTime : undefined,
      _changeNote: changeNote || undefined,
      // Fresh overrides — the new task starts clean
      doneOverrides:      [],
      deletedOccurrences: [],
    });
  }

  document.getElementById('recurRescheduleOverlay').classList.remove('open');
  _rrTaskId=_rrInstanceDate=_rrNewDate=_rrNewTime=null;
  save();renderAll();
}

function onDropDate(e,dateKey){
  e.currentTarget.classList.remove('drag-over');
  if(dragBdId){
    const t=brainDump.find(t=>t.id===dragBdId);if(!t)return;
    const defaultTime='09:00';
    if(duplicateInSlot(dateKey,defaultTime,t.name,null)){
      showWarnToast(`"${t.name}" is already in that slot`);dragBdId=null;return;
    }
    if(slotFull(dateKey,defaultTime,null)){
      showWarnToast('That slot already has 2 tasks — pick a different time');dragBdId=null;return;
    }
    tasks.push({...t,date:dateKey,time:defaultTime,scheduled:true,done:false,recur:false,recurN:1,recurU:'day',doneOverrides:[],deletedOccurrences:[]});
    brainDump=brainDump.filter(t=>t.id!==dragBdId);dragBdId=null;save();renderAll();
    setTimeout(()=>snapFlash(e.currentTarget),100);
  }else if(dragTaskId){
    rescheduleTask(dragTaskId,dragInstanceDate,dateKey,null);
    dragTaskId=null;dragInstanceDate=null;
    setTimeout(()=>snapFlash(e.currentTarget),100);
  }
}

function onDropSlot(e,dateKey,time){
  const dropEl=e.currentTarget;dropEl.classList.remove('drag-over');
  if(dragBdId){
    const t=brainDump.find(t=>t.id===dragBdId);if(!t)return;
    if(duplicateInSlot(dateKey,time,t.name,null)){
      showWarnToast(`"${t.name}" is already in that slot`);dragBdId=null;return;
    }
    if(slotFull(dateKey,time,null)){
      showWarnToast('That slot already has 2 tasks — pick a different time');dragBdId=null;return;
    }
    tasks.push({...t,date:dateKey,time,scheduled:true,done:false,recur:false,recurN:1,recurU:'day',doneOverrides:[],deletedOccurrences:[]});
    brainDump=brainDump.filter(t=>t.id!==dragBdId);dragBdId=null;save();renderAll();
    setTimeout(()=>snapFlash(dropEl),100);
  }else if(dragTaskId){
    rescheduleTask(dragTaskId,dragInstanceDate,dateKey,time,dropEl);
    dragTaskId=null;dragInstanceDate=null;
  }
}

function rescheduleTask(taskId,instanceDate,newDate,newTime,snapEl){
  const t=tasks.find(t=>t.id===taskId);if(!t)return;

  const resolvedTime=newTime||t.time||'09:00';
  const resolvedDate=newDate||instanceDate;

  // Slot validation — skip if dropping in the exact same slot
  const baseDate=t.recur?(instanceDate||t.date):t.date;
  const sameslot=(baseDate===resolvedDate&&t.time===resolvedTime);
  if(!sameslot){
    if(duplicateInSlot(resolvedDate,resolvedTime,t.name,t.id)){
      showWarnToast(`"${t.name}" is already in that slot`);
      renderAll();return;
    }
    if(slotFull(resolvedDate,resolvedTime,t.id)){
      showWarnToast('That slot already has 2 tasks — pick a different time');
      renderAll();return;
    }
  }

  if(t.recur){
    // Always show the "this / all" dialog for recurring tasks
    openRecurReschedule(taskId,instanceDate,resolvedDate,resolvedTime);
    if(snapEl)setTimeout(()=>snapFlash(snapEl),100);
    return;
  }

  // Non-recurring — just move it
  t.date=resolvedDate;
  if(newTime)t.time=newTime;
  save();renderAll();
  if(snapEl)setTimeout(()=>snapFlash(snapEl),100);
}

// ══ TOUCH DRAG POLYFILL (mobile) ═══════════════
(function(){
  let _tDragEl=null,_tGhost=null,_tType=null,_tId=null,_tIDate=null,_tSugg=null;
  let _tStartX=0,_tStartY=0,_tMoved=false;
  const MOVE_THRESH=12;

  function findDraggable(el){
    // Don't start drag on checkboxes or resize handles
    if(el.closest('.task-check,.task-resize-handle'))return null;
    const bd=el.closest('.bd-card[draggable]');if(bd)return{el:bd,type:'bd',id:bd.getAttribute('ondragstart')?.match(/'([^']+)'/)?.[1]};
    const task=el.closest('.cat-task-row[draggable],.cat-habit-row[draggable]');
    if(task){
      const m=task.getAttribute('ondragstart')?.match(/'([^']+)','([^']*)'/);
      if(m)return{el:task,type:'task',id:m[1],idate:m[2]};
    }
    // Week/Day view task blocks
    const block=el.closest('.wk-task-block[draggable],.day-task-block[draggable]');
    if(block){
      const m=block.getAttribute('ondragstart')?.match(/'([^']+)','([^']*)'/);
      if(m)return{el:block,type:'task',id:m[1],idate:m[2]};
    }
    const sugg=el.closest('.sugg-card[draggable]');
    if(sugg){
      const m=sugg.getAttribute('ondragstart')?.match(/(\d+),(\d+)/);
      if(m)return{el:sugg,type:'sugg',ci:+m[1],ii:+m[2]};
    }
    return null;
  }

  document.addEventListener('touchstart',function(e){
    const info=findDraggable(e.target);if(!info)return;
    _tDragEl=info.el;_tType=info.type;_tId=info.id;_tIDate=info.idate;
    _tSugg=info.type==='sugg'?{ci:info.ci,ii:info.ii}:null;
    _tStartX=e.touches[0].clientX;_tStartY=e.touches[0].clientY;_tMoved=false;
  },{passive:true});

  document.addEventListener('touchmove',function(e){
    if(!_tDragEl)return;
    const dx=e.touches[0].clientX-_tStartX,dy=e.touches[0].clientY-_tStartY;
    if(!_tMoved&&Math.abs(dx)+Math.abs(dy)<MOVE_THRESH)return;
    // If mostly vertical, let the browser scroll instead of dragging
    if(!_tMoved&&Math.abs(dy)>Math.abs(dx)*1.5){_tDragEl=null;return;}
    if(!_tMoved){
      _tMoved=true;
      _tGhost=_tDragEl.cloneNode(true);
      _tGhost.style.cssText='position:fixed;z-index:9999;pointer-events:none;opacity:.8;width:'+_tDragEl.offsetWidth+'px;transform:scale(.92);transition:none;box-shadow:0 8px 24px rgba(0,0,0,.2);border-radius:10px';
      document.body.appendChild(_tGhost);
      _tDragEl.style.opacity='.3';
      // Set global drag state
      if(_tType==='bd'){dragBdId=_tId;dragTaskId=null;suggDragId=null;}
      else if(_tType==='task'){dragTaskId=_tId;dragInstanceDate=_tIDate;dragBdId=null;suggDragId=null;}
      else if(_tType==='sugg'){suggDragId=_tSugg;dragBdId=null;dragTaskId=null;}
      // On mobile, close sidebar so calendar is visible for drop
      if(window.innerWidth<=640&&(_tType==='bd'||_tType==='sugg')){
        if(sidebarOpen)toggleSidebar();
      }
    }
    e.preventDefault();
    _tGhost.style.left=(e.touches[0].clientX-_tGhost.offsetWidth/2)+'px';
    _tGhost.style.top=(e.touches[0].clientY-30)+'px';
  },{passive:false});

  document.addEventListener('touchend',function(e){
    if(!_tDragEl||!_tMoved){_tDragEl=null;return;}
    if(_tGhost){_tGhost.remove();_tGhost=null;}
    // Hide dragged element so elementFromPoint finds the slot underneath
    _tDragEl.style.display='none';
    const touch=e.changedTouches[0];
    const dropEl=document.elementFromPoint(touch.clientX,touch.clientY);
    _tDragEl.style.display='';
    _tDragEl.style.opacity='';
    if(dropEl){
      // Check for slot drop (week/day)
      const slot=dropEl.closest('.wk-slot,.day-slot');
      if(slot&&slot.getAttribute('ondrop')){
        const m=slot.getAttribute('ondrop').match(/'([^']+)','([^']+)'/);
        if(m){
          const fakeE={currentTarget:slot,preventDefault:()=>{},stopPropagation:()=>{}};
          slot.classList.remove('drag-over');
          window.onDropSlot(fakeE,m[1],m[2]);
        }
      } else {
        // Check for date drop (month cell)
        const cell=dropEl.closest('.month-cell[ondrop]');
        if(cell){
          const m=cell.getAttribute('ondrop').match(/'([^']+)'/);
          if(m){
            const fakeE={currentTarget:cell,preventDefault:()=>{},stopPropagation:()=>{}};
            cell.classList.remove('drag-over');
            window.onDropDate(fakeE,m[1]);
          }
        }
      }
    }
    dragBdId=null;dragTaskId=null;dragInstanceDate=null;suggDragId=null;
    _tDragEl=null;_tType=null;_tId=null;_tIDate=null;_tSugg=null;_tMoved=false;
  },{passive:true});
})();

// ══ TOGGLE DONE ══════════════════════════════
function toggleDone(id,instanceDate,e,el){
  e.stopPropagation();if(AC.state==='suspended')AC.resume();
  const t=tasks.find(t=>t.id===id);if(!t)return;
  if(t.recur&&instanceDate){
    if(!t.doneOverrides)t.doneOverrides=[];
    const idx=t.doneOverrides.indexOf(instanceDate);
    if(idx===-1){t.doneOverrides.push(instanceDate);playDone();doRipple(el);}
    else{t.doneOverrides.splice(idx,1);playUndo();}
  }else{
    t.done=!t.done;
    if(t.done){playDone();doRipple(el);}else{playUndo();}
  }
  save();renderAll();
}
function doRipple(el){
  if(!el)return;
  const r=document.createElement('span');
  r.style.cssText='position:absolute;top:50%;left:50%;width:15px;height:15px;border-radius:50%;background:rgba(var(--accent-rgb),.45);animation:ripple-out .55s ease-out forwards;pointer-events:none;z-index:10';
  el.style.position='relative';el.appendChild(r);setTimeout(()=>r.remove(),620);
}

// ══ DURATION PICKER ══════════════════════════
const DUR_OPTS=[15,30,45,60,75,90,105,120,150,180,240];
function durLabel(m){if(m<60)return m+'m';const h=Math.floor(m/60),r=m%60;return r?h+'h '+r+'m':h+'h'}
let _selDur=30;
function buildDurSelect(val){
  _selDur=val||30;
  const wrap=document.getElementById('fDurSelect');if(!wrap)return;
  wrap.innerHTML=DUR_OPTS.map(d=>
    `<div class="dur-opt${d===_selDur?' selected':''}" onclick="pickDur(${d})">${durLabel(d)}</div>`
  ).join('');
}
function pickDur(v){
  _selDur=v;
  document.querySelectorAll('.dur-opt').forEach(el=>el.classList.toggle('selected',parseInt(el.textContent)||durToMin(el.textContent)===v));
  // re-render cleanly
  buildDurSelect(v);
}
function durToMin(lbl){
  // parse "1h 30m" or "45m" or "2h" back to minutes (for internal use)
  const mH=lbl.match(/(\d+)h/),mM=lbl.match(/(\d+)m/);
  return (mH?parseInt(mH[1])*60:0)+(mM?parseInt(mM[1]):0)||30;
}

// ══ RESIZE STATE ═════════════════════════════
let _rzTask=null,_rzStartY=0,_rzStartDur=0,_rzView='';
function onResizeStart(e,tid,idate,view){
  e.stopPropagation();e.preventDefault();
  const t=tasks.find(t=>t.id===tid);if(!t)return;
  _rzTask=t;_rzStartY=e.clientY;_rzStartDur=t.duration||30;_rzView=view;
  document.addEventListener('mousemove',onResizeMove);
  document.addEventListener('mouseup',onResizeUp);
  document.querySelector(`[data-rid="${tid}"]`)?.classList.add('active');
  document.body.style.cursor='ns-resize';
  document.body.style.userSelect='none';
}
function onResizeMove(e){
  if(!_rzTask)return;
  const slotH=_rzView==='week'?42:52;
  const dy=e.clientY-_rzStartY;
  const deltaMins=Math.round(dy/slotH*30/15)*15;
  const newDur=Math.max(15,_rzStartDur+deltaMins);
  _rzTask.duration=newDur;
  // Live-update the block height
  const block=document.querySelector(`.wk-task-block[data-id="${_rzTask.id}"],.day-task-block[data-id="${_rzTask.id}"]`);
  if(block){block.style.height=(newDur/30*slotH-1)+'px';}
  // Live-update dur label
  const dl=block?.querySelector('.wk-task-block-dur,.day-task-block-dur');
  if(dl)dl.textContent=durLabel(newDur);
}
function onResizeUp(){
  if(_rzTask)save();
  _rzTask=null;
  document.removeEventListener('mousemove',onResizeMove);
  document.removeEventListener('mouseup',onResizeUp);
  document.querySelectorAll('.task-resize-handle.active').forEach(el=>el.classList.remove('active'));
  document.body.style.cursor='';document.body.style.userSelect='';
  renderAll();
}

let mMode=null,mDate=null,mTime=null,mId=null,mInstanceDate=null;
function toggleRecurUI(){document.getElementById('recurOpts').style.display=document.getElementById('fRecurOn').checked?'flex':'none'}
function openNew(dateKey,time){
  mMode='new';mDate=dateKey;mTime=time;mId=null;mInstanceDate=null;
  document.getElementById('mTitle').textContent='New Task';
  const d=fromDk(dateKey);
  document.getElementById('mSub').textContent=DLONG[d.getDay()]+', '+MONTHS_LONG[d.getMonth()]+' '+d.getDate()+' · '+fmtT(time);
  document.getElementById('fName').value='';
  document.getElementById('fPri').value='none';
  buildAllCatSelects('none');
  document.getElementById('fNotes').value='';
  document.getElementById('fRecurOn').checked=false;
  document.getElementById('fRecurN').value=1;
  document.getElementById('fRecurU').value='day';
  document.getElementById('recurOpts').style.display='none';
  document.getElementById('btnDel').style.display='none';
  buildDurSelect(30);
  showModal('mOverlay');
}
function openEdit(id,instanceDate,e){
  e.stopPropagation();
  const t=tasks.find(t=>t.id===id);if(!t)return;
  mMode='edit';mId=id;mInstanceDate=instanceDate;
  document.getElementById('mTitle').textContent='Edit Task';
  const d=fromDk(t.date);
  document.getElementById('mSub').textContent=DLONG[d.getDay()]+', '+MONTHS_LONG[d.getMonth()]+' '+d.getDate()+(t.time?' · '+fmtT(t.time):'');
  document.getElementById('fName').value=t.name;
  document.getElementById('fPri').value=t.priority||'none';
  buildAllCatSelects(t.category||'none');
  document.getElementById('fNotes').value=t.notes||'';
  document.getElementById('fRecurOn').checked=!!t.recur;
  document.getElementById('fRecurN').value=t.recurN||1;
  document.getElementById('fRecurU').value=t.recurU||'day';
  document.getElementById('recurOpts').style.display=t.recur?'flex':'none';
  document.getElementById('btnDel').style.display='block';
  buildDurSelect(t.duration||30);
  showModal('mOverlay');
}
function showModal(id){
  document.getElementById(id).classList.add('open');
  setTimeout(()=>{
    const f=document.getElementById('fName');
    if(f){f.focus();autoExpand(f);}
    resetTextareaHeights();
  },150);
}
function closeModal(){document.getElementById('mOverlay').classList.remove('open')}
function handleMBg(e){if(e.target===e.currentTarget)closeModal()}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(_searchOpen)toggleSearch();closeModal();closeDelModal();closeAddCatModal();closeDrawer();closeBDDetail();closeRecurReschedule();closeClearModal();closeClearConfirm();closeSuggAlready();closeWrapup();closeWeekPlan();closeAISchedule();}
  if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&document.getElementById('mOverlay').classList.contains('open')){e.preventDefault();saveTask();}
});
function saveTask(){
  const name=document.getElementById('fName').value.trim();if(!name){document.getElementById('fName').focus();return}
  const priority=document.getElementById('fPri').value,category=document.getElementById('fCat').value,notes=document.getElementById('fNotes').value.trim();
  const recur=document.getElementById('fRecurOn').checked,recurN=parseInt(document.getElementById('fRecurN').value)||1,recurU=document.getElementById('fRecurU').value;
  const duration=_selDur||30;
  if(mMode==='new'){tasks.push({id:genId(),name,priority,category,notes,date:mDate,time:mTime,duration,scheduled:true,done:false,recur,recurN,recurU,doneOverrides:[],deletedOccurrences:[]});}
  else{const t=tasks.find(t=>t.id===mId);if(t)Object.assign(t,{name,priority,category,notes,duration,recur,recurN,recurU});}
  save();closeModal();renderAll();
}
function startDelete(){
  const t=tasks.find(t=>t.id===mId);if(!t)return;
  closeModal();
  if(t.recur)showModal('delOverlay');
  else doDelete('all');
}
function closeDelModal(){document.getElementById('delOverlay').classList.remove('open')}
function doDelete(mode){
  const t=tasks.find(t=>t.id===mId);if(!t){closeDelModal();return;}
  if(mode==='this'&&mInstanceDate){
    if(!t.deletedOccurrences)t.deletedOccurrences=[];
    if(!t.deletedOccurrences.includes(mInstanceDate))t.deletedOccurrences.push(mInstanceDate);
    if(t.doneOverrides){t.doneOverrides=t.doneOverrides.filter(d=>d!==mInstanceDate);}
    save();closeDelModal();closeModal();renderAll();
    showUndoToast('Occurrence removed',()=>{
      t.deletedOccurrences=t.deletedOccurrences.filter(d=>d!==mInstanceDate);
      save();renderAll();
    });
  } else {
    const removed=JSON.parse(JSON.stringify(t));
    tasks=tasks.filter(t=>t.id!==mId);
    save();closeDelModal();closeModal();renderAll();
    showUndoToast(`"${removed.name}" deleted`,()=>{
      tasks.push(removed);save();renderAll();
    });
  }
}

// ══ UNDO TOAST ══════════════════════════════════
let _undoTimer=null;
function showUndoToast(msg,undoFn){
  let el=document.getElementById('undoToast');
  if(!el){
    el=document.createElement('div');el.id='undoToast';
    el.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(12px);background:var(--text);color:var(--bg);padding:9px 14px 9px 18px;border-radius:99px;font-size:12px;font-weight:500;z-index:9100;opacity:0;transition:opacity .2s,transform .2s;white-space:nowrap;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,.25)';
    document.body.appendChild(el);
  }
  el.innerHTML=`<span>${msg}</span><button style="background:rgba(255,255,255,.2);border:none;color:inherit;padding:4px 10px;border-radius:99px;font-family:'DM Sans',sans-serif;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:.3px" id="undoBtn">UNDO</button>`;
  el.style.opacity='1';el.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(_undoTimer);
  document.getElementById('undoBtn').onclick=()=>{
    undoFn();
    el.style.opacity='0';el.style.transform='translateX(-50%) translateY(8px)';
    clearTimeout(_undoTimer);
  };
  _undoTimer=setTimeout(()=>{el.style.opacity='0';el.style.transform='translateX(-50%) translateY(8px)'},5000);
}

// ══ TIPS SYSTEM ═════════════════════════════════
const APP_TIPS=[
  {icon:'👋',title:'Welcome to Clarity',body:'This is your personal scheduler. Use these tabs to switch between Year, Month, Week, and Day views.',
    target:'.nav-tabs',label:'View tabs'},
  {icon:'🧠',title:'Brain Dump',body:'Got something on your mind? Click this button to open the sidebar. Type any thought or task and hit Add — organize it later.',
    target:'.hdr-btn.accent',label:'Open sidebar'},
  {icon:'✋',title:'Drag to Schedule',body:'Grab any Brain Dump card and drag it onto a day in Month view, or onto a specific time slot in Week or Day view.',
    target:'#bdList',label:'Drag from here',pre:function(){if(!sidebarOpen)toggleSidebar();switchSide('braindump');}},
  {icon:'📅',title:'Click Any Time Slot',body:'In Week or Day view, click on any empty time slot to create a new task right there. Fill in the name, set a priority, and you\'re done.',
    target:'.nav-tab:nth-child(4)',label:'Try Day view'},
  {icon:'⌨️',title:'Quick Add Shortcut',body:'Press the N key anywhere (when you\'re not typing) to pop open a quick-add bar. Type a task name, pick a time, and hit Save.',
    target:'header',label:'Press N anywhere'},
  {icon:'🔁',title:'Recurring Habits',body:'When creating or editing a task, check "Recurring" to make it repeat daily, weekly, or monthly. Great for habits like exercise or check-ins.',
    target:null},
  {icon:'🏷️',title:'Categories',body:'See all your tasks organized in one place. Create custom categories with colors to keep things sorted.',
    target:'.nav-tab:nth-child(5)',label:'Categories tab'},
  {icon:'↕️',title:'Resize Tasks',body:'In Week or Day view, grab the bottom edge of any task block and drag up or down to change how long it takes.',
    target:null},
  {icon:'✅',title:'Check Things Off',body:'Click the checkbox on any task to mark it done. You\'ll hear a little chime and see a satisfying strikethrough. Click again to undo.',
    target:null},
  {icon:'🎨',title:'Make It Yours',body:'Click the Clarity logo to open Settings. Switch dark/light mode, pick a theme color, and toggle 12h/24h time.',
    target:'.logo-btn',label:'Open settings'},
];
let _tipIdx=0;
let _tipsOn=localStorage.getItem('clarity_tips')===null?true:localStorage.getItem('clarity_tips')==='true';
let _tipHighlightEl=null;

function clearTipHighlight(){
  if(_tipHighlightEl){
    _tipHighlightEl.classList.remove('tip-highlight');
    _tipHighlightEl=null;
  }
  document.querySelectorAll('.tip-highlight').forEach(el=>el.classList.remove('tip-highlight'));
  document.querySelectorAll('.tip-highlight-label').forEach(el=>el.remove());
}

function renderTip(){
  clearTipHighlight();
  const bar=document.getElementById('tipBar');if(!bar)return;
  if(!_tipsOn){bar.classList.remove('visible');return;}
  const tip=APP_TIPS[_tipIdx];
  document.getElementById('tipIcon').textContent=tip.icon;
  document.getElementById('tipTitle').textContent=tip.title;
  document.getElementById('tipBody').textContent=tip.body;
  document.getElementById('tipCounter').textContent=(_tipIdx+1)+' / '+APP_TIPS.length;
  bar.classList.add('visible');
  // Run pre-action if any (e.g. open sidebar)
  if(tip.pre)tip.pre();
  // Highlight target element
  if(tip.target){
    setTimeout(()=>{
      const el=document.querySelector(tip.target);
      if(el){
        _tipHighlightEl=el;
        el.classList.add('tip-highlight');
        if(tip.label){
          const rect=el.getBoundingClientRect();
          const lbl=document.createElement('span');
          lbl.className='tip-highlight-label';
          lbl.textContent=tip.label;
          document.body.appendChild(lbl);
          // Position: try above, fall back to below if clipped
          const lblH=24;
          let top=rect.top-lblH-8;
          if(top<4)top=rect.bottom+8;
          lbl.style.top=top+'px';
          lbl.style.left=(rect.left+rect.width/2)+'px';
          lbl.style.transform='translateX(-50%)';
        }
      }
    },120);
  }
}
function nextTip(){_tipIdx=(_tipIdx+1)%APP_TIPS.length;renderTip();}
function prevTip(){_tipIdx=(_tipIdx-1+APP_TIPS.length)%APP_TIPS.length;renderTip();}
function toggleTips(){
  _tipsOn=!_tipsOn;
  localStorage.setItem('clarity_tips',_tipsOn?'true':'false');
  document.getElementById('tipsToggle').classList.toggle('on',_tipsOn);
  if(!_tipsOn)clearTipHighlight();
  renderTip();
}
// ══ EXPORT / IMPORT ═════════════════════════════
function exportData(){
  const data={
    tasks,brainDump,categories,
    journal:JSON.parse(localStorage.getItem('clarity_journal')||'{}'),
    theme:currentTheme,dark:isDark,military:useMilitary,
    exportedAt:new Date().toISOString(),version:'v19'
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='clarity-backup-'+dk(new Date())+'.json';
  a.click();URL.revokeObjectURL(a.href);
  showToast('Data exported successfully');
}
function importData(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=function(ev){
    try{
      const data=JSON.parse(ev.target.result);
      if(data.tasks)tasks=data.tasks;
      if(data.brainDump)brainDump=data.brainDump;
      if(data.categories&&data.categories.length)categories=data.categories;
      if(data.journal)localStorage.setItem('clarity_journal',JSON.stringify(data.journal));
      if(data.theme)applyTheme(data.theme);
      if(data.dark!==undefined)applyDark(data.dark);
      if(data.military!==undefined)setTimeFormat(data.military);
      save();renderAll();
      showToast('Data imported successfully');
    }catch(err){
      showToast('Import failed — invalid file');
    }
  };
  reader.readAsText(file);
  e.target.value='';
}

// ══ TASK TOOLTIP (hover preview) ════════════════
let _tooltipEl=null,_tooltipTimer=null;
function initTooltips(){
  document.addEventListener('mouseover',function(e){
    const block=e.target.closest('.wk-task-block,.day-task-block');
    if(!block)return;
    const id=block.dataset.id;
    const t=tasks.find(t=>t.id===id);
    if(!t||(!t.notes&&!t.category)||t.notes==='')return;
    clearTimeout(_tooltipTimer);
    _tooltipTimer=setTimeout(()=>{
      if(!_tooltipEl){
        _tooltipEl=document.createElement('div');
        _tooltipEl.className='task-tooltip';
        document.body.appendChild(_tooltipEl);
      }
      let html=`<div class="task-tooltip-title">${t.name}</div>`;
      const meta=[];
      if(t.category&&t.category!=='none'){const c=catById(t.category);if(c)meta.push(c.name);}
      if(t.priority&&t.priority!=='none')meta.push(t.priority+' priority');
      if(t.recur)meta.push(recurLbl(t));
      if(meta.length)html+=`<div style="font-size:10px;color:var(--text3);margin-bottom:3px">${meta.join(' · ')}</div>`;
      if(t.notes)html+=`<div class="task-tooltip-notes">${t.notes.slice(0,120)}${t.notes.length>120?'…':''}</div>`;
      _tooltipEl.innerHTML=html;
      const rect=block.getBoundingClientRect();
      _tooltipEl.style.left=Math.min(rect.left,window.innerWidth-280)+'px';
      _tooltipEl.style.top=(rect.bottom+6)+'px';
      _tooltipEl.classList.add('show');
    },400);
  });
  document.addEventListener('mouseout',function(e){
    const block=e.target.closest('.wk-task-block,.day-task-block');
    if(block){clearTimeout(_tooltipTimer);if(_tooltipEl)_tooltipEl.classList.remove('show');}
  });
}

// ══ SEARCH ══════════════════════════════════════
let _searchOpen=false;
function toggleSearch(){
  _searchOpen=!_searchOpen;
  document.getElementById('searchBar').classList.toggle('open',_searchOpen);
  if(_searchOpen){
    setTimeout(()=>document.getElementById('searchInput').focus(),80);
  } else {
    document.getElementById('searchInput').value='';
    document.getElementById('searchResults').innerHTML='';
  }
}
function onSearch(){
  const q=document.getElementById('searchInput').value.trim().toLowerCase();
  const res=document.getElementById('searchResults');
  if(!q){res.innerHTML='';return;}
  const all=[...tasks,...brainDump.map(t=>({...t,_isBd:true}))];
  const matches=all.filter(t=>
    t.name.toLowerCase().includes(q)||
    (t.notes&&t.notes.toLowerCase().includes(q))||
    (t.category&&t.category!=='none'&&(catById(t.category)?.name||'').toLowerCase().includes(q))
  ).slice(0,12);
  if(!matches.length){res.innerHTML='<div class="search-empty">No results</div>';return;}
  res.innerHTML=matches.map(t=>{
    const cc=catColor(t.category);
    const isBd=t._isBd;
    const meta=[isBd?'Brain Dump':t.date||'',t.time?fmtT(t.time):'',t.recur?'↻ '+recurLbl(t):''].filter(Boolean).join(' · ');
    return`<div class="search-result" onclick="onSearchSelect('${t.id}',${isBd?'true':'false'},'${t.date||''}')">
      <span class="sr-dot" style="background:${cc}"></span>
      <div><div class="sr-name">${t.name}</div><div class="sr-meta">${meta}</div></div>
    </div>`;
  }).join('');
}
function onSearchSelect(id,isBd,dateKey){
  toggleSearch();
  if(isBd){openBDDetail(id);return;}
  if(dateKey){selDate=fromDk(dateKey);switchView('day');}
  setTimeout(()=>{const fakeE={stopPropagation:()=>{}};openEdit(id,dateKey,fakeE);},200);
}
// Close search on outside click
document.addEventListener('click',function(e){
  if(_searchOpen&&!e.target.closest('.search-wrap'))toggleSearch();
});

// ══ BRAIN DUMP REORDER ══════════════════════════
let _bdReorderTarget=null;
function initBDReorder(){
  const list=document.getElementById('bdList');if(!list)return;
  list.addEventListener('dragover',function(e){
    if(!dragBdId)return;
    e.preventDefault();
    const card=e.target.closest('.bd-card');
    list.querySelectorAll('.bd-card').forEach(c=>{c.classList.remove('drag-above','drag-below');});
    if(card){
      const rect=card.getBoundingClientRect();
      const mid=rect.top+rect.height/2;
      if(e.clientY<mid)card.classList.add('drag-above');
      else card.classList.add('drag-below');
      _bdReorderTarget=card;
    }
  });
  list.addEventListener('dragleave',function(e){
    if(!e.currentTarget.contains(e.relatedTarget)){
      list.querySelectorAll('.bd-card').forEach(c=>{c.classList.remove('drag-above','drag-below');});
    }
  });
  list.addEventListener('drop',function(e){
    e.preventDefault();
    list.querySelectorAll('.bd-card').forEach(c=>{c.classList.remove('drag-above','drag-below');});
    if(!dragBdId||!_bdReorderTarget)return;
    // Find the target BD item by matching its onclick
    const targetMatch=_bdReorderTarget.getAttribute('onclick')?.match(/'([^']+)'/);
    if(!targetMatch)return;
    const targetId=targetMatch[1];
    if(targetId===dragBdId){_bdReorderTarget=null;return;}
    const fromIdx=brainDump.findIndex(t=>t.id===dragBdId);
    const toIdx=brainDump.findIndex(t=>t.id===targetId);
    if(fromIdx===-1||toIdx===-1)return;
    const rect=_bdReorderTarget.getBoundingClientRect();
    const insertAfter=e.clientY>rect.top+rect.height/2;
    const [item]=brainDump.splice(fromIdx,1);
    let newIdx=brainDump.findIndex(t=>t.id===targetId);
    if(insertAfter)newIdx++;
    brainDump.splice(newIdx,0,item);
    save();renderBD();
    _bdReorderTarget=null;
  });
}

// ══ CONFETTI ════════════════════════════════════
function fireConfetti(){
  const canvas=document.createElement('canvas');
  canvas.className='confetti-canvas';
  canvas.width=window.innerWidth;canvas.height=window.innerHeight;
  document.body.appendChild(canvas);
  const ctx=canvas.getContext('2d');
  const colors=['#10b981','#f59e0b','#3b82f6','#f43f5e','#8b5cf6','#ec4899'];
  const pieces=[];
  for(let i=0;i<80;i++){
    pieces.push({
      x:canvas.width/2+(Math.random()-.5)*200,
      y:canvas.height/2,
      vx:(Math.random()-.5)*12,
      vy:Math.random()*-14-4,
      r:Math.random()*6+3,
      color:colors[Math.floor(Math.random()*colors.length)],
      rot:Math.random()*360,
      rotV:(Math.random()-.5)*12,
      life:1
    });
  }
  let frame=0;
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    let alive=false;
    pieces.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;p.vy+=.35;p.rot+=p.rotV;
      p.life-=.012;
      if(p.life<=0)return;
      alive=true;
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot*Math.PI/180);
      ctx.globalAlpha=Math.max(0,p.life);
      ctx.fillStyle=p.color;
      ctx.fillRect(-p.r/2,-p.r,p.r,p.r*2);
      ctx.restore();
    });
    if(alive&&frame<180){frame++;requestAnimationFrame(draw);}
    else canvas.remove();
  }
  draw();
}

// Hook confetti into toggleDone
const _origToggleDone=toggleDone;
window.toggleDone=function(id,instanceDate,e,el){
  _origToggleDone(id,instanceDate,e,el);
  // Check if all tasks for today are now done
  const todayKey=dk(new Date());
  if(curView==='day'&&dk(selDate)===todayKey){
    const dayTasks=tasksOn(todayKey);
    if(dayTasks.length>0&&dayTasks.every(t=>t.done||(t.doneOverrides||[]).includes(todayKey))){
      setTimeout(fireConfetti,300);
    }
  }
};

// ══ KEYBOARD NAVIGATION ═════════════════════════
document.addEventListener('keydown',function(e){
  // Skip if typing in an input/textarea
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT')return;
  if(e.key==='ArrowLeft'){
    e.preventDefault();navPrev();
  } else if(e.key==='ArrowRight'){
    e.preventDefault();navNext();
  } else if(e.key==='t'||e.key==='T'){
    // T for today
    goToday();
  } else if(e.key==='/'){
    // / for search
    e.preventDefault();
    if(!_searchOpen)toggleSearch();
  }
});

// ══ CATEGORY MANAGEMENT ════════════════════════
let selectedCatColor=CAT_COLORS[3];
function openAddCatModal(){
  selectedCatColor=CAT_COLORS[3];
  document.getElementById('catNameInput').value='';
  document.getElementById('colorGrid').innerHTML=CAT_COLORS.map(c=>
    `<div class="cat-color-swatch${c===selectedCatColor?' selected':''}" style="background:${c}" onclick="selectCatColor('${c}')"></div>`
  ).join('');
  showModal('addCatOverlay');
  setTimeout(()=>document.getElementById('catNameInput').focus(),150);
}
function closeAddCatModal(){document.getElementById('addCatOverlay').classList.remove('open')}
function selectCatColor(c){
  selectedCatColor=c;
  document.querySelectorAll('.cat-color-swatch').forEach(s=>{
    s.classList.toggle('selected',s.style.background===c||s.style.backgroundColor===c);
  });
}
function saveNewCat(){
  const name=document.getElementById('catNameInput').value.trim();if(!name)return;
  categories.push({id:'cat_'+genId(),name,color:selectedCatColor,locked:false});
  save();closeAddCatModal();renderAll();
}
function delCat(id,e){
  e.stopPropagation();
  if(!confirm('Delete category? Tasks keep their data but lose the color label.'))return;
  categories=categories.filter(c=>c.id!==id);
  if(catFilter===id)catFilter='all';
  save();renderAll();
}

// ══ BRAIN DUMP DETAIL MODAL ═══════════════════
let bdDetailId=null;
function openBDDetail(id){
  const t=brainDump.find(t=>t.id===id);if(!t)return;
  bdDetailId=id;
  document.getElementById('bdDetailName').value=t.name||'';
  document.getElementById('bdDetailPri').value=t.priority||'none';
  buildCatOptions('bdDetailCat',t.category||'none');
  document.getElementById('bdDetailNotes').value=t.notes||'';
  // Pre-fill today's date as default suggestion
  const todayStr=dk(new Date());
  document.getElementById('bdDetailDate').value=t.scheduledDate||'';
  document.getElementById('bdDetailTime').value=t.scheduledTime||'';
  document.getElementById('bdDetailOverlay').classList.add('open');
  setTimeout(()=>{
    const nameEl=document.getElementById('bdDetailName');
    nameEl.focus();autoExpand(nameEl);
    autoExpand(document.getElementById('bdDetailNotes'));
  },150);
}
function closeBDDetail(){document.getElementById('bdDetailOverlay').classList.remove('open');bdDetailId=null}
function deleteBDFromModal(){
  if(!bdDetailId)return;
  brainDump=brainDump.filter(t=>t.id!==bdDetailId);
  save();closeBDDetail();renderBD();if(activeSide==='priority')renderPri();
}
function saveBDDetail(){
  if(!bdDetailId)return;
  const t=brainDump.find(t=>t.id===bdDetailId);if(!t)return;
  const name=document.getElementById('bdDetailName').value.trim();
  if(!name){document.getElementById('bdDetailName').focus();return}
  const priority=document.getElementById('bdDetailPri').value;
  const category=document.getElementById('bdDetailCat').value;
  const notes=document.getElementById('bdDetailNotes').value.trim();
  const dateVal=document.getElementById('bdDetailDate').value;
  const timeVal=document.getElementById('bdDetailTime').value;

  // If a date was provided, schedule it directly
  if(dateVal){
    const time=timeVal||'09:00';
    tasks.push({
      id:genId(),name,priority,category,notes,
      date:dateVal,time,scheduled:true,done:false,
      recur:false,recurN:1,recurU:'day',doneOverrides:[],deletedOccurrences:[]
    });
    brainDump=brainDump.filter(t=>t.id!==bdDetailId);
  } else {
    // Keep in Brain Dump but update details
    Object.assign(t,{name,priority,category,notes});
  }
  save();closeBDDetail();renderAll();
}

// ══ AUTO-EXPAND TEXTAREAS ═════════════════════
function autoExpand(el){
  el.style.height='auto';
  el.style.height=(el.scrollHeight||36)+'px';
}
// Reset heights when modals open so they recalculate
function resetTextareaHeights(){
  document.querySelectorAll('textarea.auto-expand').forEach(el=>{
    el.style.height='auto';
    el.style.height=(el.scrollHeight||36)+'px';
  });
}

// ══ SUGGESTIONS DATA ══════════════════════════
const SUGGESTIONS=[
  {
    category:'🧘 Mindfulness & Wellness',
    color:'#10b981',
    items:[
      {name:'Morning meditation',sub:'10–15 min to start the day calm',priority:'high'},
      {name:'Prayer / gratitude time',sub:'Reflect and give thanks',priority:'high'},
      {name:'Evening journaling',sub:'Write down thoughts & wins',priority:'medium'},
      {name:'Digital detox hour',sub:'No screens before bed',priority:'medium'},
      {name:'Breathing exercises',sub:'Box breathing or 4-7-8 method',priority:'low'},
      {name:'Affirmations',sub:'Speak positivity into your day',priority:'low'},
    ]
  },
  {
    category:'💪 Health & Fitness',
    color:'#f43f5e',
    items:[
      {name:'Morning workout',sub:'Gym, run, or home workout',priority:'high'},
      {name:'Evening walk',sub:'30 min outdoor walk',priority:'medium'},
      {name:'Drink 8 glasses of water',sub:'Stay hydrated throughout the day',priority:'medium'},
      {name:'Stretch / yoga',sub:'15 min flexibility routine',priority:'low'},
      {name:'Meal prep',sub:'Prep healthy meals for the week',priority:'medium'},
      {name:'Sleep by 10 PM',sub:'Consistent bedtime routine',priority:'high'},
    ]
  },
  {
    category:'📚 Learning & Growth',
    color:'#6366f1',
    items:[
      {name:'Read for 30 minutes',sub:'Books, articles, or research',priority:'medium'},
      {name:'Online course lesson',sub:'Work through a skill course',priority:'medium'},
      {name:'Learn something new',sub:'Podcast, documentary, or tutorial',priority:'low'},
      {name:'Practice a language',sub:'Duolingo or language app',priority:'low'},
      {name:'Review weekly goals',sub:'Sunday planning session',priority:'high'},
    ]
  },
  {
    category:'🤝 Relationships & Social',
    color:'#f59e0b',
    items:[
      {name:'Call a family member',sub:'Check in with someone you love',priority:'medium'},
      {name:'Reach out to a friend',sub:'Send a message or schedule a catch-up',priority:'low'},
      {name:'Family dinner',sub:'Eat together without screens',priority:'high'},
      {name:'Acts of kindness',sub:'Do something nice for someone',priority:'low'},
    ]
  },
  {
    category:'💼 Work & Productivity',
    color:'#3b82f6',
    items:[
      {name:'Deep work block',sub:'2 hrs of focused, distraction-free work',priority:'high'},
      {name:'Check & clear email',sub:'Process inbox to zero',priority:'medium'},
      {name:'Weekly review',sub:'Review tasks, wins, and priorities',priority:'high'},
      {name:'Team check-in',sub:'Sync with colleagues',priority:'medium'},
      {name:'Plan tomorrow',sub:'Set top 3 priorities for next day',priority:'high'},
    ]
  },
  {
    category:'🌿 Self-Care',
    color:'#ec4899',
    items:[
      {name:'Skincare routine',sub:'Morning and evening care',priority:'low'},
      {name:'Hobby time',sub:'Art, music, cooking — something fun',priority:'medium'},
      {name:'Unplug and rest',sub:'Guilt-free downtime',priority:'medium'},
      {name:'Nature time',sub:'Park, garden, or outdoor break',priority:'low'},
      {name:'Tidy your space',sub:'10 min daily reset',priority:'low'},
    ]
  },
];

let suggDragId=null;

function renderSuggestions(){
  const panel=document.getElementById('suggestionsPanel');if(!panel)return;

  // Build a set of task names that are already scheduled recurring habits
  const habitNames=new Set(
    tasks
      .filter(t=>t.recur&&t.scheduled)
      .map(t=>t.name.toLowerCase().trim())
  );
  // Also check brain dump names
  brainDump.forEach(t=>habitNames.add(t.name.toLowerCase().trim()));

  let html=`<div style="padding:10px">
    <div class="sugg-hint">Click "+ Add" to schedule a habit,<br>or drag directly to any time slot</div>`;
  SUGGESTIONS.forEach((cat,ci)=>{
    html+=`<div class="sugg-category">
      <div class="sugg-cat-title"><span class="sugg-cat-icon">${cat.category.split(' ')[0]}</span>${cat.category.slice(cat.category.indexOf(' ')+1)}</div>`;
    cat.items.forEach((item,ii)=>{
      const alreadyAdded=habitNames.has(item.name.toLowerCase().trim());
      const warnClass=alreadyAdded?' sugg-card-warned':'';
      const actionBtn=alreadyAdded
        ?`<span class="sugg-already-badge">⚠ Already added</span>`
        :`<button class="sugg-add-btn" onclick="openIdeaModal(${ci},${ii})">+ Add</button>`;
      html+=`<div class="sugg-card${warnClass}" draggable="true" style="border-left-color:${cat.color}"
        ondragstart="onSuggDragStart(event,${ci},${ii})" ondragend="onSuggDragEnd(event)">
        <div class="sugg-card-info">
          <div class="sugg-card-name">${item.name}</div>
          <div class="sugg-card-sub">${item.sub}</div>
        </div>
        ${actionBtn}
      </div>`;
    });
    html+=`</div>`;
  });
  html+=`<div style="padding:10px 0 20px;text-align:center">
    <button onclick="dismissSuggestions()" style="background:none;border:1px solid var(--border);border-radius:8px;padding:6px 14px;font-family:'DM Sans',sans-serif;font-size:11px;color:var(--text3);cursor:pointer;transition:all .15s">Hide Ideas tab</button>
  </div>`;
  html+=`</div>`;
  panel.innerHTML=html;
}

function showToast(msg){
  let t=document.getElementById('clarityToast');
  if(!t){
    t=document.createElement('div');t.id='clarityToast';
    t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(12px);background:var(--text);color:var(--bg);padding:8px 16px;border-radius:99px;font-size:12px;font-weight:500;z-index:9000;pointer-events:none;opacity:0;transition:opacity .2s,transform .2s;white-space:nowrap';
    document.body.appendChild(t);
  }
  t.textContent=msg;
  t.style.opacity='1';t.style.transform='translateX(-50%) translateY(0)';
  clearTimeout(t._hide);
  t._hide=setTimeout(()=>{t.style.opacity='0';t.style.transform='translateX(-50%) translateY(8px)'},2000);
}

function onSuggDragStart(e,ci,ii){
  const cat=SUGGESTIONS[ci],item=cat.items[ii];
  // Store as a special suggestion drag
  suggDragId={ci,ii,color:cat.color};
  dragBdId=null;dragTaskId=null;
  e.dataTransfer.effectAllowed='copy';
  e.dataTransfer.setData('text/plain','sugg');
  setTimeout(()=>e.target.classList.add('dragging'),0);
}
function onSuggDragEnd(e){
  e.target.classList.remove('dragging');
  suggDragId=null;
}

// Patch onDO, onDropDate, onDropSlot to also handle suggDragId
const _origOnDO=onDO;
window.onDO=function(e){
  if(!dragBdId&&!dragTaskId&&!suggDragId)return;
  e.preventDefault();e.stopPropagation();
  // Use 'copy' only for suggestion drags, 'move' for everything else
  e.dataTransfer.dropEffect=suggDragId?'copy':'move';
  e.currentTarget.classList.add('drag-over');
};
const _origDropDate=onDropDate;
window.onDropDate=function(e,dateKey){
  if(suggDragId){
    e.currentTarget.classList.remove('drag-over');
    const cat=SUGGESTIONS[suggDragId.ci],item=cat.items[suggDragId.ii];
    const defaultTime='09:00';
    // Check if already added → show confirmation modal
    const habitNames=new Set(
      tasks.filter(t=>t.recur&&t.scheduled).map(t=>t.name.toLowerCase().trim())
    );
    brainDump.forEach(t=>habitNames.add(t.name.toLowerCase().trim()));
    if(habitNames.has(item.name.toLowerCase().trim())){
      const pendingCi=suggDragId.ci, pendingIi=suggDragId.ii;
      suggDragId=null;
      openSuggAlready(pendingCi, pendingIi, dateKey, defaultTime);
      return;
    }
    if(duplicateInSlot(dateKey,defaultTime,item.name,null)){
      showWarnToast(`"${item.name}" is already in that slot`);suggDragId=null;return;
    }
    if(slotFull(dateKey,defaultTime,null)){
      showWarnToast('That slot already has 2 tasks — pick a different time');suggDragId=null;return;
    }
    tasks.push({id:genId(),name:item.name,priority:item.priority,category:'none',notes:item.sub,
      date:dateKey,time:defaultTime,scheduled:true,done:false,recur:false,recurN:1,recurU:'day',doneOverrides:[],deletedOccurrences:[]});
    suggDragId=null;save();renderAll();
    setTimeout(()=>snapFlash(e.currentTarget),100);
    return;
  }
  _origDropDate(e,dateKey);
};
const _origDropSlot=onDropSlot;
window.onDropSlot=function(e,dateKey,time){
  if(suggDragId){
    const dropEl=e.currentTarget;dropEl.classList.remove('drag-over');
    const cat=SUGGESTIONS[suggDragId.ci],item=cat.items[suggDragId.ii];
    // Check if already added → show confirmation modal
    const habitNames=new Set(
      tasks.filter(t=>t.recur&&t.scheduled).map(t=>t.name.toLowerCase().trim())
    );
    brainDump.forEach(t=>habitNames.add(t.name.toLowerCase().trim()));
    if(habitNames.has(item.name.toLowerCase().trim())){
      const pendingCi=suggDragId.ci, pendingIi=suggDragId.ii;
      suggDragId=null;
      openSuggAlready(pendingCi, pendingIi, dateKey, time);
      return;
    }
    if(duplicateInSlot(dateKey,time,item.name,null)){
      showWarnToast(`"${item.name}" is already in that slot`);suggDragId=null;return;
    }
    if(slotFull(dateKey,time,null)){
      showWarnToast('That slot already has 2 tasks — pick a different time');suggDragId=null;return;
    }
    tasks.push({id:genId(),name:item.name,priority:item.priority,category:'none',notes:item.sub,
      date:dateKey,time,scheduled:true,done:false,recur:false,recurN:1,recurU:'day',doneOverrides:[],deletedOccurrences:[]});
    suggDragId=null;save();renderAll();
    setTimeout(()=>snapFlash(dropEl),100);
    return;
  }
  _origDropSlot(e,dateKey,time);
};

// ══ CLEAR MODAL ═══════════════════════════════
let _clearScope = null; // 'day' | 'week' | 'all'

function openClearModal(){
  // Update label with current context
  const dayStr = DLONG[selDate.getDay()] + ', ' + MONTHS_S[selDate.getMonth()] + ' ' + selDate.getDate();
  const mon = wkStart(selDate), sun = addDays(mon, 6);
  const weekStr = MONTHS_S[mon.getMonth()] + ' ' + mon.getDate() + ' – ' + MONTHS_S[sun.getMonth()] + ' ' + sun.getDate();
  document.getElementById('clearDayLabel').textContent = 'Remove all tasks from ' + dayStr;
  document.getElementById('clearWeekLabel').textContent = 'Remove all tasks from ' + weekStr;
  document.getElementById('clearScopeOverlay').classList.add('open');
}

function closeClearModal(){
  document.getElementById('clearScopeOverlay').classList.remove('open');
}

function chooseClearScope(scope){
  _clearScope = scope;
  closeClearModal();
  const titles = {
    day:  'Clear ' + DLONG[selDate.getDay()] + ', ' + MONTHS_S[selDate.getMonth()] + ' ' + selDate.getDate() + '?',
    week: 'Clear week of ' + MONTHS_S[wkStart(selDate).getMonth()] + ' ' + wkStart(selDate).getDate() + '?',
    all:  'Clear the entire calendar?'
  };
  document.getElementById('clearConfirmTitle').textContent = titles[scope];
  document.getElementById('clearConfirmOverlay').classList.add('open');
}

function closeClearConfirm(){
  document.getElementById('clearConfirmOverlay').classList.remove('open');
  _clearScope = null;
}

function executeClear(includeHabits){
  if(!_clearScope) return;
  const scope = _clearScope;

  if(scope === 'all'){
    tasks = includeHabits ? [] : tasks.filter(t => t.recur);

  } else if(scope === 'day'){
    const key = dk(selDate);
    if(includeHabits){
      // Remove non-recur tasks on this day; suppress recurring occurrences
      tasks = tasks.filter(t => !(!t.recur && t.date === key));
      tasks.forEach(t => {
        if(t.recur){
          const occ = expandedTasks(selDate, selDate).find(x => x.id === t.id && x.date === key);
          if(occ){
            if(!t.deletedOccurrences) t.deletedOccurrences = [];
            if(!t.deletedOccurrences.includes(key)) t.deletedOccurrences.push(key);
          }
        }
      });
    } else {
      tasks = tasks.filter(t => !(!t.recur && t.date === key));
    }

  } else if(scope === 'week'){
    const mon = wkStart(selDate);
    const weekKeys = Array.from({length:7}, (_, i) => dk(addDays(mon, i)));
    if(includeHabits){
      tasks = tasks.filter(t => !(!t.recur && weekKeys.includes(t.date)));
      tasks.forEach(t => {
        if(t.recur){
          weekKeys.forEach(key => {
            const start = fromDk(key);
            const occ = expandedTasks(start, start).find(x => x.id === t.id && x.date === key);
            if(occ){
              if(!t.deletedOccurrences) t.deletedOccurrences = [];
              if(!t.deletedOccurrences.includes(key)) t.deletedOccurrences.push(key);
            }
          });
        }
      });
    } else {
      tasks = tasks.filter(t => !(!t.recur && weekKeys.includes(t.date)));
    }
  }

  save(); renderAll(); closeClearConfirm(); _clearScope = null;
  const label = scope === 'all' ? 'Entire calendar cleared' : scope === 'day' ? 'Day cleared' : 'Week cleared';
  showToast(label + (includeHabits ? '' : ' · habits kept'));
}

// ══ SUGG ALREADY-ADDED CONFIRM ════════════════
let _suggAlreadyPending = null; // {ci, ii, dateKey, time}

function openSuggAlready(ci, ii, dateKey, time){
  const item = SUGGESTIONS[ci].items[ii];
  _suggAlreadyPending = {ci, ii, dateKey, time};
  document.getElementById('suggAlreadyName').textContent = item.name;
  document.getElementById('suggAlreadyOverlay').classList.add('open');
}

function closeSuggAlready(){
  document.getElementById('suggAlreadyOverlay').classList.remove('open');
  _suggAlreadyPending = null;
  suggDragId = null;
}

function confirmSuggAlready(){
  if(!_suggAlreadyPending) return;
  const {ci, ii, dateKey, time} = _suggAlreadyPending;
  const cat = SUGGESTIONS[ci], item = cat.items[ii];
  const resolvedTime = time || '09:00';
  if(slotFull(dateKey, resolvedTime, null)){
    showWarnToast('That slot already has 2 tasks — pick a different time');
    closeSuggAlready(); return;
  }
  tasks.push({
    id:genId(), name:item.name, priority:item.priority, category:'none',
    notes:item.sub, date:dateKey, time:resolvedTime,
    scheduled:true, done:false, recur:false, recurN:1, recurU:'day',
    doneOverrides:[], deletedOccurrences:[]
  });
  save(); renderAll(); closeSuggAlready();
  showToast('"' + item.name + '" added as a one-time task');
}


// ══ NOW-LINE ══════════════════════════════════════════════════════════════════
function getNowMins(){const n=new Date();return n.getHours()*60+n.getMinutes()}

function renderNowLine(){
  const mins=getNowMins();
  // Week view — one vertical column set, insert line in today's column
  const todayKey=dk(new Date());
  // Week view now-line
  const weekCols=document.querySelectorAll('.wk-day-col');
  const weekHdrCells=document.querySelectorAll('.wk-day-head');
  weekCols.forEach((col,i)=>{
    col.querySelectorAll('.now-line').forEach(el=>el.remove());
    const hdrCell=weekHdrCells[i];
    if(hdrCell&&hdrCell.classList.contains('today')){
      const top=(mins/30)*42; // 42px per half-hour slot
      const line=document.createElement('div');
      line.className='now-line';
      line.style.cssText=`top:${top}px;position:absolute;left:0;right:0`;
      line.innerHTML='<div class="now-line-dot"></div><div class="now-line-bar"></div>';
      col.style.position='relative';
      col.appendChild(line);
    }
  });
  // Day view now-line
  const dayTimeline=document.getElementById('dayTimeline');
  if(dayTimeline&&isToday(selDate)){
    dayTimeline.querySelectorAll('.now-line').forEach(el=>el.remove());
    const top=(mins/30)*52; // 52px per half-hour slot
    const line=document.createElement('div');
    line.className='now-line';
    line.style.cssText=`top:${top}px;grid-column:2;position:absolute;left:56px;right:0`;
    line.innerHTML='<div class="now-line-dot"></div><div class="now-line-bar"></div>';
    dayTimeline.style.position='relative';
    dayTimeline.appendChild(line);
  }
}

function scrollToNow(){
  const mins=getNowMins();
  const wv=document.querySelector('.week-scroll');
  if(wv&&curView==='week'){
    const top=Math.max(0,(mins/30)*42 - wv.clientHeight/2);
    wv.scrollTo({top,behavior:'smooth'});
  }
  const dv=document.querySelector('.day-scroll');
  if(dv&&curView==='day'){
    const top=Math.max(0,(mins/30)*52 - dv.clientHeight/2);
    dv.scrollTo({top,behavior:'smooth'});
  }
}

// Start the now-line interval
setInterval(()=>{renderNowLine();},60000);

// ══ OVERDUE BADGE ════════════════════════════════════════════════════════════
function updateOverdueBadge(){
  const today=dk(new Date());
  const overdue=tasks.filter(t=>
    t.scheduled&&t.date&&t.date<today&&!t.done&&!t.recur
  );
  const badge=document.getElementById('overdueBadge');
  if(!badge)return;
  if(overdue.length>0){
    badge.textContent='Overdue '+overdue.length;
    badge.classList.remove('hidden');
  }else{
    badge.classList.add('hidden');
  }
}

function goOverdue(){
  switchView('categories');
  showToast('Showing overdue tasks in Categories');
}

// ══ QUICK-ADD BAR ════════════════════════════════════════════════════════════
let _qaOpen=false;

function openQuickAdd(){
  if(_qaOpen)return;
  _qaOpen=true;
  const bar=document.getElementById('quickAddBar');
  // Pre-fill date/time to now
  const now=new Date();
  document.getElementById('qaDate').value=dk(now);
  const h=String(now.getHours()).padStart(2,'0');
  const m=String(Math.round(now.getMinutes()/30)*30%60).padStart(2,'0');
  document.getElementById('qaTime').value=h+':'+m;
  document.getElementById('qaPri').value='none';
  document.getElementById('qaName').value='';
  bar.classList.add('open');
  const bd=document.getElementById('quickAddBackdrop');if(bd)bd.style.display='block';
  setTimeout(()=>document.getElementById('qaName').focus(),80);
}

function closeQuickAdd(){
  _qaOpen=false;
  document.getElementById('quickAddBar').classList.remove('open');
  const bd=document.getElementById('quickAddBackdrop');if(bd)bd.style.display='none';
}

function saveQuickAdd(){
  const name=document.getElementById('qaName').value.trim();
  if(!name){document.getElementById('qaName').focus();return;}
  const dateVal=document.getElementById('qaDate').value||dk(new Date());
  const timeVal=document.getElementById('qaTime').value||'09:00';
  const priority=document.getElementById('qaPri').value;
  tasks.push({
    id:genId(),name,priority,category:'none',notes:'',
    date:dateVal,time:timeVal,scheduled:true,done:false,
    recur:false,recurN:1,recurU:'day',doneOverrides:[],deletedOccurrences:[]
  });
  save();renderAll();closeQuickAdd();
  showToast('"'+name+'" added');
}

// ── N key opens quick-add ──────────────────────────────────────────────────
document.addEventListener('keydown',function(e){
  if(_qaOpen&&e.key==='Escape'){e.preventDefault();closeQuickAdd();return;}
  if(_qaOpen&&(e.key==='Enter')&&(e.ctrlKey||e.metaKey)){e.preventDefault();saveQuickAdd();return;}
  // Open on N (not when typing in an input/textarea)
  if(e.key==='n'||e.key==='N'){
    const tag=document.activeElement.tagName;
    const inModal=document.activeElement.closest('.modal-overlay.open,.modal');
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||inModal)return;
    e.preventDefault();
    openQuickAdd();
  }
});


// ══ JOURNAL ═══════════════════════════════════════════════════════════════════
let journal = {};
let _journalMood = '';
let _journalAutoSaveTimer = null;
let _journalDate = '';  // currently displayed date key

function loadJournal(){
  try{ journal = JSON.parse(localStorage.getItem('clarity_journal')||'{}'); }catch{ journal = {}; }
}
function saveJournalData(){
  localStorage.setItem('clarity_journal', JSON.stringify(journal));
}
loadJournal();

const MOOD_EMOJIS = ['😔','😐','🙂','😊','🌟'];
const MOOD_LABELS = { '😔':'Rough day','😐':'Just okay','🙂':'Pretty good','😊':'Good day','🌟':'Amazing day' };

function openJournalForDate(dateKey){
  _journalDate = dateKey;
  const entry = journal[dateKey] || {};
  const d = fromDk(dateKey);
  const todayKey = dk(new Date());
  const isToday = dateKey === todayKey;

  // Date label
  const dateLabel = DLONG[d.getDay()] + ', ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  document.getElementById('journalDateLabel').textContent = isToday ? 'Today' : dateLabel;
  document.getElementById('journalDateSub').textContent = isToday
    ? 'How did your day go?'
    : dateLabel;

  // Mood
  _journalMood = entry.mood || '';
  MOOD_EMOJIS.forEach((em, i) => {
    const btn = document.getElementById('mood-' + i);
    if(btn) btn.classList.toggle('selected', em === _journalMood);
  });

  // Text
  const ta = document.getElementById('journalTa');
  if(ta) ta.value = entry.text || '';

  // Hide saved hint
  const hint = document.getElementById('journalSavedHint');
  if(hint) hint.classList.remove('show');

  // Past entries
  renderJournalPast(dateKey);
}

function setMood(emoji){
  _journalMood = _journalMood === emoji ? '' : emoji;
  MOOD_EMOJIS.forEach((em, i) => {
    const btn = document.getElementById('mood-' + i);
    if(btn) btn.classList.toggle('selected', em === _journalMood);
  });
  autoSaveJournal();
}

function onJournalInput(){
  clearTimeout(_journalAutoSaveTimer);
  _journalAutoSaveTimer = setTimeout(autoSaveJournal, 1200);
}

function autoSaveJournal(){
  const ta = document.getElementById('journalTa');
  if(!ta || !_journalDate) return;
  const text = ta.value.trim();
  if(!text && !_journalMood) {
    delete journal[_journalDate];
  } else {
    journal[_journalDate] = {
      text,
      mood: _journalMood,
      updatedAt: new Date().toISOString()
    };
  }
  saveJournalData();
}

function saveJournalEntry(){
  autoSaveJournal();
  renderJournalPast(_journalDate);
  const hint = document.getElementById('journalSavedHint');
  if(hint){
    hint.classList.add('show');
    setTimeout(() => hint.classList.remove('show'), 2200);
  }
}

function renderJournalPast(currentKey){
  const el = document.getElementById('journalPastEntries');
  if(!el) return;

  const entries = Object.entries(journal)
    .filter(function(e){ return e[0] !== currentKey && journal[e[0]].text; })
    .sort(function(a,b){ return b[0].localeCompare(a[0]); });

  if(!entries.length){
    el.innerHTML = '<div class="journal-empty">Your past entries will appear here.<br>Start writing — even a sentence counts.</div>';
    return;
  }

  const todayKey = dk(new Date());
  let html = '<div class="journal-past-title">Past Entries</div>';
  entries.slice(0, 20).forEach(function(pair){
    const k = pair[0], entry = pair[1];
    const d = fromDk(k);
    const daysAgo = Math.round((new Date(todayKey) - new Date(k)) / 86400000);
    const ago = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : daysAgo + ' days ago';
    const shortDate = MONTHS_S[d.getMonth()] + ' ' + d.getDate();
    const moodLabel = entry.mood ? (MOOD_LABELS[entry.mood] || '') : '';
    const safeText = entry.text.replace(/</g,'&lt;').replace(/>/g,'&gt;');
    html += '<div class="journal-past-entry" onclick="openJournalForDate(\''+k+'\')">';
    html += '<div class="jpe-header">';
    if(entry.mood) html += '<span class="jpe-mood">'+entry.mood+'</span>';
    html += '<span class="jpe-date">'+shortDate+(moodLabel?' · '+moodLabel:'')+'</span>';
    html += '<span class="jpe-date-sub">'+ago+'</span>';
    html += '</div>';
    html += '<div class="jpe-text">'+safeText+'</div>';
    html += '</div>';
  });
  el.innerHTML = html;
}



// ══ INIT ══════════════════════════════════════
// Don't auto-render — splash handles the gate
// renderAll() is called inside enterApp()

// ══ IDEA MODAL ════════════════════════════════
let _ideaPri = 'none';
let _ideaItem = null; // {name, sub, color, priority}

function openIdeaModal(ci, ii) {
  const cat = SUGGESTIONS[ci], item = cat.items[ii];
  _ideaItem = {name: item.name, sub: item.sub, color: cat.color, priority: item.priority};
  _ideaPri = item.priority || 'none';

  // Populate header
  document.getElementById('ideaColorBar').style.background = cat.color;
  document.getElementById('ideaModalName').textContent = item.name;
  document.getElementById('ideaModalSub').textContent = item.sub;

  // Reset fields — default to recurring since these are habits
  document.getElementById('ideaDate').value = '';
  document.getElementById('ideaTime').value = '';
  document.getElementById('ideaRecurOn').checked = true;
  document.getElementById('ideaRecurOpts').style.display = 'flex';
  document.getElementById('ideaRecurN').value = 1;
  document.getElementById('ideaRecurU').value = 'day';
  document.getElementById('ideaNotes').value = '';
  document.getElementById('ideaNotes').style.height = 'auto';

  // Set priority buttons
  setIdeaPri(_ideaPri);

  // Open modal
  document.getElementById('ideaModalOverlay').classList.add('open');
  setTimeout(() => {
    autoExpand(document.getElementById('ideaNotes'));
    document.getElementById('ideaDate').focus();
  }, 150);
}

function closeIdeaModal() {
  document.getElementById('ideaModalOverlay').classList.remove('open');
  _ideaItem = null;
}

function toggleIdeaRecur() {
  const on = document.getElementById('ideaRecurOn').checked;
  document.getElementById('ideaRecurOpts').style.display = on ? 'flex' : 'none';
}

function setIdeaPri(p) {
  _ideaPri = p;
  ['none','low','medium','high'].forEach(k => {
    const btn = document.getElementById('ipri-' + k);
    btn.className = 'idea-pri-btn' + (k === p ? ' active-' + k : '');
  });
}

function saveIdea() {
  if (!_ideaItem) return;
  const dateVal  = document.getElementById('ideaDate').value;
  const timeVal  = document.getElementById('ideaTime').value || '09:00';
  const recur    = document.getElementById('ideaRecurOn').checked;
  const recurN   = parseInt(document.getElementById('ideaRecurN').value) || 1;
  const recurU   = document.getElementById('ideaRecurU').value;
  const notes    = document.getElementById('ideaNotes').value.trim();

  if (dateVal) {
    // Schedule it directly onto the calendar
    tasks.push({
      id: genId(),
      name:     _ideaItem.name,
      priority: _ideaPri,
      category: 'none',
      notes:    notes || _ideaItem.sub,
      date:     dateVal,
      time:     timeVal,
      scheduled: true,
      done:      false,
      recur,
      recurN,
      recurU,
      doneOverrides:      [],
      deletedOccurrences: []
    });
    showToast('Scheduled "' + _ideaItem.name + '"' + (recur ? ' · repeating' : ''));
  } else {
    // No date — save to brain dump so they can schedule later
    brainDump.push({
      id:       genId(),
      name:     _ideaItem.name,
      priority: _ideaPri,
      category: 'none',
      notes:    notes || _ideaItem.sub
    });
    showToast('"' + _ideaItem.name + '" saved to Brain Dump');
  }

  save();
  renderAll();
  closeIdeaModal();
}

// Close idea modal on Escape (patch into existing keydown listener)
document.addEventListener('keydown', function ideaEsc(e) {
  if (e.key === 'Escape') closeIdeaModal();
});

// ══ CONSOLIDATED INIT ═══════════════════════════
function clarityInit(){
  // Time format buttons
  const b12=document.getElementById('tfBtn12');
  const b24=document.getElementById('tfBtn24');
  if(b12&&b24){b12.classList.toggle('active',!useMilitary);b24.classList.toggle('active',useMilitary);}

  // Suggestions tab visibility
  applySuggTabVisibility();

  // Mobile: close sidebar by default
  if(window.innerWidth<=640){
    sidebarOpen=false;
    const sb=document.getElementById('sidebar');
    if(sb)sb.classList.add('collapsed');
  }

  // Render routine blocks in settings
  renderRoutineList();

  // Tips toggle state (don't render tip yet — enterApp handles that)
  const tipsToggle=document.getElementById('tipsToggle');
  if(tipsToggle)tipsToggle.classList.toggle('on',_tipsOn);

  // AI input bullet behavior
  const aiTa=document.getElementById('aiInput');
  if(aiTa){
    aiTa.addEventListener('focus',function(){
      if(!this.value.trim())this.value='• ';
    });
    aiTa.addEventListener('keydown',function(e){
      if(e.key==='Enter'){
        e.preventDefault();
        const pos=this.selectionStart;
        const before=this.value.slice(0,pos);
        const after=this.value.slice(this.selectionEnd);
        const lastLine=before.split('\n').pop();
        if(lastLine.trim()==='•'){
          const lineStart=before.lastIndexOf('\n')+1;
          this.value=before.slice(0,lineStart)+after;
          this.selectionStart=this.selectionEnd=lineStart;
        } else {
          this.value=before+'\n• '+after;
          this.selectionStart=this.selectionEnd=pos+3;
        }
        autoExpand(this);
      }
    });
  }

  // Sunday evening wrap-up auto-show
  const now=new Date();
  if(now.getDay()===0&&now.getHours()>=17){
    const lastShown=localStorage.getItem('clarity_wrapup_last');
    const todayKey=dk(now);
    if(lastShown!==todayKey){
      localStorage.setItem('clarity_wrapup_last',todayKey);
      setTimeout(openWrapup,2000);
    }
  }

  // Init tooltips and BD reorder
  initTooltips();
  initBDReorder();
}
document.addEventListener('DOMContentLoaded',clarityInit);
