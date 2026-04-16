// ══ LUCLARO SANDBOX DEMO ════════════════════════════
// Self-contained onboarding overlay. Zero contact with real app data.
// Entry: startSandboxDemo()  |  Exit: _sbClose()
// All DOM is created/destroyed dynamically. IDs/classes prefixed sb-.

(function(){
'use strict';

// ── State ───────────────────────────────────────────
let _sbStep=0;
let _sbActive=false;
let _sbRoot=null; // overlay root element
let _sbStyle=null; // injected <style>

// Fake data for the demo
const SB_TASKS=[
  {id:'sb1',name:'Team standup',time:'09:00',dur:30,cat:'Work',color:'#3b82f6',done:false},
  {id:'sb2',name:'Reply to emails',time:'09:30',dur:30,cat:'Work',color:'#3b82f6',done:false},
  {id:'sb3',name:'Lunch break',time:'12:00',dur:60,cat:'Personal',color:'#10b981',done:false},
];

const SB_BRAINDUMP=[
  {id:'bd1',name:'Research competitors',pri:'high'},
  {id:'bd2',name:'Grocery shopping',pri:'medium'},
  {id:'bd3',name:'Call dentist',pri:'low'},
];

const SB_ROUTINES=[
  {label:'Work',start:'08:00',end:'12:00',blocked:false,color:'rgba(59,130,246,.08)'},
  {label:'Lunch',start:'12:00',end:'13:00',blocked:true,color:'rgba(239,68,68,.06)'},
  {label:'Work',start:'13:00',end:'17:00',blocked:false,color:'rgba(59,130,246,.08)'},
];

const SB_AI_TASKS=[
  {name:'Research competitors',time:'10:00',dur:45,color:'#8b5cf6'},
  {name:'Draft proposal outline',time:'10:45',dur:30,color:'#8b5cf6'},
  {name:'Review analytics',time:'13:00',dur:30,color:'#8b5cf6'},
  {name:'Grocery shopping',time:'17:15',dur:45,color:'#8b5cf6'},
];

// Slots to render (8am–6pm)
const SB_HOURS=[8,9,10,11,12,13,14,15,16,17];

const SB_STEPS=[
  {
    id:'welcome',
    title:'Welcome to LuClaro',
    body:'A quick tour of how to plan your day — using a safe sandbox. Nothing here touches your real data.',
    btn:'Let\'s go',
    pos:'center'
  },
  {
    id:'quickadd',
    title:'Quick Add',
    body:'Type a task below and press <strong>Enter</strong>. Try something like <em>"Study 3pm 45min"</em>.',
    btn:'Skip',
    pos:'above-input',
    interactive:true
  },
  {
    id:'drag',
    title:'Drag to Schedule',
    body:'Grab the highlighted card and <strong>drag it onto a time slot</strong> in the calendar.',
    btn:'Skip',
    pos:'above-sidebar',
    interactive:true
  },
  {
    id:'routines',
    title:'Routines',
    body:'Set up blocks for work, gym, meals, or sleep. <strong>Windows</strong> (blue) stay open for tasks. <strong>Blocks</strong> (red hatch) are reserved — tasks can\'t go there.',
    btn:'Next',
    pos:'above-timeline'
  },
  {
    id:'ai',
    title:'AI Schedule',
    body:'Describe your priorities and AI places tasks into open windows — respecting routines, holidays, and existing events.',
    btn:'Next',
    pos:'above-timeline'
  },
  {
    id:'done',
    title:'You\'re all set!',
    body:'That\'s the core of LuClaro. Brain dump → schedule → focus. You\'ve got this.',
    btn:'Start planning',
    pos:'center'
  }
];


// ── Inject CSS ──────────────────────────────────────
function _sbInjectCSS(){
  if(_sbStyle)return;
  _sbStyle=document.createElement('style');
  _sbStyle.id='sb-styles';
  _sbStyle.textContent=`
/* ══ SANDBOX OVERLAY ══ */
#sb-overlay{
  position:fixed;inset:0;z-index:700;
  background:var(--bg);
  display:flex;flex-direction:column;
  opacity:0;transition:opacity .4s ease;
  overflow:hidden;
}
#sb-overlay.sb-visible{opacity:1}
#sb-overlay *{box-sizing:border-box}

/* Header */
.sb-header{
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 20px;border-bottom:1px solid var(--border);
  background:var(--surface);flex-shrink:0;
}
.sb-header-title{
  font-family:'DM Serif Display',serif;font-size:20px;color:var(--text);
  display:flex;align-items:center;gap:10px;
}
.sb-header-dot{
  width:10px;height:10px;border-radius:50%;background:var(--accent);
  animation:sbDotPulse 1.4s ease-in-out infinite;
}
@keyframes sbDotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(.85)}}
.sb-skip-btn{
  background:none;border:1px solid var(--border);color:var(--text2);
  font-family:'DM Sans',sans-serif;font-size:12px;padding:6px 14px;
  border-radius:8px;cursor:pointer;transition:all .15s;
}
.sb-skip-btn:hover{border-color:var(--text3);color:var(--text)}

/* Progress bar */
.sb-progress{
  height:3px;background:var(--surface2);flex-shrink:0;
}
.sb-progress-fill{
  height:100%;background:var(--accent);
  transition:width .4s cubic-bezier(.4,0,.2,1);border-radius:0 2px 2px 0;
}

/* Main body */
.sb-body{
  flex:1;display:flex;overflow:hidden;position:relative;
}

/* Sidebar */
.sb-sidebar{
  width:280px;border-right:1px solid var(--border);
  background:var(--surface);display:flex;flex-direction:column;
  flex-shrink:0;
}
.sb-side-hdr{
  padding:14px 16px 10px;font-size:13px;font-weight:600;
  color:var(--text);letter-spacing:.3px;
  display:flex;align-items:center;justify-content:space-between;
}
.sb-side-label{font-size:11px;color:var(--text3);font-weight:500}

/* Quick add input */
.sb-qe-wrap{
  padding:0 12px 12px;
}
.sb-qe-input{
  width:100%;padding:10px 12px;border:1.5px solid var(--border);
  border-radius:10px;font-family:'DM Sans',sans-serif;font-size:13px;
  background:var(--surface2);color:var(--text);outline:none;
  transition:border-color .15s,box-shadow .15s;
}
.sb-qe-input:focus{
  border-color:var(--accent);
  box-shadow:0 0 0 3px rgba(var(--accent-rgb),.12);
}
.sb-qe-input::placeholder{color:var(--text3)}

/* Brain dump cards */
.sb-bd-list{
  flex:1;overflow-y:auto;padding:0 12px 12px;display:flex;flex-direction:column;gap:6px;
}
.sb-bd-card{
  padding:10px 12px;border-radius:10px;background:var(--surface2);
  border:1.5px solid var(--border);cursor:grab;
  transition:all .2s;position:relative;
}
.sb-bd-card:active{cursor:grabbing}
.sb-bd-card.sb-highlight{
  border-color:var(--accent);
  box-shadow:0 0 0 3px rgba(var(--accent-rgb),.15);
  animation:sbPulse 1.5s ease-in-out infinite;
}
@keyframes sbPulse{0%,100%{box-shadow:0 0 0 3px rgba(var(--accent-rgb),.15)}50%{box-shadow:0 0 0 6px rgba(var(--accent-rgb),.08)}}
.sb-bd-name{font-size:13px;color:var(--text);font-weight:500}
.sb-bd-pri{
  display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:6px;
  vertical-align:1px;
}
.sb-bd-card.sb-dragging{opacity:.4;transform:scale(.96)}
.sb-bd-card.sb-placed{
  opacity:0;transform:translateX(-20px) scale(.95);
  transition:all .3s ease;pointer-events:none;
}

/* Timeline */
.sb-timeline-wrap{
  flex:1;overflow-y:auto;overflow-x:hidden;position:relative;
}
.sb-day-hdr{
  padding:12px 20px 8px;background:var(--surface);
  border-bottom:1px solid var(--border);
  position:sticky;top:0;z-index:2;
}
.sb-day-title{
  font-family:'DM Serif Display',serif;font-size:18px;color:var(--text);
}
.sb-day-sub{font-size:12px;color:var(--text2);margin-top:2px}

.sb-timeline{
  display:grid;grid-template-columns:70px 1fr;
  padding-bottom:40px;position:relative;
}
.sb-time-lbl{
  padding:6px 12px 0 0;text-align:right;font-size:11px;
  color:var(--text3);font-weight:500;letter-spacing:.3px;
  border-right:1px solid var(--border);
  height:64px;
}
.sb-slot{
  height:64px;border-bottom:1px solid var(--border);
  position:relative;cursor:pointer;
  transition:background .15s;
}
.sb-slot:hover{background:var(--accent-pale)}
.sb-slot.sb-drag-over{
  background:var(--accent-pale)!important;
  outline:1.5px dashed var(--accent);outline-offset:-1px;
}
.sb-slot.sb-routine-window{
  background:var(--surface);
}
.sb-slot.sb-routine-blocked{
  background:repeating-linear-gradient(135deg,transparent,transparent 5px,rgba(239,68,68,.05) 5px,rgba(239,68,68,.05) 10px);
  cursor:not-allowed;
}
[data-dark="true"] .sb-slot.sb-routine-blocked{
  background:repeating-linear-gradient(135deg,transparent,transparent 5px,rgba(239,68,68,.08) 5px,rgba(239,68,68,.08) 10px);
}

/* Routine band labels */
.sb-routine-label{
  position:absolute;right:8px;top:2px;font-size:9px;
  color:var(--text3);font-weight:600;letter-spacing:.5px;text-transform:uppercase;
  opacity:.6;
}

/* Task blocks on timeline */
.sb-task-block{
  position:absolute;left:4px;right:4px;
  border-radius:9px;padding:6px 10px;
  font-size:12px;font-weight:500;color:#fff;
  box-shadow:0 2px 8px rgba(0,0,0,.1);
  z-index:3;pointer-events:none;
  display:flex;align-items:center;gap:6px;
  overflow:hidden;
}
.sb-task-block-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sb-task-block-dur{font-size:10px;opacity:.75;flex-shrink:0}
.sb-task-block.sb-ai-task{
  opacity:0;transform:translateY(8px) scale(.97);
}
.sb-task-block.sb-ai-reveal{
  opacity:1;transform:translateY(0) scale(1);
  transition:all .45s cubic-bezier(.34,1.56,.64,1);
}

/* Drop ghost */
.sb-drop-ghost{
  position:absolute;left:4px;right:4px;
  border-radius:9px;border:2px dashed var(--accent);
  background:rgba(var(--accent-rgb),.08);
  height:32px;z-index:2;pointer-events:none;
  opacity:0;transition:opacity .15s;
}
.sb-drop-ghost.sb-visible{opacity:1}

/* Tooltip card */
.sb-tooltip{
  position:absolute;z-index:10;
  width:300px;max-width:calc(100vw - 32px);
  background:var(--surface);border:1.5px solid var(--accent);
  border-radius:14px;padding:18px 20px 16px;
  box-shadow:0 12px 40px rgba(0,0,0,.12);
  opacity:0;transform:translateY(10px);
  transition:all .35s cubic-bezier(.34,1.56,.64,1);
}
.sb-tooltip.sb-visible{opacity:1;transform:translateY(0)}
.sb-tooltip-title{
  font-family:'DM Serif Display',serif;font-size:17px;
  color:var(--text);margin-bottom:6px;
}
.sb-tooltip-body{
  font-size:13px;color:var(--text2);line-height:1.65;margin-bottom:14px;
}
.sb-tooltip-body em{color:var(--accent);font-style:normal;font-weight:600}
.sb-tooltip-body strong{color:var(--text);font-weight:600}
.sb-tooltip-actions{display:flex;align-items:center;gap:8px}
.sb-tooltip-btn{
  flex:1;padding:10px;background:var(--accent);color:#fff;
  border:none;border-radius:10px;font-family:'DM Sans',sans-serif;
  font-size:13px;font-weight:600;cursor:pointer;
  transition:background .15s,transform .1s;
}
.sb-tooltip-btn:hover{background:var(--accent-dim);transform:translateY(-1px)}
.sb-tooltip-btn:active{transform:translateY(0)}
.sb-tooltip-skip{
  background:none;border:none;color:var(--text3);font-size:11px;
  font-family:'DM Sans',sans-serif;cursor:pointer;padding:6px 8px;
}
.sb-tooltip-skip:hover{color:var(--text2)}

/* Step dots */
.sb-dots{display:flex;gap:5px;justify-content:center;margin-top:12px}
.sb-dot{
  width:6px;height:6px;border-radius:50%;background:var(--border);
  transition:all .25s;
}
.sb-dot.sb-active{background:var(--accent);transform:scale(1.3)}

/* Success flash */
.sb-success{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(var(--accent-rgb),.1);border-radius:14px;
  opacity:0;pointer-events:none;z-index:11;
}
.sb-success.sb-show{
  opacity:1;animation:sbSuccessIn .5s ease;
}
@keyframes sbSuccessIn{
  0%{opacity:0;transform:scale(.8)}
  50%{opacity:1;transform:scale(1.05)}
  100%{opacity:1;transform:scale(1)}
}
.sb-success-check{
  width:48px;height:48px;border-radius:50%;background:var(--accent);
  display:flex;align-items:center;justify-content:center;
  color:#fff;font-size:24px;font-weight:700;
  box-shadow:0 4px 20px rgba(var(--accent-rgb),.35);
}

/* Center overlay for welcome/done steps */
.sb-center-card{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.4);z-index:12;
  opacity:0;transition:opacity .3s;
}
.sb-center-card.sb-visible{opacity:1}
.sb-center-inner{
  background:var(--surface);border-radius:20px;padding:36px 32px 28px;
  max-width:380px;width:calc(100% - 32px);text-align:center;
  box-shadow:0 20px 60px rgba(0,0,0,.2);
  transform:translateY(20px) scale(.95);
  transition:transform .45s cubic-bezier(.34,1.56,.64,1);
}
.sb-center-card.sb-visible .sb-center-inner{transform:translateY(0) scale(1)}
.sb-center-icon{
  width:56px;height:56px;border-radius:16px;
  background:var(--accent-pale);display:flex;align-items:center;justify-content:center;
  margin:0 auto 16px;
}
.sb-center-icon svg{width:28px;height:28px;color:var(--accent)}
.sb-center-title{
  font-family:'DM Serif Display',serif;font-size:24px;color:var(--text);
  margin-bottom:8px;
}
.sb-center-body{
  font-size:14px;color:var(--text2);line-height:1.65;margin-bottom:20px;
}
.sb-center-btn{
  display:inline-block;padding:14px 36px;background:var(--accent);color:#fff;
  border:none;border-radius:12px;font-family:'DM Sans',sans-serif;
  font-size:15px;font-weight:600;cursor:pointer;
  transition:all .15s;
  box-shadow:0 4px 20px rgba(var(--accent-rgb),.3);
}
.sb-center-btn:hover{background:var(--accent-dim);transform:translateY(-2px);box-shadow:0 8px 28px rgba(var(--accent-rgb),.35)}
.sb-center-btn:active{transform:translateY(0)}

/* AI shimmer animation */
.sb-ai-shimmer{
  position:absolute;left:4px;right:4px;
  border-radius:9px;height:30px;
  background:linear-gradient(90deg,var(--surface2) 25%,var(--accent-pale) 50%,var(--surface2) 75%);
  background-size:200% 100%;
  animation:sbShimmer 1.2s ease-in-out infinite;
  z-index:2;
}
@keyframes sbShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* Mobile */
@media(max-width:640px){
  .sb-sidebar{width:100%;border-right:none;border-bottom:1px solid var(--border);max-height:180px}
  .sb-body{flex-direction:column}
  .sb-tooltip{width:calc(100% - 24px);left:12px!important;right:12px!important}
  .sb-side-hdr{padding:10px 14px 6px}
  .sb-bd-list{flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:0 12px 10px;gap:8px}
  .sb-bd-card{min-width:140px;flex-shrink:0}
  .sb-time-lbl{font-size:10px;padding:4px 8px 0 0}
  .sb-slot{height:52px}
  .sb-day-hdr{padding:10px 14px 6px}
  .sb-day-title{font-size:16px}
}
`;
  document.head.appendChild(_sbStyle);
}

// ── Helpers ─────────────────────────────────────────
function _sbFmt(t){
  const[h,m]=t.split(':').map(Number);
  const ap=h>=12?'PM':'AM';
  const h12=h%12||12;
  return h12+':'+(m<10?'0':'')+m+' '+ap;
}
function _sbSlotIdx(t){
  const[h]=t.split(':').map(Number);
  return SB_HOURS.indexOf(h);
}
function _sbPriColor(p){
  return p==='high'?'#ef4444':p==='medium'?'#f59e0b':'#3b82f6';
}

// ── Build DOM ───────────────────────────────────────
function _sbBuild(){
  _sbRoot=document.createElement('div');
  _sbRoot.id='sb-overlay';

  const today=new Date();
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const dayTitle=days[today.getDay()]+', '+months[today.getMonth()]+' '+today.getDate();

  // Header
  const hdr=`
  <div class="sb-header">
    <div class="sb-header-title"><div class="sb-header-dot"></div>LuClaro Demo</div>
    <button class="sb-skip-btn" onclick="_sbClose()">Exit tour</button>
  </div>
  <div class="sb-progress"><div class="sb-progress-fill" id="sbProgress" style="width:0%"></div></div>`;

  // Sidebar
  const bdCards=SB_BRAINDUMP.map(t=>`
    <div class="sb-bd-card" id="sbBd-${t.id}" draggable="true"
         data-id="${t.id}" data-name="${t.name}">
      <div class="sb-bd-name"><span class="sb-bd-pri" style="background:${_sbPriColor(t.pri)}"></span>${t.name}</div>
    </div>`).join('');

  const sidebar=`
  <div class="sb-sidebar" id="sbSidebar">
    <div class="sb-side-hdr">Brain Dump <span class="sb-side-label">${SB_BRAINDUMP.length} items</span></div>
    <div class="sb-qe-wrap">
      <input class="sb-qe-input" id="sbQeInput" placeholder="Quick add: &quot;Lunch 12pm 1hr&quot;" autocomplete="off">
    </div>
    <div class="sb-bd-list" id="sbBdList">${bdCards}</div>
  </div>`;

  // Timeline
  let slotsHTML='';
  SB_HOURS.forEach(h=>{
    const t=h+':00';
    const lbl=_sbFmt(t);
    // Check routine
    let routineClass='';
    let routineLabel='';
    for(const r of SB_ROUTINES){
      const[rs]=r.start.split(':').map(Number);
      const[re]=r.end.split(':').map(Number);
      if(h>=rs&&h<re){
        routineClass=r.blocked?'sb-routine-blocked':'sb-routine-window';
        routineLabel=r.label;
        break;
      }
    }
    slotsHTML+=`
      <div class="sb-time-lbl">${lbl}</div>
      <div class="sb-slot ${routineClass}" data-hour="${h}" id="sbSlot-${h}">
        ${routineLabel?`<span class="sb-routine-label">${routineLabel}</span>`:''}
        <div class="sb-drop-ghost" id="sbGhost-${h}"></div>
      </div>`;
  });

  const timeline=`
  <div class="sb-timeline-wrap" id="sbTimeline">
    <div class="sb-day-hdr">
      <div class="sb-day-title">${dayTitle}</div>
      <div class="sb-day-sub">${today.getFullYear()} · Today · Sandbox</div>
    </div>
    <div class="sb-timeline" id="sbGrid">${slotsHTML}</div>
  </div>`;

  _sbRoot.innerHTML=hdr+`<div class="sb-body">${sidebar}${timeline}</div>`;
  document.body.appendChild(_sbRoot);

  // Place pre-existing task blocks
  requestAnimationFrame(()=>{
    SB_TASKS.forEach(t=>_sbPlaceTask(t));
    // Animate in
    requestAnimationFrame(()=>_sbRoot.classList.add('sb-visible'));
  });
}

// ── Place a task block on the timeline ──────────────
function _sbPlaceTask(t,extraClass){
  const grid=document.getElementById('sbGrid');if(!grid)return;
  const hourSlot=document.getElementById('sbSlot-'+parseInt(t.time));
  if(!hourSlot)return;

  const[h,m]=(t.time||'0:00').split(':').map(Number);
  const slotH=window.innerWidth<=640?52:64;
  const topOffset=(SB_HOURS.indexOf(h))*slotH+(m/60)*slotH;
  const height=((t.dur||30)/60)*slotH;

  // Offset for the header row in the grid (time-lbl col + slot col per hour)
  const block=document.createElement('div');
  block.className='sb-task-block'+(extraClass?' '+extraClass:'');
  block.style.cssText=`
    top:${topOffset}px;height:${Math.max(height,24)}px;
    background:${t.color||'var(--accent)'};
    left:74px;right:4px;
  `;
  block.innerHTML=`<span class="sb-task-block-name">${t.name}</span>
    <span class="sb-task-block-dur">${t.dur}m</span>`;
  block.id='sbTask-'+(t.id||t.name.replace(/\s/g,''));

  // Place relative to the timeline grid's parent
  const wrap=document.getElementById('sbTimeline');
  const gridEl=document.getElementById('sbGrid');
  // Use grid as positioning parent
  gridEl.style.position='relative';
  gridEl.appendChild(block);
  return block;
}


// ── Show a step ─────────────────────────────────────
function _sbShowStep(){
  // Remove old tooltip/center cards
  _sbRoot.querySelectorAll('.sb-tooltip,.sb-center-card,.sb-success').forEach(el=>el.remove());
  _sbRoot.querySelectorAll('.sb-highlight').forEach(el=>el.classList.remove('sb-highlight'));

  // Update progress
  const pct=(_sbStep/SB_STEPS.length)*100;
  const prog=document.getElementById('sbProgress');
  if(prog)prog.style.width=pct+'%';

  const step=SB_STEPS[_sbStep];
  if(!step){_sbClose();return;}

  if(step.pos==='center'){
    _sbShowCenter(step);
  } else {
    _sbShowTooltip(step);
  }

  // Step-specific setup
  if(step.id==='quickadd')_sbSetupQuickAdd();
  if(step.id==='drag')_sbSetupDrag();
  if(step.id==='routines')_sbSetupRoutines();
  if(step.id==='ai')_sbSetupAI();
}

// ── Center card (welcome/done) ──────────────────────
function _sbShowCenter(step){
  const isWelcome=step.id==='welcome';
  const isDone=step.id==='done';

  const iconSvg=isWelcome
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>'
    :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';

  const card=document.createElement('div');
  card.className='sb-center-card';
  card.innerHTML=`
    <div class="sb-center-inner">
      <div class="sb-center-icon">${iconSvg}</div>
      <div class="sb-center-title">${step.title}</div>
      <div class="sb-center-body">${step.body}</div>
      <button class="sb-center-btn" onclick="${isDone?'_sbClose()':'_sbNext()'}">${step.btn}</button>
      ${_sbDotsHTML()}
    </div>`;
  _sbRoot.appendChild(card);
  requestAnimationFrame(()=>card.classList.add('sb-visible'));
}

// ── Tooltip card ────────────────────────────────────
function _sbShowTooltip(step){
  const tip=document.createElement('div');
  tip.className='sb-tooltip';
  tip.id='sbTooltip';

  const skipBtn=step.interactive?`<button class="sb-tooltip-skip" onclick="_sbNext()">Skip</button>`:'';

  tip.innerHTML=`
    <div class="sb-tooltip-title">${step.title}</div>
    <div class="sb-tooltip-body">${step.body}</div>
    <div class="sb-tooltip-actions">
      ${skipBtn}
      ${!step.interactive?`<button class="sb-tooltip-btn" onclick="_sbNext()">${step.btn}</button>`:''}
    </div>
    ${_sbDotsHTML()}`;

  _sbRoot.querySelector('.sb-body').appendChild(tip);

  // Position
  requestAnimationFrame(()=>{
    const isMobile=window.innerWidth<=640;
    if(step.pos==='above-input'){
      const inp=document.getElementById('sbQeInput');
      if(inp){
        const r=inp.getBoundingClientRect();
        const overlay=_sbRoot.getBoundingClientRect();
        tip.style.top=(r.bottom-overlay.top+8)+'px';
        tip.style.left=isMobile?'12px':Math.max(12,r.left-overlay.left-10)+'px';
      }
    } else if(step.pos==='above-sidebar'){
      const sb=document.getElementById('sbSidebar');
      if(sb){
        const r=sb.getBoundingClientRect();
        const overlay=_sbRoot.getBoundingClientRect();
        if(isMobile){
          tip.style.top=(r.bottom-overlay.top+8)+'px';
          tip.style.left='12px';
        } else {
          tip.style.top=(r.top-overlay.top+60)+'px';
          tip.style.left=(r.right-overlay.left+12)+'px';
        }
      }
    } else if(step.pos==='above-timeline'){
      const tl=document.getElementById('sbTimeline');
      if(tl){
        const r=tl.getBoundingClientRect();
        const overlay=_sbRoot.getBoundingClientRect();
        if(isMobile){
          tip.style.bottom='16px';
          tip.style.left='12px';
          tip.style.top='auto';
        } else {
          tip.style.top=(r.top-overlay.top+60)+'px';
          tip.style.right='20px';
          tip.style.left='auto';
        }
      }
    }
    tip.classList.add('sb-visible');
  });
}

// ── Dots HTML ───────────────────────────────────────
function _sbDotsHTML(){
  return '<div class="sb-dots">'+SB_STEPS.map((_,i)=>
    `<span class="sb-dot${i===_sbStep?' sb-active':''}"></span>`
  ).join('')+'</div>';
}

// ── Next step ───────────────────────────────────────
window._sbNext=function(){
  _sbStep++;
  _sbShowStep();
};

// ── Close sandbox ───────────────────────────────────
window._sbClose=function(){
  if(!_sbActive)return;
  _sbActive=false;
  if(_sbRoot){
    _sbRoot.classList.remove('sb-visible');
    setTimeout(()=>{
      _sbRoot.remove();
      _sbRoot=null;
    },400);
  }
  if(_sbStyle){
    _sbStyle.remove();
    _sbStyle=null;
  }
  // Mark onboarded
  localStorage.setItem('clarity_onboarded','true');
  // If app is behind, enter it
  const splash=document.getElementById('splash');
  if(splash&&splash.style.display!=='none'){
    if(typeof enterApp==='function')enterApp();
  }
};

// ── Interactive: Quick Add ──────────────────────────
function _sbSetupQuickAdd(){
  const inp=document.getElementById('sbQeInput');
  if(!inp)return;
  inp.focus();
  inp.value='';

  inp.addEventListener('keydown',function handler(e){
    if(e.key!=='Enter')return;
    const val=inp.value.trim();
    if(!val){inp.classList.add('sb-highlight');setTimeout(()=>inp.classList.remove('sb-highlight'),600);return;}

    // Parse a simple name from the input
    const name=val.replace(/\d{1,2}(:\d{2})?\s*(am|pm)?/gi,'').replace(/\d+\s*(min|m|hr|h|hour)/gi,'').trim()||val;
    const timeMatch=val.match(/(\d{1,2})(:\d{2})?\s*(am|pm)/i);
    let time='14:00';
    if(timeMatch){
      let h=parseInt(timeMatch[1]);
      const m=timeMatch[2]?parseInt(timeMatch[2].slice(1)):0;
      if(timeMatch[3].toLowerCase()==='pm'&&h<12)h+=12;
      if(timeMatch[3].toLowerCase()==='am'&&h===12)h=0;
      time=(h<10?'0':'')+h+':'+(m<10?'0':'')+m;
    }
    const durMatch=val.match(/(\d+)\s*(min|m(?:inute)?s?)\b/i)||val.match(/(\d+\.?\d*)\s*(hr|h|hour)/i);
    let dur=30;
    if(durMatch){
      if(durMatch[2].startsWith('h'))dur=Math.round(parseFloat(durMatch[1])*60);
      else dur=parseInt(durMatch[1]);
    }
    dur=Math.max(15,Math.round(dur/15)*15);

    // Place the task
    const task={id:'sbQe',name:name,time:time,dur:dur,color:'var(--accent)'};
    const block=_sbPlaceTask(task,'sb-ai-task');
    if(block)requestAnimationFrame(()=>block.classList.add('sb-ai-reveal'));

    // Success flash
    inp.value='';
    inp.removeEventListener('keydown',handler);
    _sbShowSuccess();
    setTimeout(()=>_sbNext(),1000);
  });
}

// ── Interactive: Drag ───────────────────────────────
function _sbSetupDrag(){
  // Highlight first available BD card
  const firstCard=_sbRoot.querySelector('.sb-bd-card:not(.sb-placed)');
  if(!firstCard){_sbNext();return;}
  firstCard.classList.add('sb-highlight');

  let _dragging=null;
  let _dragName='';

  function onDragStart(e){
    _dragging=e.target.closest('.sb-bd-card');
    if(!_dragging)return;
    _dragName=_dragging.dataset.name;
    _dragging.classList.add('sb-dragging');
    e.dataTransfer.setData('text/plain',_dragging.dataset.id);
    e.dataTransfer.effectAllowed='move';
  }

  function onDragOver(e){
    const slot=e.target.closest('.sb-slot');
    if(!slot||slot.classList.contains('sb-routine-blocked'))return;
    e.preventDefault();
    e.dataTransfer.dropEffect='move';
    // Show ghost
    _sbRoot.querySelectorAll('.sb-drag-over').forEach(s=>s.classList.remove('sb-drag-over'));
    slot.classList.add('sb-drag-over');
    const ghost=slot.querySelector('.sb-drop-ghost');
    if(ghost)ghost.classList.add('sb-visible');
  }

  function onDragLeave(e){
    const slot=e.target.closest('.sb-slot');
    if(slot){
      slot.classList.remove('sb-drag-over');
      const ghost=slot.querySelector('.sb-drop-ghost');
      if(ghost)ghost.classList.remove('sb-visible');
    }
  }

  function onDrop(e){
    e.preventDefault();
    const slot=e.target.closest('.sb-slot');
    if(!slot||slot.classList.contains('sb-routine-blocked'))return;
    const h=parseInt(slot.dataset.hour);
    slot.classList.remove('sb-drag-over');
    const ghost=slot.querySelector('.sb-drop-ghost');
    if(ghost)ghost.classList.remove('sb-visible');

    // Place task
    const task={id:'sbDrag',name:_dragName,time:h+':00',dur:30,color:'#10b981'};
    const block=_sbPlaceTask(task,'sb-ai-task');
    if(block)requestAnimationFrame(()=>block.classList.add('sb-ai-reveal'));

    // Mark BD card as placed
    if(_dragging){
      _dragging.classList.remove('sb-dragging','sb-highlight');
      _dragging.classList.add('sb-placed');
    }

    // Cleanup
    cleanup();
    _sbShowSuccess();
    setTimeout(()=>_sbNext(),1000);
  }

  function onDragEnd(){
    if(_dragging)_dragging.classList.remove('sb-dragging');
    _sbRoot.querySelectorAll('.sb-drag-over').forEach(s=>s.classList.remove('sb-drag-over'));
    _sbRoot.querySelectorAll('.sb-drop-ghost.sb-visible').forEach(g=>g.classList.remove('sb-visible'));
  }

  function cleanup(){
    _sbRoot.removeEventListener('dragstart',onDragStart);
    _sbRoot.removeEventListener('dragover',onDragOver);
    _sbRoot.removeEventListener('dragleave',onDragLeave);
    _sbRoot.removeEventListener('drop',onDrop);
    _sbRoot.removeEventListener('dragend',onDragEnd);
  }

  _sbRoot.addEventListener('dragstart',onDragStart);
  _sbRoot.addEventListener('dragover',onDragOver);
  _sbRoot.addEventListener('dragleave',onDragLeave);
  _sbRoot.addEventListener('drop',onDrop);
  _sbRoot.addEventListener('dragend',onDragEnd);
}

// ── Demo: Routines ──────────────────────────────────
function _sbSetupRoutines(){
  // Routine bands are already rendered. Just pulse them to draw attention.
  const slots=_sbRoot.querySelectorAll('.sb-routine-blocked,.sb-routine-window');
  slots.forEach((s,i)=>{
    s.style.transition='box-shadow .3s';
    setTimeout(()=>{
      s.style.boxShadow='inset 0 0 0 2px '+(s.classList.contains('sb-routine-blocked')?'rgba(239,68,68,.25)':'rgba(59,130,246,.2)');
    },i*80);
    setTimeout(()=>{s.style.boxShadow='';},1500+i*80);
  });
}

// ── Demo: AI Schedule ───────────────────────────────
function _sbSetupAI(){
  // Show shimmers first, then reveal tasks
  const grid=document.getElementById('sbGrid');
  if(!grid)return;

  // Add shimmers
  const shimmers=[];
  SB_AI_TASKS.forEach((t,i)=>{
    const[h,m]=t.time.split(':').map(Number);
    const slotH=window.innerWidth<=640?52:64;
    const topOffset=SB_HOURS.indexOf(h)*slotH+(m/60)*slotH;
    const height=(t.dur/60)*slotH;

    const shim=document.createElement('div');
    shim.className='sb-ai-shimmer';
    shim.style.cssText=`top:${topOffset}px;height:${Math.max(height,24)}px;left:74px;right:4px;position:absolute;`;
    grid.appendChild(shim);
    shimmers.push(shim);
  });

  // After a delay, remove shimmers and reveal task blocks
  setTimeout(()=>{
    shimmers.forEach(s=>s.remove());
    SB_AI_TASKS.forEach((t,i)=>{
      // Don't place if slot already has a task with this name
      const existing=document.getElementById('sbTask-'+t.name.replace(/\s/g,''));
      if(existing)return;

      const block=_sbPlaceTask(t,'sb-ai-task');
      if(block){
        setTimeout(()=>block.classList.add('sb-ai-reveal'),i*200);
      }
    });
  },1500);
}

// ── Success flash ───────────────────────────────────
function _sbShowSuccess(){
  const tip=document.getElementById('sbTooltip');
  if(!tip)return;
  const flash=document.createElement('div');
  flash.className='sb-success';
  flash.innerHTML='<div class="sb-success-check">✓</div>';
  tip.appendChild(flash);
  requestAnimationFrame(()=>flash.classList.add('sb-show'));
}


// ══ PUBLIC API ══════════════════════════════════════
window.startSandboxDemo=function(){
  if(_sbActive)return;
  _sbActive=true;
  _sbStep=0;
  _sbInjectCSS();
  _sbBuild();
  // Show first step after overlay animates in
  setTimeout(()=>_sbShowStep(),500);
};

})();
