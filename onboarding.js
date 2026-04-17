// ══ LUCLARO SANDBOX DEMO v2 ════════════════════════
// Full interactive sandbox. Zero contact with real app data.
// Entry: startSandboxDemo()  |  Exit: _sbClose()
// All DOM created/destroyed dynamically. Prefixed sb-.

(function(){
'use strict';

/* ────────────────────────────────────────────────
   STATE
──────────────────────────────────────────────────── */
let _sbActive=false, _sbRoot=null, _sbStyle=null;
let _sbPhase=0; // 0=welcome,1=braindump,2=schedule,3=routines,4=ai,5=done
let _sbTasks=[];     // {id,name,time,dur,color} — on the timeline
let _sbBrain=[];     // {id,name,pri} — brain dump cards
let _sbRoutines=[];  // {id,label,start,end,blocked,active,color}
let _sbSideTab='braindump';
let _sbIdCounter=100;

const SB_HOURS=[7,8,9,10,11,12,13,14,15,16,17,18,19];
const PHASE_LABELS=['Welcome','Brain Dump','Schedule','Routines','Plan My Day','Ready!'];
const PHASE_COUNT=6;

/* ────────────────────────────────────────────────
   INITIAL DATA
──────────────────────────────────────────────────── */
function _sbResetData(){
  _sbIdCounter=100;
  _sbTasks=[];
  _sbBrain=[
    {id:'bd1',name:'Weekly team meeting',pri:'high'},
    {id:'bd2',name:'Buy groceries',pri:'low'},
    {id:'bd3',name:'Draft project proposal',pri:'high'},
    {id:'bd4',name:'Call dentist',pri:'low'},
    {id:'bd5',name:'Review budget report',pri:'medium'},
  ];
  _sbRoutines=[
    {id:'r1',label:'Work (Morning)',start:'09:00',end:'12:00',blocked:false,active:false,color:'#3b82f6'},
    {id:'r2',label:'Lunch Break',start:'12:00',end:'13:00',blocked:true,active:false,color:'#f59e0b'},
    {id:'r3',label:'Work (Afternoon)',start:'13:00',end:'17:00',blocked:false,active:false,color:'#3b82f6'},
    {id:'r4',label:'Gym',start:'18:00',end:'19:00',blocked:true,active:false,color:'#ef4444'},
  ];
}

/* ────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────────── */
function _sbId(){return 'sb'+(++_sbIdCounter)}
function _sbFmt12(t){
  const[h,m]=t.split(':').map(Number);
  return(h%12||12)+':'+(m<10?'0':'')+m+(h>=12?' PM':' AM');
}
function _sbDurLabel(m){if(m<60)return m+'m';const h=Math.floor(m/60),r=m%60;return r?h+'h '+r+'m':h+'h'}
function _sbPriColor(p){return p==='high'?'#ef4444':p==='medium'?'#f59e0b':'#3b82f6'}
function _sbHourToMin(t){const[h,m]=t.split(':').map(Number);return h*60+m}
function _sbEsc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function _sbSnap15(mins){return Math.max(15,Math.round(mins/15)*15)}

// Parse quick event text → {name, time(24h), dur, allday}
function _sbParseQE(raw){
  let text=raw.trim(); if(!text)return null;
  let time=null, dur=null, allday=false;

  // Time: "3pm", "10:30am", "14:00"
  const tmRe=/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;
  const tm=text.match(tmRe);
  if(tm){
    let h=parseInt(tm[1]),m=parseInt(tm[2]||'0');
    if(tm[3].toLowerCase()==='pm'&&h<12)h+=12;
    if(tm[3].toLowerCase()==='am'&&h===12)h=0;
    time=(h<10?'0':'')+h+':'+(m<10?'0':'')+m;
    text=text.replace(tm[0],'').trim();
  } else {
    const tm2=text.match(/\b(\d{1,2}):(\d{2})\b/);
    if(tm2){time=(parseInt(tm2[1])<10?'0':'')+parseInt(tm2[1])+':'+(parseInt(tm2[2])<10?'0':'')+parseInt(tm2[2]);text=text.replace(tm2[0],'').trim();}
  }

  // All day
  if(/\ball\s*day\b/i.test(text)){allday=true;text=text.replace(/\ball\s*day\b/i,'').trim();}

  // Weekday patterns — strip from name (we don't implement recurrence in sandbox, just clean up)
  text=text.replace(/\b(mon|tue|wed|thu|fri|sat|sun)(\s*\/\s*(mon|tue|wed|thu|fri|sat|sun))+\b/gi,'').trim();
  text=text.replace(/\bevery\s+(mon|tue|wed|thu|fri|sat|sun)(day)?\b/gi,'').trim();

  // Duration: "45min", "45mins", "1.5hr", "2 hours", "for 30 minutes"
  const durRe=/\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|m)\b/i;
  const dm=text.match(durRe);
  if(dm){
    const val=parseFloat(dm[1]);
    const unit=dm[2].toLowerCase();
    dur=unit.startsWith('h')?Math.round(val*60):Math.round(val);
    if(dur<5)dur=null;
    text=text.replace(dm[0],'').replace(/\bfor\b\s*/i,'').trim();
  }

  // Clean name
  const name=text.replace(/\s+(at|on|in|for)$/i,'').replace(/\s+/g,' ').trim();
  if(!name)return null;
  return{name, time:allday?null:time, dur:dur||30, allday};
}

/* ────────────────────────────────────────────────
   CSS INJECTION
──────────────────────────────────────────────────── */
function _sbInjectCSS(){
  if(_sbStyle)return;
  _sbStyle=document.createElement('style');
  _sbStyle.id='sb-styles';
  _sbStyle.textContent=`
/* ══ SANDBOX OVERLAY ══ */
#sb-overlay{position:fixed;inset:0;z-index:700;background:var(--bg);display:flex;flex-direction:column;opacity:0;transition:opacity .4s ease;overflow:hidden}
#sb-overlay.sb-vis{opacity:1}
#sb-overlay *{box-sizing:border-box}

/* ── Header ── */
.sb-hdr{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0;gap:12px}
.sb-hdr-left{display:flex;align-items:center;gap:10px}
.sb-hdr-dot{width:9px;height:9px;border-radius:50%;background:var(--accent);animation:sbPulse 1.4s ease-in-out infinite}
@keyframes sbPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}
.sb-hdr-title{font-family:'DM Serif Display',serif;font-size:18px;color:var(--text)}
.sb-hdr-badge{font-size:10px;color:var(--accent);font-weight:600;background:rgba(var(--accent-rgb),.1);padding:2px 8px;border-radius:6px;letter-spacing:.3px}
.sb-exit{background:none;border:1px solid var(--border);color:var(--text2);font-family:'DM Sans',sans-serif;font-size:11px;padding:5px 12px;border-radius:7px;cursor:pointer;transition:all .15s}
.sb-exit:hover{border-color:var(--text3);color:var(--text)}

/* ── Phase progress ── */
.sb-prog{height:3px;background:var(--surface2);flex-shrink:0}
.sb-prog-fill{height:100%;background:var(--accent);transition:width .5s cubic-bezier(.4,0,.2,1);border-radius:0 2px 2px 0}

/* ── Body ── */
.sb-body{flex:1;display:flex;overflow:hidden;position:relative}

/* ── Sidebar ── */
.sb-side{width:300px;border-left:1px solid var(--border);background:var(--surface);display:flex;flex-direction:column;flex-shrink:0}
.sb-side-tabs{display:flex;border-bottom:1px solid var(--border)}
.sb-side-tab{flex:1;padding:10px 8px;font-size:11px;font-weight:600;text-align:center;color:var(--text3);cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;background:none;border-top:none;border-left:none;border-right:none;font-family:'DM Sans',sans-serif}
.sb-side-tab.active{color:var(--accent);border-bottom-color:var(--accent)}
.sb-side-tab:hover{color:var(--text2)}
.sb-side-tab.sb-locked{opacity:.4;cursor:default}
.sb-side-content{flex:1;overflow-y:auto;display:flex;flex-direction:column}

/* ── Quick add ── */
.sb-qe{padding:10px 12px;border-bottom:1px solid var(--border)}
.sb-qe-input{width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;background:var(--surface2);color:var(--text);outline:none;transition:border-color .15s,box-shadow .15s}
.sb-qe-input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(var(--accent-rgb),.12)}
.sb-qe-input::placeholder{color:var(--text3)}
.sb-qe-highlight .sb-qe-input{
  border-color:var(--accent);
  animation:sbQePulse 1.8s ease-in-out infinite;
}
@keyframes sbQePulse{
  0%,100%{box-shadow:0 0 0 0 rgba(var(--accent-rgb),.3),0 0 0 1.5px var(--accent)}
  50%{box-shadow:0 0 0 6px rgba(var(--accent-rgb),0),0 0 0 1.5px var(--accent)}
}
.sb-qe-badge{
  display:inline-flex;align-items:center;gap:4px;
  font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;
  color:var(--accent);margin-bottom:6px;
  padding:2px 7px;border-radius:5px;background:rgba(var(--accent-rgb),.1);
}

/* ── Brain dump cards ── */
.sb-bd{flex:1;overflow-y:auto;padding:8px 12px;display:flex;flex-direction:column;gap:5px}
.sb-bd-card{padding:9px 11px;border-radius:9px;background:var(--surface2);border:1.5px solid var(--border);transition:all .2s;display:flex;align-items:center;gap:8px;cursor:default}
.sb-bd-card.sb-draggable{cursor:grab}
.sb-bd-card.sb-draggable:active{cursor:grabbing}
.sb-bd-card.sb-drag-src{opacity:.35;transform:scale(.96)}
.sb-bd-card.sb-placed{opacity:0;height:0;padding:0;margin:0;border:none;overflow:hidden;transition:all .3s}
.sb-bd-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.sb-bd-name{font-size:13px;color:var(--text);font-weight:500;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sb-bd-empty{text-align:center;color:var(--text3);font-size:13px;padding:24px 12px;line-height:1.6}

/* ── Routine toggles ── */
.sb-rt-list{flex:1;overflow-y:auto;padding:8px 12px;display:flex;flex-direction:column;gap:6px}
.sb-rt-card{padding:12px;border-radius:10px;background:var(--surface2);border:1.5px solid var(--border);display:flex;align-items:center;gap:10px;transition:all .2s}
.sb-rt-card.sb-rt-on{border-color:var(--accent);background:rgba(var(--accent-rgb),.06)}
.sb-rt-info{flex:1;min-width:0}
.sb-rt-name{font-size:13px;font-weight:600;color:var(--text)}
.sb-rt-time{font-size:11px;color:var(--text2);margin-top:1px}
.sb-rt-badge{font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;padding:2px 6px;border-radius:4px;flex-shrink:0}
.sb-rt-badge.sb-window{color:#3b82f6;background:rgba(59,130,246,.1)}
.sb-rt-badge.sb-block{color:#ef4444;background:rgba(239,68,68,.1)}
.sb-rt-toggle{position:relative;width:40px;height:22px;border-radius:11px;background:var(--border);cursor:pointer;transition:background .2s;flex-shrink:0;border:none}
.sb-rt-toggle.sb-on{background:var(--accent)}
.sb-rt-toggle::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s;box-shadow:0 1px 3px rgba(0,0,0,.15)}
.sb-rt-toggle.sb-on::after{transform:translateX(18px)}
.sb-rt-hint{padding:10px 14px;font-size:12px;color:var(--text2);line-height:1.6;border-top:1px solid var(--border);margin-top:auto;background:rgba(var(--accent-rgb),.04)}
.sb-rt-hint strong{color:var(--text);font-weight:600}

/* ── Timeline ── */
.sb-tl-wrap{flex:1;overflow-y:auto;overflow-x:hidden;position:relative;background:var(--bg)}
.sb-tl-hdr{padding:10px 16px 6px;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:5}
.sb-tl-title{font-family:'DM Serif Display',serif;font-size:18px;color:var(--text)}
.sb-tl-sub{font-size:12px;color:var(--text2);margin-top:2px}
.sb-tl-grid{display:grid;grid-template-columns:68px 1fr;position:relative;padding-bottom:40px}
.sb-tl-lbl{padding:6px 10px 0 0;text-align:right;font-size:11px;color:var(--text3);font-weight:500;letter-spacing:.3px;border-right:1px solid var(--border);height:64px}
.sb-tl-slot{height:64px;border-bottom:1px solid var(--border);position:relative;cursor:pointer;transition:background .15s}
.sb-tl-slot:hover{background:var(--accent-pale)}
.sb-tl-slot.sb-drop-over{background:var(--accent-pale)!important;outline:1.5px dashed var(--accent);outline-offset:-1px}
.sb-tl-slot.sb-rt-window{background:transparent}
.sb-tl-slot.sb-rt-blocked{background:repeating-linear-gradient(135deg,transparent,transparent 5px,rgba(239,68,68,.05) 5px,rgba(239,68,68,.05) 10px);cursor:not-allowed}
[data-dark="true"] .sb-tl-slot.sb-rt-blocked{background:repeating-linear-gradient(135deg,transparent,transparent 5px,rgba(239,68,68,.08) 5px,rgba(239,68,68,.08) 10px)}
.sb-tl-rt-lbl{position:absolute;right:8px;top:2px;font-size:9px;color:var(--text3);font-weight:600;letter-spacing:.5px;text-transform:uppercase;opacity:.5}
.sb-tl-open{position:absolute;right:8px;bottom:4px;font-size:9px;font-weight:600;letter-spacing:.3px;opacity:.5}

/* ── Task blocks on timeline ── */
.sb-task{position:absolute;left:72px;right:4px;border-radius:0 7px 7px 0;border-left:3px solid var(--accent);border-top:2px solid var(--accent);background:rgba(var(--accent-rgb),.13);padding:5px 10px;font-size:12px;font-weight:500;color:var(--text);z-index:3;display:flex;align-items:center;gap:6px;overflow:hidden;cursor:pointer;transition:opacity .15s}
.sb-task:hover{opacity:.8}
.sb-task-name{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-task-dur{font-size:10px;color:var(--text2);flex-shrink:0}
.sb-task.sb-reveal{opacity:0;transform:translateY(6px) scale(.97)}
.sb-task.sb-revealed{opacity:1;transform:translateY(0) scale(1);transition:all .45s cubic-bezier(.34,1.56,.64,1)}

/* ── AI shimmer ── */
.sb-shimmer{position:absolute;left:72px;right:4px;border-radius:7px;background:linear-gradient(90deg,var(--surface2) 25%,var(--accent-pale) 50%,var(--surface2) 75%);background-size:200% 100%;animation:sbShim 1.2s ease-in-out infinite;z-index:2}
@keyframes sbShim{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* ── AI button ── */
.sb-ai-wrap{padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:10px;border-top:1px solid var(--border);margin-top:auto}
.sb-ai-btn{width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:11px;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s;box-shadow:0 4px 20px rgba(var(--accent-rgb),.3);display:flex;align-items:center;justify-content:center;gap:8px}
.sb-ai-btn:hover{background:var(--accent-dim);transform:translateY(-1px);box-shadow:0 6px 24px rgba(var(--accent-rgb),.35)}
.sb-ai-btn:active{transform:translateY(0)}
.sb-ai-btn:disabled{opacity:.5;cursor:default;transform:none;box-shadow:none}
.sb-ai-desc{font-size:12px;color:var(--text3);text-align:center;line-height:1.5}
.sb-spin{animation:sbSpin 1s linear infinite}
@keyframes sbSpin{to{transform:rotate(360deg)}}

/* ── Guide card ── */
.sb-guide{position:absolute;bottom:16px;left:16px;z-index:10;width:320px;max-width:calc(100% - 32px);background:var(--surface);border:1.5px solid var(--accent);border-radius:14px;padding:16px 18px 14px;box-shadow:0 12px 40px rgba(0,0,0,.12);opacity:0;transform:translateY(12px);transition:all .4s cubic-bezier(.34,1.56,.64,1)}
.sb-guide.sb-vis{opacity:1;transform:translateY(0)}
.sb-guide-title{font-family:'DM Serif Display',serif;font-size:16px;color:var(--text);margin-bottom:4px}
.sb-guide-body{font-size:12.5px;color:var(--text2);line-height:1.65;margin-bottom:12px}
.sb-guide-body em{color:var(--accent);font-style:normal;font-weight:600}
.sb-guide-body strong{color:var(--text);font-weight:600}
.sb-guide-actions{display:flex;gap:8px;align-items:center}
.sb-guide-btn{flex:1;padding:9px;background:var(--accent);color:#fff;border:none;border-radius:9px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all .15s}
.sb-guide-btn:hover{background:var(--accent-dim)}
.sb-guide-dots{display:flex;gap:5px;justify-content:center;margin-top:10px}
.sb-guide-dot{width:6px;height:6px;border-radius:50%;background:var(--border);transition:all .25s}
.sb-guide-dot.sb-on{background:var(--accent);transform:scale(1.3)}

/* ── Center modal (welcome/done) ── */
.sb-modal{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.4);z-index:12;opacity:0;transition:opacity .3s}
.sb-modal.sb-vis{opacity:1}
.sb-modal-inner{background:var(--surface);border-radius:20px;padding:36px 32px 28px;max-width:400px;width:calc(100% - 32px);text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.2);transform:translateY(20px) scale(.95);transition:transform .45s cubic-bezier(.34,1.56,.64,1)}
.sb-modal.sb-vis .sb-modal-inner{transform:translateY(0) scale(1)}
.sb-modal-icon{width:52px;height:52px;border-radius:14px;background:var(--accent-pale);display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
.sb-modal-icon svg{width:26px;height:26px;color:var(--accent)}
.sb-modal-title{font-family:'DM Serif Display',serif;font-size:24px;color:var(--text);margin-bottom:8px}
.sb-modal-body{font-size:14px;color:var(--text2);line-height:1.65;margin-bottom:20px}
.sb-modal-btn{display:inline-block;padding:13px 34px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;cursor:pointer;transition:all .15s;box-shadow:0 4px 20px rgba(var(--accent-rgb),.3)}
.sb-modal-btn:hover{background:var(--accent-dim);transform:translateY(-2px);box-shadow:0 8px 28px rgba(var(--accent-rgb),.35)}

/* ── Routine band overlays on timeline ── */
.sb-rt-band{position:absolute;left:69px;right:0;pointer-events:none;z-index:1;border-left:3px solid transparent}
.sb-rt-banner{position:absolute;left:69px;right:0;height:16px;z-index:2;color:#fff;font-size:9px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;display:flex;align-items:center;padding-left:10px;pointer-events:none}

/* ── Toast ── */
.sb-toast{position:absolute;bottom:80px;left:50%;transform:translateX(-50%) translateY(10px);background:var(--surface);border:1px solid var(--border);color:var(--text);padding:8px 16px;border-radius:10px;font-size:12px;font-weight:500;box-shadow:0 6px 20px rgba(0,0,0,.1);opacity:0;transition:all .3s;z-index:15;white-space:nowrap}
.sb-toast.sb-vis{opacity:1;transform:translateX(-50%) translateY(0)}

/* ── Mobile ── */
@media(max-width:640px){
  .sb-side{width:100%;border-left:none;border-top:1px solid var(--border);max-height:200px}
  .sb-body{flex-direction:column}
  .sb-guide{bottom:8px;left:8px;right:8px;width:auto}
  .sb-tl-lbl{font-size:10px;padding:4px 6px 0 0;height:52px}
  .sb-tl-slot{height:52px}
  .sb-tl-grid{grid-template-columns:52px 1fr}
  .sb-task{left:56px}
  .sb-shimmer{left:56px}
  .sb-rt-band{left:53px}
  .sb-rt-banner{left:53px;font-size:8px}
  .sb-hdr{padding:8px 12px}
  .sb-hdr-title{font-size:16px}
  .sb-modal-inner{padding:28px 20px 22px}
  .sb-modal-title{font-size:20px}
}
`;
  document.head.appendChild(_sbStyle);
}


/* ────────────────────────────────────────────────
   BUILD & RENDER
──────────────────────────────────────────────────── */
function _sbBuild(){
  _sbRoot=document.createElement('div');
  _sbRoot.id='sb-overlay';

  const today=new Date();
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayTitle=days[today.getDay()]+', '+months[today.getMonth()]+' '+today.getDate();

  _sbRoot.innerHTML=`
    <div class="sb-hdr">
      <div class="sb-hdr-left">
        <div class="sb-hdr-dot"></div>
        <span class="sb-hdr-title">LuClaro</span>
        <span class="sb-hdr-badge" id="sbPhaseBadge">SANDBOX</span>
      </div>
      <button class="sb-exit" onclick="_sbClose()">Exit demo</button>
    </div>
    <div class="sb-prog"><div class="sb-prog-fill" id="sbProg" style="width:0%"></div></div>
    <div class="sb-body">
      <div class="sb-tl-wrap" id="sbTlWrap">
        <div class="sb-tl-hdr">
          <div class="sb-tl-title">${dayTitle}</div>
          <div class="sb-tl-sub" id="sbTlSub">${today.getFullYear()} · Today · Sandbox</div>
        </div>
        <div class="sb-tl-grid" id="sbGrid"></div>
      </div>
      <div class="sb-side" id="sbSide">
        <div class="sb-side-tabs">
          <button class="sb-side-tab active" id="sbTabBd" onclick="_sbSwitchTab('braindump')">Brain Dump</button>
          <button class="sb-side-tab sb-locked" id="sbTabRt" onclick="_sbSwitchTab('routines')">Routines</button>
        </div>
        <div class="sb-side-content" id="sbSideContent"></div>
      </div>
    </div>`;

  document.body.appendChild(_sbRoot);
  _sbRenderTimeline();
  _sbRenderSidebar();
  requestAnimationFrame(()=>_sbRoot.classList.add('sb-vis'));
}

// ── Timeline render ─────────────────────────────
function _sbRenderTimeline(){
  const grid=document.getElementById('sbGrid');if(!grid)return;
  const isMobile=window.innerWidth<=640;
  const slotH=isMobile?52:64;

  let html='';
  SB_HOURS.forEach(h=>{
    const t=(h<10?'0':'')+h+':00';
    const lbl=_sbFmt12(t);
    let rtClass='',rtLabel='',rtOpen='';
    _sbRoutines.forEach(r=>{
      if(!r.active)return;
      const rs=_sbHourToMin(r.start),re=_sbHourToMin(r.end);
      if(h*60>=rs&&h*60<re){
        rtClass=r.blocked?'sb-rt-blocked':'sb-rt-window';
        rtLabel=r.label;
        if(!r.blocked)rtOpen=`<span class="sb-tl-open" style="color:${r.color}">open</span>`;
      }
    });
    const canDrop=_sbPhase>=2&&!rtClass.includes('blocked');
    html+=`<div class="sb-tl-lbl">${lbl}</div>
      <div class="sb-tl-slot ${rtClass}" data-hour="${h}"
        ${canDrop?`ondragover="_sbDO(event)" ondragleave="_sbDL(event)" ondrop="_sbDrop(event,${h})"`:''}
        ${_sbPhase>=2&&!rtClass.includes('blocked')?`onclick="_sbSlotClick(${h})"`:''}
        >${rtLabel?`<span class="sb-tl-rt-lbl">${rtLabel}</span>`:''}${rtOpen}</div>`;
  });
  grid.innerHTML=html;

  // Routine bands
  _sbRoutines.forEach(r=>{
    if(!r.active)return;
    const rs=_sbHourToMin(r.start),re=_sbHourToMin(r.end);
    const topIdx=SB_HOURS.indexOf(Math.floor(rs/60));
    if(topIdx<0)return;
    const topPx=topIdx*slotH+(rs%60)/60*slotH;
    const hPx=(re-rs)/60*slotH;
    const band=document.createElement('div');
    band.className='sb-rt-band';
    band.style.cssText=`top:${topPx}px;height:${hPx}px;background:${r.color}0c;border-left-color:${r.color}`;
    grid.appendChild(band);
    const banner=document.createElement('div');
    banner.className='sb-rt-banner';
    banner.style.cssText=`top:${topPx}px;background:${r.color}cc`;
    banner.textContent=r.label;
    grid.appendChild(banner);
  });

  // Task blocks
  _sbTasks.forEach(t=>{
    const[h,m]=t.time.split(':').map(Number);
    const topIdx=SB_HOURS.indexOf(h);
    if(topIdx<0)return;
    const topPx=topIdx*slotH+(m/60)*slotH;
    const hPx=Math.max(22,(t.dur/60)*slotH);
    const el=document.createElement('div');
    el.className='sb-task';
    el.style.cssText=`top:${topPx}px;height:${hPx}px;border-left-color:${t.color||'var(--accent)'};border-top-color:${t.color||'var(--accent)'};background:${t.color?t.color+'20':'rgba(var(--accent-rgb),.13)'}`;
    el.innerHTML=`<span class="sb-task-name">${_sbEsc(t.name)}</span><span class="sb-task-dur">${_sbDurLabel(t.dur)}</span>`;
    el.onclick=function(e){e.stopPropagation();_sbUnschedule(t.id);};
    el.title='Tap to unschedule';
    grid.appendChild(el);
  });

  // Sub line
  const sub=document.getElementById('sbTlSub');
  if(sub){
    const done=_sbTasks.length;
    const total=done+_sbBrain.length;
    sub.textContent=new Date().getFullYear()+' · Today'+(total>0?' · '+done+'/'+total+' scheduled':'');
  }
}

// ── Sidebar render ──────────────────────────────
function _sbRenderSidebar(){
  const el=document.getElementById('sbSideContent');if(!el)return;
  if(_sbSideTab==='braindump')_sbRenderBrainDump(el);
  else _sbRenderRoutines(el);
}

function _sbRenderBrainDump(el){
  const canDrag=_sbPhase>=2;
  const showInput=_sbPhase>=1;
  const emphasize=_sbPhase===1;
  let html='';
  if(showInput){
    html+=`<div class="sb-qe${emphasize?' sb-qe-highlight':''}">
      ${emphasize?'<div class="sb-qe-badge">✨ Quick Events</div>':''}
      <input class="sb-qe-input" id="sbQeInput" placeholder="Try: &quot;Study 3pm 45min&quot;"
        autocomplete="off" onkeydown="if(event.key==='Enter')_sbQuickAdd()">
    </div>`;
  }
  if(_sbBrain.length){
    html+='<div class="sb-bd" id="sbBdList">';
    _sbBrain.forEach(b=>{
      html+=`<div class="sb-bd-card${canDrag?' sb-draggable':''}" id="sbBd-${b.id}" data-id="${b.id}"
        ${canDrag?`draggable="true" ondragstart="_sbBdDragStart(event,'${b.id}')" ondragend="_sbBdDragEnd(event)"`:''}
        ><span class="sb-bd-dot" style="background:${_sbPriColor(b.pri)}"></span>
        <span class="sb-bd-name">${_sbEsc(b.name)}</span></div>`;
    });
    html+='</div>';
  } else {
    html+='<div class="sb-bd-empty">Brain dump is empty!<br>All tasks are on the calendar.</div>';
  }
  if(_sbPhase===4){
    const hasItems=_sbBrain.length>0;
    html+=`<div class="sb-ai-wrap">
      <button class="sb-ai-btn" id="sbAiBtn" onclick="${hasItems?'_sbRunAI()':'_sbSetPhase(5)'}"${false?'':''}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
        ${hasItems?'Plan my day':'Continue →'}
      </button>
      <div class="sb-ai-desc">${hasItems?'Luclaro will place your remaining '+_sbBrain.length+' tasks into open windows.':'All tasks are already scheduled! Nice work.'}</div>
    </div>`;
  }
  el.innerHTML=html;
}

function _sbRenderRoutines(el){
  let html='<div class="sb-rt-list">';
  _sbRoutines.forEach(r=>{
    html+=`<div class="sb-rt-card${r.active?' sb-rt-on':''}">
      <div class="sb-rt-info">
        <div class="sb-rt-name">${r.label}</div>
        <div class="sb-rt-time">${_sbFmt12(r.start)} – ${_sbFmt12(r.end)}</div>
      </div>
      <span class="sb-rt-badge ${r.blocked?'sb-block':'sb-window'}">${r.blocked?'Block':'Window'}</span>
      <button class="sb-rt-toggle${r.active?' sb-on':''}" onclick="_sbToggleRoutine('${r.id}')"></button>
    </div>`;
  });
  html+='</div>';
  html+=`<div class="sb-rt-hint">
    <strong>Windows</strong> are open for tasks — Luclaro fills them.<br>
    <strong>Blocks</strong> are reserved — tasks can't go there.
  </div>`;
  el.innerHTML=html;
}

window._sbSwitchTab=function(tab){
  if(tab==='routines'&&_sbPhase<3)return;
  _sbSideTab=tab;
  document.getElementById('sbTabBd').classList.toggle('active',tab==='braindump');
  document.getElementById('sbTabRt').classList.toggle('active',tab==='routines');
  _sbRenderSidebar();
};


/* ────────────────────────────────────────────────
   INTERACTIONS
──────────────────────────────────────────────────── */
window._sbQuickAdd=function(){
  const inp=document.getElementById('sbQeInput');if(!inp)return;
  const raw=inp.value.trim();if(!raw){inp.focus();return;}
  const parsed=_sbParseQE(raw);
  if(!parsed){_sbToast('Could not parse — try "Lunch 12pm 1hr"');return;}
  inp.value='';
  if(parsed.time){
    const snapDur=_sbSnap15(parsed.dur);
    _sbTasks.push({id:_sbId(),name:parsed.name,time:parsed.time,dur:snapDur,color:'var(--accent)'});
    _sbRenderTimeline();
    _sbToast('"'+parsed.name+'" scheduled at '+_sbFmt12(parsed.time)+' · '+_sbDurLabel(snapDur));
  } else {
    _sbBrain.push({id:_sbId(),name:parsed.name,pri:'none'});
    _sbRenderSidebar();
    _sbToast('"'+parsed.name+'" added to Brain Dump — needs a time');
  }
};

window._sbSlotClick=function(hour){
  if(_sbPhase<2)return;
  const blocked=_sbRoutines.some(r=>r.active&&r.blocked&&hour*60>=_sbHourToMin(r.start)&&hour*60<_sbHourToMin(r.end));
  if(blocked){_sbToast('This slot is blocked by a routine');return;}
  // Overlap check
  const occupied=_sbTasks.some(t=>{const[h]=t.time.split(':').map(Number);return h===hour;});
  if(occupied){_sbToast('That slot already has a task — tap it to unschedule first');return;}
  if(_sbBrain.length){
    const item=_sbBrain.shift();
    _sbTasks.push({id:item.id,name:item.name,time:(hour<10?'0':'')+hour+':00',dur:30,color:_sbPriColor(item.pri)});
    _sbRenderTimeline();
    _sbRenderSidebar();
    _sbToast('"'+item.name+'" scheduled');
  }
};

let _sbDragId=null;
window._sbBdDragStart=function(e,id){
  _sbDragId=id;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',id);
  setTimeout(()=>{const c=document.getElementById('sbBd-'+id);if(c)c.classList.add('sb-drag-src');},0);
};
window._sbBdDragEnd=function(e){
  const c=document.getElementById('sbBd-'+_sbDragId);if(c)c.classList.remove('sb-drag-src');
  _sbDragId=null;
  if(_sbRoot)_sbRoot.querySelectorAll('.sb-drop-over').forEach(s=>s.classList.remove('sb-drop-over'));
};
window._sbDO=function(e){if(!_sbDragId)return;e.preventDefault();e.dataTransfer.dropEffect='move';e.currentTarget.classList.add('sb-drop-over')};
window._sbDL=function(e){e.currentTarget.classList.remove('sb-drop-over')};
window._sbDrop=function(e,hour){
  e.preventDefault();e.currentTarget.classList.remove('sb-drop-over');
  if(!_sbDragId)return;
  const blocked=_sbRoutines.some(r=>r.active&&r.blocked&&hour*60>=_sbHourToMin(r.start)&&hour*60<_sbHourToMin(r.end));
  if(blocked){_sbToast('Can\'t drop here — slot is blocked');_sbDragId=null;return;}
  // Overlap check
  const occupied=_sbTasks.some(t=>{const[h]=t.time.split(':').map(Number);return h===hour;});
  if(occupied){_sbToast('That slot already has a task — tap it to unschedule first');_sbDragId=null;return;}
  const idx=_sbBrain.findIndex(b=>b.id===_sbDragId);
  if(idx<0){_sbDragId=null;return;}
  const item=_sbBrain.splice(idx,1)[0];
  _sbTasks.push({id:item.id,name:item.name,time:(hour<10?'0':'')+hour+':00',dur:30,color:_sbPriColor(item.pri)});
  _sbDragId=null;
  _sbRenderTimeline();_sbRenderSidebar();
  _sbToast('"'+item.name+'" scheduled at '+_sbFmt12((hour<10?'0':'')+hour+':00'));
};

// Tap a scheduled task to send it back to brain dump
window._sbUnschedule=function(taskId){
  const idx=_sbTasks.findIndex(t=>t.id===taskId);
  if(idx<0)return;
  const task=_sbTasks.splice(idx,1)[0];
  _sbBrain.push({id:task.id,name:task.name,pri:'none'});
  _sbRenderTimeline();_sbRenderSidebar();
  _sbToast('"'+task.name+'" moved back to Brain Dump');
};

window._sbToggleRoutine=function(id){
  const r=_sbRoutines.find(r=>r.id===id);if(!r)return;

  // If turning ON a blocked routine, check for task conflicts
  if(!r.active&&r.blocked){
    const rStart=_sbHourToMin(r.start),rEnd=_sbHourToMin(r.end);
    const conflicts=_sbTasks.filter(t=>{
      const[h,m]=t.time.split(':').map(Number);
      const tStart=h*60+m,tEnd=tStart+t.dur;
      return tStart<rEnd&&tEnd>rStart; // overlaps
    });
    if(conflicts.length){
      // Move conflicting tasks back to brain dump
      conflicts.forEach(ct=>{
        _sbTasks=_sbTasks.filter(t=>t.id!==ct.id);
        _sbBrain.push({id:ct.id,name:ct.name,pri:'none'});
      });
      _sbToast(conflicts.length+' task'+(conflicts.length!==1?'s':'')+' moved back to Brain Dump — '+r.label+' blocks that time');
    }
  }

  r.active=!r.active;
  _sbRenderTimeline();_sbRenderSidebar();
};

// ── Fake AI ─────────────────────────────────────
window._sbRunAI=function(){
  if(!_sbBrain.length){_sbToast('All tasks already scheduled!');setTimeout(()=>_sbSetPhase(5),1200);return;}
  const btn=document.getElementById('sbAiBtn');
  if(btn){btn.disabled=true;btn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="sb-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Planning...';}

  const grid=document.getElementById('sbGrid');
  const isMobile=window.innerWidth<=640;
  const slotH=isMobile?52:64;

  // Build occupied set (15-min granularity)
  const occupied=new Set();
  _sbTasks.forEach(t=>{
    const[h,m]=t.time.split(':').map(Number);
    for(let i=h*60+m;i<h*60+m+t.dur;i+=15)occupied.add(i);
  });
  _sbRoutines.forEach(r=>{
    if(!r.active||!r.blocked)return;
    for(let i=_sbHourToMin(r.start);i<_sbHourToMin(r.end);i+=15)occupied.add(i);
  });

  // Collect open 15-min slots — prefer routine windows
  const openSlots=[];
  _sbRoutines.forEach(r=>{
    if(!r.active||r.blocked)return;
    for(let i=_sbHourToMin(r.start);i<_sbHourToMin(r.end);i+=15){if(!occupied.has(i))openSlots.push(i);}
  });
  SB_HOURS.forEach(h=>{
    const inRt=_sbRoutines.some(r=>r.active&&h*60>=_sbHourToMin(r.start)&&h*60<_sbHourToMin(r.end));
    if(!inRt){for(let i=h*60;i<h*60+60;i+=15){if(!occupied.has(i)&&!openSlots.includes(i))openSlots.push(i);}}
  });

  // Greedy placement
  const placements=[];
  const usedMins=new Set([...occupied]);
  [..._sbBrain].forEach(item=>{
    const dur=30;
    for(let wi=0;wi<openSlots.length;wi++){
      const s=openSlots[wi];if(usedMins.has(s))continue;
      let fits=true;
      for(let k=0;k<dur/15;k++){if(usedMins.has(s+k*15)){fits=false;break;}}
      if(fits){
        for(let k=0;k<dur/15;k++)usedMins.add(s+k*15);
        const h=Math.floor(s/60),m=s%60;
        placements.push({item,time:(h<10?'0':'')+h+':'+(m<10?'0':'')+m,dur});
        break;
      }
    }
  });

  // Handle zero placements — no open slots available
  if(!placements.length){
    _sbToast('No open time slots available — try adjusting your routines');
    if(btn){btn.disabled=false;btn.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg> Plan my day';}
    setTimeout(()=>_sbSetPhase(5),2000);
    return;
  }

  // Shimmer → reveal
  const shimmers=[];
  placements.forEach((p,i)=>{
    const[h,m]=p.time.split(':').map(Number);
    const topIdx=SB_HOURS.indexOf(h);if(topIdx<0)return;
    const topPx=topIdx*slotH+(m/60)*slotH;
    const hPx=Math.max(22,(p.dur/60)*slotH);
    const shim=document.createElement('div');
    shim.className='sb-shimmer';
    shim.style.cssText=`top:${topPx}px;height:${hPx}px;opacity:0;transition:opacity .3s`;
    grid.appendChild(shim);
    setTimeout(()=>{shim.style.opacity='1';},i*150);
    shimmers.push(shim);
  });

  setTimeout(()=>{
    shimmers.forEach(s=>s.remove());
    placements.forEach((p,i)=>{
      _sbBrain=_sbBrain.filter(b=>b.id!==p.item.id);
      _sbTasks.push({id:p.item.id,name:p.item.name,time:p.time,dur:p.dur,color:'#8b5cf6'});
      const[h,m]=p.time.split(':').map(Number);
      const topIdx=SB_HOURS.indexOf(h);if(topIdx<0)return;
      const topPx=topIdx*slotH+(m/60)*slotH;
      const hPx=Math.max(22,(p.dur/60)*slotH);
      const el=document.createElement('div');
      el.className='sb-task sb-reveal';
      el.style.cssText=`top:${topPx}px;height:${hPx}px;border-left-color:#8b5cf6;border-top-color:#8b5cf6;background:rgba(139,92,246,.13)`;
      el.innerHTML=`<span class="sb-task-name">${_sbEsc(p.item.name)}</span><span class="sb-task-dur">${_sbDurLabel(p.dur)}</span>`;
      grid.appendChild(el);
      setTimeout(()=>el.classList.add('sb-revealed'),i*200+50);
    });
    setTimeout(()=>{
      _sbRenderSidebar();_sbRenderTimeline();
      _sbToast(placements.length+' task'+(placements.length!==1?'s':'')+' scheduled');
      setTimeout(()=>_sbSetPhase(5),1500);
    },placements.length*200+400);
  },placements.length*150+1200);
};


/* ────────────────────────────────────────────────
   PHASE MANAGEMENT
──────────────────────────────────────────────────── */
function _sbSetPhase(p){
  _sbPhase=p;
  const prog=document.getElementById('sbProg');
  if(prog)prog.style.width=(p/(PHASE_COUNT-1)*100)+'%';
  const badge=document.getElementById('sbPhaseBadge');
  if(badge)badge.textContent=PHASE_LABELS[p]||'SANDBOX';
  const rtTab=document.getElementById('sbTabRt');
  if(rtTab)rtTab.classList.toggle('sb-locked',p<3);
  if(p===3)_sbSwitchTab('routines');
  else if(p===4)_sbSwitchTab('braindump');
  _sbRenderTimeline();_sbRenderSidebar();_sbRenderGuide();
}

window._sbNext=function(){_sbSetPhase(_sbPhase+1)};

function _sbRenderGuide(){
  if(!_sbRoot)return;
  _sbRoot.querySelectorAll('.sb-guide,.sb-modal').forEach(e=>e.remove());

  if(_sbPhase===0){
    const m=document.createElement('div');m.className='sb-modal';
    m.innerHTML=`<div class="sb-modal-inner">
      <div class="sb-modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></div>
      <div class="sb-modal-title">Welcome to LuClaro</div>
      <div class="sb-modal-body">This is a hands-on sandbox — nothing here touches your real data. You'll learn to brain dump, schedule, set up routines, and let Luclaro plan your day.</div>
      <button class="sb-modal-btn" onclick="_sbNext()">Let's start</button>
    </div>`;
    _sbRoot.appendChild(m);requestAnimationFrame(()=>m.classList.add('sb-vis'));return;
  }
  if(_sbPhase===5){
    const m=document.createElement('div');m.className='sb-modal';
    m.innerHTML=`<div class="sb-modal-inner">
      <div class="sb-modal-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
      <div class="sb-modal-title">You're all set!</div>
      <div class="sb-modal-body">Brain dump, drag-to-schedule, routines, and smart planning — you've got the fundamentals. Time to plan your real day.</div>
      <button class="sb-modal-btn" onclick="_sbClose()">Start planning</button>
    </div>`;
    _sbRoot.appendChild(m);requestAnimationFrame(()=>m.classList.add('sb-vis'));return;
  }

  const guides={
    1:{title:'Brain Dump + Quick Events',body:'Get tasks out of your head — type in the quick add box on the right.<br><br>✨ <strong>Quick Events</strong> parses naturally: try <em>"Study 3pm 45min"</em>, <em>"Lunch tomorrow noon"</em>, or <em>"Gym Mon/Wed/Fri 6pm"</em>.<br><br>Tasks with a time go straight to the calendar. Without a time, they land in brain dump cards.',btn:'I\'ve added some tasks'},
    2:{title:'Drag to Schedule',body:'Grab any card from the brain dump and <strong>drag it onto a time slot</strong>. You can also <strong>click a slot</strong> to place the next card there.<br><br>Take your time — schedule as many as you want.',btn:'Done scheduling'},
    3:{title:'Routines',body:'Toggle routines on to shape your day. <strong>Windows</strong> (blue) stay open for tasks. <strong>Blocks</strong> (red hatching) are reserved — tasks can\'t go there.<br><br>Watch the calendar update as you toggle each one.',btn:'Routines are set'},
    4:{title:'Let Luclaro Plan',body:_sbBrain.length
        ?'Hit <em>"Plan my day"</em> in the sidebar. Luclaro will place your remaining brain dump items into open windows — respecting your routines, using smart defaults for duration, and avoiding blocked time.'
        :'You\'ve already scheduled all your tasks — great job! Hit <em>"Continue"</em> in the sidebar to finish up.',btn:null},
  };
  const g=guides[_sbPhase];if(!g)return;
  const card=document.createElement('div');card.className='sb-guide';
  const dots=Array.from({length:PHASE_COUNT},(_,i)=>`<span class="sb-guide-dot${i===_sbPhase?' sb-on':''}"></span>`).join('');
  card.innerHTML=`<div class="sb-guide-title">${g.title}</div>
    <div class="sb-guide-body">${g.body}</div>
    ${g.btn?`<div class="sb-guide-actions"><button class="sb-guide-btn" onclick="_sbNext()">${g.btn} →</button></div>`:''}
    <div class="sb-guide-dots">${dots}</div>`;
  _sbRoot.querySelector('.sb-body').appendChild(card);
  requestAnimationFrame(()=>card.classList.add('sb-vis'));
}

function _sbToast(msg){
  if(!_sbRoot)return;
  const old=_sbRoot.querySelector('.sb-toast');if(old)old.remove();
  const t=document.createElement('div');t.className='sb-toast';t.textContent=msg;
  _sbRoot.querySelector('.sb-body').appendChild(t);
  requestAnimationFrame(()=>t.classList.add('sb-vis'));
  setTimeout(()=>{t.classList.remove('sb-vis');setTimeout(()=>t.remove(),300);},2200);
}


/* ────────────────────────────────────────────────
   OPEN / CLOSE
──────────────────────────────────────────────────── */
window._sbClose=function(){
  if(!_sbActive)return;_sbActive=false;
  if(_sbRoot)_sbRoot.classList.remove('sb-vis');
  setTimeout(()=>{
    if(_sbRoot){_sbRoot.remove();_sbRoot=null;}
    if(_sbStyle){_sbStyle.remove();_sbStyle=null;}
  },400);
  localStorage.setItem('clarity_onboarded','true');
  const splash=document.getElementById('splash');
  if(splash&&splash.style.display!=='none'&&typeof enterApp==='function')enterApp();
};

window.startSandboxDemo=function(){
  if(_sbActive)return;_sbActive=true;
  _sbPhase=0;_sbSideTab='braindump';
  _sbResetData();_sbInjectCSS();_sbBuild();
  setTimeout(()=>_sbRenderGuide(),500);
};

})();
