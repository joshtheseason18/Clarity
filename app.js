// ══ AUDIO ══════════════════════════════════
let AC=null;
function getAC(){
  if(!AC)AC=new(window.AudioContext||window.webkitAudioContext)();
  if(AC.state==='suspended')AC.resume();
  return AC;
}
function playDone(){
  const ac=getAC();
  [[523.25,0],[659.25,.09],[783.99,.18]].forEach(([f,d])=>{
    const o=ac.createOscillator(),g=ac.createGain();
    o.connect(g);g.connect(ac.destination);o.type='sine';
    o.frequency.setValueAtTime(f,ac.currentTime+d);
    g.gain.setValueAtTime(0,ac.currentTime+d);
    g.gain.linearRampToValueAtTime(.15,ac.currentTime+d+.02);
    g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+d+.38);
    o.start(ac.currentTime+d);o.stop(ac.currentTime+d+.42);
  });
}
function playUndo(){
  const ac=getAC();
  const o=ac.createOscillator(),g=ac.createGain();
  o.connect(g);g.connect(ac.destination);o.type='sine';
  o.frequency.setValueAtTime(400,ac.currentTime);
  o.frequency.linearRampToValueAtTime(280,ac.currentTime+.18);
  g.gain.setValueAtTime(.09,ac.currentTime);
  g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.22);
  o.start(ac.currentTime);o.stop(ac.currentTime+.25);
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
  localStorage.setItem('clarity_dark',d?'true':'false');
}
function toggleDark(){applyDark(!isDark);}

// Apply saved on load
applyTheme(currentTheme);
applyDark(isDark);
// Time format button state applied after DOM ready

// ══ MORE MENU ════════════════════════════════
let _moreOpen=false;
function toggleMoreMenu(){
  _moreOpen=!_moreOpen;
  document.getElementById('moreMenu').classList.toggle('open',_moreOpen);
}
function closeMoreMenu(){
  _moreOpen=false;
  document.getElementById('moreMenu').classList.remove('open');
}
document.addEventListener('click',function(e){
  if(_moreOpen&&!e.target.closest('.more-wrap'))closeMoreMenu();
});

// ══ BOTTOM NAV SYNC ═════════════════════════
function syncBottomNav(view){
  const map={day:0,week:1,month:2,year:3,categories:4};
  document.querySelectorAll('.bnav-tab').forEach((b,i)=>b.classList.toggle('active',i===map[view]));
}

// ══ ONBOARDING — SPLASH NAME ════════════════════
const SPLASH_TAGLINES=[
  "Let's get it.",
  "Lock in today.",
  "Make today count.",
  "Stay sharp. Stay focused.",
  "One day at a time.",
  "You already know the plan.",
  "New day, new wins.",
  "Show up and show out.",
  "Less talk, more action.",
  "Today's yours — own it.",
  "Keep the momentum going.",
  "Big things start today.",
  "Dialed in. Let's go.",
  "Eyes on the prize.",
  "Walk in the light today.",
  "A lamp to your feet.",
  "Light the path forward.",
  "Ordered steps, bright day.",
];
function initSplashName(){
  const name=localStorage.getItem('clarity_username');
  const onboarded=localStorage.getItem('clarity_onboarded');
  // Rotate tagline daily — always show regardless of user state
  const dayIndex=Math.floor(Date.now()/86400000)%SPLASH_TAGLINES.length;
  const sublineEl=document.getElementById('splashSubline');
  if(sublineEl){
    sublineEl.textContent=SPLASH_TAGLINES[dayIndex];
    sublineEl.style.opacity='1';
    sublineEl.style.display=''; // ensure not hidden
  }
  if(onboarded&&name){
    const h=new Date().getHours();
    let greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
    document.getElementById('splashGreeting').textContent=greet+', '+name+'.';
    document.getElementById('splashGreeting').style.display='';
    document.getElementById('splashTagline').style.display='none';
  } else if(onboarded&&!name){
    // returning user without name — keep tagline, show subline
  } else {
    document.getElementById('splashNameWrap').style.display='';
  }
}
initSplashName();

// ══ GUIDED TOUR (contextual, tip-highlight style) ═══
let _tourStep=0;
const TOUR_STEPS=[
  {
    target:'.sidebar-toggle-btn',
    arrow:'top',
    title:'🧠 Dump everything',
    body:'Tap here to open the sidebar. Write down whatever\'s on your mind — tasks, ideas, reminders. Don\'t organize, just dump.',
    pre:function(){if(sidebarOpen)toggleSidebar();} // ensure closed so they see the button
  },
  {
    target:'.sidebar',
    arrow:'right',
    title:'✋ Drag to schedule',
    body:'Grab any card and drag it onto a time slot in Day or Week view. Or just leave it here — organize whenever you\'re ready.',
    pre:function(){if(!sidebarOpen)toggleSidebar();switchSide('braindump');}
  },
  {
    target:'[onclick="openAISchedule()"]',
    arrow:'top',
    title:'Let Luclaro plan your day',
    body:'Describe what you need to do and Luclaro\'s AI builds a schedule for you. Tweak anything, then accept.',
    pre:function(){if(sidebarOpen)toggleSidebar();}
  }
];

function startGuidedTour(){
  if(localStorage.getItem('clarity_onboarded'))return;
  // Save name from splash
  const nameInput=document.getElementById('splashName');
  if(nameInput){
    const name=nameInput.value.trim();
    if(name)localStorage.setItem('clarity_username',name);
  }
  _tourStep=0;
  setTimeout(showTourStep,600);
}

function showTourStep(){
  // Clean up previous
  clearTourUI();
  if(_tourStep>=TOUR_STEPS.length){finishTour();return;}

  const step=TOUR_STEPS[_tourStep];
  if(step.pre)step.pre();

  setTimeout(()=>{
    const target=document.querySelector(step.target);
    if(!target){_tourStep++;showTourStep();return;}

    // Backdrop — clicking it skips the tour (critical for mobile)
    const backdrop=document.createElement('div');
    backdrop.className='tour-backdrop';
    backdrop.id='tourBackdrop';
    backdrop.addEventListener('click',finishTour);
    document.body.appendChild(backdrop);

    // Highlight target
    target.classList.add('tip-highlight');
    target.style.position=target.style.position||'relative';
    target.style.zIndex='9999';
    target._tourStyled=true;

    // Tour card
    const card=document.createElement('div');
    card.className='tour-card arrow-'+step.arrow;
    card.id='tourCard';

    const dots=TOUR_STEPS.map((_,i)=>
      `<span class="tour-step-dot${i===_tourStep?' active':''}"></span>`
    ).join('');

    card.innerHTML=`
      <div class="tour-title">${step.title}</div>
      <div class="tour-body">${step.body}</div>
      <div class="tour-actions">
        <button class="tour-skip" onclick="finishTour()">Skip tour</button>
        <button class="tour-btn" onclick="nextTourStep()">${_tourStep<TOUR_STEPS.length-1?'Next →':'Got it 🚀'}</button>
      </div>
      <div class="tour-step-dots">${dots}</div>
      ${window.innerWidth<=640?'<div class="tour-tap-hint">Tap outside to skip</div>':''}`;
    document.body.appendChild(card);

    // Position card relative to target (use RAF to ensure card is rendered)
    const rect=target.getBoundingClientRect();
    const isMobile=window.innerWidth<=640;
    requestAnimationFrame(()=>{
      const cardH=card.offsetHeight;
      const cardW=Math.min(300,window.innerWidth-32);
      if(isMobile){
        // On mobile: always center horizontally, position below or above target
        card.style.left=Math.max(16,(window.innerWidth-cardW)/2)+'px';
        card.style.right='auto';
        const spaceBelow=window.innerHeight-rect.bottom;
        if(spaceBelow>=cardH+20){
          card.style.top=(rect.bottom+12)+'px';
        } else {
          card.style.top=Math.max(8,rect.top-cardH-12)+'px';
        }
      } else if(step.arrow==='top'){
        card.style.top=(rect.bottom+12)+'px';
        card.style.left=Math.max(16,Math.min(rect.left+rect.width/2-150,window.innerWidth-316))+'px';
      } else if(step.arrow==='bottom'){
        card.style.top=Math.max(8,(rect.top-cardH-12))+'px';
        card.style.left=Math.max(16,Math.min(rect.left+rect.width/2-150,window.innerWidth-316))+'px';
      } else if(step.arrow==='right'){
        // Guard against card going off the left edge of the screen
        const rightVal=window.innerWidth-rect.left+12;
        if(rightVal+cardW>window.innerWidth-16){
          // Would overflow — center it instead
          card.style.left=Math.max(16,(window.innerWidth-cardW)/2)+'px';
          card.style.right='auto';
          card.style.top=Math.max(8,rect.top)+'px';
        } else {
          card.style.top=rect.top+'px';
          card.style.right=rightVal+'px';
        }
      }
    });
  },400);
}

function nextTourStep(){
  _tourStep++;
  showTourStep();
}

function clearTourUI(){
  const card=document.getElementById('tourCard');if(card)card.remove();
  const bd=document.getElementById('tourBackdrop');if(bd)bd.remove();
  document.querySelectorAll('.tip-highlight').forEach(el=>{
    el.classList.remove('tip-highlight');
    if(el._tourStyled){el.style.zIndex='';delete el._tourStyled;}
  });
}

function finishTour(){
  clearTourUI();
  localStorage.setItem('clarity_onboarded','true');
  renderGreeting();
  if(sidebarOpen)toggleSidebar();
}

function showOnboarding(){
  startGuidedTour();
}

// ══ DAY GREETING ════════════════════════════════
function renderGreeting(){
  const el=document.getElementById('dayGreeting');if(!el)return;
  const h=new Date().getHours();
  const name=localStorage.getItem('clarity_username')||'';
  let greeting;
  if(h<12)greeting='Good morning';
  else if(h<17)greeting='Good afternoon';
  else greeting='Good evening';
  el.textContent=name?`${greeting}, ${name}.`:greeting;
}

// ══ JOURNAL PROMPTS ═════════════════════════════
const JOURNAL_PROMPTS=[
  '💭 What went well today?',
  '🌱 What\'s one thing you learned?',
  '🙏 What are you grateful for right now?',
  '🔄 What would you do differently today?',
  '⭐ What was the highlight of your day?',
  '😌 How are you really feeling right now?',
  '🎯 Did you make progress on what matters most?',
  '💡 What\'s one idea you had today?',
  '🤝 Who made your day better?',
  '🌅 What are you looking forward to tomorrow?',
];
function renderJournalPrompt(){
  const el=document.getElementById('journalPrompt');if(!el)return;
  // Pick a prompt based on the day (so it rotates daily, not randomly each render)
  const dayNum=Math.floor(Date.now()/86400000);
  el.textContent=JOURNAL_PROMPTS[dayNum%JOURNAL_PROMPTS.length];
}

// ══ UPCOMING EVENTS WIDGET ══════════════════════
let _upcomingExpanded=true;
function renderUpcomingEvents(){
  const el=document.getElementById('upcomingEvents');if(!el)return;
  const today=new Date();today.setHours(0,0,0,0);
  const todayKey=dk(today);
  const weekEnd=addDays(today,7);
  // Get events for the next 7 days
  const upcoming=expandedTasks(today,weekEnd).filter(t=>(t.type||'task')==='event'&&t._instanceDate>=todayKey).sort((a,b)=>(a._instanceDate+(a.time||'')).localeCompare(b._instanceDate+(b.time||'')));
  if(!upcoming.length){el.innerHTML='';return;}
  const count=Math.min(upcoming.length,5);
  const shown=upcoming.slice(0,count);
  let html=`<button class="upcoming-toggle" onclick="_upcomingExpanded=!_upcomingExpanded;renderUpcomingEvents()">
    <span>${_upcomingExpanded?'▾':'▸'}</span> ${upcoming.length} upcoming event${upcoming.length!==1?'s':''}
  </button>`;
  if(_upcomingExpanded){
    html+=`<div class="upcoming-list">`;
    shown.forEach(t=>{
      const d=fromDk(t._instanceDate);
      const isToday=t._instanceDate===todayKey;
      const dayLabel=isToday?'Today':DAYS_S[d.getDay()]+' '+(d.getMonth()+1)+'/'+d.getDate();
      html+=`<div class="upcoming-item" onclick="openUpcomingEdit('${t.id}','${t._instanceDate}')" title="Click to view & edit">
        <span class="upcoming-item-day">${dayLabel}</span>
        <span class="upcoming-item-time">${t.time?fmtT(t.time):t.allday?'All Day':''}</span>
        <span class="upcoming-item-name">${esc(t.name)}</span>
        ${t.location?`<span class="upcoming-item-loc">${IC_PIN} ${esc(t.location)}</span>`:''}
      </div>`;
    });
    if(upcoming.length>5)html+=`<div style="text-align:center;font-size:10px;color:var(--text3);padding:4px">+${upcoming.length-5} more</div>`;
    html+=`</div>`;
  }
  el.innerHTML=html;
}
function openUpcomingEdit(id, instanceDate){
  // Navigate to the event's day, then open the edit modal once the day view has rendered
  selDate=fromDk(instanceDate);
  switchView('day');
  setTimeout(()=>{
    const fakeEvent={stopPropagation:()=>{}};
    openEdit(id, instanceDate, fakeEvent);
  }, 80);
}

// ══ DRAWER ══════════════════════════════════
function openDrawer(){
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
}
function closeDrawer(){
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
}
function toggleDrawerAcc(el){
  // Don't toggle if clicking inside the body (inputs, buttons, etc.)
  if(event.target.closest('.drawer-acc-body'))return;
  const wasOpen=el.classList.contains('open');
  // Close all accordion sections
  document.querySelectorAll('.drawer-acc').forEach(a=>a.classList.remove('open'));
  // Open this one if it wasn't already open
  if(!wasOpen)el.classList.add('open');
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

// ══ DAY JOURNAL (collapsed section in day view) ══════
let _dayJournalOpen=false;
function toggleDayJournal(){
  _dayJournalOpen=!_dayJournalOpen;
  const body=document.getElementById('dayJournalBody');
  const arrow=document.getElementById('dayJournalArrow');
  if(body)body.style.display=_dayJournalOpen?'':'none';
  if(arrow)arrow.textContent=_dayJournalOpen?'▾':'▸';
  if(_dayJournalOpen){
    openJournalForDate(dk(selDate));
    renderJournalPrompt();
  }
}

// ══ SPLASH ══════════════════════════════════
function enterApp(){
  const splash=document.getElementById('splash');
  splash.classList.add('hiding');
  setTimeout(()=>{splash.style.display='none';renderAll();},500);
}

// ══ CONSTANTS ══════════════════════════════
const MONTHS_LONG=['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_S=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_S=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DLONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const CAT_COLORS=['#3b82f6','#8b5cf6','#10b981','#ec4899','#14b8a6','#f59e0b','#ef4444','#f97316','#06b6d4','#84cc16','#a855f7','#64748b'];

// ── Inline SVG icons (replace emojis) ──
const IC_PIN='<svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="vertical-align:-1px"><path d="M8 1C5.2 1 3 3.1 3 5.8 3 9.5 8 15 8 15s5-5.5 5-9.2C13 3.1 10.8 1 8 1z" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="5.8" r="1.8" fill="currentColor"/></svg>';
const IC_CLIP='<svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="vertical-align:-1px"><path d="M7 3.5V11a2 2 0 004 0V4a1 1 0 00-2 0v6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
const IC_LINK='<svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="vertical-align:-1px"><path d="M6.5 9.5l3-3M5 10l-1.4 1.4a2 2 0 002.8 2.8L8 12.8M8 3.2l1.6-1.4a2 2 0 012.8 2.8L11 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
const IC_FILE='<svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="vertical-align:-1px"><path d="M4 2h5l3 3v9H4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M9 2v3h3" stroke="currentColor" stroke-width="1.3"/></svg>';
const IC_BREAK='<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".3"/><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.5"/><path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/></svg>';
const IC_REST='<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 3C7 3 3 7 3 12s4 9 9 9 9-4 9-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M16 6l2-2M18 8l2-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/></svg>';

// ══ STATE ═══════════════════════════════════
let curView='day';
let curYear=new Date().getFullYear();
let cursor=new Date();cursor.setDate(1);cursor.setHours(0,0,0,0);
let selDate=new Date();
let sidebarOpen=true,activeSide='braindump';
// Close sidebar by default on mobile
let _scheduleTab='tasks'; // 'tasks' or 'events'
let catFilter='all';
let showDone=false;
function switchScheduleTab(tab){
  _scheduleTab=tab;
  document.getElementById('schedTabTasks').classList.toggle('active',tab==='tasks');
  document.getElementById('schedTabEvents').classList.toggle('active',tab==='events');
  document.getElementById('schedTabRoutine').classList.toggle('active',tab==='routine');
  document.getElementById('schedTabHolidays').classList.toggle('active',tab==='holidays');
  document.getElementById('catTasksArea').style.display=tab==='tasks'?'':'none';
  document.getElementById('catEventsArea').style.display=tab==='events'?'flex':'none';
  document.getElementById('catRoutineArea').style.display=tab==='routine'?'flex':'none';
  document.getElementById('catHolidaysArea').style.display=tab==='holidays'?'flex':'none';
  // Chips row: visible on tasks only
  const chipsRow=document.getElementById('catChips');
  if(chipsRow)chipsRow.style.display=tab==='tasks'?'flex':'none';
  // Task action buttons (+ Category, Show Completed)
  const taskControls=document.getElementById('catTaskControls');
  if(taskControls)taskControls.style.display=tab==='tasks'?'flex':'none';
  // Event action buttons (Show Past)
  const evControls=document.getElementById('catEventControls');
  if(evControls)evControls.style.display=tab==='events'?'flex':'none';
  if(tab==='events')renderEvents();
  else if(tab==='routine')renderRoutineList();
  else if(tab==='holidays')renderHolidaysList();
  else renderCat();
}
let showPastEvents=false;
function togglePastEvents(){
  showPastEvents=!showPastEvents;
  const btn=document.getElementById('pastEventsBtn');
  if(btn)btn.textContent=showPastEvents?'Hide Past':'Show Past';
  renderEvents();
}
function renderEvents(){
  const today=new Date();today.setHours(0,0,0,0);
  const far=addDays(today,365);
  const past=addDays(today,-365);
  const allEvents=expandedTasks(showPastEvents?past:today,far)
    .filter(t=>(t.type||'task')==='event')
    .sort((a,b)=>(a._instanceDate+(a.time||'')).localeCompare(b._instanceDate+(b.time||'')));
  // Deduplicate by id+instanceDate
  const seen=new Set();
  const events=allEvents.filter(t=>{const k=t.id+'|'+(t._instanceDate||'');if(seen.has(k))return false;seen.add(k);return true;});
  const todayKey=dk(today);
  let html='';
  if(!events.length){
    html=`<div class="cat-empty" style="padding:40px 0;text-align:center">
      <div style="font-size:28px;margin-bottom:8px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" stroke-width="1.5" opacity=".5"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.5" opacity=".5"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/></svg></div>
      <div style="font-size:13px;font-weight:500;color:var(--text)">No events yet</div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px">Create an event from the Day or Week view</div>
    </div>`;
  } else {
    // Group by upcoming vs today vs past
    const upcoming=events.filter(t=>t._instanceDate>todayKey);
    const todayEvs=events.filter(t=>t._instanceDate===todayKey);
    const pastEvs=events.filter(t=>t._instanceDate<todayKey);
    if(todayEvs.length){
      html+=`<div class="cat-section"><div class="cat-sec-title">Today</div>`;
      todayEvs.forEach(t=>{html+=eventRow(t)});
      html+=`</div>`;
    }
    if(upcoming.length){
      html+=`<div class="cat-section"><div class="cat-sec-title">Upcoming</div>`;
      upcoming.forEach(t=>{html+=eventRow(t)});
      html+=`</div>`;
    }
    if(showPastEvents&&pastEvs.length){
      html+=`<div class="cat-section"><div class="cat-sec-title" style="opacity:.6">Past</div>`;
      [...pastEvs].reverse().forEach(t=>{html+=eventRow(t,true)});
      html+=`</div>`;
    }
  }
  const el=document.getElementById('catEventsContent');
  if(el)el.innerHTML=html;
}
function eventRow(t,isPast=false){
  const cc=catColor(t.category);
  const idate=t._instanceDate||t.date||'';
  const d=idate?fromDk(idate):null;
  const dateLabel=d?DLONG[d.getDay()]+', '+MONTHS_LONG[d.getMonth()]+' '+d.getDate():'';
  const timeLabel=t.allday?'All Day':t.time?fmtT(t.time):'';
  return`<div class="cat-task-row event-row${isPast?' past-event':''}" style="border-left-color:${cc};cursor:pointer"
    onclick="openCatEdit('${t.id}','${idate}',event)">
    <div class="event-row-dot" style="background:${cc};border-top-color:${cc}"></div>
    <div class="cat-task-info" style="flex:1;min-width:0">
      <div class="cat-task-name">${esc(t.name)}${t.recur?' <span style="opacity:.5;font-size:10px">↻</span>':''}</div>
      <div class="cat-task-meta">
        ${dateLabel?`<span>${dateLabel}</span>`:''}
        ${timeLabel?`<span style="font-weight:600;color:var(--accent)">${timeLabel}</span>`:''}
        ${t.location?`<span>${IC_PIN} ${esc(t.location)}</span>`:''}
        ${t.category&&t.category!=='none'?`<span class="mbadge" style="background:${cc}1a;color:${cc}">${catById(t.category)?.name||t.category}</span>`:''}
      </div>
    </div>
    <div class="cat-edit-hint" onclick="event.stopPropagation();openCatEdit('${t.id}','${idate}',event)">Edit</div>
  </div>`;
}
let tasks=[],brainDump=[];
let categories=[
  {id:'work',name:'Work',color:'#3b82f6',locked:true},
  {id:'personal',name:'Personal',color:'#8b5cf6',locked:true},
  {id:'health',name:'Health',color:'#10b981',locked:true},
];

function genId(){return Math.random().toString(36).slice(2,10)}
function save(){
  try{
    localStorage.setItem('clarity_t3',JSON.stringify(tasks));
    localStorage.setItem('clarity_bd3',JSON.stringify(brainDump));
    localStorage.setItem('clarity_cats',JSON.stringify(categories));
  }catch(e){
    showToast('Storage full — export your data to free space');
    console.error('localStorage save failed:',e);
  }
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

// HTML escape to prevent XSS in innerHTML
function esc(s){if(!s)return'';return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// Reusable bullet-point behavior for any textarea
function addBulletBehavior(ta){
  if(!ta)return;
  ta.addEventListener('focus',function(){
    if(!this.value.trim())this.value='• ';
  });
  ta.addEventListener('keydown',function(e){
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
function dk(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function pad(n){return String(n).padStart(2,'0')}
function fromDk(s){const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function isToday(d){return dk(d)===dk(new Date())}
let useMilitary=localStorage.getItem('clarity_military')==='true';
let weekStartDay=parseInt(localStorage.getItem('clarity_wkstart')||'0'); // 0=Sunday, 1=Monday
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
function wkStart(d){
  const r=new Date(d);
  const dow=r.getDay();
  const diff=(dow-weekStartDay+7)%7;
  r.setDate(r.getDate()-diff);
  r.setHours(0,0,0,0);
  return r;
}
function orderedDayLabels(){
  // Returns day labels starting from weekStartDay
  const labels=[...DAYS_S];
  return[...labels.slice(weekStartDay),...labels.slice(0,weekStartDay)];
}
function setWeekStart(day){
  weekStartDay=day;
  localStorage.setItem('clarity_wkstart',String(day));
  document.getElementById('wkStartSun').classList.toggle('active',day===0);
  document.getElementById('wkStartMon').classList.toggle('active',day===1);
  renderAll();
}
function recurLbl(t){if(!t.recur)return'';return`Every ${t.recurN} ${t.recurU}${t.recurN>1?'s':''}`}
function catById(id){return categories.find(c=>c.id===id)}
function catColor(id){const c=catById(id);return c?c.color:'var(--border2)'}
function eventColor(id){const c=catById(id);return c?c.color:'var(--accent)'}
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
      // ── Multi-day events: emit instance for each day in range ──
      if(t.multiDay&&t.endDate){
        const mdStart=fromDk(t.date);
        const mdEnd=fromDk(t.endDate);
        mdStart.setHours(0,0,0,0);mdEnd.setHours(23,59,59,999);
        // Only process if ranges overlap
        if(mdEnd>=s&&mdStart<=e){
          const loopStart=new Date(Math.max(mdStart.getTime(),s.getTime()));
          const loopEnd=new Date(Math.min(mdEnd.getTime(),e.getTime()));
          const totalDays=Math.round((mdEnd-mdStart)/86400000)+1;
          for(let d=new Date(loopStart);d<=loopEnd;d.setDate(d.getDate()+1)){
            const ndk=dk(d);
            const dayNum=Math.round((d-mdStart)/86400000)+1;
            const key=t.id+'|'+ndk;
            if(!seen.has(key)){seen.add(key);
              out.push({...t,date:ndk,_instanceDate:ndk,_isMultiDay:true,_multiDayNum:dayNum,_multiDayTotal:totalDays,_multiDayStart:t.date,_multiDayEnd:t.endDate});
            }
          }
        }
        return; // skip normal single-day handling for multi-day events
      }
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
        const hasRecurDays=t.recurU==='week'&&t.recurDays&&t.recurDays.length>0;
        if(hasRecurDays){
          // Day-of-week recurrence: iterate by week intervals, emit on matching days
          const baseDow=base.getDay();
          // Find the Monday (or start) of the base week
          const baseWeekStart=new Date(base);baseWeekStart.setDate(baseWeekStart.getDate()-baseDow);
          let iStart=0;
          const daysBetween=Math.floor((s-baseWeekStart)/(86400000));
          if(daysBetween>0){const weekStep=t.recurN*7;iStart=Math.max(0,Math.floor(daysBetween/weekStep)-1);}
          for(let i=iStart;i<=104;i++){
            const weekStart=new Date(baseWeekStart);weekStart.setDate(weekStart.getDate()+t.recurN*7*i);
            if(weekStart>e)break; // past end of range
            for(const dow of t.recurDays){
              const dayDate=new Date(weekStart);dayDate.setDate(dayDate.getDate()+dow);
              if(dayDate<=base)continue; // skip before/on base date (base date already handled above)
              if(dayDate>e)continue;
              if(dayDate>=s){
                const ndk=dk(dayDate);
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
        } else {
        // Standard recurrence (day/week/month without recurDays)
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
    }
  });
  return out;
}
function tasksOn(dateKey){const d=fromDk(dateKey);return expandedTasks(d,d).filter(t=>t.date===dateKey)}

function buildCatOptions(selId,val){
  const sel=document.getElementById(selId);if(!sel)return;
  sel.innerHTML=`<option value="none">None</option>`+categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  if(val)sel.value=val;
}
function buildAllCatSelects(val){buildCatOptions('fCat',val)}

// ══ VIEW SWITCHING ══════════════════════════
function switchView(v){
  const wasView=curView;
  curView=v;
  document.querySelectorAll('.view').forEach(el=>el.classList.remove('active'));
  document.getElementById('view-'+v).classList.add('active');
  syncBottomNav(v);
  if(window.innerWidth<=640&&sidebarOpen)toggleSidebar();
  renderAll();
  if((v==='week'||v==='day')&&wasView!==v){setTimeout(scrollToNow,80);}
}
function switchSide(tab){
  activeSide=tab;
  document.querySelectorAll('.side-tab').forEach((b,i)=>b.classList.toggle('active',['braindump','priority','focus','suggestions'][i]===tab));
  document.querySelectorAll('.side-panel').forEach(p=>p.classList.remove('active'));
  const panel=document.getElementById('panel-'+tab);
  if(panel)panel.classList.add('active');
  if(tab==='priority')renderPri();
  if(tab==='suggestions')renderSuggestions();
  if(tab==='focus'){
    switchSideFocus();
    // Hide mini-timer when focus tab is visible
    hideFocusMiniTimer();
  } else {
    // Show mini-timer when leaving focus tab (if timer running and overlay closed)
    if(_focusRunning&&!_focusOverlayOpen)showFocusMiniTimer();
  }
}
function toggleSidebar(){
  sidebarOpen=!sidebarOpen;
  document.getElementById('sidebar').classList.toggle('collapsed',!sidebarOpen);
  const bd=document.getElementById('sidebarBackdrop');
  if(bd)bd.classList.toggle('open',sidebarOpen);
  // Render sidebar content when opening
  if(sidebarOpen){renderBD();if(activeSide==='priority')renderPri();if(activeSide==='focus'){switchSideFocus();hideFocusMiniTimer();}}
  // Show mini-timer when collapsing sidebar if timer running
  if(!sidebarOpen&&_focusRunning&&!_focusOverlayOpen)showFocusMiniTimer();
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
  else if(_scheduleTab==='events')renderEvents();
  else if(_scheduleTab==='routine')renderRoutineList();
  else if(_scheduleTab==='holidays')renderHolidaysList();
  else renderCat();
  // Only render sidebar panels if sidebar is visible
  if(sidebarOpen){
    renderBD();
    if(activeSide==='priority')renderPri();
    if(activeSide==='suggestions')renderSuggestions();
  }
  if(curView==='categories'){renderCatChips();buildAllCatSelects();}
  else buildAllCatSelects();
  updateOverdueBadge();
  // Only render now-line in views that use it
  if(curView==='day'||curView==='week'){
    setTimeout(()=>{renderNowLine();},0);
  }
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
  const todayMo=new Date().getMonth();
  const todayYr=new Date().getFullYear();
  const yStart=new Date(curYear,0,1),yEnd=new Date(curYear,11,31);
  const allYT=expandedTasks(yStart,yEnd);
  let html='';
  for(let mo=0;mo<12;mo++){
    const first=(new Date(curYear,mo,1).getDay()-weekStartDay+7)%7,dim=new Date(curYear,mo+1,0).getDate(),dip=new Date(curYear,mo,0).getDate();
    const dayCount={};
    const eventDayCount={};
    allYT.forEach(t=>{
      if(t.date){
        const d=fromDk(t.date);
        if(d.getFullYear()===curYear&&d.getMonth()===mo){
          const isEvent=(t.type||'task')==='event';
          if(isEvent){eventDayCount[d.getDate()]=(eventDayCount[d.getDate()]||0)+1;}
          else{dayCount[d.getDate()]=(dayCount[d.getDate()]||0)+1;}
        }
      }
    });
    const taskTotal=Object.values(dayCount).reduce((a,b)=>a+b,0);
    const eventTotal=Object.values(eventDayCount).reduce((a,b)=>a+b,0);
    const total=taskTotal+eventTotal;
    const hasToday=todayKey.startsWith(`${curYear}-${pad(mo+1)}-`);
    const isCurrentMonth=curYear===todayYr&&mo===todayMo;
    // Current month shows both task + event counts; other months show just tasks
    let countHtml='';
    if(isCurrentMonth){
      if(taskTotal>0)countHtml+=`<span class="ym-count-tasks has-tasks">${taskTotal} task${taskTotal!==1?'s':''}</span>`;
      if(eventTotal>0)countHtml+=`<span class="ym-count-events">${eventTotal} event${eventTotal!==1?'s':''}</span>`;
    } else if(taskTotal>0){
      countHtml=`<span class="ym-count has-tasks">${taskTotal} task${taskTotal!==1?'s':''}</span>`;
    }
    html+=`<div class="year-month-card${hasToday?' has-today':''}" onclick="openYearMonthPopup(${curYear},${mo})">
      <div class="ym-header"><div class="ym-name">${MONTHS_LONG[mo]}</div><div class="ym-counts">${countHtml}</div></div>
      <div class="ym-days-hdr">${orderedDayLabels().map(d=>`<div class="ym-day-lbl">${d[0]}</div>`).join('')}</div>
      <div class="ym-cal-grid">`;
    for(let i=0;i<first;i++)html+=`<div class="ym-day other"></div>`;
    for(let d=1;d<=dim;d++){
      const key=`${curYear}-${pad(mo+1)}-${pad(d)}`,n=(dayCount[d]||0)+(eventDayCount[d]||0),isT=key===todayKey;
      const hasEv=(eventDayCount[d]||0)>0;
      let dotCls=n===1?'d1':n===2?'d2':n<=4?'d3':n>4?'d4':'';
      html+=`<div class="ym-day${isT?' today':''}${n>0?' has-tasks':''}${hasEv?' has-event':''}" onclick="event.stopPropagation();onYearDayClick('${key}')" title="Click to add">${d}${n>0?`<span class="ym-dot ${dotCls}"></span>`:''}</div>`;
    }
    const rem=(first+dim)%7;if(rem>0)for(let i=0;i<7-rem;i++)html+=`<div class="ym-day other"></div>`;
    html+=`</div>`;
    html+=`</div>`;
  }
  document.getElementById('yearGrid').innerHTML=html;
}
function onYearDayClick(key){openNew(key,'09:00')}
function onYearGoMonth(y,mo){cursor=new Date(y,mo,1);selDate=new Date(y,mo,1);switchView('month');}

// ── Year Month Popup ──────────────────────────────────
function openYearMonthPopup(y,mo){
  const popup=document.getElementById('yearMonthPopup');
  if(!popup)return;
  const todayKey=dk(new Date());
  const first=(new Date(y,mo,1).getDay()-weekStartDay+7)%7;
  const dim=new Date(y,mo+1,0).getDate();
  const mStart=new Date(y,mo,1),mEnd=new Date(y,mo,dim);
  const allItems=expandedTasks(mStart,mEnd);
  const monthTasks=allItems.filter(t=>(t.type||'task')==='task');
  const monthEvents=allItems.filter(t=>(t.type||'task')==='event');
  // Day counts for dots
  const dayCount={},eventDayCount={};
  allItems.forEach(t=>{
    if(t.date){const d=fromDk(t.date);if(d.getMonth()===mo&&d.getFullYear()===y){
      if((t.type||'task')==='event')eventDayCount[d.getDate()]=(eventDayCount[d.getDate()]||0)+1;
      else dayCount[d.getDate()]=(dayCount[d.getDate()]||0)+1;
    }}
  });
  let calHtml=`<div class="ymp-dow-row">${orderedDayLabels().map(d=>`<div class="ymp-dow">${d[0]}</div>`).join('')}</div><div class="ymp-cal-grid">`;
  for(let i=0;i<first;i++)calHtml+=`<div class="ymp-day other"></div>`;
  for(let d=1;d<=dim;d++){
    const key=`${y}-${pad(mo+1)}-${pad(d)}`,n=(dayCount[d]||0)+(eventDayCount[d]||0),isT=key===todayKey;
    const hasEv=(eventDayCount[d]||0)>0;
    let dotCls=n===1?'d1':n===2?'d2':n<=4?'d3':n>4?'d4':'';
    calHtml+=`<div class="ymp-day${isT?' today':''}${n>0?' has-tasks':''}${hasEv?' has-event':''}" onclick="event.stopPropagation();onYearDayClick('${key}')">${d}${n>0?`<span class="ym-dot ${dotCls}"></span>`:''}</div>`;
  }
  const rem2=(first+dim)%7;if(rem2>0)for(let i=0;i<7-rem2;i++)calHtml+=`<div class="ymp-day other"></div>`;
  calHtml+=`</div>`;
  const inner=popup.querySelector('.ym-popup');
  inner.innerHTML=`
    <div class="ymp-hdr"><span class="ymp-title">${MONTHS_LONG[mo]} ${y}</span><button class="ymp-close" onclick="closeYearMonthPopup()">✕</button></div>
    <div class="ymp-body" id="ympBody">
      <div id="ympCalView">
        ${calHtml}
        <div class="ymp-stats">
          <div class="ymp-stat-card" onclick="showYearMonthSummary('task',${y},${mo})" onmouseenter="this.classList.add('hover')" onmouseleave="this.classList.remove('hover')">
            <span class="ymp-stat-num">${monthTasks.length}</span><span class="ymp-stat-label">Task${monthTasks.length!==1?'s':''}</span>
          </div>
          <div class="ymp-stat-card" onclick="showYearMonthSummary('event',${y},${mo})" onmouseenter="this.classList.add('hover')" onmouseleave="this.classList.remove('hover')">
            <span class="ymp-stat-num">${monthEvents.length}</span><span class="ymp-stat-label">Event${monthEvents.length!==1?'s':''}</span>
          </div>
        </div>
        <button class="ymp-open-month" onclick="closeYearMonthPopup();onYearGoMonth(${y},${mo})">Open in month view</button>
      </div>
    </div>`;
  popup.classList.add('show');
}
function closeYearMonthPopup(){
  const popup=document.getElementById('yearMonthPopup');
  if(popup)popup.classList.remove('show');
}
// Change 10: Summary list view
function showYearMonthSummary(type,y,mo){
  const mStart=new Date(y,mo,1),mEnd=new Date(y,mo,new Date(y,mo+1,0).getDate());
  const allItems=expandedTasks(mStart,mEnd);
  let filtered=type==='event'?allItems.filter(t=>(t.type||'task')==='event'):allItems.filter(t=>(t.type||'task')==='task');
  // Deduplicate multi-day events (only show once, on their start date or first visible date)
  const seenMdIds=new Set();
  filtered=filtered.filter(t=>{
    if(t._isMultiDay){
      if(seenMdIds.has(t.id))return false;
      seenMdIds.add(t.id);
    }
    return true;
  });
  filtered.sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  const label=type==='event'?'event':'task';
  const maxShow=8;
  const shown=filtered.slice(0,maxShow);
  // Group by date
  const groups={};
  shown.forEach(t=>{
    const dk2=t.date||t._instanceDate;
    if(!groups[dk2])groups[dk2]=[];
    groups[dk2].push(t);
  });
  let listHtml=`<div class="ymp-summary-hdr"><button class="ymp-back" onclick="openYearMonthPopup(${y},${mo})">← Back to ${MONTHS_LONG[mo]}</button><span class="ymp-summary-title">${filtered.length} ${label}${filtered.length!==1?'s':''} in ${MONTHS_LONG[mo]}</span></div><div class="ymp-summary-list">`;
  Object.keys(groups).sort().forEach(dk2=>{
    const d=fromDk(dk2);
    const dayName=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
    listHtml+=`<div class="ymp-group-hdr">${dayName}, ${MONTHS_LONG[d.getMonth()]} ${d.getDate()}</div>`;
    groups[dk2].forEach(t=>{
      const isEvent=(t.type||'task')==='event';
      const cc=isEvent?(t.eventColor||eventColor(t.category)):catColor(t.category);
      let timeStr=t.allday?'All Day':t.time?fmtT(t.time):'';
      if(t._isMultiDay){
        const sd=fromDk(t._multiDayStart),ed=fromDk(t._multiDayEnd);
        timeStr=`${MONTHS_S[sd.getMonth()]} ${sd.getDate()} – ${MONTHS_S[ed.getMonth()]} ${ed.getDate()}`;
      }
      const badge=isEvent?'event':'task';
      const editDate=t._isMultiDay?t._multiDayStart:(t._instanceDate||dk2);
      listHtml+=`<div class="ymp-item" onclick="closeYearMonthPopup();openEdit('${t.id}','${editDate}',event)">
        <span class="ymp-item-dot" style="background:${cc}"></span>
        <span class="ymp-item-name">${esc(t.name)}</span>
        <span class="ymp-item-badge ${badge}">${badge}</span>
        ${timeStr?`<span class="ymp-item-time">${timeStr}</span>`:''}
      </div>`;
    });
  });
  if(filtered.length>maxShow){
    listHtml+=`<div class="ymp-more" onclick="closeYearMonthPopup();onYearGoMonth(${y},${mo})">View all ${filtered.length} in month view →</div>`;
  }
  listHtml+=`</div>`;
  const body=document.getElementById('ympBody');
  if(body)body.innerHTML=listHtml;
}

// ══ MONTH ════════════════════════════════════
function renderMonth(){
  const y=cursor.getFullYear(),mo=cursor.getMonth(),first=(new Date(y,mo,1).getDay()-weekStartDay+7)%7,dim=new Date(y,mo+1,0).getDate(),dip=new Date(y,mo,0).getDate(),todayKey=dk(new Date());
  // Month-wide stats
  const mStart=new Date(y,mo,1),mEnd=new Date(y,mo,dim);
  const allMonth=expandedTasks(mStart,mEnd);
  const mTasks=allMonth.filter(t=>(t.type||'task')==='task');
  const mEvents=allMonth.filter(t=>(t.type||'task')==='event');
  const mDone=mTasks.filter(t=>t.done||(t.doneOverrides||[]).includes(t._instanceDate||t.date)).length;
  const mPlans=getMonthPlans(y+'-'+pad(mo+1));
  const goalsDone=(mPlans.goals||[]).filter(g=>g.done).length;
  const goalsTotal=(mPlans.goals||[]).length;
  const goalPct=goalsTotal?Math.round(goalsDone/goalsTotal*100):0;
  let statsHtml=`<div class="month-stats-bar" id="monthStatsBar">
    <div class="month-stat-card" onmouseenter="monthGlow('tasks')" onmouseleave="monthGlow(null)" onclick="openYearMonthPopup(${y},${mo});showYearMonthSummary('task',${y},${mo})">
      <span class="month-stat-num">${mTasks.length}</span><span class="month-stat-sub">${mDone} done</span><span class="month-stat-label">Tasks</span>
    </div>
    <div class="month-stat-card" onmouseenter="monthGlow('events')" onmouseleave="monthGlow(null)" onclick="openYearMonthPopup(${y},${mo});showYearMonthSummary('event',${y},${mo})">
      <span class="month-stat-num">${mEvents.length}</span><span class="month-stat-label">Events</span>
    </div>
    <div class="month-stat-card">
      <span class="month-stat-num">${goalsDone}/${goalsTotal}</span><span class="month-stat-sub">${goalPct}%</span><span class="month-stat-label">Goals</span>
    </div>
  </div>`;
  let html=statsHtml+`<div class="month-grid-hdr">${orderedDayLabels().map(d=>`<div class="month-day-name">${d}</div>`).join('')}</div><div class="month-grid" id="monthGridInner">`;
  let cells=[];
  for(let i=first-1;i>=0;i--)cells.push({date:new Date(y,mo-1,dip-i),cur:false});
  for(let d=1;d<=dim;d++)cells.push({date:new Date(y,mo,d),cur:true});
  let nx=1;while(cells.length<42)cells.push({date:new Date(y,mo+1,nx++),cur:false});
  cells.forEach(({date,cur})=>{
    const key=dk(date),isTod=key===todayKey;
    const dt=tasksOn(key);
    const events=dt.filter(t=>(t.type||'task')==='event');
    const taskCount=dt.filter(t=>(t.type||'task')!=='event').length;
    const eventCount=events.length;
    let cls='month-cell m-cell'+((!cur)?' other-month':'')+(isTod?' today':'')+(eventCount?' has-event':'')+(taskCount?' has-task':'');
    // Show events first, then tasks sorted by priority
    const priOrder={high:0,medium:1,low:2,none:3};
    const sorted=[
      ...dt.filter(t=>(t.type||'task')==='event').sort((a,b)=>(a.time||'').localeCompare(b.time||'')),
      ...dt.filter(t=>(t.type||'task')!=='event').sort((a,b)=>(priOrder[a.priority]||3)-(priOrder[b.priority]||3))
    ].slice(0,5);
    let chips=sorted.map(t=>{
      const isEvent=(t.type||'task')==='event';
      const cc=isEvent?(t.eventColor||eventColor(t.category)):catColor(t.category);
      const isAllday=isEvent&&t.allday;
      const isDone=t.done||(t.doneOverrides||[]).includes(t._instanceDate||key);
      // Multi-day event bar
      if(t._isMultiDay){
        const isFirst=t._multiDayNum===1;
        const isLast=t._multiDayNum===t._multiDayTotal;
        const rndL=isFirst?'4px':'0';const rndR=isLast?'4px':'0';
        const label=isFirst?esc(t.name):'';
        return`<span class="m-chip m-chip-multiday" style="background:${cc};border-radius:${rndL} ${rndR} ${rndR} ${rndL};color:#fff;border-left-color:${cc}" onclick="openEdit('${t.id}','${t._multiDayStart}',event)">${label||'&nbsp;'}</span>`;
      }
      let c='m-chip'+(isDone?' done':'')+(isEvent?' m-chip-event':'')+(isAllday?' m-chip-allday':'');
      const priDot=!isEvent&&t.priority&&t.priority!=='none'?`<span class="m-chip-pri pri-${t.priority[0]}"></span>`:'';
      const timeStr=isAllday?`<span class="m-chip-time">All Day</span>`:t.time?`<span class="m-chip-time">${fmtT(t.time)}</span>`:'';
      const chipStyle=isAllday?`background:${cc};border-left-color:${cc};color:#fff`:`border-left-color:${isEvent?'var(--accent)':cc}${isEvent?';background:var(--accent-pale)':''}`;
      return`<span class="${c}" style="${chipStyle}" draggable="true"
        ondragstart="onTaskDragStart(event,'${t.id}','${t._instanceDate||key}')" ondragend="onTaskDragEnd(event)"
        onclick="openEdit('${t.id}','${t._instanceDate||key}',event)">${priDot}${timeStr}${esc(t.name)}${t.recur?' ↻':''}</span>`;
    }).join('')+(dt.length>5?`<span class="more-chip">+${dt.length-5}</span>`:'');
    const eventDot=eventCount?`<span class="cell-event-dot" title="${eventCount} event${eventCount>1?'s':''}"></span>`:'';
    html+=`<div class="${cls}" onclick="onMCell('${key}')" ondragover="onDO(event,'${key}')" ondragleave="onDL(event)" ondrop="onDropDate(event,'${key}')">
      <div class="cell-num-row"><span class="cell-num-circle">${date.getDate()}</span>${eventDot}</div>${chips}</div>`;
  });
  document.getElementById('monthGrid').innerHTML=html+'</div>';
  // Load month planning
  renderMonthPlan();
}
function monthGlow(type){
  const grid=document.getElementById('monthGridInner');
  if(!grid)return;
  grid.classList.remove('glow-tasks','glow-events');
  if(type==='tasks')grid.classList.add('glow-tasks');
  else if(type==='events')grid.classList.add('glow-events');
}
function onMCell(k){openNew(k,'09:00')}

// ── Month Planning (replaces Month Notes) ─────────────────────────────
function monthPlanKey(){
  return cursor.getFullYear()+'-'+pad(cursor.getMonth()+1);
}
let monthPlans={};
try{monthPlans=JSON.parse(localStorage.getItem('clarity_monthPlans')||'{}')}catch{monthPlans={}}
function saveMonthPlans(){try{localStorage.setItem('clarity_monthPlans',JSON.stringify(monthPlans))}catch(e){showToast('Storage full');console.error(e)}}
function getMonthPlans(key){
  if(!key)key=monthPlanKey();
  if(!monthPlans[key])monthPlans[key]={goals:[],lookingForward:[],wentWell:[],toImprove:[]};
  return monthPlans[key];
}
let _monthPlanOpen=localStorage.getItem('clarity_monthPlanOpen')!=='false';
function toggleMonthPlan(){
  _monthPlanOpen=!_monthPlanOpen;
  localStorage.setItem('clarity_monthPlanOpen',_monthPlanOpen?'true':'false');
  const grid=document.getElementById('monthPlanGrid');
  const tog=document.getElementById('monthPlanToggle');
  if(grid)grid.style.display=_monthPlanOpen?'':'none';
  if(tog)tog.textContent=_monthPlanOpen?'collapse':'expand';
}
function updateMonthGoalStat(){
  const bar=document.getElementById('monthStatsBar');if(!bar)return;
  const goalCard=bar.querySelector('.month-stat-card:last-child');if(!goalCard)return;
  const key=monthPlanKey();const p=getMonthPlans(key);
  const done=(p.goals||[]).filter(g=>g.done).length;
  const total=(p.goals||[]).length;
  const pct=total?Math.round(done/total*100):0;
  goalCard.querySelector('.month-stat-num').textContent=`${done}/${total}`;
  goalCard.querySelector('.month-stat-sub').textContent=`${pct}%`;
}
function renderMonthPlan(){
  const grid=document.getElementById('monthPlanGrid');
  const tog=document.getElementById('monthPlanToggle');
  if(!grid)return;
  grid.style.display=_monthPlanOpen?'':'none';
  if(tog)tog.textContent=_monthPlanOpen?'collapse':'expand';
  const key=monthPlanKey();
  const p=getMonthPlans(key);
  // ── Column 1: Goals ──
  let goalsHtml=`<div class="mp-col"><div class="mp-col-title">Goals</div>`;
  (p.goals||[]).forEach((g,i)=>{
    goalsHtml+=`<div class="mp-goal${g.done?' done':''}" draggable="true"
      ondragstart="onMpGoalDragStart(event,${i})" ondragover="onMpGoalDragOver(event)" ondrop="onMpGoalDrop(event,${i})" ondragend="onMpGoalDragEnd(event)">
      <span class="mp-goal-grip" onmousedown="event.stopPropagation()">≡</span>
      <div class="mp-goal-check${g.done?' checked':''}" onclick="toggleMpGoal(${i})"></div>
      <span class="mp-goal-text" contenteditable="true" spellcheck="false" data-placeholder="Type a goal…"
        onblur="saveMpGoalText(${i},this)" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur()}">${esc(g.text)}</span>
      <span class="mp-goal-del" onclick="deleteMpGoal(${i})">✕</span>
    </div>`;
  });
  goalsHtml+=`<div class="mp-add-goal" onclick="addMpGoal()">+ Add goal</div></div>`;
  // ── Column 2: Looking forward to ──
  let lfHtml=`<div class="mp-col"><div class="mp-col-title">Looking forward to</div>`;
  (p.lookingForward||[]).forEach((item,i)=>{
    lfHtml+=`<div class="mp-bullet">
      <span class="mp-bullet-dot" style="background:var(--text3)"></span>
      <span class="mp-bullet-text" contenteditable="false" id="mpLf${i}">${esc(item.text)}</span>
      <span class="mp-bullet-actions">
        <button class="mp-bullet-btn" onclick="editMpBullet('lookingForward',${i})">✎</button>
        <button class="mp-bullet-btn del" onclick="deleteMpBullet('lookingForward',${i})">✕</button>
      </span>
    </div>`;
  });
  lfHtml+=`<input class="mp-input" placeholder="Add something you're excited about…" onkeydown="if(event.key==='Enter'&&this.value.trim()){addMpBullet('lookingForward',this.value.trim());this.value=''}">`;
  lfHtml+=`</div>`;
  // ── Column 3: Reflection ──
  let refHtml=`<div class="mp-col"><div class="mp-col-title">Reflection</div>`;
  // What went well
  refHtml+=`<div class="mp-reflect-sub"><div class="mp-reflect-label">What went well?</div>`;
  (p.wentWell||[]).forEach((item,i)=>{
    refHtml+=`<div class="mp-bullet">
      <span class="mp-bullet-dot" style="background:#10b981"></span>
      <span class="mp-bullet-text" contenteditable="false" id="mpWw${i}">${esc(item.text)}</span>
      <span class="mp-bullet-actions">
        <button class="mp-bullet-btn" onclick="editMpBullet('wentWell',${i})">✎</button>
        <button class="mp-bullet-btn del" onclick="deleteMpBullet('wentWell',${i})">✕</button>
      </span>
    </div>`;
  });
  refHtml+=`<input class="mp-input" placeholder="Something that went well…" onkeydown="if(event.key==='Enter'&&this.value.trim()){addMpBullet('wentWell',this.value.trim());this.value=''}">`;
  refHtml+=`</div>`;
  // What to improve
  refHtml+=`<div class="mp-reflect-sub"><div class="mp-reflect-label">What to improve?</div>`;
  (p.toImprove||[]).forEach((item,i)=>{
    refHtml+=`<div class="mp-bullet">
      <span class="mp-bullet-dot" style="background:#f59e0b"></span>
      <span class="mp-bullet-text" contenteditable="false" id="mpTi${i}">${esc(item.text)}</span>
      <span class="mp-bullet-actions">
        <button class="mp-bullet-btn" onclick="editMpBullet('toImprove',${i})">✎</button>
        <button class="mp-bullet-btn del" onclick="deleteMpBullet('toImprove',${i})">✕</button>
      </span>
    </div>`;
  });
  refHtml+=`<input class="mp-input" placeholder="Something to work on…" onkeydown="if(event.key==='Enter'&&this.value.trim()){addMpBullet('toImprove',this.value.trim());this.value=''}">`;
  refHtml+=`</div></div>`;
  grid.innerHTML=goalsHtml+lfHtml+refHtml;
}
// Goals functions
function addMpGoal(){
  const key=monthPlanKey();const p=getMonthPlans(key);
  p.goals.push({id:'g'+Date.now(),text:'',done:false});
  saveMonthPlans();renderMonthPlan();
  // Focus the new goal text
  setTimeout(()=>{
    const goals=document.querySelectorAll('.mp-goal-text');
    if(goals.length){
      const el=goals[goals.length-1];
      el.focus();
    }
  },50);
}
function toggleMpGoal(i){
  const key=monthPlanKey();const p=getMonthPlans(key);
  if(p.goals[i])p.goals[i].done=!p.goals[i].done;
  saveMonthPlans();renderMonthPlan();updateMonthGoalStat();
}
function saveMpGoalText(i,el){
  const key=monthPlanKey();const p=getMonthPlans(key);
  const txt=(el.textContent||'').trim();
  if(!txt){p.goals.splice(i,1);}else if(p.goals[i])p.goals[i].text=txt;
  saveMonthPlans();renderMonthPlan();updateMonthGoalStat();
}
function deleteMpGoal(i){
  const key=monthPlanKey();const p=getMonthPlans(key);
  p.goals.splice(i,1);saveMonthPlans();renderMonthPlan();updateMonthGoalStat();
}
// Goal drag reorder
let _mpGoalDragFrom=-1;
function onMpGoalDragStart(e,i){_mpGoalDragFrom=i;e.dataTransfer.effectAllowed='move';e.target.style.opacity='.4'}
function onMpGoalDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move'}
function onMpGoalDrop(e,i){
  e.preventDefault();
  if(_mpGoalDragFrom<0||_mpGoalDragFrom===i)return;
  const key=monthPlanKey();const p=getMonthPlans(key);
  const[moved]=p.goals.splice(_mpGoalDragFrom,1);
  p.goals.splice(i,0,moved);
  saveMonthPlans();renderMonthPlan();
}
function onMpGoalDragEnd(e){_mpGoalDragFrom=-1;e.target.style.opacity=''}
// Bullet list functions (shared by lookingForward, wentWell, toImprove)
function addMpBullet(field,text){
  const key=monthPlanKey();const p=getMonthPlans(key);
  if(!p[field])p[field]=[];
  p[field].push({id:'b'+Date.now(),text:text});
  saveMonthPlans();renderMonthPlan();
}
function deleteMpBullet(field,i){
  const key=monthPlanKey();const p=getMonthPlans(key);
  if(p[field])p[field].splice(i,1);
  saveMonthPlans();renderMonthPlan();
}
function editMpBullet(field,i){
  const prefixMap={lookingForward:'mpLf',wentWell:'mpWw',toImprove:'mpTi'};
  const el=document.getElementById(prefixMap[field]+i);
  if(!el)return;
  el.contentEditable='true';el.focus();
  // Select all text
  const range=document.createRange();range.selectNodeContents(el);
  const sel=window.getSelection();sel.removeAllRanges();sel.addRange(range);
  el.onblur=function(){
    el.contentEditable='false';
    const txt=(el.textContent||'').trim();
    const key=monthPlanKey();const p=getMonthPlans(key);
    if(!txt){if(p[field])p[field].splice(i,1);}
    else if(p[field]&&p[field][i])p[field][i].text=txt;
    saveMonthPlans();renderMonthPlan();
  };
  el.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();el.blur();}};
}

// ══ WEEK ════════════════════════════════════
function renderWeek(){
  const mon=wkStart(selDate),days=Array.from({length:7},(_,i)=>addDays(mon,i)),todayKey=dk(new Date());

  // ── Pre-scan: find max overlap per day for adaptive column widths ──
  const dayMaxCols=days.map(d=>{
    const dayTasks=tasksOn(dk(d)).filter(t=>t.time&&!t.allday);
    if(dayTasks.length<=1)return 1;
    const items=dayTasks.map(t=>{const[h,m]=t.time.split(':').map(Number);return{start:h*60+m,end:h*60+m+(t.duration||30)};}).sort((a,b)=>a.start-b.start);
    const clusters=[];
    items.forEach(item=>{
      let merged=false;
      for(const cl of clusters){if(cl.some(c=>item.start<c.end&&c.start<item.end)){cl.push(item);merged=true;break;}}
      if(!merged)clusters.push([item]);
    });
    return Math.max(1,...clusters.map(c=>c.length));
  });
  // Build adaptive fr values: base 1fr, scale up for busy days
  const gutterW=window.innerWidth<=380?'32px':window.innerWidth<=640?'42px':'68px';
  const colFrs=dayMaxCols.map(mc=>mc<=1?'1fr':Math.min(3,mc*0.75).toFixed(1)+'fr');
  const gridCols=`${gutterW} ${colFrs.join(' ')}`;

  let hdr=`<div class="wk-gutter"></div>`;
  days.forEach(d=>{const k=dk(d);hdr+=`<div class="wk-day-head${k===todayKey?' today':''}" onclick="onWkDay('${k}')"><div class="wdh-name">${DAYS_S[d.getDay()]}</div><div class="wdh-num">${d.getDate()}</div></div>`;});
  document.getElementById('weekHdr').innerHTML=hdr;

  // ── Events row (all events: all-day + timed) ────────────────────────────────
  const eventsByDay={};
  days.forEach(d=>{
    const k=dk(d);
    eventsByDay[k]=tasksOn(k).filter(t=>(t.type||'task')==='event'&&!t._isMultiDay);
  });
  // Collect multi-day events visible this week
  const weekStart=days[0],weekEnd=days[days.length-1];
  const wkMultiDay=[];
  const seenMd=new Set();
  days.forEach(d=>{
    const k=dk(d);
    tasksOn(k).filter(t=>t._isMultiDay).forEach(t=>{
      if(seenMd.has(t.id))return;seenMd.add(t.id);
      const mdS=fromDk(t._multiDayStart),mdE=fromDk(t._multiDayEnd);
      const visStart=Math.max(mdS.getTime(),weekStart.getTime());
      const visEnd=Math.min(mdE.getTime(),weekEnd.getTime());
      const startCol=days.findIndex(dd=>dk(dd)===dk(new Date(visStart)));
      const endCol=days.findIndex(dd=>dk(dd)===dk(new Date(visEnd)));
      if(startCol>=0&&endCol>=0){
        wkMultiDay.push({...t,_visStartCol:startCol,_visEndCol:endCol,
          _isFirst:dk(new Date(visStart))===t._multiDayStart,
          _isLast:dk(new Date(visEnd))===t._multiDayEnd});
      }
    });
  });
  const hasAnyEvents=days.some(d=>eventsByDay[dk(d)].length>0)||wkMultiDay.length>0;
  let alldayRowHtml='';
  if(hasAnyEvents){
    alldayRowHtml=`<div class="wk-allday-row">`;
    alldayRowHtml+=`<div class="wk-allday-gutter">Events</div>`;
    days.forEach(d=>{
      const k=dk(d);
      const pills=eventsByDay[k].map(t=>{
        const cc=eventColor(t.category);
        const badge=t.allday?'All Day':t.time?fmtT(t.time):'';
        return`<div class="wk-allday-pill" style="background:${cc};color:#fff" onclick="openEdit('${t.id}','${t._instanceDate||k}',event)" title="${esc(t.name)}${badge?' · '+badge:''}">${esc(t.name)}${badge?`<span class="wk-event-badge">${badge}</span>`:''}</div>`;
      }).join('');
      alldayRowHtml+=`<div class="wk-allday-cell">${pills}</div>`;
    });
    alldayRowHtml+=`</div>`;
    // Multi-day spanning bars
    if(wkMultiDay.length){
      alldayRowHtml+=`<div class="wk-multiday-row" style="grid-template-columns:${gridCols}">`;
      alldayRowHtml+=`<div class="wk-allday-gutter"></div>`;
      // Use grid placement for each multi-day bar
      wkMultiDay.forEach(md=>{
        const cc=md.eventColor||eventColor(md.category);
        const span=md._visEndCol-md._visStartCol+1;
        const rndL=md._isFirst?'8px':'0';const rndR=md._isLast?'8px':'0';
        const label=md._visStartCol===0||md._isFirst?esc(md.name):'';
        alldayRowHtml+=`<div class="wk-multiday-bar" style="grid-column:${md._visStartCol+2}/span ${span};background:${cc};border-radius:${rndL} ${rndR} ${rndR} ${rndL}" onclick="openEdit('${md.id}','${md._multiDayStart}',event)" title="${esc(md.name)} · ${md._multiDayStart} to ${md._multiDayEnd}">${label?`<span>${label}</span>`:''}</div>`;
      });
      alldayRowHtml+=`</div>`;
    }
  }
  document.getElementById('weekAlldayRow').innerHTML=alldayRowHtml;

  const sl=slots();
  const WK_SLOT_H=54;
  let g=`<div class="wk-time-col">${sl.map(s=>`<div class="time-lbl">${s.m===0?fmtT(sk(s.h,s.m)):''}</div>`).join('')}</div>`;
  days.forEach(d=>{
    const k=dk(d);
    const dayRoutines=getRoutineForDay(k);
    let colSlots=sl.map(s=>{
      const sk2=sk(s.h,s.m);
      // Check if slot is blocked by a non-schedulable routine
      const rbWk=dayRoutines.find(b=>sk2>=b.start&&sk2<b.end)||null;
      const rtWk=rbWk?ROUTINE_TYPES[rbWk.type]||ROUTINE_TYPES.custom:null;
      const wkBlocked=rbWk&&(rbWk.schedulable!==undefined?!rbWk.schedulable:!(rtWk&&rtWk.schedulable));
      return`<div class="wk-slot${s.m===30?' half':''}${wkBlocked?' routine-blocked':''}" onclick="onWkSlot('${k}','${sk2}',event)"
        ondragover="onDO(event,'${k}','${sk2}')" ondragleave="onDL(event)" ondrop="onDropSlot(event,'${k}','${sk2}')"></div>`;
    }).join('');
    const dayTasks=tasksOn(k).filter(t=>t.time&&!t.allday);

    // ── Overlap column layout (handles task-task, event-event, AND task-event) ──
    const wkColMap=new Map();
    (function(){
      const items=dayTasks.map(t=>{
        const[h,m]=t.time.split(':').map(Number);
        return{id:t.id,start:h*60+m,end:h*60+m+(t.duration||30),isEvent:(t.type||'task')==='event'};
      }).sort((a,b)=>a.start-b.start||b.end-a.end);
      // Build overlap clusters
      const clusters=[];
      items.forEach(item=>{
        let merged=false;
        for(const cl of clusters){
          if(cl.some(c=>item.start<c.end&&c.start<item.end)){cl.push(item);merged=true;break;}
        }
        if(!merged)clusters.push([item]);
      });
      // Assign columns within each cluster (tasks first → left, events → right)
      clusters.forEach(cl=>{
        if(cl.length===1){wkColMap.set(cl[0].id,{col:0,total:1});return;}
        // Sort: tasks before events, then by start time
        cl.sort((a,b)=>(a.isEvent?1:0)-(b.isEvent?1:0)||a.start-b.start);
        const cols=[];
        cl.forEach(item=>{
          let c=cols.findIndex(end=>item.start>=end);
          if(c===-1){c=cols.length;cols.push(0);}
          cols[c]=item.end;
          wkColMap.set(item.id,{col:c,total:0});
        });
        cl.forEach(item=>{wkColMap.get(item.id).total=cols.length;});
      });
    })();

    // Routine bands for this day (for banner offset)
    const wkDayRoutines=getRoutineForDay(k);
    let taskBlocks=dayTasks.map(t=>{
      const [th,tm]=t.time.split(':').map(Number);
      // Offset task below banner if it starts at a routine's start time
      const wkBannerH=wkDayRoutines.some(b=>b.start===t.time)?18:0;
      const topPx=(th*60+tm)/30*WK_SLOT_H+wkBannerH;
      const dur=t.duration||30;
      const hPx=Math.max(14,dur/30*WK_SLOT_H-1-wkBannerH);
      const isEvent=(t.type||'task')==='event';
      const cc=isEvent?eventColor(t.category):catColor(t.category);
      const isDone=t.done||(t.doneOverrides||[]).includes(t._instanceDate||k);
      // Column positioning from overlap layout
      const ci=wkColMap.get(t.id)||{col:0,total:1};
      let leftVal='2px',rightVal='2px';
      if(ci.total>1){
        const pct=100/ci.total;
        leftVal=ci.col===0?'2px':`calc(${(ci.col*pct).toFixed(1)}% + 1px)`;
        rightVal=ci.col===ci.total-1?'2px':`calc(${((ci.total-ci.col-1)*pct).toFixed(1)}% + 1px)`;
      }
      const narrowCls=ci.total>=3?' wk-task-narrow':'';
      const subs=t.subtasks||[];
      const wkDurLabel=dur>30?`<span class="wk-task-block-dur">${durLabel(dur)}</span>`:'';
      const wkDurStep=dur>30?`<div class="wk-dur-stepper"><button class="wk-dur-btn" onclick="event.stopPropagation();adjustDuration('${t.id}','${t._instanceDate||k}',-15,event)">−</button><span class="wk-task-block-dur">${durLabel(dur)}</span><button class="wk-dur-btn" onclick="event.stopPropagation();adjustDuration('${t.id}','${t._instanceDate||k}',15,event)">+</button></div>`:'';
      const wkSubPill=subs.length?`<span class="wk-sub-pill" onclick="event.stopPropagation();openSubtaskPopup('${t.id}','${t._instanceDate||k}')">☰ ${subs.length}</span>`:'';
      if(isEvent){
        return`<div class="wk-task-block event-block${narrowCls}" data-id="${t.id}" title="${esc(t.name)}"
          draggable="true" ondragstart="onTaskDragStart(event,'${t.id}','${t._instanceDate||k}')" ondragend="onTaskDragEnd(event)"
          style="top:${topPx}px;height:${hPx}px;left:${leftVal};right:${rightVal};background:${cc};border-top-color:${cc}"
          onclick="openEdit('${t.id}','${t._instanceDate||k}',event)">
          <span class="wk-task-block-name">${esc(t.name)}</span>
          ${ci.total<=2?`<div class="wk-task-meta-row">${wkSubPill}${wkDurStep}</div>`:''}
        </div>`;
      }
      return`<div class="wk-task-block${isDone?' done-block':''}${narrowCls}" data-id="${t.id}" title="${esc(t.name)}"
        draggable="true" ondragstart="onTaskDragStart(event,'${t.id}','${t._instanceDate||k}')" ondragend="onTaskDragEnd(event)"
        style="top:${topPx}px;height:${hPx}px;left:${leftVal};right:${rightVal};border-left-color:${cc};border-top-color:${cc};background:${taskBlockBg(t.category)}"
        onclick="openEdit('${t.id}','${t._instanceDate||k}',event)">
        <div style="display:flex;align-items:center;gap:2px;min-width:0">
          ${ci.total<=2?`<div class="task-check${isDone?' checked':''}" onclick="toggleDone('${t.id}','${t._instanceDate||k}',event,this)"></div>`:''}
          <span class="wk-task-block-name task-lbl">${esc(t.name)}</span>${ci.total<=2&&t.recur?'<span class="recur-icon">↻</span>':''}
        </div>
        ${ci.total<=2?`<div class="wk-task-meta-row">${wkSubPill}${wkDurStep}</div>`:''}
      </div>`;
    }).join('');
    const WK_SLOT_H_R=54;
    let routineBandsHtml='';
    getRoutineForDay(k).forEach(b=>{
      const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
      const isW=b.schedulable!==undefined?b.schedulable:(rt.schedulable||false);
      const[sh,sm]=b.start.split(':').map(Number);
      const[eh,em]=b.end.split(':').map(Number);
      const topPx=(sh*60+sm)/30*WK_SLOT_H_R;
      const hPx=(eh*60+em)/30*WK_SLOT_H_R-topPx;
      const rName=esc(b.customName||rt.label);
      const badgeCls=isW?'window':'block';
      routineBandsHtml+=`<div class="wk-routine-band" style="top:${topPx}px;height:${hPx}px;background:${rt.color}0c;--rb-color:${rt.color};border-left-color:${rt.color}">
      </div><div class="wk-routine-banner" style="top:${topPx}px;background:${rt.color}cc;color:#fff"><span class="wk-routine-dot" style="background:#fff"></span>${rName}</div>`;
    });
    g+=`<div class="wk-day-col">${colSlots}<div class="wk-task-layer">${routineBandsHtml}${taskBlocks}</div></div>`;
  });
  document.getElementById('weekGrid').innerHTML=g;

  // ── Apply adaptive column widths ──
  const hdrEl=document.getElementById('weekHdr');
  const gridEl=document.getElementById('weekGrid');
  const alldayEl=document.getElementById('weekAlldayRow');
  [hdrEl,gridEl].forEach(el=>{if(el)el.style.gridTemplateColumns=gridCols;});
  const alldayGrid=alldayEl?.querySelector('.wk-allday-row');
  if(alldayGrid)alldayGrid.style.gridTemplateColumns=gridCols;
}
function onWkDay(k){selDate=fromDk(k);switchView('day')}
function onWkSlot(k,t,e){if(e.target.closest('.wk-task-block,.now-line,.task-check'))return;const rb=isBlockedByRoutine(k,t);if(rb.blocked){showWarnToast(`${rb.routineName} blocks ${fmtT(rb.routineStart)} – ${fmtT(rb.routineEnd)}`);return;}openNew(k,t)}

// ══ DAY ═════════════════════════════════════

// ── Subtask list builder with drag-to-reorder ──
let _subDragTaskId=null,_subDragFrom=-1;
function buildSubtaskHtml(taskId,subs,isEvent){
  const subsDone=subs.filter(s=>s.done).length;
  const subsTotal=subs.length;
  if(!subsTotal)return'';
  const hdrColor=isEvent?'color:rgba(255,255,255,.6)':'';
  const countColor=isEvent?'color:rgba(255,255,255,.5)':'';
  const rows=subs.map((s,si)=>`<div class="day-subtask${s.done?' done':''}" draggable="true"
    ondragstart="onSubDragStart(event,'${taskId}',${si})"
    ondragover="onSubDragOver(event)" ondrop="onSubDrop(event,'${taskId}',${si})"
    ondragend="onSubDragEnd(event)">
    <span class="sub-grip" onmousedown="event.stopPropagation()">⋮</span>
    <div class="day-subtask-check${s.done?' checked':''}" onclick="event.stopPropagation();toggleSubtaskInline('${taskId}',${si})"></div>
    <span class="day-subtask-name" contenteditable="true" spellcheck="false" onclick="event.stopPropagation()" onblur="saveSubtaskInline('${taskId}',${si},this)" onkeydown="onSubtaskKeydown(event,'${taskId}',${si},this)">${esc(s.name)}</span>
  </div>`).join('');
  return`<div class="day-task-divider"></div><div class="day-subtask-hdr-row"><span class="day-subtask-hdr" style="${hdrColor}">SUBTASKS</span>${subsDone?`<span class="day-subtask-count" style="${countColor}">${subsDone}/${subsTotal}</span>`:''}</div><div class="day-subtask-list">${rows}</div>`;
}
function onSubDragStart(e,taskId,idx){
  _subDragTaskId=taskId;_subDragFrom=idx;
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain','sub');
  e.target.classList.add('sub-dragging');
}
function onSubDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';
  const row=e.target.closest('.day-subtask');
  if(row&&!row.classList.contains('sub-drop-target')){
    document.querySelectorAll('.sub-drop-target').forEach(r=>r.classList.remove('sub-drop-target'));
    row.classList.add('sub-drop-target');
  }
}
function onSubDrop(e,taskId,toIdx){
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.sub-drop-target').forEach(r=>r.classList.remove('sub-drop-target'));
  if(_subDragTaskId!==taskId||_subDragFrom===toIdx||_subDragFrom<0)return;
  const t=tasks.find(t=>t.id===taskId);if(!t||!t.subtasks)return;
  const moved=t.subtasks.splice(_subDragFrom,1)[0];
  t.subtasks.splice(toIdx,0,moved);
  save();renderAll();
  _subDragTaskId=null;_subDragFrom=-1;
}
function onSubDragEnd(e){
  e.target.classList.remove('sub-dragging');
  document.querySelectorAll('.sub-drop-target').forEach(r=>r.classList.remove('sub-drop-target'));
  _subDragTaskId=null;_subDragFrom=-1;
}

// Build a single in-flow day task block (no absolute top/height — slot provides sizing)
function buildDayTaskBlock(t, key, conflictIds){
  const idate=t._instanceDate||key;
  const dur=t.duration||30;
  const isEvent=(t.type||'task')==='event';
  const cc=isEvent?eventColor(t.category):catColor(t.category);
  const isDone=t.done||(t.doneOverrides||[]).includes(idate);
  const subs=t.subtasks||[];
  const subsDone=subs.filter(s=>s.done).length;
  const subsTotal=subs.length;
  const DAY_H=window.innerWidth<=640?64:76;
  const schedH=Math.max(36,dur/30*DAY_H-8);
  const hasConflict=conflictIds&&conflictIds.has(t.id);
  const conflictBadge=hasConflict?`<span class="day-conflict-badge" title="This task overlaps another scheduled task">⚠ overlap</span>`:'';

  // Duration stepper: − [30m] +
  const durStepHtml=`<span class="dur-stepper"><button class="dur-step-btn" onclick="event.stopPropagation();adjustDuration('${t.id}','${idate}',-15,event)">−</button><span class="day-task-dur-pill">${durLabel(dur)}</span><button class="dur-step-btn" onclick="event.stopPropagation();adjustDuration('${t.id}','${idate}',15,event)">+</button></span>`;

  // Time range badge: "8:30 – 9:30 AM"
  let timeRangeBadge='';
  if(t.time){
    const[th,tm]=t.time.split(':').map(Number);
    const endMins=(th*60+tm)+dur;
    const endH=Math.floor(endMins/60)%24;
    const endM=endMins%60;
    timeRangeBadge=`<span class="day-time-range">${fmtT(t.time)} – ${fmtT(pad(endH)+':'+pad(endM))}</span>`;
  }

  if(isEvent){
    return`<div class="day-task-slot-wrap" style="position:relative;min-height:${schedH}px">
      <div class="day-task-block event-block" data-id="${t.id}" title="${esc(t.name)}"
        draggable="true" ondragstart="onTaskDragStart(event,'${t.id}','${idate}')" ondragend="onTaskDragEnd(event)"
        style="background:${cc};border-top-color:${cc}"
        onclick="openEdit('${t.id}','${idate}',event)">
        <div class="day-task-block-check">
          <span class="day-task-block-name">${esc(t.name)}</span>
          <button class="day-add-sub-btn event-add-sub" data-tip="Add subtask" onclick="event.stopPropagation();addSubtaskInline('${t.id}','${idate}')">+</button>
          ${timeRangeBadge}
        </div>
        ${dur>15?`<div class="day-task-meta-row">${durStepHtml}${t.location?` · <span class="event-location">${IC_PIN} ${esc(t.location)}</span>`:''}${t.recur?` ↻`:''}</div>`:''}
        ${(t.attachments||[]).length?`<span class="task-attach" onclick="event.stopPropagation()">${IC_CLIP} ${(t.attachments||[]).length} attached</span>`:t.link?`<a class="task-attach" href="${esc(t.link)}" target="_blank" onclick="event.stopPropagation()">${IC_LINK} Link</a>`:''}
        ${buildSubtaskHtml(t.id,subs,true)}
        ${conflictBadge}
      </div>
    </div>`;
  }

  // Focus pill — compact pill style instead of inline button
  const focusPill=!isDone&&dur>15?`<button class="day-focus-pill" onclick="event.stopPropagation();startFocusForTask('${t.id}','${idate}')">▶ Focus</button>`:'';

  return`<div class="day-task-slot-wrap" style="position:relative;min-height:${schedH}px">
    <div class="day-task-block${isDone?' done-block':''}" data-id="${t.id}" title="${esc(t.name)}"
      draggable="true" ondragstart="onTaskDragStart(event,'${t.id}','${idate}')" ondragend="onTaskDragEnd(event)"
      style="border-left-color:${cc};border-top-color:${cc};background:${taskBlockBg(t.category)}"
      onclick="openEdit('${t.id}','${idate}',event)">
      <div class="day-task-block-check">
        <div class="task-check${isDone?' checked':''}" onclick="toggleDone('${t.id}','${idate}',event,this)"></div>
        <span class="day-task-block-name task-lbl">${esc(t.name)}</span>
        <button class="day-add-sub-btn" data-tip="Add subtask" onclick="event.stopPropagation();addSubtaskInline('${t.id}','${idate}')">+</button>
        ${t.recur?`<span class="recur-icon" title="${recurLbl(t)}">↻</span>`:''}
        ${timeRangeBadge}
      </div>
      ${dur>15?`<div class="day-task-meta-row">
        ${durStepHtml}
        ${focusPill}
        ${t.notes?`<span class="day-task-notes-pill">${esc(t.notes.slice(0,32))}${t.notes.length>32?'…':''}</span>`:''}
        ${(t.attachments||[]).length?`<span class="task-attach day-task-attach-pill">${IC_CLIP} ${(t.attachments||[]).length}</span>`:t.link?`<a class="task-attach day-task-attach-pill" href="${esc(t.link)}" target="_blank" onclick="event.stopPropagation()">${IC_LINK}</a>`:''}
        ${conflictBadge}
      </div>`:''}
      ${buildSubtaskHtml(t.id,subs,false)}
    </div>
  </div>`;
}

let _overlapWarnShown=false;
function renderDay(){
  renderGreeting();
  renderUpcomingEvents();
  const key=dk(selDate);
  document.getElementById('dayTitle').textContent=DLONG[selDate.getDay()]+', '+MONTHS_LONG[selDate.getMonth()]+' '+selDate.getDate();
  const _allTasks=tasksOn(dk(selDate));
  const _alldayTasks=_allTasks.filter(t=>t.allday===true);
  const _timedTasks=_allTasks.filter(t=>t.time&&!t.allday);
  const _dayTotal=_allTasks.length;
  const _dayDone=_allTasks.filter(t=>t.done||(t.doneOverrides||[]).includes(dk(selDate))).length;
  document.getElementById('daySub').textContent=selDate.getFullYear()+(isToday(selDate)?' · Today':'')+(_dayTotal>0?' · '+_dayDone+'/'+_dayTotal+' done':'');

  // ── All-day banner ─────────────────────────────────────────────────────────
  const alldayBar=document.getElementById('dayAlldayBar');
  if(alldayBar){
    if(_alldayTasks.length){
      alldayBar.innerHTML=_alldayTasks.map(t=>{
        const cc=t.eventColor||eventColor(t.category);
        const isDone=t.done;
        const mdBadge=t._isMultiDay?` · Day ${t._multiDayNum} of ${t._multiDayTotal}`:'';
        return`<span class="allday-pill${isDone?' done':''}" style="background:${cc};border-color:${cc};color:#fff"
          onclick="openEdit('${t.id}','${t._multiDayStart||key}',event)" title="Click to edit">
          <span class="allday-pill-type">Event</span>
          ${esc(t.name)}${t.recur?' ↻':''} · All Day${mdBadge}
          <span class="allday-pill-edit">✎</span>
        </span>`;
      }).join('');
      alldayBar.style.display='flex';
    } else {
      alldayBar.innerHTML='';
      alldayBar.style.display='none';
    }
  }

  // ── Conflict detection ─────────────────────────────────────────────────────
  const conflictIds=new Set();
  const overlapIds=new Set();
  _timedTasks.forEach((a,ai)=>{
    const[ah,am]=a.time.split(':').map(Number);
    const aStart=ah*60+am;
    const aEnd=aStart+(a.duration||30);
    _timedTasks.forEach((b,bi)=>{
      if(ai>=bi)return;
      const[bh,bm]=b.time.split(':').map(Number);
      const bStart=bh*60+bm;
      const bEnd=bStart+(b.duration||30);
      if(aStart<bEnd&&bStart<aEnd){
        conflictIds.add(a.id);
        conflictIds.add(b.id);
        overlapIds.add(a.id);
        overlapIds.add(b.id);
      }
    });
  });

  // ── Column layout for ALL timed tasks (like week view) ──
  const dayColMap=new Map();
  {
    const allItems=_timedTasks.map(t=>{
      const[h,m]=t.time.split(':').map(Number);
      return{id:t.id,start:h*60+m,end:h*60+m+(t.duration||30),isEvent:(t.type||'task')==='event'};
    }).sort((a,b)=>a.start-b.start||b.end-a.end);
    const clusters=[];
    allItems.forEach(item=>{
      let merged=false;
      for(const cl of clusters){if(cl.some(c=>item.start<c.end&&c.start<item.end)){cl.push(item);merged=true;break;}}
      if(!merged)clusters.push([item]);
    });
    clusters.forEach(cl=>{
      if(cl.length===1){dayColMap.set(cl[0].id,{col:0,total:1});return;}
      cl.sort((a,b)=>(a.isEvent?1:0)-(b.isEvent?1:0)||a.start-b.start);
      const cols=[];
      cl.forEach(item=>{
        let c=cols.findIndex(end=>item.start>=end);
        if(c===-1){c=cols.length;cols.push(0);}
        cols[c]=item.end;
        dayColMap.set(item.id,{col:c,total:0});
      });
      cl.forEach(item=>{dayColMap.get(item.id).total=cols.length;});
    });
    const maxCols=Math.max(0,...[...dayColMap.values()].map(v=>v.total));
    if(maxCols>=3&&!_overlapWarnShown){
      _overlapWarnShown=true;
      const msg=maxCols>=4
        ?`You have ${maxCols} tasks overlapping — that's hard to read! Try using subtasks to group related items under one task.`
        :`${maxCols} tasks overlap at the same time. Consider using subtasks to keep things organized.`;
      setTimeout(()=>showWarnToast(msg,true),300);
    }
    if(maxCols<3)_overlapWarnShown=false;
  }

  const sl=slots();
  const DAY_SLOT_H=window.innerWidth<=640?64:76;

  // Routine block lookup
  const routineBands=getRoutineForDay(key);
  const allDayRoutines=getAllRoutinesForDay(key);
  function routineAt(slotTime){
    return routineBands.find(b=>slotTime>=b.start&&slotTime<b.end)||null;
  }
  // ── Routine chips (skip/unskip) ──
  const chipsEl=document.getElementById('dayRoutineChips');
  const daySuppressed=isRoutineSuppressed(key);
  if(chipsEl){
    if(allDayRoutines.length){
      chipsEl.innerHTML=allDayRoutines.map(b=>{
        const idx=routineBlocks.indexOf(b);
        const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
        const isSkipped=(b.skipDates||[]).includes(key);
        const isBlocked=b.schedulable!==undefined?!b.schedulable:!rt.schedulable;
        const isSup=daySuppressed&&isBlocked&&!isSkipped;
        const label=esc(b.customName||rt.label);
        const timeRange=fmtT(b.start)+' – '+fmtT(b.end);
        if(isSkipped){
          return`<div class="day-rt-chip skipped" style="--chip-color:${rt.color}"><span class="day-rt-chip-dot" style="background:${rt.color}"></span><span class="day-rt-chip-name">${label}</span><span class="day-rt-chip-time">${timeRange}</span><button class="day-rt-chip-btn undo" onclick="unskipRoutineToday(${idx},'${key}')" title="Undo skip">Undo</button></div>`;
        }
        if(isSup){
          return`<div class="day-rt-chip skipped" style="--chip-color:${rt.color}"><span class="day-rt-chip-dot" style="background:${rt.color}"></span><span class="day-rt-chip-name">${label}</span><span class="day-rt-chip-time">${timeRange}</span><span class="day-rt-chip-badge">paused</span></div>`;
        }
        return`<div class="day-rt-chip" style="--chip-color:${rt.color}"><span class="day-rt-chip-dot" style="background:${rt.color}"></span><span class="day-rt-chip-name">${label}</span><span class="day-rt-chip-time">${timeRange}</span><button class="day-rt-chip-btn" onclick="skipRoutineToday(${idx},'${key}')" title="Skip today">Skip</button></div>`;
      }).join('');
      chipsEl.style.display='';
    } else {
      chipsEl.innerHTML='';
      chipsEl.style.display='none';
    }
  }

  // ── Build slot grid: consistent heights, NO task blocks, NO inline labels ──
  let html='';
  sl.forEach(s=>{
    const sk2=sk(s.h,s.m);
    const isHalf=s.m===30;

    // Routine shading
    const rb=routineAt(sk2);
    const rt=rb?ROUTINE_TYPES[rb.type]||ROUTINE_TYPES.custom:null;
    const lblBorder=rt?`border-right:2px solid ${rt.color}`:'';
    const slotBg=rt?`background:${rt.color}18`:'';
    const routineAttr=rb?` data-routine="${rb.type}"`:'';
    // Check if slot is blocked by a non-schedulable routine
    const isSlotBlocked=rb&&(rb.schedulable!==undefined?!rb.schedulable:!(rt&&rt.schedulable));

    // Open-window hint for empty schedulable routine slots
    const hasTaskHere=_timedTasks.some(t=>t.time===sk2);
    let windowHintHtml='';
    if(rb&&!hasTaskHere){
      const isWin=rb.schedulable!==undefined?rb.schedulable:(rt.schedulable||false);
      if(isWin){windowHintHtml=`<div class="routine-window-hint" style="color:${rt.color}">open</div>`;}
    }

    html+=`<div class="day-time-lbl${isHalf?' half-lbl':''}" style="${lblBorder}">${!isHalf?fmtT(sk2):''}</div>
           <div class="day-slot${isHalf?' half':''}${isSlotBlocked?' routine-blocked':''}" data-time="${sk2}"${routineAttr}
             style="${slotBg}"
             onclick="onDaySlot('${key}','${sk2}',event)"
             ondragover="onDO(event,'${key}','${sk2}')" ondragleave="onDL(event)"
             ondrop="onDropSlot(event,'${key}','${sk2}')">
             ${windowHintHtml}
           </div>`;
  });

  const tl=document.getElementById('dayTimeline');
  tl.innerHTML=html;

  // ── Absolute overlay for ALL timed tasks (like week view) ──────────────────
  if(_timedTasks.length){
    requestAnimationFrame(()=>{
      const firstLbl=tl.querySelector('.day-time-lbl');
      const lblW=firstLbl?firstLbl.offsetWidth:80;

      const overlay=document.createElement('div');
      overlay.className='day-overlay-layer';
      overlay.style.cssText=`position:absolute;top:0;left:${lblW}px;right:0;bottom:0;pointer-events:none;z-index:3`;

      _timedTasks.forEach(t=>{
        const[h,m]=t.time.split(':').map(Number);
        const timeKey=sk(h,m);
        const slotEl=tl.querySelector(`.day-slot[data-time="${timeKey}"]`);
        if(!slotEl)return;
        // If task starts at a routine band's start time, offset below the banner
        const tMins=h*60+m;
        const atBandStart=routineBands.some(b=>b.start===timeKey);
        const bannerH=atBandStart?18:0;
        const topPx=slotEl.offsetTop+bannerH;
        const dur=t.duration||30;
        const hPx=Math.max(36,dur/30*DAY_SLOT_H-bannerH);

        const ci=dayColMap.get(t.id)||{col:0,total:1};
        // Inset for tasks within routine containers
        const tStartMins=h*60+m;
        const inRoutine=routineBands.some(b=>{
          const[bsh,bsm]=b.start.split(':').map(Number);
          const[beh,bem]=b.end.split(':').map(Number);
          return tStartMins>=bsh*60+bsm&&tStartMins<beh*60+bem;
        });
        const rInset=inRoutine?4:0;
        let leftVal=(2+rInset)+'px',rightVal=(2+rInset)+'px';
        if(ci.total>1){
          const pct=100/ci.total;
          leftVal=ci.col===0?(2+rInset)+'px':`calc(${(ci.col*pct).toFixed(1)}% + ${1+rInset}px)`;
          rightVal=ci.col===ci.total-1?(2+rInset)+'px':`calc(${((ci.total-ci.col-1)*pct).toFixed(1)}% + ${1+rInset}px)`;
        }

        const idate=t._instanceDate||key;
        const isEvent=(t.type||'task')==='event';
        const cc=isEvent?eventColor(t.category):catColor(t.category);
        const isDone=t.done||(t.doneOverrides||[]).includes(idate);
        const subs=t.subtasks||[];

        let timeRB='';
        if(t.time){
          const[th2,tm2]=t.time.split(':').map(Number);
          const endMins2=(th2*60+tm2)+dur;
          timeRB=`<span class="day-time-range">${fmtT(t.time)} – ${fmtT(pad(Math.floor(endMins2/60)%24)+':'+pad(endMins2%60))}</span>`;
        }

        let blockHtml;
        const durStep=`<span class="dur-stepper"><button class="dur-step-btn" onclick="event.stopPropagation();adjustDuration('${t.id}','${idate}',-15,event)">−</button><span class="day-task-dur-pill">${durLabel(dur)}</span><button class="dur-step-btn" onclick="event.stopPropagation();adjustDuration('${t.id}','${idate}',15,event)">+</button></span>`;
        const subPillInline=subs.length?(ci.total===1?`<span class="sub-pill-row" onclick="event.stopPropagation();openSubtaskPopup('${t.id}','${idate}')"><span class="sub-pill-icon">☰</span> ${subs.length} subtask${subs.length!==1?'s':''} <span class="sub-pill-done">(${subs.filter(s=>s.done).length} done)</span></span>`:(ci.total<=3?`<span class="sub-pill-row sub-pill-compact" onclick="event.stopPropagation();openSubtaskPopup('${t.id}','${idate}')"><span class="sub-pill-icon">☰</span> ${subs.length}</span>`:'')):'';
        if(isEvent){
          blockHtml=`<div class="day-task-block event-block" data-id="${t.id}" title="${esc(t.name)}"
            draggable="true" ondragstart="onTaskDragStart(event,'${t.id}','${idate}')" ondragend="onTaskDragEnd(event)"
            style="background:${cc};border-top-color:${cc};height:100%;margin:0;border-radius:0 6px 6px 0"
            onclick="openEdit('${t.id}','${idate}',event)">
            <div class="day-task-block-check">
              <span class="day-task-block-name">${esc(t.name)}</span>
              <button class="day-add-sub-btn event-add-sub" data-tip="Add subtask" onclick="event.stopPropagation();openSubtaskPopup('${t.id}','${idate}')">+</button>
              ${ci.total<=3?timeRB:''}
            </div>
            ${dur>15?`<div class="day-task-meta-row">${durStep}${ci.total<=3&&t.location?` · <span class="event-location">${IC_PIN} ${esc(t.location)}</span>`:''}${ci.total<=3&&t.recur?' ↻':''}${subPillInline}</div>`:''}
          </div>`;
        } else {
          const focusPill2=ci.total<=2&&!isDone&&dur>15?`<button class="day-focus-pill" onclick="event.stopPropagation();startFocusForTask('${t.id}','${idate}')">▶ Focus</button>`:'';
          blockHtml=`<div class="day-task-block${isDone?' done-block':''}" data-id="${t.id}" title="${esc(t.name)}"
            draggable="true" ondragstart="onTaskDragStart(event,'${t.id}','${idate}')" ondragend="onTaskDragEnd(event)"
            style="border-left-color:${cc};border-top-color:${cc};background:${taskBlockBg(t.category)};height:100%;margin:0;border-radius:0 6px 6px 0"
            onclick="openEdit('${t.id}','${idate}',event)">
            <div class="day-task-block-check">
              <div class="task-check${isDone?' checked':''}" onclick="toggleDone('${t.id}','${idate}',event,this)"></div>
              <span class="day-task-block-name task-lbl">${esc(t.name)}</span>
              <button class="day-add-sub-btn" data-tip="Add subtask" onclick="event.stopPropagation();openSubtaskPopup('${t.id}','${idate}')">+</button>
              ${ci.total<=3&&t.recur?`<span class="recur-icon">↻</span>`:''}
              ${ci.total<=3?timeRB:''}
            </div>
            ${dur>15?`<div class="day-task-meta-row">
              ${durStep}
              ${focusPill2}
              ${ci.total<=3&&(t.attachments||[]).length?`<span class="task-attach day-task-attach-pill">${IC_CLIP} ${(t.attachments||[]).length}</span>`:ci.total<=3&&t.link?`<a class="task-attach day-task-attach-pill" href="${esc(t.link)}" target="_blank" onclick="event.stopPropagation()">${IC_LINK}</a>`:''}
              ${subPillInline}
            </div>`:''}
          </div>`;
        }

        const block=document.createElement('div');
        block.setAttribute('data-cols',ci.total);
        if(ci.total>=3)block.classList.add('day-overlay-narrow');
        if(ci.total>=4)block.classList.add('day-overlay-xnarrow');
        block.style.cssText=`position:absolute;top:${topPx}px;height:${hPx}px;left:${leftVal};right:${rightVal};pointer-events:all;z-index:3;overflow:hidden`;
        block.innerHTML=blockHtml;
        overlay.appendChild(block);
      });

      tl.style.position='relative';
      tl.appendChild(overlay);
    });
  }

  // ── Routine container nesting overlays + banners ─────────────────────────────
  if(routineBands.length){
    requestAnimationFrame(()=>{
      const firstLbl2=tl.querySelector('.day-time-lbl');
      const lblW2=firstLbl2?firstLbl2.offsetWidth:80;
      tl.style.position='relative';
      routineBands.forEach(b=>{
        const rtC=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
        const isW=b.schedulable!==undefined?b.schedulable:(rtC.schedulable||false);
        const startSlot=tl.querySelector(`.day-slot[data-time="${b.start}"]`);
        if(!startSlot)return;
        const[eH,eM]=b.end.split(':').map(Number);const endMins3=eH*60+eM;
        let endSlot=null;
        for(let mm=endMins3-30;mm>=0;mm-=30){
          const sk3=pad(Math.floor(mm/60))+':'+pad(mm%60);
          const el=tl.querySelector(`.day-slot[data-time="${sk3}"]`);
          if(el){endSlot=el;break;}
        }
        if(!endSlot)endSlot=startSlot;
        const topPx2=startSlot.offsetTop;
        const hPx2=endSlot.offsetTop+endSlot.offsetHeight-topPx2;
        if(hPx2<=0)return;

        // Container frame (z-index 1, behind tasks)
        const container=document.createElement('div');
        container.className='routine-container';
        container.style.cssText=`--rc-color:${rtC.color};--rc-dim:${rtC.color}20;--rc-bg:${rtC.color}06;top:${topPx2}px;height:${hPx2}px;left:${lblW2}px;right:0`;
        tl.appendChild(container);

        // Banner (z-index 5, above tasks)
        const rName=esc(b.customName||rtC.label);
        const badgeCls=isW?'window':'block';
        const badgeText=isW?'Window':'Block';
        const banner=document.createElement('div');
        banner.className='routine-banner';
        banner.style.cssText=`color:#fff;background:${rtC.color}cc;border-bottom-color:${rtC.color}30;top:${topPx2}px;left:${lblW2}px;right:0`;
        banner.innerHTML=`<span class="routine-banner-dot" style="background:#fff"></span><span class="routine-banner-name">${rName}</span><span class="routine-banner-badge ${badgeCls}">${badgeText}</span><span class="routine-banner-time">${fmtT(b.start)} – ${fmtT(b.end)}</span>`;
        tl.appendChild(banner);
      });
    });
  }

  // Empty-day state
  if(!_dayTotal){
    const empty=document.createElement('div');
    empty.className='day-empty-state';
    empty.innerHTML=`<div class="day-empty-icon"><svg width="36" height="36" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" stroke-width="1.5" opacity=".5"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.5" opacity=".5"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/></svg></div><div class="day-empty-text">Nothing scheduled yet<br><span style="font-size:11px">Click a time slot or press <strong>N</strong> to add a task</span></div>`;
    tl.appendChild(empty);
  }
  // Update journal if expanded
  if(_dayJournalOpen)openJournalForDate(dk(selDate));
}
function onDaySlot(k,t,e){if(e.target.closest('.day-task-block,.day-task-slot-wrap,.now-line,.task-check'))return;const rb=isBlockedByRoutine(k,t);if(rb.blocked){showWarnToast(`${rb.routineName} blocks ${fmtT(rb.routineStart)} – ${fmtT(rb.routineEnd)}`);return;}openNew(k,t)}

// ══ CATEGORIES ════════════════════════════════
function renderCatChips(){
  const wrap=document.getElementById('catChips');if(!wrap)return;
  let html=`<div class="cat-chip all-chip${catFilter==='all'?' active':''}" onclick="setCF('all')">All</div>`;
  categories.forEach(c=>{
    const isActive=catFilter===c.id;
    html+=`<div class="cat-chip${isActive?' active':''}" style="${isActive?`background:${c.color}`:'background:var(--surface3)'};${isActive?'':'color:var(--text2)'}" onclick="setCF('${c.id}')">
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
  renderCatChips(); // always refresh chips when rendering the tasks panel
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
    } else if((t.type||'task')!=='event'){
      // Events are shown in the Events tab, not in the Tasks To Do list
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
  html+=`<div class="cat-section"><div class="cat-sec-title">To Do <span style="font-weight:400;opacity:.6;margin-left:4px">${pending.length}</span></div>`;
  if(!pending.length)html+=`<div class="cat-empty">All clear! 🎉</div>`;
  pending.forEach(t=>{html+=catRow(t)});
  html+=`</div>`;

  if(showDone){
    html+=`<div class="cat-section"><div class="cat-sec-title" style="color:var(--accent)">✅ Completed <span style="font-weight:400;opacity:.6;margin-left:4px">${done.length}</span></div>`;
    if(!done.length)html+=`<div class="cat-empty">Nothing completed yet</div>`;
    done.forEach(t=>{html+=catRow(t)});
    html+=`</div>`;
  }

  const el=document.getElementById('catTasksArea');if(el)el.innerHTML=html;
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
      <div class="cat-task-name">${esc(t.name)}</div>
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
      <div class="cat-task-name" style="${t.done?'text-decoration:line-through;opacity:.6':''}" ondblclick="event.stopPropagation();inlineRename(this,'${t.id}',${!!isBd})">${esc(t.name)}</div>
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
  work:{icon:()=>rIcon('W','#3b82f6'),label:'Work',color:'#3b82f6',busy:true,schedulable:true},
  class:{icon:()=>rIcon('C','#8b5cf6'),label:'Class',color:'#8b5cf6',busy:true,schedulable:false},
  gym:{icon:()=>rIcon('G','#10b981'),label:'Gym / Exercise',color:'#10b981',busy:true,schedulable:false},
  meals:{icon:()=>rIcon('M','#f59e0b'),label:'Meals',color:'#f59e0b',busy:true,schedulable:false},
  sleep:{icon:()=>rIcon('Z','#64748b'),label:'Sleep',color:'#64748b',busy:true,schedulable:false},
  commute:{icon:()=>rIcon('D','#6366f1'),label:'Commute',color:'#6366f1',busy:true,schedulable:false},
  church:{icon:()=>rIcon('+','#a855f7'),label:'Church',color:'#a855f7',busy:true,schedulable:false},
  family:{icon:()=>rIcon('F','#ec4899'),label:'Family Time',color:'#ec4899',busy:true,schedulable:false},
  free:{icon:()=>rIcon('·','#10b981'),label:'Free Time',color:'#10b981',busy:false,schedulable:true},
  focus:{icon:()=>rIcon('!','#f43f5e'),label:'Focus / Deep Work',color:'#f43f5e',busy:true,schedulable:true},
  selfcare:{icon:()=>rIcon('S','#14b8a6'),label:'Self-Care',color:'#14b8a6',busy:true,schedulable:false},
  custom:{icon:()=>rIcon('?','#78716c'),label:'Custom',color:'#78716c',busy:true,schedulable:false},
};
let routineBlocks=[];
try{routineBlocks=JSON.parse(localStorage.getItem('clarity_routine')||'[]')}catch{routineBlocks=[]}
function saveRoutine(){try{localStorage.setItem('clarity_routine',JSON.stringify(routineBlocks))}catch(e){showToast('Storage full');console.error(e)}}
function onRoutineTypeChange(){
  const v=document.getElementById('routineType').value;
  const nameWrap=document.getElementById('routineNameWrap');
  if(nameWrap)nameWrap.style.display=v==='custom'?'':'none';
  const rt=ROUTINE_TYPES[v]||ROUTINE_TYPES.custom;
  const toggle=document.getElementById('routineSchedToggle');
  if(toggle)toggle.classList.toggle('on',rt.schedulable||false);
}

let _routineStripDay=new Date().getDay(); // 0=Sun..6=Sat
let _routineStripMode='day'; // 'day','weekdays','weekends'

function setRoutineStripDay(d){_routineStripMode='day';_routineStripDay=d;renderRoutineList();}
function setRoutineStripPreset(mode){_routineStripMode=mode;renderRoutineList();}

function _routineStripActiveDays(){
  if(_routineStripMode==='weekdays')return[1,2,3,4,5];
  if(_routineStripMode==='weekends')return[0,6];
  return[_routineStripDay];
}

function renderRoutineList(){
  const el=document.getElementById('routineList');if(!el)return;
  if(!routineBlocks.length){
    el.innerHTML=`<div class="routine-hero">
      <div class="routine-hero-top"><div class="routine-hero-title">My Routine</div></div>
      <div class="routine-hero-desc">Tell Luclaro about your typical day so the AI can plan around it.</div>
      <div class="rt-strip-wrap">
        <div class="rt-strip rt-strip-empty">
          <div class="rt-strip-empty-hint">Your routine blocks will appear here</div>
        </div>
        <div class="rt-strip-times"><span>12am</span><span>3am</span><span>6am</span><span>9am</span><span>12pm</span><span>3pm</span><span>6pm</span><span>9pm</span><span>12am</span></div>
      </div>
    </div>
    <div class="routine-add-row"><button class="routine-add-btn" onclick="openRoutineModal()">+ Add routine block</button></div>
    <div class="routine-lower">
      <div class="routine-instr">
        <div class="routine-instr-title">How routines work</div>
        <div class="routine-instr-item"><span class="routine-instr-dot" style="background:var(--accent)"></span><div><strong>Window</strong> — Luclaro can schedule tasks during this time</div></div>
        <div class="routine-instr-item"><span class="routine-instr-dot" style="background:var(--text3)"></span><div><strong>Block</strong> — Protected time the AI won't schedule over</div></div>
        <div class="routine-instr-hint">Add blocks like Work, Gym, Sleep, or Church. The AI will build your schedule around them.</div>
      </div>
      <div class="routine-blocks-list">
        <div class="routine-blocks-title">Your blocks</div>
        <div class="routine-empty-list">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style="opacity:.3;margin-bottom:6px"><rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" stroke-width="1.5"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="13" x2="12" y2="17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="10" y1="15" x2="14" y2="15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <span>No blocks yet</span>
          <span style="font-size:10px;color:var(--text3);margin-top:2px">Tap the button above to add your first routine block</span>
        </div>
      </div>
    </div>`;
    return;
  }
  // ── Day selector buttons ──
  const dayLetters=['S','M','T','W','T','F','S'];
  const activeDays=_routineStripActiveDays();
  let tabsHtml=`<div class="rt-day-selector">`;
  tabsHtml+=`<div class="rt-day-btns">`;
  for(let d=0;d<7;d++){
    const isOn=_routineStripMode==='day'&&_routineStripDay===d;
    tabsHtml+=`<button class="rt-day-btn${isOn?' on':''}" onclick="setRoutineStripDay(${d})">${dayLetters[d]}</button>`;
  }
  tabsHtml+=`</div>`;
  tabsHtml+=`<div class="rt-day-presets">`;
  tabsHtml+=`<button class="rt-day-preset${_routineStripMode==='weekdays'?' on':''}" onclick="setRoutineStripPreset('weekdays')">Weekdays</button>`;
  tabsHtml+=`<button class="rt-day-preset${_routineStripMode==='weekends'?' on':''}" onclick="setRoutineStripPreset('weekends')">Weekends</button>`;
  tabsHtml+=`</div></div>`;
  // ── Strip blocks — show blocks active on selected day(s) ──
  const activeBlocks=routineBlocks.filter(b=>activeDays.some(d=>b.days.includes(d)));
  let stripHtml='';
  activeBlocks.slice().sort((a,b)=>a.start.localeCompare(b.start)).forEach(b=>{
    const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
    const[sh,sm]=b.start.split(':').map(Number);const[eh,em]=b.end.split(':').map(Number);
    let startMins=sh*60+sm,endMins=eh*60+em;const overnight=endMins<=startMins;
    const label=esc(b.customName||rt.label);const idx=routineBlocks.indexOf(b);
    if(overnight){
      const evePct=(startMins/1440*100),eveW=((1440-startMins)/1440*100);
      stripHtml+=`<div class="rt-strip-blk rt-night-r" style="left:${evePct.toFixed(1)}%;width:${eveW.toFixed(1)}%;background:${rt.color};opacity:.55" title="${label}: ${fmtT(b.start)} – ${fmtT(b.end)}" onclick="editRoutine(${idx})"><span>${label}</span></div>`;
      const mornW=(endMins/1440*100);
      stripHtml+=`<div class="rt-strip-blk rt-night-l" style="left:0;width:${mornW.toFixed(1)}%;background:${rt.color};opacity:.55" title="${label}" onclick="editRoutine(${idx})"><span></span></div>`;
    } else {
      const pct=(startMins/1440*100),w=((endMins-startMins)/1440*100);
      stripHtml+=`<div class="rt-strip-blk" style="left:${pct.toFixed(1)}%;width:${w.toFixed(1)}%;background:${rt.color}" title="${label}: ${fmtT(b.start)} – ${fmtT(b.end)}" onclick="editRoutine(${idx})"><span>${label}</span></div>`;
    }
  });
  // ── Block list ──
  const dayLabels=['S','M','T','W','T','F','S'];
  let bkHtml=routineBlocks.slice().sort((a,b)=>a.start.localeCompare(b.start)).map(b=>{
    const i=routineBlocks.indexOf(b);const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
    const isW=b.schedulable!==undefined?b.schedulable:(rt.schedulable||false);
    const badge=isW?'<span class="routine-mode-badge window">Window</span>':'<span class="routine-mode-badge block">Block</span>';
    const ds=[0,1,2,3,4,5,6].map(d=>`<span class="rt-bk-day${b.days.includes(d)?' on':''}">${dayLabels[d]}</span>`).join('');
    return`<div class="rt-bk" onclick="editRoutine(${i})"><div class="rt-bk-bar" style="background:${rt.color}"></div><div class="rt-bk-info"><div class="rt-bk-name">${esc(b.customName||rt.label)}</div><div class="rt-bk-meta"><span>${fmtT(b.start)} – ${fmtT(b.end)}</span>${badge}<span class="rt-bk-days">${ds}</span></div></div><button class="rt-bk-del" onclick="event.stopPropagation();delRoutine(${i})" title="Delete"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>`;
  }).join('');

  el.innerHTML=`<div class="routine-hero"><div class="routine-hero-top"><div class="routine-hero-title">My Routine</div></div>
    ${tabsHtml}
    <div class="rt-strip-wrap"><div class="rt-strip">${stripHtml}</div>
    <div class="rt-strip-times"><span>12am</span><span>3am</span><span>6am</span><span>9am</span><span>12pm</span><span>3pm</span><span>6pm</span><span>9pm</span><span>12am</span></div></div></div>
    <div class="routine-add-row"><button class="routine-add-btn" onclick="openRoutineModal()">+ Add routine block</button></div>
    <div class="routine-lower"><div class="routine-instr"><div class="routine-instr-title">How routines work</div>
      <div class="routine-instr-item"><span class="routine-instr-dot" style="background:var(--accent)"></span><div><strong>Window</strong> — Luclaro can schedule tasks during this time</div></div>
      <div class="routine-instr-item"><span class="routine-instr-dot" style="background:var(--text3)"></span><div><strong>Block</strong> — Protected time the AI won't schedule over</div></div>
      <div class="routine-instr-hint">Tap any block in the strip or list to edit. Overnight blocks wrap around.</div></div>
    <div class="routine-blocks-list"><div class="routine-blocks-title">Your blocks</div>${bkHtml}</div></div>`;
}

let _routineEditIdx=-1;
function openRoutineModal(){
  _routineEditIdx=-1;resetRoutineModal();
  document.getElementById('routineModalTitle').textContent='Add routine block';
  document.getElementById('routineModalSave').textContent='Add Block';
  document.getElementById('routineModalOverlay').classList.add('open');
}
function closeRoutineModal(){document.getElementById('routineModalOverlay').classList.remove('open')}
function resetRoutineModal(){
  document.getElementById('routineType').value='work';
  document.getElementById('routineName').value='';
  const nw=document.getElementById('routineNameWrap');if(nw)nw.style.display='none';
  document.getElementById('routineStart').value='09:00';
  document.getElementById('routineEnd').value='17:00';
  document.querySelectorAll('#routineDays .routine-day-btn').forEach(b=>b.classList.add('on'));
  const t=document.getElementById('routineSchedToggle');if(t)t.classList.remove('on');
  onRoutineTypeChange();
}
function editRoutine(idx){
  const b=routineBlocks[idx];if(!b)return;_routineEditIdx=idx;
  document.getElementById('routineType').value=b.type;onRoutineTypeChange();
  if(b.customName)document.getElementById('routineName').value=b.customName;
  document.getElementById('routineStart').value=b.start;
  document.getElementById('routineEnd').value=b.end;
  document.querySelectorAll('#routineDays .routine-day-btn').forEach((btn,i)=>btn.classList.toggle('on',b.days.includes(i)));
  const st=document.getElementById('routineSchedToggle');
  const isW=b.schedulable!==undefined?b.schedulable:((ROUTINE_TYPES[b.type]||{}).schedulable||false);
  if(st)st.classList.toggle('on',isW);
  document.getElementById('routineModalTitle').textContent='Edit routine block';
  document.getElementById('routineModalSave').textContent='Save Changes';
  document.getElementById('routineModalOverlay').classList.add('open');
}
function saveRoutineFromModal(){
  const validated=validateRoutineInput(_routineEditIdx);if(!validated)return;
  if(_routineEditIdx>=0){
    validated.skipDates=routineBlocks[_routineEditIdx].skipDates||[];
    routineBlocks[_routineEditIdx]=validated;showToast('Routine block updated');
  }
  else{validated.skipDates=[];routineBlocks.push(validated);showToast('Routine block added');}
  saveRoutine();renderRoutineList();closeRoutineModal();
}

function toggleRoutineDay(btn){btn.classList.toggle('on')}
function addRoutineBlock(){saveRoutineFromModal()}

function validateRoutineInput(editIdx){
  // Max 20
  if(editIdx===-1&&routineBlocks.length>=20){showToast('Maximum 20 routine blocks');return null;}
  const type=document.getElementById('routineType').value;
  const customName=type==='custom'?document.getElementById('routineName').value.trim():'';
  if(type==='custom'&&!customName){document.getElementById('routineName').focus();showToast('Enter a custom label');return null;}
  const start=document.getElementById('routineStart').value;
  const end=document.getElementById('routineEnd').value;
  if(!start||!end){showToast('Set start and end times');return null;}
  // Validate end time is after start time
  const[sh,sm]=start.split(':').map(Number);
  const[eh,em]=end.split(':').map(Number);
  const startMins=sh*60+sm;
  const endMins=eh*60+em;
  if(endMins<=startMins){showToast('End time must be after start time');return null;}
  const dayBtns=document.querySelectorAll('#routineDays .routine-day-btn');
  const days=[];dayBtns.forEach((b,i)=>{if(b.classList.contains('on'))days.push(i);});
  if(!days.length){showToast('Select at least one day');return null;}
  const schedulable=document.getElementById('routineSchedToggle').classList.contains('on');
  // Check exact duplicate
  for(let i=0;i<routineBlocks.length;i++){
    if(i===editIdx)continue;
    const b=routineBlocks[i];
    if(b.type===type&&b.start===start&&b.end===end&&b.days.some(d=>days.includes(d))){
      showToast('This routine already exists');return null;
    }
  }
  // Check same-type overlap
  for(let i=0;i<routineBlocks.length;i++){
    if(i===editIdx)continue;
    const b=routineBlocks[i];
    if(b.type!==type)continue;
    const sharedDays=b.days.filter(d=>days.includes(d));
    if(!sharedDays.length)continue;
    const[bsh,bsm]=b.start.split(':').map(Number);
    const[beh,bem]=b.end.split(':').map(Number);
    const bStart=bsh*60+bsm;
    const bEnd=beh*60+bem;
    if(startMins<bEnd&&bStart<endMins){
      const rt=ROUTINE_TYPES[type]||ROUTINE_TYPES.custom;
      showToast(`You already have ${rt.label} at ${fmtT(b.start)}–${fmtT(b.end)} on overlapping days`);
      return null;
    }
  }
  // Check cross-type overlap (warning, not block)
  for(let i=0;i<routineBlocks.length;i++){
    if(i===editIdx)continue;
    const b=routineBlocks[i];
    if(b.type===type)continue;
    const sharedDays=b.days.filter(d=>days.includes(d));
    if(!sharedDays.length)continue;
    const[bsh2,bsm2]=b.start.split(':').map(Number);
    const[beh2,bem2]=b.end.split(':').map(Number);
    const bStart2=bsh2*60+bsm2;
    const bEnd2=beh2*60+bem2;
    if(startMins<bEnd2&&bStart2<endMins){
      const rt2=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
      if(!confirm(`This overlaps with ${rt2.label} (${fmtT(b.start)}–${fmtT(b.end)}). Add anyway?`))return null;
      break; // Only warn once
    }
  }
  return{type,customName,start,end,days,schedulable};
}
function delRoutine(i){routineBlocks.splice(i,1);saveRoutine();renderRoutineList();}

// Get routine blocks for a specific day (0=Sun..6=Sat)
function getRoutineForDay(dateKey){
  const d=fromDk(dateKey);
  const dow=d.getDay();
  const isSuppressed=_hasSuppressingEvent(dateKey);
  return routineBlocks.filter(b=>{
    if(!b.days.includes(dow))return false;
    if((b.skipDates||[]).includes(dateKey))return false;
    // If suppressed by an event, exclude blocked (non-schedulable) routines
    if(isSuppressed){
      const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
      const isSchedulable=b.schedulable!==undefined?b.schedulable:rt.schedulable;
      if(!isSchedulable)return false;
    }
    return true;
  });
}
function _hasSuppressingEvent(dateKey){
  return tasks.some(t=>{
    if(!t.scheduled||t.type!=='event'||!t.allday||!t.suppressRoutines)return false;
    if(t.multiDay&&t.endDate){return dateKey>=t.date&&dateKey<=t.endDate;}
    return t.date===dateKey;
  });
}
function getAllRoutinesForDay(dateKey){
  const d=fromDk(dateKey);
  const dow=d.getDay();
  return routineBlocks.filter(b=>b.days.includes(dow));
}
function isRoutineSuppressed(dateKey){return _hasSuppressingEvent(dateKey);}
function skipRoutineToday(routineIdx,dateKey){
  const b=routineBlocks[routineIdx];if(!b)return;
  if(!b.skipDates)b.skipDates=[];
  if(!b.skipDates.includes(dateKey))b.skipDates.push(dateKey);
  saveRoutine();renderAll();
}
function unskipRoutineToday(routineIdx,dateKey){
  const b=routineBlocks[routineIdx];if(!b)return;
  b.skipDates=(b.skipDates||[]).filter(d=>d!==dateKey);
  saveRoutine();renderAll();
}
function routineContextStr(dateKey){
  const blocks=getRoutineForDay(dateKey);
  if(!blocks.length)return'';
  const windows=blocks.filter(b=>{
    const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
    return b.schedulable!==undefined?b.schedulable:rt.schedulable;
  });
  const blocked=blocks.filter(b=>{
    const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
    return b.schedulable!==undefined?!b.schedulable:!rt.schedulable;
  });
  let str='';
  if(windows.length)str+='\n\nScheduling windows (place tasks INTO these, matching category when possible):\n'+
    windows.map(b=>{
      const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
      const label=esc(b.customName||rt.label);
      return`${b.start} - ${b.end}: ${label} window — prioritize ${label.toLowerCase()}-related tasks here`;
    }).join('\n');
  if(blocked.length)str+='\n\nBlocked time (do NOT schedule over these):\n'+
    blocked.map(b=>`${b.start} - ${b.end}: ${esc(b.customName||(ROUTINE_TYPES[b.type]?.label||b.type))}`).join('\n');
  return str;
}

// ══ FOCUS TIMER ═════════════════════════════════
let _focusTaskId=null,_focusDate=null;
let _focusDur=25,_focusRemaining=25*60,_focusTotal=25*60;
let _focusRunning=false,_focusInterval=null;
let _focusSessions=0;
let _focusOriginalDur=30;
let _focusMode='task'; // 'pomodoro','task','custom'
let _focusOverlayOpen=false;

function switchSideFocus(){
  populateFocusPicker();
  // Safety: ensure overlay is hidden when no focus task
  if(!_focusTaskId){
    const overlay=document.getElementById('focusOverlay');
    if(overlay){overlay.classList.remove('show');overlay.style.display='none';}
    hideFocusMiniTimer();
  }
  if(_focusTaskId){
    document.getElementById('focusEmpty').style.display='none';
    document.getElementById('focusActive').style.display='';
    // Update sidebar compact card
    const t=tasks.find(t=>t.id===_focusTaskId);
    if(t){
      document.getElementById('focusSideName').textContent=t.name;
      updateSidebarTimer();
    }
  } else {
    document.getElementById('focusEmpty').style.display='';
    document.getElementById('focusActive').style.display='none';
  }
}
function updateSidebarTimer(){
  const el=document.getElementById('focusSideTime');
  if(el)el.textContent=focusTimeStr(_focusRemaining);
  const pct=_focusTotal>0?(_focusTotal-_focusRemaining)/_focusTotal:0;
  const circ=94.25;
  const arc=document.getElementById('focusArcSide');
  if(arc)arc.setAttribute('stroke-dashoffset',circ-(circ*pct));
}
function populateFocusPicker(){
  const sel=document.getElementById('focusTaskPicker');if(!sel)return;
  const key=dk(selDate);
  const dayTasks=tasksOn(key).filter(t=>!t.done);
  sel.innerHTML='<option value="">— Select a task —</option>'+
    dayTasks.map(t=>`<option value="${t.id}|${t._instanceDate||key}">${t.time?fmtT(t.time)+' ':''} ${esc(t.name)}</option>`).join('');
}
function onFocusPickTask(val){
  if(!val)return;
  const[id,idate]=val.split('|');
  startFocusForTask(id,idate);
}
function startFocusForTask(id,dateKey){
  const t=tasks.find(t=>t.id===id);if(!t)return;
  // Clean up any running timer before starting new one
  if(_focusRunning&&_focusTaskId&&_focusTaskId!==id){
    clearInterval(_focusInterval);
    _focusRunning=false;
    localStorage.removeItem('clarity_focus_active');
  }
  _focusTaskId=id;_focusDate=dateKey;
  const dur=t.duration||30;
  _focusOriginalDur=dur;
  _focusMode='task';
  // Smart time estimation: if current time is past task start, use remaining time
  let effectiveDur=dur;
  if(t.time&&dateKey===dk(new Date())){
    const now=new Date();
    const nowMins=now.getHours()*60+now.getMinutes();
    const[th,tm]=t.time.split(':').map(Number);
    const taskStart=th*60+tm;
    const taskEnd=taskStart+dur;
    if(nowMins>taskStart&&nowMins<taskEnd){
      effectiveDur=taskEnd-nowMins;
    }
  }
  _focusDur=effectiveDur;_focusRemaining=effectiveDur*60;_focusTotal=effectiveDur*60;
  _focusRunning=false;
  clearInterval(_focusInterval);
  // Update sidebar
  document.getElementById('focusEmpty').style.display='none';
  document.getElementById('focusActive').style.display='';
  document.getElementById('focusSideName').textContent=t.name;
  // Open the overlay
  openFocusOverlay();
}

// ── Focus Overlay ────────────────────────────────────
function openFocusOverlay(){
  const t=tasks.find(t=>t.id===_focusTaskId);if(!t)return;
  _focusOverlayOpen=true;
  const overlay=document.getElementById('focusOverlay');
  overlay.style.display='flex';
  overlay.classList.add('show');
  // Populate content
  document.getElementById('foTaskName').textContent=t.name;
  const cc=catColor(t.category);
  const catName=catById(t.category)?.name||'';
  const timeStr=t.time?fmtT(t.time)+' – '+fmtT(pad(Math.floor(((t.time.split(':').map(Number)[0]*60+t.time.split(':').map(Number)[1])+(t.duration||30))/60)%24)+':'+pad(((t.time.split(':').map(Number)[0]*60+t.time.split(':').map(Number)[1])+(t.duration||30))%60)):'';
  document.getElementById('foTaskMeta').innerHTML=`<span class="fo-cat-dot" style="background:${cc}"></span>${catName}${timeStr?' · '+timeStr:''}`;
  // Set mode toggle
  updateFocusModeUI();
  // Build subtasks
  buildFocusSubtasks();
  // Update done checkbox
  updateFocusDoneCheck();
  // Show intention
  loadFocusIntention();
  // Update display
  updateFocusDisplay();
  updatePlayBtnIcon();
  // Update session count
  const sc=document.getElementById('foSessionCount');
  if(sc)sc.textContent=_focusSessions?`${_focusSessions} session${_focusSessions>1?'s':''} today`:'';
  // Hide mini-timer
  hideFocusMiniTimer();
}
function closeFocusOverlay(){
  _focusOverlayOpen=false;
  const overlay=document.getElementById('focusOverlay');
  overlay.classList.remove('show');
  overlay.style.display='none';
  // If timer is running, show mini-timer
  if(_focusRunning)showFocusMiniTimer();
  switchSideFocus();
}

// ── Focus Modes ──────────────────────────────────────
function setFocusMode(mode){
  if(_focusRunning)return;
  _focusMode=mode;
  const t=tasks.find(t=>t.id===_focusTaskId);
  if(mode==='pomodoro'){
    _focusDur=25;
  } else if(mode==='task'){
    _focusDur=t?(t.duration||30):30;
  } else if(mode==='custom'){
    const slider=document.getElementById('foCustomSlider');
    _focusDur=slider?parseInt(slider.value):30;
  }
  _focusRemaining=_focusDur*60;_focusTotal=_focusDur*60;
  updateFocusModeUI();
  updateFocusDisplay();
}
function updateFocusModeUI(){
  const btns=document.querySelectorAll('.fo-mode-btn');
  btns.forEach(b=>{
    const m=b.textContent.toLowerCase().trim();
    const mKey=m==='pomodoro'?'pomodoro':m==='task'?'task':'custom';
    b.classList.toggle('on',mKey===_focusMode);
  });
  const customRow=document.getElementById('foCustomRow');
  if(customRow)customRow.style.display=_focusMode==='custom'?'':'none';
  if(_focusMode==='custom'){
    const slider=document.getElementById('foCustomSlider');
    if(slider)slider.value=_focusDur;
    const val=document.getElementById('foCustomVal');
    if(val)val.textContent=durLabel(_focusDur);
  }
  // Disable mode buttons while running
  const modeRow=document.getElementById('foModeRow');
  if(modeRow){
    modeRow.style.opacity=_focusRunning?'.4':'';
    modeRow.style.pointerEvents=_focusRunning?'none':'';
  }
}
function onFocusCustomSlider(val){
  if(_focusRunning)return;
  _focusDur=parseInt(val);
  _focusRemaining=_focusDur*60;_focusTotal=_focusDur*60;
  const valEl=document.getElementById('foCustomVal');
  if(valEl)valEl.textContent=durLabel(_focusDur);
  updateFocusDisplay();
}

// ── Focus Display Updates ────────────────────────────
function focusTimeStr(totalSecs){
  const h=Math.floor(totalSecs/3600);
  const m=Math.floor((totalSecs%3600)/60);
  const s=totalSecs%60;
  return h+':'+pad(m)+':'+pad(s);
}
function updateFocusDisplay(){
  const timeStr=focusTimeStr(_focusRemaining);
  // Update overlay
  const td=document.getElementById('focusTimeDisplay');
  if(td)td.textContent=timeStr;
  const pct=_focusTotal>0?(_focusTotal-_focusRemaining)/_focusTotal:0;
  const circ=326.73;
  const arc=document.getElementById('focusArc');
  if(arc)arc.setAttribute('stroke-dashoffset',circ-(circ*pct));
  // Update sidebar
  updateSidebarTimer();
  // Update mini-timer
  updateFocusMiniTimer();
}
function updatePlayBtnIcon(){
  const icon=document.getElementById('foPlayIcon');
  if(!icon)return;
  if(_focusRunning){
    icon.setAttribute('d','M6 4h4v16H6zM14 4h4v16h-4z'); // pause icon
  } else {
    icon.setAttribute('d','M8 5v14l11-7z'); // play icon
  }
}

// ── Focus Meta Time Updater ──────────────────────────
function updateFocusMetaTime(){
  const t=tasks.find(t=>t.id===_focusTaskId);if(!t)return;
  const cc=catColor(t.category);
  const catName=catById(t.category)?.name||'';
  let timeStr='';
  if(t.time){
    const[h,m]=t.time.split(':').map(Number);
    const endMins=h*60+m+_focusDur;
    timeStr=fmtT(t.time)+' – '+fmtT(pad(Math.floor(endMins/60)%24)+':'+pad(endMins%60));
  }
  const metaEl=document.getElementById('foTaskMeta');
  if(metaEl)metaEl.innerHTML=`<span class="fo-cat-dot" style="background:${cc}"></span>${catName}${timeStr?' · '+timeStr:''}`;
}

// ── In-overlay notification ──────────────────────────
let _foNotifyTimer=null;
function showFocusNotification(msg,type){
  // type: 'ok','warn','error'
  let el=document.getElementById('foNotification');
  if(!el){
    el=document.createElement('div');
    el.id='foNotification';
    el.className='fo-notify';
    const card=document.getElementById('focusOverlayCard');
    if(!card)return;
    // Insert after the meta row
    const meta=document.getElementById('foTaskMeta');
    if(meta&&meta.nextSibling)meta.parentNode.insertBefore(el,meta.nextSibling);
    else if(card)card.insertBefore(el,card.children[3]||null);
  }
  const colorMap={ok:'var(--accent)',warn:'var(--amber-warn)',error:'var(--red)'};
  el.style.borderLeftColor=colorMap[type]||colorMap.ok;
  // Use class-based backgrounds so dark mode CSS overrides work
  el.classList.remove('fo-notify-ok','fo-notify-warn','fo-notify-error');
  el.classList.add('fo-notify-'+(type||'ok'));
  el.innerHTML=`<span class="fo-notify-msg">${msg}</span><button class="fo-notify-x" onclick="dismissFocusNotification()">✕</button>`;
  el.classList.add('show');
  clearTimeout(_foNotifyTimer);
  _foNotifyTimer=setTimeout(()=>el.classList.remove('show'),8000);
}
function dismissFocusNotification(){
  const el=document.getElementById('foNotification');
  if(el)el.classList.remove('show');
  clearTimeout(_foNotifyTimer);
}

// ── Focus Subtasks ───────────────────────────────────
function buildFocusSubtasks(){
  const el=document.getElementById('foSubtasks');if(!el)return;
  const t=tasks.find(t=>t.id===_focusTaskId);
  if(!t||!t.subtasks||!t.subtasks.length){el.innerHTML='';return;}
  el.innerHTML=`<div class="fo-sub-label">Subtasks</div>`+
    t.subtasks.map((s,i)=>`<div class="fo-sub-row">
      <div class="fo-sub-check${s.done?' checked':''}" onclick="toggleFocusSubtask(${i})"></div>
      <span class="fo-sub-name${s.done?' done':''}">${esc(s.name)}</span>
    </div>`).join('');
}
function toggleFocusSubtask(i){
  const t=tasks.find(t=>t.id===_focusTaskId);if(!t||!t.subtasks||!t.subtasks[i])return;
  t.subtasks[i].done=!t.subtasks[i].done;
  if(t.subtasks[i].done)playSubTick();
  save();
  buildFocusSubtasks();
}
function toggleFocusDone(){
  const t=tasks.find(t=>t.id===_focusTaskId);if(!t)return;
  if(t.recur&&_focusDate){
    if(!t.doneOverrides)t.doneOverrides=[];
    const idx=t.doneOverrides.indexOf(_focusDate);
    if(idx===-1){t.doneOverrides.push(_focusDate);playDone();}
    else{t.doneOverrides.splice(idx,1);playUndo();}
  } else {
    t.done=!t.done;
    if(t.done)playDone();else playUndo();
  }
  save();renderAll();
  updateFocusDoneCheck();
  const isDone=t.done||(t.doneOverrides||[]).includes(_focusDate);
  if(isDone){
    // Stop timer and show completion
    clearInterval(_focusInterval);
    _focusRunning=false;
    localStorage.removeItem('clarity_focus_active');
    _focusSessions++;
    onFocusComplete();
  }
}
function updateFocusDoneCheck(){
  const el=document.getElementById('foDoneCheck');if(!el)return;
  const t=tasks.find(t=>t.id===_focusTaskId);if(!t)return;
  const isDone=t.done||(t.doneOverrides||[]).includes(_focusDate);
  el.classList.toggle('checked',isDone);
}
function playSubTick(){
  try{const ac=getAC();const o=ac.createOscillator(),g=ac.createGain();o.connect(g);g.connect(ac.destination);o.type='sine';o.frequency.setValueAtTime(880,ac.currentTime);g.gain.setValueAtTime(.08,ac.currentTime);g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.15);o.start(ac.currentTime);o.stop(ac.currentTime+.18);}catch(e){}
}

// ── Focus Intention ──────────────────────────────────
function loadFocusIntention(){
  const el=document.getElementById('foIntention');if(!el)return;
  const weekStart=wkStart(new Date());
  const intentionKey='clarity_intention_'+dk(weekStart);
  const intention=localStorage.getItem(intentionKey)||'';
  if(intention){
    el.innerHTML=`<div class="fo-intention-text">"${esc(intention)}"</div>`;
  } else {
    el.innerHTML='';
  }
}

// ── Timer Controls ───────────────────────────────────
function toggleFocusTimer(){
  if(_focusRunning){
    _focusRunning=false;
    clearInterval(_focusInterval);
    localStorage.removeItem('clarity_focus_active');
  } else {
    _focusRunning=true;
    // Save state for refresh recovery
    localStorage.setItem('clarity_focus_active',JSON.stringify({
      taskId:_focusTaskId,date:_focusDate,
      endAt:Date.now()+_focusRemaining*1000,
      total:_focusTotal
    }));
    _focusInterval=setInterval(()=>{
      _focusRemaining--;
      updateFocusDisplay();
      if(_focusRemaining<=0){
        clearInterval(_focusInterval);
        _focusRunning=false;
        localStorage.removeItem('clarity_focus_active');
        onFocusComplete();
      }
    },1000);
  }
  updatePlayBtnIcon();
  updateFocusModeUI();
}
// Restore focus timer on page load
function restoreFocusTimer(){
  const saved=localStorage.getItem('clarity_focus_active');
  if(!saved)return;
  try{
    const s=JSON.parse(saved);
    const remaining=Math.round((s.endAt-Date.now())/1000);
    if(remaining<=0){localStorage.removeItem('clarity_focus_active');return;}
    const t=tasks.find(t=>t.id===s.taskId);if(!t)return;
    _focusTaskId=s.taskId;_focusDate=s.date;
    const dur=t.duration||30;
    _focusOriginalDur=dur;_focusMode='task';
    _focusDur=dur;_focusRemaining=remaining;_focusTotal=s.total;
    _focusRunning=false;
    clearInterval(_focusInterval);
    document.getElementById('focusEmpty').style.display='none';
    document.getElementById('focusActive').style.display='';
    document.getElementById('focusSideName').textContent=t.name;
    updateFocusDisplay();
    toggleFocusTimer(); // auto-start
    // Show mini-timer (overlay not open on restore)
    showFocusMiniTimer();
  }catch(e){localStorage.removeItem('clarity_focus_active');}
}
function addFocusTime(){
  const t=tasks.find(t=>t.id===_focusTaskId);
  if(t&&t.time&&t.date){
    const newDur=_focusDur+15;
    const overflow=checkDurationOverflow(t.id,_focusDate||t.date,t.time,newDur);
    if(overflow.blocked){
      showFocusNotification(`Can't extend — ${overflow.count} tasks already at ${fmtT(overflow.slotTime)}`,'error');
      return;
    }
    const routineCheck=checkRoutineOverflow(_focusDate||t.date,t.time,newDur);
    if(routineCheck.blocked){
      showFocusNotification(`Extending runs into ${routineCheck.routineName} (${fmtT(routineCheck.routineStart)})`,'warn');
    }
  }
  _focusRemaining+=15*60;
  _focusTotal+=15*60;
  _focusDur+=15;
  if(t)t.duration=_focusDur;
  save();
  if(_focusRunning){
    localStorage.setItem('clarity_focus_active',JSON.stringify({
      taskId:_focusTaskId,date:_focusDate,
      endAt:Date.now()+_focusRemaining*1000,
      total:_focusTotal
    }));
  }
  updateFocusDisplay();
  updateFocusMetaTime();
  showFocusNotification(`+15 min · Task now ${durLabel(_focusDur)}`,'ok');
}
function resetFocusTimer(){
  clearInterval(_focusInterval);
  _focusRunning=false;
  localStorage.removeItem('clarity_focus_active');
  const t=tasks.find(t=>t.id===_focusTaskId);
  if(t&&t.duration!==_focusOriginalDur){
    t.duration=_focusOriginalDur;
    save();
  }
  _focusDur=_focusOriginalDur;_focusRemaining=_focusOriginalDur*60;_focusTotal=_focusOriginalDur*60;
  _focusMode='task';
  updateFocusModeUI();
  updatePlayBtnIcon();
  updateFocusDisplay();
  updateFocusMetaTime();
  dismissFocusNotification();
  showFocusNotification(`Timer reset to ${durLabel(_focusOriginalDur)}`,'ok');
}

// ── End Confirmation ─────────────────────────────────
function confirmEndFocus(){
  const elapsed=_focusTotal-_focusRemaining;
  const elapsedH=Math.floor(elapsed/3600);
  const elapsedM=Math.floor((elapsed%3600)/60);
  const elapsedStr=elapsedH>0?`${elapsedH}h ${elapsedM}m`:`${elapsedM}m`;
  const sub=document.getElementById('focusEndSub');
  if(sub)sub.textContent=`You've focused for ${elapsedStr}. The task won't be marked as done.`;
  document.getElementById('focusEndOverlay').classList.add('open');
}
function cancelEndFocus(){
  document.getElementById('focusEndOverlay').classList.remove('open');
}
function doEndFocus(){
  document.getElementById('focusEndOverlay').classList.remove('open');
  endFocusSession();
}
function endFocusSession(){
  clearInterval(_focusInterval);
  _focusRunning=false;
  localStorage.removeItem('clarity_focus_active');
  const elapsed=_focusTotal-_focusRemaining;
  if(elapsed>60){
    _focusSessions++;
  }
  const t=tasks.find(t=>t.id===_focusTaskId);
  if(t&&elapsed>t.duration*60){
    const newDurMins=Math.ceil(elapsed/60);
    if(t.time&&t.date){
      const overflow=checkDurationOverflow(t.id,_focusDate||t.date,t.time,newDurMins);
      if(overflow.blocked){
        showWarnToast(`Session ran over but can't extend — ${overflow.count} tasks at ${fmtT(overflow.slotTime)}`,false);
        resetFocusUI();
        return;
      }
    }
    const overflowMins=Math.ceil((elapsed-t.duration*60)/60);
    t.duration=newDurMins;
    save();
    offerReflow(t,overflowMins);
  }
  resetFocusUI();
}
function onFocusComplete(){
  playDone();
  _focusSessions++;
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
  // Show completion in overlay
  const card=document.getElementById('focusOverlayCard');
  if(card&&_focusOverlayOpen){
    const isLongBreak=_focusSessions%4===0;
    card.innerHTML=`
      <button class="fo-exit" onclick="closeFocusOverlay()">✕</button>
      <div class="fo-complete-wrap">
        <div class="fo-complete-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="var(--accent)" stroke-width="1.5"/>
            <path d="M8 12l3 3 5-6" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="fo-complete-title">${isLongBreak?'Long break — 15 min':'Nice work!'}</div>
        <div class="fo-complete-sub">${t?'"'+esc(t.name)+'" marked complete':'Session finished'}</div>
        <div class="fo-complete-sub">${_focusSessions} session${_focusSessions>1?'s':''} today</div>
        <button class="fo-complete-btn" onclick="closeFocusOverlay();resetFocusUI()">Done</button>
      </div>`;
  }
  hideFocusMiniTimer();
}
function resetFocusUI(){
  _focusTaskId=null;_focusDate=null;_focusRunning=false;
  _focusOverlayOpen=false;
  clearInterval(_focusInterval);
  const overlay=document.getElementById('focusOverlay');
  if(overlay){overlay.classList.remove('show');overlay.style.display='none';}
  hideFocusMiniTimer();
  switchSideFocus();
}

// ── Floating Mini Timer ──────────────────────────────
function showFocusMiniTimer(){
  // Don't show if focus sidebar tab is active — user can see the timer there
  if(activeSide==='focus'&&sidebarOpen)return;
  const el=document.getElementById('focusMiniTimer');if(!el)return;
  const t=tasks.find(t=>t.id===_focusTaskId);
  if(t)document.getElementById('fmtName').textContent=t.name;
  updateFocusMiniTimer();
  el.style.display='flex';
}
function hideFocusMiniTimer(){
  const el=document.getElementById('focusMiniTimer');
  if(el)el.style.display='none';
}
function updateFocusMiniTimer(){
  const el=document.getElementById('fmtTime');
  if(el)el.textContent=focusTimeStr(_focusRemaining);
  const pct=_focusTotal>0?(_focusTotal-_focusRemaining)/_focusTotal:0;
  const circ=94.25;
  const arc=document.getElementById('fmtArc');
  if(arc)arc.setAttribute('stroke-dashoffset',circ-(circ*pct));
}
function buildFocusDurButtons(sel){
  // Legacy — no longer renders buttons, mode toggle handles this
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
        <span style="flex:1;font-weight:500">${esc(t.name)}</span>
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

// ══ SMART RESCHEDULE ════════════════════════════
function checkOverdueTasks(){
  const todayKey=dk(new Date());
  const overdue=tasks.filter(t=>
    t.scheduled&&t.date&&t.date<todayKey&&!t.done&&!t.recur&&
    (t.type||'task')!=='event'&&
    !(t._smartRescheduleOffered||[]).includes(t.date)
  );
  if(!overdue.length)return;
  openOverduePopup(overdue);
}

// ── Overdue Popup (all tasks at once) ─────────────────────────────────
let _overdueDismissedToday=false;
function openOverduePopup(overdueList){
  if(_overdueDismissedToday)return;
  // Don't open if another modal or focus overlay is already visible (prevent stacking)
  const anyModalOpen=document.querySelector('.modal-overlay.open,.modal-overlay.show,.fo-overlay.show');
  if(anyModalOpen&&anyModalOpen.id!=='overduePopupOverlay')return;
  if(!overdueList||!overdueList.length){
    const todayKey=dk(new Date());
    overdueList=tasks.filter(t=>
      t.scheduled&&t.date&&t.date<todayKey&&!t.done&&!t.recur&&
      (t.type||'task')!=='event'
    );
  }
  if(!overdueList.length){showToast('No overdue tasks');return;}
  // Sort by date (oldest first)
  overdueList.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const todayKey=dk(new Date());
  const today=new Date();today.setHours(0,0,0,0);
  // Calculate days overdue
  const listHtml=overdueList.map(t=>{
    const d=fromDk(t.date);
    const diffDays=Math.floor((today-d)/(86400000));
    const cc=catColor(t.category);
    const durStr=t.duration?durLabel(t.duration):'30m';
    const overdueStr=diffDays===1?'1 day overdue':diffDays+' days overdue';
    const severeClass=diffDays>=7?' od-severe':'';
    return`<div class="od-task-row">
      <div class="od-task-color" style="background:${cc}"></div>
      <div class="od-task-info" onclick="closeOverduePopup();openEdit('${t.id}','${t.date}',event)">
        <div class="od-task-name">${esc(t.name)}</div>
        <div class="od-task-meta"><span class="od-overdue-badge${severeClass}">${overdueStr}</span><span>${t.date} · ${durStr}</span></div>
      </div>
      <div class="od-task-actions">
        <button class="od-act od-act-move" title="Move to today" onclick="overdueMoveSingle('${t.id}','${todayKey}')">↦</button>
        <button class="od-act od-act-pick" title="Pick date" onclick="closeOverduePopup();openEdit('${t.id}','${t.date}',event)">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" stroke-width="1.3"/><line x1="2" y1="6.5" x2="14" y2="6.5" stroke="currentColor" stroke-width="1.3"/><line x1="5.5" y1="1.5" x2="5.5" y2="4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><line x1="10.5" y1="1.5" x2="10.5" y2="4.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        </button>
        <button class="od-act od-act-done" title="Mark done" onclick="overdueMarkDone('${t.id}','${t.date}')">✓</button>
      </div>
    </div>`;
  }).join('');
  const scrollClass=overdueList.length>6?' od-scrollable':'';
  const oldest=overdueList[0];
  const oldestDays=Math.floor((today-fromDk(oldest.date))/(86400000));
  const subText=overdueList.length===1?'This task is past its scheduled date':`Oldest is ${oldestDays} day${oldestDays!==1?'s':''} overdue`;
  let overlay=document.getElementById('overduePopupOverlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='overduePopupOverlay';
    overlay.className='modal-overlay';
    overlay.onclick=function(e){if(e.target===this)closeOverduePopup()};
    overlay.innerHTML='<div class="modal od-modal" onclick="event.stopPropagation()" id="overduePopupContent"></div>';
    document.body.appendChild(overlay);
  }
  document.getElementById('overduePopupContent').innerHTML=`
    <div class="od-hdr">
      <div class="od-hdr-icon">⏰</div>
      <div class="od-hdr-text">
        <div class="od-hdr-title">${overdueList.length} overdue task${overdueList.length!==1?'s':''}</div>
        <div class="od-hdr-sub">${subText}</div>
      </div>
      <button class="od-close" onclick="closeOverduePopup()">✕</button>
    </div>
    <div class="od-batch-bar">
      <button class="od-batch-btn od-batch-primary" onclick="overdueBatchMove('today')">Move all to today</button>
      <button class="od-batch-btn" onclick="overdueBatchMove('tomorrow')">Move all to tomorrow</button>
    </div>
    <div class="od-task-list${scrollClass}" id="odTaskList">${listHtml}</div>
    ${overdueList.length>6?'<div class="od-scroll-hint">scroll for more</div>':''}
    <div class="od-footer">
      <span class="od-footer-link" onclick="overdueDismissAll()">Dismiss all — I'll handle it</span>
      <span class="od-footer-link" onclick="overdueDismissToday()">Don't show today</span>
    </div>`;
  overlay.classList.add('open');
}
function closeOverduePopup(){
  const overlay=document.getElementById('overduePopupOverlay');
  if(overlay)overlay.classList.remove('open');
}

// ── Smart Placement: find open slots in routine windows ──────────────
function findOpenSlots(dateKey,count,durations){
  const existing=tasksOn(dateKey).filter(t=>t.time&&!t.allday);
  const routines=getRoutineForDay(dateKey);
  // Get schedulable windows
  const windows=routines.filter(b=>{
    const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
    return b.schedulable!==undefined?b.schedulable:rt.schedulable;
  });
  // Build occupied map (minutes → true)
  const occupied=new Set();
  existing.forEach(t=>{
    const[h,m]=t.time.split(':').map(Number);
    const start=h*60+m, end=start+(t.duration||30);
    for(let mm=start;mm<end;mm+=15)occupied.add(mm);
  });
  // Also mark blocked routine time as occupied
  const blocked=routines.filter(b=>{
    const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
    return b.schedulable!==undefined?!b.schedulable:!rt.schedulable;
  });
  blocked.forEach(b=>{
    const[bh,bm]=b.start.split(':').map(Number);
    const[beh,bem]=b.end.split(':').map(Number);
    const bStart=bh*60+bm,bEnd=beh*60+bem;
    for(let mm=bStart;mm<bEnd;mm+=15)occupied.add(mm);
  });
  // Find open slots within windows
  const slots=[];
  const allWindows=windows.length?windows:[{start:'08:00',end:'18:00'}]; // fallback if no routine
  allWindows.forEach(w=>{
    const[sh,sm]=w.start.split(':').map(Number);
    const[eh,em]=w.end.split(':').map(Number);
    const wStart=sh*60+sm,wEnd=eh*60+em;
    for(let mm=wStart;mm<wEnd&&slots.length<count;mm+=30){
      const dur=durations[slots.length]||30;
      let fits=true;
      for(let t=mm;t<mm+dur;t+=15){if(occupied.has(t)){fits=false;break;}}
      if(fits){
        slots.push(pad(Math.floor(mm/60))+':'+pad(mm%60));
        // Mark as occupied for subsequent tasks
        for(let t=mm;t<mm+dur;t+=15)occupied.add(t);
      }
    }
  });
  return slots;
}
function checkConflicts(overdueList,dateKey){
  const existing=tasksOn(dateKey).filter(t=>t.time&&!t.allday);
  // Build slot usage count
  const slotCount={};
  existing.forEach(t=>{
    if(!t.time)return;
    const[h,m]=t.time.split(':').map(Number);
    const slotKey=Math.floor((h*60+m)/30);
    slotCount[slotKey]=(slotCount[slotKey]||0)+1;
  });
  const conflicts=[];
  overdueList.forEach(t=>{
    if(!t.time){conflicts.push({task:t,conflict:false});return;}
    const[h,m]=t.time.split(':').map(Number);
    const slotKey=Math.floor((h*60+m)/30);
    const current=slotCount[slotKey]||0;
    if(current>=3){conflicts.push({task:t,conflict:true,slotTime:t.time});}
    else{
      conflicts.push({task:t,conflict:false});
      slotCount[slotKey]=(slotCount[slotKey]||0)+1;
    }
  });
  return conflicts;
}

// ── Batch Move with conflict check ──────────────────────────────────
function overdueBatchMove(target){
  const todayKey=dk(new Date());
  const targetKey=target==='tomorrow'?dk(addDays(new Date(),1)):todayKey;
  const today=new Date();today.setHours(0,0,0,0);
  const overdueList=tasks.filter(t=>
    t.scheduled&&t.date&&t.date<todayKey&&!t.done&&!t.recur&&
    (t.type||'task')!=='event'
  ).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  if(!overdueList.length)return;
  // Check for conflicts
  const results=checkConflicts(overdueList,targetKey);
  const hasConflicts=results.some(r=>r.conflict);
  if(hasConflicts){
    showOverdueConflictView(overdueList,results,targetKey,target);
  } else {
    // No conflicts — move all directly
    overdueList.forEach(t=>{t.date=targetKey;});
    save();renderAll();closeOverduePopup();
    showToast(`Moved ${overdueList.length} task${overdueList.length!==1?'s':''} to ${target}`);
  }
}
function showOverdueConflictView(overdueList,results,targetKey,targetLabel){
  const conflictCount=results.filter(r=>r.conflict).length;
  // Only find slots for conflicting tasks
  const conflictingDurations=results.filter(r=>r.conflict).map(r=>r.task.duration||30);
  const smartSlots=findOpenSlots(targetKey,conflictingDurations.length,conflictingDurations);
  let slotIdx=0;
  const listHtml=results.map((r,i)=>{
    const t=r.task;
    const cc=catColor(t.category);
    if(r.conflict){
      const newTime=smartSlots[slotIdx]?fmtT(smartSlots[slotIdx]):'no open slot';
      slotIdx++;
      return`<div class="od-task-row">
        <div class="od-task-color" style="background:${cc}"></div>
        <div class="od-task-info">
          <div class="od-task-name">${esc(t.name)}</div>
          <div class="od-task-meta">${t.time?fmtT(t.time):'—'} → <span class="od-conflict-badge">conflict</span> → <span class="od-placed">${newTime}</span></div>
        </div>
      </div>`;
    }
    return`<div class="od-task-row">
      <div class="od-task-color" style="background:${cc}"></div>
      <div class="od-task-info">
        <div class="od-task-name">${esc(t.name)}</div>
        <div class="od-task-meta">${t.time?fmtT(t.time):'—'} → <span class="od-ok-badge">no conflict</span></div>
      </div>
    </div>`;
  }).join('');
  const noSlotCount=conflictCount-smartSlots.length;
  const content=document.getElementById('overduePopupContent');
  if(!content)return;
  content.innerHTML=`
    <div class="od-hdr">
      <div class="od-hdr-icon od-hdr-icon-warn">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l6.5 12H1.5L8 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><line x1="8" y1="6.5" x2="8" y2="9.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="8" cy="11.5" r=".6" fill="currentColor"/></svg>
      </div>
      <div class="od-hdr-text">
        <div class="od-hdr-title">${conflictCount} of ${overdueList.length} would conflict</div>
        <div class="od-hdr-sub">Some ${targetLabel} slots are already full</div>
      </div>
      <button class="od-close" onclick="closeOverduePopup()">✕</button>
    </div>
    <div class="od-warn-bar">
      <div class="od-warn-text"><strong>Smart placement available</strong> — move conflicting tasks to the next open slots in your routine windows?${noSlotCount>0?` <em>(${noSlotCount} task${noSlotCount>1?'s':''} couldn't be placed — not enough open slots)</em>`:''}</div>
    </div>
    <div class="od-task-list" id="odTaskList">${listHtml}</div>
    <div class="od-batch-bar">
      <button class="od-batch-btn od-batch-primary" onclick="overdueSmartPlace('${targetKey}')">Smart place all</button>
      <button class="od-batch-btn" onclick="overdueForceMove('${targetKey}','${targetLabel}')">Force move anyway</button>
      <button class="od-batch-btn" onclick="openOverduePopup()">Back</button>
    </div>`;
}
function overdueSmartPlace(targetKey){
  const todayKey=dk(new Date());
  const overdueList=tasks.filter(t=>
    t.scheduled&&t.date&&t.date<todayKey&&!t.done&&!t.recur&&
    (t.type||'task')!=='event'
  ).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  // Run conflict check to know which need new slots
  const results=checkConflicts(overdueList,targetKey);
  const conflictingTasks=results.filter(r=>r.conflict).map(r=>r.task);
  const conflictingDurations=conflictingTasks.map(t=>t.duration||30);
  const smartSlots=findOpenSlots(targetKey,conflictingDurations.length,conflictingDurations);
  let slotIdx=0;
  overdueList.forEach(t=>{
    t.date=targetKey;
    const isConflict=conflictingTasks.some(ct=>ct.id===t.id);
    if(isConflict&&smartSlots[slotIdx]){
      t.time=smartSlots[slotIdx];
      slotIdx++;
    } else if(isConflict){
      slotIdx++; // skip — no slot available, keep original time
    }
    // Non-conflicting tasks keep their original time
  });
  save();renderAll();closeOverduePopup();
  const placed=Math.min(conflictingTasks.length,smartSlots.length);
  showToast(`Smart-placed ${placed} task${placed!==1?'s':''}, ${overdueList.length-conflictingTasks.length} moved as-is`);
}
function overdueForceMove(targetKey,targetLabel){
  const todayKey=dk(new Date());
  const overdueList=tasks.filter(t=>
    t.scheduled&&t.date&&t.date<todayKey&&!t.done&&!t.recur&&
    (t.type||'task')!=='event'
  );
  overdueList.forEach(t=>{t.date=targetKey;});
  save();renderAll();closeOverduePopup();
  showToast(`Moved ${overdueList.length} task${overdueList.length!==1?'s':''} to ${targetLabel}`);
}

// ── Individual task actions ──────────────────────────────────
function overdueMoveSingle(id,newDate){
  const t=tasks.find(t=>t.id===id);
  if(t){t.date=newDate;save();renderAll();}
  showToast('Moved to '+fmtDateShort(newDate));
  // Re-open popup with remaining overdue
  setTimeout(()=>{
    const todayKey=dk(new Date());
    const remaining=tasks.filter(t2=>
      t2.scheduled&&t2.date&&t2.date<todayKey&&!t2.done&&!t2.recur&&
      (t2.type||'task')!=='event'
    );
    if(remaining.length)openOverduePopup(remaining);
    else closeOverduePopup();
  },300);
}
function overdueMarkDone(id,dateKey){
  const t=tasks.find(t=>t.id===id);
  if(t){t.done=true;save();renderAll();playDone();}
  showToast('Marked done');
  setTimeout(()=>{
    const todayKey=dk(new Date());
    const remaining=tasks.filter(t2=>
      t2.scheduled&&t2.date&&t2.date<todayKey&&!t2.done&&!t2.recur&&
      (t2.type||'task')!=='event'
    );
    if(remaining.length)openOverduePopup(remaining);
    else closeOverduePopup();
  },300);
}
function overdueDismissAll(){
  const todayKey=dk(new Date());
  tasks.filter(t=>
    t.scheduled&&t.date&&t.date<todayKey&&!t.done&&!t.recur&&
    (t.type||'task')!=='event'
  ).forEach(t=>{
    if(!t._smartRescheduleOffered)t._smartRescheduleOffered=[];
    if(!t._smartRescheduleOffered.includes(t.date))t._smartRescheduleOffered.push(t.date);
  });
  save();closeOverduePopup();
}
function overdueDismissToday(){
  _overdueDismissedToday=true;
  closeOverduePopup();
}
function fmtDateShort(dk2){
  const d=fromDk(dk2);
  return MONTHS_LONG[d.getMonth()]+' '+d.getDate();
}
// Check on app open (after splash)
const _origEnterApp=enterApp;
window.enterApp=function(){
  _origEnterApp();
  setTimeout(checkOverdueTasks,1500);
  showOnboarding();
  // renderGreeting is already called inside renderAll→renderDay; no need to call again
};


// ══ WEEKLY PLANNING MODE ═════════════════════════
function openWeekPlan(){
  const today=new Date();today.setHours(0,0,0,0);
  // Next week starting from user's preferred start day
  const dow=today.getDay();
  const diff=(dow-weekStartDay+7)%7;
  const thisWeekStart=addDays(today,-diff);
  const nextWeekStart=addDays(thisWeekStart,7);
  // If we're early in the week (first 2 days), plan this week; otherwise next
  const planStart=diff<=1?thisWeekStart:nextWeekStart;
  const days=Array.from({length:7},(_,i)=>addDays(planStart,i));

  document.getElementById('wpDateRange').textContent=
    MONTHS_S[days[0].getMonth()]+' '+days[0].getDate()+' – '+
    MONTHS_S[days[6].getMonth()]+' '+days[6].getDate()+', '+days[6].getFullYear();

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
    routine.forEach(b=>{
      const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
      content+=`<div class="wp-routine">${fmtT(b.start)}–${fmtT(b.end)} ${esc(b.customName||rt.label)}</div>`;
    });
    if(dayTasks.length){
      dayTasks.slice(0,5).forEach(t=>{
        const isDone=t.done||(t.doneOverrides||[]).includes(t._instanceDate);
        content+=`<div class="wp-task-mini${isDone?' done':''}" style="border-left-color:${catColor(t.category)}">${t.time?fmtT(t.time)+' ':''}${esc(t.name)}</div>`;
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
  const diff=(dow-weekStartDay+7)%7;
  const thisWeekStart=addDays(today,-diff);
  const nextWeekStart=addDays(thisWeekStart,7);
  const planStart=diff<=1?thisWeekStart:nextWeekStart;
  const key='clarity_intention_'+dk(planStart);
  const val=document.getElementById('wpIntention').value.trim();
  if(val)localStorage.setItem(key,val);
  else localStorage.removeItem(key);
  closeWeekPlan();
  showToast(val?'Weekly intention saved':'Intention cleared');
}

// ══ WEEKLY WRAP-UP ══════════════════════════════
function openWrapup(){
  const today=new Date();today.setHours(0,0,0,0);
  // Calculate week range based on weekStartDay setting
  const dow=today.getDay();
  const diff=(dow-weekStartDay+7)%7;
  const weekEnd=today;
  const weekStart=addDays(today,-diff);
  
  document.getElementById('wrapupDateRange').textContent=
    MONTHS_S[weekStart.getMonth()]+' '+weekStart.getDate()+' – '+
    MONTHS_S[weekEnd.getMonth()]+' '+weekEnd.getDate()+', '+weekEnd.getFullYear();

  const weekTasks=expandedTasks(weekStart,weekEnd).filter(t=>(t.type||'task')==='task');
  const completed=weekTasks.filter(t=>t.done||(t.doneOverrides||[]).includes(t._instanceDate));
  const total=weekTasks.length;
  const doneCount=completed.length;

  const habitTasks=weekTasks.filter(t=>t.recur);
  const habitDone=habitTasks.filter(t=>t.done||(t.doneOverrides||[]).includes(t._instanceDate));
  const habitRate=habitTasks.length?Math.round(habitDone.length/habitTasks.length*100):0;

  const dayCounts={};
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  completed.forEach(t=>{
    if(t._instanceDate){
      const d=fromDk(t._instanceDate);
      dayCounts[dayNames[d.getDay()]]=(dayCounts[dayNames[d.getDay()]]||0)+1;
    }
  });
  let bestDay='—',bestCount=0;
  Object.entries(dayCounts).forEach(([d,c])=>{if(c>bestCount){bestDay=d;bestCount=c;}});

  // Bar chart — ordered by weekStartDay
  const orderedDays=orderedDayLabels();
  const maxDay=Math.max(1,...orderedDays.map(d=>dayCounts[d]||0));
  const barsHtml=orderedDays.map(d=>{
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
function toggleWrapupAuto(){
  const cur=localStorage.getItem('clarity_wrapup_auto')==='true';
  localStorage.setItem('clarity_wrapup_auto',cur?'false':'true');
  const toggle=document.getElementById('wrapupAutoToggle');
  if(toggle)toggle.classList.toggle('on',!cur);
}

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
  _aiBdSelected=new Set();
  renderAiBdChips();
  document.getElementById('aiScheduleOverlay').classList.add('open');
  setTimeout(()=>{
    const ta=document.getElementById('aiInput');
    if(!brainDump.length)ta.focus();
    autoExpand(ta);
  },150);
}

// ── AI Brain Dump chips ──
let _aiBdSelected=new Set();
function renderAiBdChips(){
  const wrap=document.getElementById('aiBdChipsWrap');
  const el=document.getElementById('aiBdChips');
  if(!wrap||!el)return;
  if(!brainDump.length){wrap.style.display='none';return;}
  wrap.style.display='';
  // Pre-select all by default
  if(!_aiBdSelected.size)brainDump.forEach(t=>_aiBdSelected.add(t.id));
  el.innerHTML=brainDump.map(t=>{
    const sel=_aiBdSelected.has(t.id);
    const cc=catColor(t.category);
    return`<button class="ai-bd-chip${sel?' selected':''}" style="${sel?`background:${cc};border-color:${cc};color:#fff`:`border-color:var(--border)`}" onclick="toggleAiBdChip('${t.id}')">
      ${sel?'✓ ':''}${esc(t.name)}${t.priority&&t.priority!=='none'?` · ${t.priority}`:''}
    </button>`;
  }).join('');
}
function toggleAiBdChip(id){
  if(_aiBdSelected.has(id))_aiBdSelected.delete(id);
  else _aiBdSelected.add(id);
  renderAiBdChips();
}

// ── AI Preference chips ──
function toggleAiPref(btn,group){
  // Make morning/afternoon mutually exclusive
  if(group==='morning'){
    document.getElementById('aiPrefAfternoon').classList.remove('on');
    btn.classList.toggle('on');
  } else if(group==='afternoon'){
    document.getElementById('aiPrefMorning').classList.remove('on');
    btn.classList.toggle('on');
  }
}

// Bullet point behavior for AI input
function closeAISchedule(){
  document.getElementById('aiScheduleOverlay').classList.remove('open');
}

async function generateAISchedule(){
  // Build input from BD chips + textarea
  const selectedBd=brainDump.filter(t=>_aiBdSelected.has(t.id));
  const bdText=selectedBd.map(t=>{
    let line=t.name;
    if(t.priority&&t.priority!=='none')line+=` (${t.priority} priority)`;
    if(t.category&&t.category!=='none'){const c=catById(t.category);if(c)line+=` [${c.name}]`;}
    if(t.notes)line+=` — ${t.notes}`;
    return line;
  }).join('\n');
  const extraInput=document.getElementById('aiInput').value.trim();
  const input=[bdText,extraInput].filter(Boolean).join('\n');
  if(!input){document.getElementById('aiInput').focus();return;}
  const dateVal=document.getElementById('aiDate').value;
  const startTime=document.getElementById('aiStartTime').value||'08:00';
  const d=fromDk(dateVal);
  const dayName=DLONG[d.getDay()];

  // Preferences
  const includeBreaks=document.getElementById('aiPrefBreaks').classList.contains('on');
  const prefMorning=document.getElementById('aiPrefMorning').classList.contains('on');
  const prefAfternoon=document.getElementById('aiPrefAfternoon').classList.contains('on');
  let prefStr='';
  if(includeBreaks)prefStr+='\n- Include 10-15 minute breaks between focused work blocks';
  if(prefMorning)prefStr+='\n- Front-load important/difficult tasks in the morning';
  if(prefAfternoon)prefStr+='\n- Schedule important/difficult tasks in the afternoon';

  // Get existing tasks for that day
  const existing=tasksOn(dateVal).filter(t=>t.time).map(t=>
    `${fmtT(t.time)} - ${esc(t.name)} (${durLabel(t.duration||30)})`
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

  const prompt=`You are Luclaro, an intelligent scheduling assistant. Plan the user's ${dayName}, ${dateVal}. Day starts at ${startTime}.${existingStr}${routineStr}

The user wants to schedule:
"${input}"

Rules:
- Schedule tasks INTO scheduling windows (match task category to window type when possible)
- Do NOT schedule over blocked time
- Don't overlap with existing tasks${prefStr}
- Put time-specific requests at the exact time asked ("at noon", "at 2pm")
- Estimate realistic durations: quick tasks ~15m, medium ~30-45m, deep work ~60-120m
- If the user specifies a duration, use it exactly
- If something is clearly an event (birthday, meeting, appointment, class, church, party), set type:"event"
- If it's a birthday or anniversary, set allday:true with recur/recurN:1/recurU:"year"
- If the user lists sub-items after a task (e.g. "study: geography, calculus" or "meeting prep — slides, handouts"), create a subtasks array with proportional durations
- For tasks over 60 minutes, break into subtasks with focused blocks and breaks
- Order by logical flow of the day

Respond with ONLY a JSON array, no markdown, no backticks:
[{"name":"Task","time":"HH:MM","duration":30,"priority":"medium","category":"work","type":"task","location":"","allday":false,"recur":false,"recurN":1,"recurU":"day","subtasks":[]}]
Subtask format: {"name":"Review notes","duration":25}`;

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
    preview.innerHTML=_aiTasks.map((t,i)=>{
      const isEvent=(t.type||'task')==='event';
      const subs=t.subtasks||[];
      let subsHtml=subs.length?`<div style="margin-left:26px;margin-top:3px">${subs.map(s=>`<div style="font-size:10px;color:var(--text3);padding-left:10px;border-left:2px solid var(--border)">↳ ${esc(s.name)}${s.duration?' · '+durLabel(s.duration):''}</div>`).join('')}</div>`:'';
      return`<div class="ai-preview-task" style="${isEvent?'border-left:3px solid var(--accent);background:var(--accent-pale)':''}">
        <span style="font-size:11px;font-weight:700;color:var(--text3);min-width:18px">${i+1}.</span>
        <span class="ai-preview-time">${fmtT(t.time)}</span>
        <span class="ai-preview-name">${esc(t.name)}${isEvent?' <span style="font-size:9px;background:var(--accent);color:#fff;padding:1px 5px;border-radius:3px;font-weight:600">EVENT</span>':''}</span>
        <span class="ai-preview-dur">${durLabel(t.duration||30)}</span>
      </div>${subsHtml}`;
    }).join('');
    document.getElementById('aiPreviewWrap').style.display='';
    document.getElementById('aiGenBtn').style.display='';
    document.getElementById('aiGenLabel').textContent='Regenerate';
    document.getElementById('aiAcceptBtn').style.display='';
  }catch(err){
    const isFetchErr=err.message&&(err.message.includes('fetch')||err.message.includes('network')||err.message.includes('Failed'));
    if(isFetchErr){
      document.getElementById('aiError').textContent='AI planning requires the Anthropic API. If you\'re using Luclaro standalone, set up a Supabase Edge Function to proxy the API — or use this feature inside claude.ai.';
    } else {
      document.getElementById('aiError').textContent='Something went wrong — try again. '+err.message;
    }
    document.getElementById('aiError').style.display='';
  }
  document.getElementById('aiGenLabel').style.display='';
  document.getElementById('aiSpinner').style.display='none';
}

function acceptAISchedule(){
  const dateVal=document.getElementById('aiDate').value;
  _aiTasks.forEach(t=>{
    const subs=(t.subtasks||[]).map(s=>({id:genId(),name:s.name,duration:s.duration||0,done:false}));
    const isAllday=!!(t.allday);
    tasks.push({
      id:genId(),
      name:t.name,
      type:t.type||'task',
      date:dateVal,
      time:isAllday?null:t.time,
      allday:isAllday,
      duration:t.duration||30,
      priority:t.priority||'none',
      category:t.category||'none',
      location:t.location||'',
      attachments:[],
      notes:'',
      subtasks:subs,
      scheduled:true,
      done:false,
      recur:!!(t.recur),recurN:t.recurN||1,recurU:t.recurU||'day',recurDays:[],
      doneOverrides:[],deletedOccurrences:[],
      multiDay:false,endDate:'',eventColor:'',suppressRoutines:false
    });
  });
  // Remove accepted Brain Dump items
  if(_aiBdSelected.size){
    brainDump=brainDump.filter(t=>!_aiBdSelected.has(t.id));
    _aiBdSelected.clear();
  }
  save();closeAISchedule();
  selDate=fromDk(dateVal);
  switchView('day');
  renderAll();
  const evtCount=_aiTasks.filter(t=>(t.type||'task')==='event').length;
  const taskCount=_aiTasks.length-evtCount;
  let msg=[];
  if(taskCount)msg.push(`${taskCount} task${taskCount!==1?'s':''}`);
  if(evtCount)msg.push(`${evtCount} event${evtCount!==1?'s':''}`);
  showToast(msg.join(' and ')+' added to your schedule');
  _aiTasks=[];
}

// ══ INLINE RENAME (dbl-click in categories) ════
function inlineRename(el,id,isBd){
  const orig=el.textContent;
  const input=document.createElement('input');
  input.value=orig;
  input.style.cssText='width:100%;padding:2px 6px;border:1.5px solid var(--accent);border-radius:5px;font-family:inherit;font-size:12px;font-weight:500;color:var(--text);background:var(--surface2);outline:none;box-shadow:0 0 0 3px rgba(var(--accent-rgb),.12)';
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
  const raw=document.getElementById('bdInput').value.trim();if(!raw)return;
  // Parse bullet points into separate items
  const lines=raw.split('\n').map(l=>l.replace(/^[•\-\*]\s*/,'').trim()).filter(Boolean);
  const remaining=30-brainDump.length;
  if(remaining<=0){showToast('Brain Dump is full (max 30) — schedule or remove some items');return;}
  const toAdd=lines.slice(0,remaining);
  if(toAdd.length<lines.length)showToast(`Added ${toAdd.length} of ${lines.length} items (max 30)`);
  toAdd.forEach(name=>{
    brainDump.push({id:genId(),name,priority:'none',category:'none'});
  });
  const ta=document.getElementById('bdInput');
  ta.value='';
  ta.style.height='';
  save();renderBD();if(activeSide==='priority')renderPri();
}
function bdAutoFocus(el){
  autoExpand(el);
  if(!el.value.trim())el.value='• ';
}
document.getElementById('bdInput').addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();addBD();return;}
  if(e.key==='Enter'){
    e.preventDefault();
    const ta=e.target,pos=ta.selectionStart;
    const before=ta.value.slice(0,pos),after=ta.value.slice(ta.selectionEnd);
    const lastLine=before.split('\n').pop();
    if(lastLine.trim()==='•'){
      const lineStart=before.lastIndexOf('\n')+1;
      ta.value=before.slice(0,lineStart)+after;
      ta.selectionStart=ta.selectionEnd=lineStart;
    } else {
      ta.value=before+'\n• '+after;
      ta.selectionStart=ta.selectionEnd=pos+3;
    }
    autoExpand(ta);
  }
});

// ══ QUICK EVENT ADD ════════════════════════════
function parseQuickEvent(raw){
  let text=raw.trim();if(!text)return null;
  let time=null,date=null,location=null,allday=false;

  // 1. Extract time FIRST (before "at" parsing to avoid "at 2pm" confusion)
  const timeRe=/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|AM|PM)\b/;
  const tm=text.match(timeRe);
  if(tm){
    let h=parseInt(tm[1]),m=parseInt(tm[2]||'0');
    const ampm=tm[3].toLowerCase();
    if(ampm==='pm'&&h<12)h+=12;if(ampm==='am'&&h===12)h=0;
    time=pad(h)+':'+pad(m);text=text.replace(tm[0],'').trim();
  } else {const tm2=text.match(/\b(\d{1,2}):(\d{2})\b/);if(tm2){time=pad(parseInt(tm2[1]))+':'+pad(parseInt(tm2[2]));text=text.replace(tm2[0],'').trim();}}

  // 2. Check "all day"
  if(/\ball\s*day\b/i.test(text)){allday=true;text=text.replace(/\ball\s*day\b/i,'').trim();}

  // 3. Extract numeric dates: 5/11, 05/11, 5/11/2026, 5-11, 5-11-2026
  const numDateRe=/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/;
  const nd=text.match(numDateRe);
  if(nd){
    const mo=parseInt(nd[1]),dy=parseInt(nd[2]);
    let yr=nd[3]?parseInt(nd[3]):null;
    if(yr&&yr<100)yr+=2000;
    if(mo>=1&&mo<=12&&dy>=1&&dy<=31){
      const today=new Date();today.setHours(0,0,0,0);
      if(!yr){yr=(mo<today.getMonth()+1||(mo===today.getMonth()+1&&dy<today.getDate()))?today.getFullYear()+1:today.getFullYear();}
      date=`${yr}-${pad(mo)}-${pad(dy)}`;
      text=text.replace(nd[0],'').trim();
    }
  }

  // 4. Extract named dates: today, tomorrow, day names, month names
  const today=new Date();today.setHours(0,0,0,0);
  if(!date){
    const dayNames=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const dayNamesS=['sun','mon','tue','wed','thu','fri','sat'];
    const monthNames=['january','february','march','april','may','june','july','august','september','october','november','december'];
    const monthNamesS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    if(/\btoday\b/i.test(text)){date=dk(today);text=text.replace(/\btoday\b/i,'').trim();}
    else if(/\btomorrow\b/i.test(text)){date=dk(addDays(today,1));text=text.replace(/\btomorrow\b/i,'').trim();}
    else{for(let i=0;i<7;i++){const re=new RegExp('\\b('+dayNames[i]+'|'+dayNamesS[i]+')\\b','i');const dm=text.match(re);if(dm){let diff=i-today.getDay();if(diff<=0)diff+=7;date=dk(addDays(today,diff));text=text.replace(dm[0],'').trim();break;}}}
    if(!date){for(let mi=0;mi<12;mi++){const re=new RegExp('\\b('+monthNames[mi]+'|'+monthNamesS[mi]+')\\s+(\\d{1,2})\\b','i');const mm=text.match(re);if(mm){const dayNum=parseInt(mm[2]);const yr2=mi<today.getMonth()||(mi===today.getMonth()&&dayNum<today.getDate())?today.getFullYear()+1:today.getFullYear();date=`${yr2}-${pad(mi+1)}-${pad(dayNum)}`;text=text.replace(mm[0],'').trim();break;}}}
  }

  // 5. Extract "at <location>" — only if content after "at" contains a letter (not a date/number)
  const atMatch=text.match(/\s+at\s+((?=.*[a-zA-Z]).+)$/i);
  if(atMatch){location=atMatch[1].trim();text=text.slice(0,atMatch.index).trim();}

  // 6. Defaults
  if(!date)date=dk(today);
  if(!time&&!allday)time='09:00';

  // 7. Clean up name — strip trailing prepositions, extra whitespace
  const name=text.replace(/\s+(at|on|in)$/i,'').replace(/\s+/g,' ').replace(/^[\-,·]\s*/,'').replace(/\s*[\-,·]$/,'').trim();
  if(!name)return null;
  return{name,date,time:allday?null:time,allday,location};
}
let _lastQeId=null;
function addQuickEvent(){
  const input=document.getElementById('qeInput');if(!input)return;
  const raw=input.value.trim();if(!raw)return;
  const parsed=parseQuickEvent(raw);
  if(!parsed){showToast('Could not parse — try "Dinner Friday 7pm"');return;}
  const newId=genId();
  _lastQeId=newId;
  tasks.push({id:newId,name:parsed.name,type:'event',priority:'none',category:'none',notes:'',date:parsed.date,time:parsed.time,allday:parsed.allday,duration:60,scheduled:true,done:false,location:parsed.location||'',recur:false,recurN:1,recurU:'day',recurDays:[],subtasks:[],attachments:[],doneOverrides:[],deletedOccurrences:[],multiDay:false,endDate:'',eventColor:'',suppressRoutines:false});
  input.value='';save();renderAll();
  // Show confirmation card
  const d=fromDk(parsed.date);
  const dateStr=DLONG[d.getDay()]+', '+MONTHS_S[d.getMonth()]+' '+d.getDate();
  const timeStr=parsed.allday?'All Day':fmtT(parsed.time);
  const locStr=parsed.location?` · ${esc(parsed.location)}`:'';
  const el=document.getElementById('qeConfirm');
  if(el){
    el.innerHTML=`<div class="qe-confirm-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 8.5l3 3 5-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="qe-confirm-body">
        <div class="qe-confirm-title">${esc(parsed.name)}</div>
        <div class="qe-confirm-detail">${dateStr} · ${timeStr}${locStr}</div>
        <div class="qe-confirm-actions">
          <button class="qe-confirm-btn qe-edit" onclick="openQeEdit()">Edit details</button>
          <button class="qe-confirm-btn qe-done" onclick="dismissQeConfirm()">Done</button>
        </div>
      </div>`;
    el.style.display='flex';
  }
}
function dismissQeConfirm(){
  const el=document.getElementById('qeConfirm');
  if(el){el.style.display='none';el.innerHTML='';}
}
function openQeEdit(){
  dismissQeConfirm();
  if(!_lastQeId)return;
  const t=tasks.find(t=>t.id===_lastQeId);if(!t)return;
  const fakeEvent={stopPropagation:()=>{}};
  openEdit(_lastQeId,t.date,fakeEvent);
}

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
      <div class="bd-name">${esc(t.name)}</div>
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
        <div style="flex:1;min-width:0"><div class="pri-name">${esc(t.name)}</div>
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
function _setDragActive(on){
  const tl=document.getElementById('dayTimeline');if(tl)tl.classList.toggle('drag-active',on);
  const wg=document.getElementById('weekGrid');if(wg)wg.classList.toggle('drag-active',on);
  if(on){
    // Defer: let browser initiate the drag first, then disable non-dragged blocks
    setTimeout(()=>{
      document.querySelectorAll('.day-task-block,.wk-task-block').forEach(el=>{
        if(!el.closest('.dragging-task')&&!el.classList.contains('dragging-task')){
          el.style.pointerEvents='none';
        }
      });
    },50);
  } else {
    // Restore all pointer-events
    document.querySelectorAll('.day-task-block,.wk-task-block').forEach(el=>{
      el.style.pointerEvents='all';
    });
  }
}
function onBDS(e,id){dragBdId=id;dragTaskId=null;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','bd:'+id);setTimeout(()=>e.target.classList.add('dragging'),0);_setDragActive(true)}
function onBDE(e){e.target.classList.remove('dragging');dragBdId=null;_setDragActive(false)}
function onTaskDragStart(e,id,idate){
  dragTaskId=id;dragInstanceDate=idate;dragBdId=null;
  e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','task:'+id);
  setTimeout(()=>{const el=e.target.closest('.day-task,.slot-task,.m-chip,.cat-task-row,.cat-habit-row,.wk-task-block,.day-task-block');if(el)el.classList.add('dragging-task');},0);
  e.stopPropagation();_setDragActive(true);
}
function onTaskDragEnd(){document.querySelectorAll('.dragging-task').forEach(el=>el.classList.remove('dragging-task'));dragTaskId=null;dragInstanceDate=null;_setDragActive(false)}
function onDO(e){if(!dragBdId&&!dragTaskId)return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect='move';e.currentTarget.classList.add('drag-over')}
function onDL(e){e.currentTarget.classList.remove('drag-over')}
function snapFlash(el){if(!el)return;el.classList.remove('snap-flash');void el.offsetWidth;el.classList.add('snap-flash');setTimeout(()=>el.classList.remove('snap-flash'),600)}
// ══ SLOT VALIDATION ══════════════════════════
const MAX_TASKS_PER_SLOT = 3;

function tasksInSlot(dateKey, time){
  // All non-done tasks scheduled at this exact date+time
  return tasks.filter(t=>t.scheduled&&t.date===dateKey&&t.time===time&&!t.done);
}

// Count all tasks that overlap a given time range on a date (duration-aware)
function countOverlappingAt(dateKey, checkMins, excludeId){
  const dayTasks=tasks.filter(t=>t.scheduled&&t.date===dateKey&&t.time&&!t.done&&!t.allday&&t.id!==excludeId);
  let count=0;
  dayTasks.forEach(t=>{
    const[h,m]=t.time.split(':').map(Number);
    const tStart=h*60+m;
    const tEnd=tStart+(t.duration||30);
    if(checkMins>=tStart&&checkMins<tEnd)count++;
  });
  return count;
}

// Check if extending a task would overflow any slot in its new range
function checkDurationOverflow(taskId, dateKey, startTime, newDur){
  const[h,m]=startTime.split(':').map(Number);
  const startMins=h*60+m;
  const endMins=startMins+newDur;
  // Check every 30-min slot the task would now occupy
  for(let mm=startMins;mm<endMins;mm+=30){
    const count=countOverlappingAt(dateKey,mm,taskId);
    if(count>=MAX_TASKS_PER_SLOT){
      const slotH=Math.floor(mm/60),slotM=mm%60;
      return{blocked:true,slotTime:pad(slotH)+':'+pad(slotM),count:count};
    }
  }
  return{blocked:false};
}

// Check if extending would push into a blocked routine
function checkRoutineOverflow(dateKey, startTime, newDur){
  const[h,m]=startTime.split(':').map(Number);
  const startMins=h*60+m;
  const endMins=startMins+newDur;
  const routines=getRoutineForDay(dateKey);
  for(const b of routines){
    const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
    const isSchedulable=b.schedulable!==undefined?b.schedulable:rt.schedulable;
    if(isSchedulable)continue;
    const[bh,bm]=b.start.split(':').map(Number);
    const[eh,em]=b.end.split(':').map(Number);
    const bStart=bh*60+bm;
    const bEnd=eh*60+em;
    // Task extends into blocked routine
    if(startMins<bStart&&endMins>bStart){
      return{blocked:true,routineName:b.customName||rt.label,routineStart:b.start};
    }
    // Task starts inside blocked routine
    if(startMins>=bStart&&startMins<bEnd){
      return{blocked:true,routineName:b.customName||rt.label,routineStart:b.start};
    }
  }
  return{blocked:false};
}

// Check if a specific time slot falls inside a blocked routine
function isBlockedByRoutine(dateKey, time){
  const[h,m]=time.split(':').map(Number);
  const mins=h*60+m;
  const routines=getRoutineForDay(dateKey);
  for(const b of routines){
    const rt=ROUTINE_TYPES[b.type]||ROUTINE_TYPES.custom;
    const isSchedulable=b.schedulable!==undefined?b.schedulable:rt.schedulable;
    if(isSchedulable)continue;
    const[bh,bm]=b.start.split(':').map(Number);
    const[eh,em]=b.end.split(':').map(Number);
    const bStart=bh*60+bm;
    const bEnd=eh*60+em;
    if(mins>=bStart&&mins<bEnd){
      return{blocked:true,routineName:b.customName||rt.label,routineStart:b.start,routineEnd:b.end};
    }
  }
  return{blocked:false};
}

function slotFull(dateKey, time, excludeId){
  // Check both exact start count AND duration-aware overlap count
  const exactCount=tasksInSlot(dateKey,time).filter(t=>t.id!==excludeId).length;
  const[h,m]=time.split(':').map(Number);
  const overlapCount=countOverlappingAt(dateKey,h*60+m,excludeId);
  return Math.max(exactCount,overlapCount)>=MAX_TASKS_PER_SLOT;
}

function duplicateInSlot(dateKey, time, taskName, excludeId){
  return tasksInSlot(dateKey,time).some(t=>
    t.id!==excludeId &&
    t.name.toLowerCase().trim()===taskName.toLowerCase().trim()
  );
}

function showWarnToast(msg,persist){
  let el=document.getElementById('slotWarnToast');
  if(!el){el=document.createElement('div');el.id='slotWarnToast';el.className='slot-warn-toast';document.body.appendChild(el);}
  clearTimeout(el._t);
  if(persist){
    el.innerHTML=`<span class="warn-toast-msg">${msg}</span><button class="warn-toast-x" onclick="dismissWarnToast()" title="Dismiss">&times;</button>`;
    el.classList.add('show','persistent');
  } else {
    el.innerHTML=`<span class="warn-toast-msg">${msg}</span>`;
    el.classList.remove('persistent');el.classList.add('show');
    el._t=setTimeout(()=>el.classList.remove('show'),2800);
  }
}
function dismissWarnToast(){const el=document.getElementById('slotWarnToast');if(el)el.classList.remove('show','persistent');}

// ══ RECUR RESCHEDULE DIALOG ═══════════════════
let _rrTaskId=null,_rrInstanceDate=null,_rrNewDate=null,_rrNewTime=null;

function openRecurReschedule(taskId,instanceDate,newDate,newTime){
  _rrTaskId=taskId;_rrInstanceDate=instanceDate;
  _rrNewDate=newDate;_rrNewTime=newTime;
  const t=tasks.find(t=>t.id===taskId);if(!t)return;
  const sub=`"${esc(t.name)}" · ${recurLbl(t)}`;
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
      showWarnToast(`"${esc(t.name)}" is already in that slot`);dragBdId=null;return;
    }
    if(slotFull(dateKey,defaultTime,null)){
      showWarnToast('That slot already has 3 tasks — pick a different time');dragBdId=null;return;
    }
    tasks.push({...t,type:'task',date:dateKey,time:defaultTime,allday:false,duration:30,scheduled:true,done:false,recur:false,recurN:1,recurU:'day',recurDays:[],attachments:[],location:'',doneOverrides:[],deletedOccurrences:[],multiDay:false,endDate:'',eventColor:'',suppressRoutines:false});
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
    // Check blocked routine
    const rBlock=isBlockedByRoutine(dateKey,time);
    if(rBlock.blocked){
      showWarnToast(`Can't drop here — blocked by ${rBlock.routineName} (${fmtT(rBlock.routineStart)} – ${fmtT(rBlock.routineEnd)})`);
      dragBdId=null;return;
    }
    if(duplicateInSlot(dateKey,time,t.name,null)){
      showWarnToast(`"${esc(t.name)}" is already in that slot`);dragBdId=null;return;
    }
    if(slotFull(dateKey,time,null)){
      showWarnToast('That slot already has 3 tasks — pick a different time');dragBdId=null;return;
    }
    tasks.push({...t,type:'task',date:dateKey,time,allday:false,duration:30,scheduled:true,done:false,recur:false,recurN:1,recurU:'day',recurDays:[],attachments:[],location:'',doneOverrides:[],deletedOccurrences:[],multiDay:false,endDate:'',eventColor:'',suppressRoutines:false});
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
    // Check blocked routine
    const rBlock=isBlockedByRoutine(resolvedDate,resolvedTime);
    if(rBlock.blocked){
      showWarnToast(`Can't move here — blocked by ${rBlock.routineName} (${fmtT(rBlock.routineStart)} – ${fmtT(rBlock.routineEnd)})`);
      renderAll();return;
    }
    if(duplicateInSlot(resolvedDate,resolvedTime,t.name,t.id)){
      showWarnToast(`"${esc(t.name)}" is already in that slot`);
      renderAll();return;
    }
    if(slotFull(resolvedDate,resolvedTime,t.id)){
      showWarnToast('That slot already has 3 tasks — pick a different time');
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
    if(el.closest('.task-check'))return null;
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
  e.stopPropagation();if(AC&&AC.state==='suspended')AC.resume();
  const t=tasks.find(t=>t.id===id);if(!t)return;
  if((t.type||'task')==='event')return; // events can't be checked off
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

let _adjustDurLock=false;
function adjustDuration(id,idate,delta,e){
  if(e){e.stopPropagation();e.preventDefault();}
  if(_adjustDurLock)return;
  _adjustDurLock=true;
  const t=tasks.find(t=>t.id===id);if(!t){_adjustDurLock=false;return;}
  const newDur=Math.max(15,Math.min(720,(t.duration||30)+delta));
  if(newDur===(t.duration||30)){_adjustDurLock=false;return;}
  // Only check overflow on INCREASE (shrinking is always safe)
  if(delta>0&&t.time&&t.date){
    // Check if extending pushes into a full slot
    const overflow=checkDurationOverflow(t.id,idate||t.date,t.time,newDur);
    if(overflow.blocked){
      showWarnToast(`Can't extend — ${overflow.count} tasks already at ${fmtT(overflow.slotTime)}`,false);
      _adjustDurLock=false;
      setTimeout(()=>{_adjustDurLock=false;},150);
      return;
    }
    // Check if extending pushes into a blocked routine
    const routineCheck=checkRoutineOverflow(idate||t.date,t.time,newDur);
    if(routineCheck.blocked){
      showWarnToast(`Extending would run into ${routineCheck.routineName} (${fmtT(routineCheck.routineStart)})`,false);
      // Allow it but warn — don't block
    }
  }
  t.duration=newDur;
  save();
  // Targeted update: find this task's dur label in DOM and update it without full re-render
  const block=document.querySelector(`.day-task-block[data-id="${id}"],.wk-task-block[data-id="${id}"]`);
  if(block){
    const durPill=block.querySelector('.day-task-dur-pill,.wk-task-block-dur');
    if(durPill)durPill.textContent=durLabel(newDur);
  }
  // Defer full re-render to avoid click race
  requestAnimationFrame(()=>{
    renderAll();
    setTimeout(()=>{_adjustDurLock=false;},150);
  });
}

let _selDur=30;

// Duration spinner for task modal
function setDurSpinner(totalMin){
  _selDur=totalMin||30;
  const hr=Math.floor(_selDur/60);
  const mn=_selDur%60;
  const hrEl=document.getElementById('fDurHr');
  const mnEl=document.getElementById('fDurMin');
  if(hrEl)hrEl.value=hr;
  if(mnEl)mnEl.value=mn;
  syncEndTimeFromDur();
}
function onDurSpinnerChange(){
  const hr=parseInt(document.getElementById('fDurHr').value)||0;
  let mn=parseInt(document.getElementById('fDurMin').value)||0;
  mn=Math.round(mn/15)*15;
  if(mn>=60){mn=45;}
  document.getElementById('fDurMin').value=mn;
  _selDur=Math.min(720,hr*60+mn); // cap at 12 hours
  if(_selDur<15)_selDur=15;
  if(hr>12){document.getElementById('fDurHr').value=12;_selDur=720;}
  syncEndTimeFromDur();
}

// ── Start / End time field sync ──
function syncEndTimeFromDur(){
  const startEl=document.getElementById('fStartTime');
  const endEl=document.getElementById('fEndTime');
  if(!startEl||!endEl||!startEl.value)return;
  const[sh,sm]=startEl.value.split(':').map(Number);
  const endMins=sh*60+sm+_selDur;
  endEl.value=pad(Math.floor(endMins/60)%24)+':'+pad(endMins%60);
}
function onStartTimeChange(){
  const startEl=document.getElementById('fStartTime');
  if(!startEl||!startEl.value)return;
  mTime=startEl.value;
  syncEndTimeFromDur();
}
function onEndTimeChange(){
  const startEl=document.getElementById('fStartTime');
  const endEl=document.getElementById('fEndTime');
  if(!startEl||!endEl||!startEl.value||!endEl.value)return;
  const[sh,sm]=startEl.value.split(':').map(Number);
  const[eh,em]=endEl.value.split(':').map(Number);
  let diff=(eh*60+em)-(sh*60+sm);
  if(diff<=0)diff+=1440; // overnight
  diff=Math.min(720,Math.max(15,diff));
  _selDur=diff;
  setDurSpinner(_selDur);
}
function durToMin(lbl){
  // parse "1h 30m" or "45m" or "2h" back to minutes (for internal use)
  const mH=lbl.match(/(\d+)h/),mM=lbl.match(/(\d+)m/);
  return (mH?parseInt(mH[1])*60:0)+(mM?parseInt(mM[1]):0)||30;
}

let mMode=null,mDate=null,mTime=null,mId=null,mInstanceDate=null;
let _editOrigSubtasks=[];  // snapshot taken at openEdit; restored on cancel
let _modalCommitted=false; // set true by saveTask so closeModal knows not to restore
function toggleRecurUI(){
  const on=document.getElementById('fRecurOn').checked;
  document.getElementById('recurOpts').style.display=on?'flex':'none';
  onRecurUnitChange();
}
function onRecurUnitChange(){
  const on=document.getElementById('fRecurOn').checked;
  const unit=document.getElementById('fRecurU').value;
  const row=document.getElementById('recurDaysRow');
  if(row)row.style.display=(on&&unit==='week')?'flex':'none';
}
function toggleRecurDay(btn,d){
  btn.classList.toggle('on');
  // Ensure at least one day is selected
  const allBtns=document.querySelectorAll('#recurDaysBtns .recur-day-btn');
  const anyOn=[...allBtns].some(b=>b.classList.contains('on'));
  if(!anyOn)btn.classList.add('on');
}
function getRecurDays(){
  const btns=document.querySelectorAll('#recurDaysBtns .recur-day-btn');
  const days=[];btns.forEach((b,i)=>{if(b.classList.contains('on'))days.push(i);});
  return days;
}
function setRecurDays(days){
  const btns=document.querySelectorAll('#recurDaysBtns .recur-day-btn');
  btns.forEach((b,i)=>b.classList.toggle('on',days.includes(i)));
}
// ══ ITEM TYPE (task vs event) ════════════════════
let _itemType='task';
let _modalSubtasks=[];
let _modalAttachments=[];

function setItemType(type){
  _itemType=type;
  document.getElementById('typeBtnTask').classList.toggle('active',type==='task');
  document.getElementById('typeBtnEvent').classList.toggle('active',type==='event');
  document.getElementById('fNameLabel').textContent=type==='event'?'Event':'Task';
  document.getElementById('fName').placeholder=type==='event'?'What\'s happening?':'What needs to get done?';
  document.getElementById('fLocationWrap').style.display=type==='event'?'':'none';
  document.getElementById('fAlldayWrap').style.display=type==='event'?'':'none';
  document.getElementById('fPriRow').style.display=type==='event'?'none':'';
  document.getElementById('fRecurLabel').textContent=type==='event'?'event':'task';
  document.getElementById('mTitle').textContent=mMode==='edit'?'Edit '+(type==='event'?'Event':'Task'):'New '+(type==='event'?'Event':'Task');
  // When switching away from event, clear all-day
  if(type!=='event')setAlldayModal(false);
  // Update done checkbox visibility
  updateModalDoneCheck();
}

let _modalAllday=false;
let _modalMultiDay=false;
let _modalEventColor='';
let _modalSuppressRoutines=false;
const EVENT_COLORS=['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899'];

function setAlldayModal(val){
  _modalAllday=val;
  const tog=document.getElementById('fAlldayToggle');
  if(tog)tog.classList.toggle('on',val);
  // Hide duration when all-day
  const durWrap=document.querySelector('.dur-spinner-row')?.closest('.fg');
  if(durWrap)durWrap.style.display=val?'none':'';
  // Show/hide multi-day toggle
  const mdWrap=document.getElementById('fMultiDayWrap');
  if(mdWrap)mdWrap.style.display=val?'':'none';
  // Show/hide suppress routines toggle
  const supWrap=document.getElementById('fSuppressWrap');
  if(supWrap)supWrap.style.display=val?'':'none';
  if(!val){setMultiDayModal(false);setSuppressModal(false);}
  // Update modal subtitle — remove time when all-day
  const subEl=document.getElementById('mSub');
  if(subEl&&mDate){
    const d=fromDk(mDate);
    const timeStr=(!val&&mTime)?' · '+fmtT(mTime):'';
    subEl.textContent=DLONG[d.getDay()]+', '+MONTHS_LONG[d.getMonth()]+' '+d.getDate()+timeStr;
  }
}
function toggleAlldayModal(){setAlldayModal(!_modalAllday);}

function setMultiDayModal(val){
  _modalMultiDay=val;
  const tog=document.getElementById('fMultiDayToggle');
  if(tog)tog.classList.toggle('on',val);
  const datesRow=document.getElementById('fMultiDayDates');
  const colorWrap=document.getElementById('fEventColorWrap');
  if(datesRow)datesRow.style.display=val?'':'none';
  if(colorWrap)colorWrap.style.display=val?'':'none';
  if(val){
    // Default start to current mDate, end to mDate+1
    const startEl=document.getElementById('fMultiStart');
    const endEl=document.getElementById('fMultiEnd');
    if(startEl&&!startEl.value)startEl.value=mDate||dk(new Date());
    if(endEl&&!endEl.value){
      const d=fromDk(mDate||dk(new Date()));d.setDate(d.getDate()+1);
      endEl.value=dk(d);
    }
    renderEventColorPicker();
  }
}
function toggleMultiDayModal(){setMultiDayModal(!_modalMultiDay);}

function renderEventColorPicker(){
  const row=document.getElementById('fEventColorRow');if(!row)return;
  row.innerHTML=EVENT_COLORS.map(c=>`<button class="event-color-swatch${_modalEventColor===c?' on':''}" style="background:${c}" onclick="pickEventColor('${c}')"></button>`).join('');
}
function pickEventColor(c){_modalEventColor=c;renderEventColorPicker();}

function setSuppressModal(val){
  _modalSuppressRoutines=val;
  const tog=document.getElementById('fSuppressToggle');
  if(tog)tog.classList.toggle('on',val);
}
function toggleSuppressModal(){setSuppressModal(!_modalSuppressRoutines);}

// ══ MODAL DETAIL TABS ═══════════════════════════
let _activeDetailTab='notes';
function switchDetailTab(tab){
  _activeDetailTab=tab;
  document.querySelectorAll('.modal-dtab').forEach(el=>el.classList.remove('active'));
  document.querySelectorAll('.modal-dpanel').forEach(el=>el.classList.remove('active'));
  const tabMap={notes:0,attach:1,subtasks:2};
  document.querySelectorAll('.modal-dtab')[tabMap[tab]].classList.add('active');
  document.getElementById('dpanel'+{notes:'Notes',attach:'Attach',subtasks:'Subtasks'}[tab]).classList.add('active');
}
function updateDetailBadges(){
  const notesDot=document.getElementById('dtabDotNotes');
  const attachBadge=document.getElementById('dtabBadgeAttach');
  const subsBadge=document.getElementById('dtabBadgeSubs');
  const hasNotes=document.getElementById('fNotes').value.trim().length>0;
  const attachCount=_modalAttachments.length;
  const subsCount=_modalSubtasks.length;
  if(notesDot){notesDot.classList.toggle('visible',hasNotes);}
  if(attachBadge){attachBadge.classList.toggle('visible',attachCount>0);attachBadge.textContent=attachCount;}
  if(subsBadge){subsBadge.classList.toggle('visible',subsCount>0);subsBadge.textContent=subsCount;}
}
function setQaType(type){
  _qaType=type;
  document.getElementById('qaTypeBtnTask').classList.toggle('active',type==='task');
  document.getElementById('qaTypeBtnEvent').classList.toggle('active',type==='event');
  document.getElementById('qaName').placeholder=type==='event'?'Event name…':'Task name…';
}

// ══ SUBTASK MANAGEMENT ══════════════════════════
function renderModalSubtasks(){
  const list=document.getElementById('fSubtaskList');
  if(!_modalSubtasks.length){list.innerHTML='';updateDetailBadges();return;}
  list.innerHTML=_modalSubtasks.map((s,i)=>`
    <div class="subtask-item">
      <div class="subtask-check${s.done?' checked':''}" onclick="toggleSubtaskInModal(${i})"></div>
      <span class="subtask-name${s.done?' done':''}" contenteditable="true" spellcheck="false" onblur="saveSubtaskNameInModal(${i},this)" onkeydown="onModalSubtaskKey(event,${i},this)">${esc(s.name)}</span>
      ${s.duration?`<span class="subtask-dur">${durLabel(s.duration)}</span>`:''}
      ${s.duration&&!s.done&&mId?`<button class="subtask-focus-btn" onclick="event.stopPropagation();startSubtaskFocus(${i})" title="Focus on this subtask">▶</button>`:''}
      <button class="subtask-del" onclick="deleteSubtaskFromModal(${i})">✕</button>
    </div>
  `).join('');
  updateDetailBadges();
}
function addSubtaskFromModal(){
  if(_modalSubtasks.length>=20){showToast('Maximum 20 subtasks per task');return;}
  const input=document.getElementById('fSubtaskInput');
  const name=input.value.trim();if(!name)return;
  _modalSubtasks.push({id:genId(),name,duration:0,done:false});
  input.value='';
  renderModalSubtasks();
  input.focus();
  _livePreviewSubtasks();
}
function deleteSubtaskFromModal(i){
  _modalSubtasks.splice(i,1);
  renderModalSubtasks();
  _livePreviewSubtasks();
}

// Pushes the current modal subtask list into the in-memory task object
// and re-renders the Day view block so the user sees it expanding in real-time.
// Does NOT call save() — that only happens when the user clicks Save.
function _livePreviewSubtasks(){
  if(mMode!=='edit'||!mId||curView!=='day')return;
  const t=tasks.find(t=>t.id===mId);
  if(!t)return;
  // Write a live snapshot (non-persisted) so renderDay picks up the subtasks
  t.subtasks=JSON.parse(JSON.stringify(_modalSubtasks));
  renderDay();
}
function saveSubtaskNameInModal(i,el){
  const name=el.textContent.trim();
  if(!name){
    _modalSubtasks.splice(i,1);
    renderModalSubtasks();
  } else {
    _modalSubtasks[i].name=name;
  }
}
function onModalSubtaskKey(e,i,el){
  if(e.key==='Enter'){
    e.preventDefault();
    saveSubtaskNameInModal(i,el);
    _modalSubtasks.splice(i+1,0,{id:genId(),name:'',duration:0,done:false});
    renderModalSubtasks();
    _livePreviewSubtasks();
    setTimeout(()=>{
      const names=document.querySelectorAll('#fSubtaskList .subtask-name');
      const target=names[i+1];
      if(target){target.focus();placeCaretAtEnd(target);}
    },50);
  } else if(e.key==='Escape'){
    el.blur();
  }
}
function toggleSubtaskInModal(i){
  _modalSubtasks[i].done=!_modalSubtasks[i].done;
  renderModalSubtasks();
  // Auto-save subtask state to task (so closing without Save doesn't lose checkbox changes)
  if(mMode==='edit'&&mId){
    const t=tasks.find(t=>t.id===mId);
    if(t){t.subtasks=JSON.parse(JSON.stringify(_modalSubtasks));save();renderAll();}
  }
}
function startSubtaskFocus(idx){
  if(!mId)return;
  const sub=_modalSubtasks[idx];if(!sub)return;
  // Save subtasks first
  const t=tasks.find(t=>t.id===mId);
  if(t)t.subtasks=JSON.parse(JSON.stringify(_modalSubtasks));
  save();
  closeModal();
  // Start focus with subtask duration
  startFocusForTask(mId,mInstanceDate);
  if(sub.duration){
    _focusDur=sub.duration;_focusRemaining=sub.duration*60;_focusTotal=sub.duration*60;
    _focusMode='custom';
    updateFocusModeUI();
    updateFocusDisplay();
  }
  // Update overlay with subtask name
  const nameEl=document.getElementById('foTaskName');
  if(nameEl)nameEl.textContent=sub.name;
  const metaEl=document.getElementById('foTaskMeta');
  if(metaEl)metaEl.textContent='Subtask of: '+(t?t.name:'');
}
async function generateSubtasks(){
  const taskName=document.getElementById('fName').value.trim();
  const dur=_selDur||30;
  if(!taskName){showToast('Enter a task name first');return;}
  const btn=document.querySelector('.subtask-gen-btn-full');
  btn.textContent='⏳ Generating…';btn.style.pointerEvents='none';
  try{
    const prompt=`The user has a task called "${taskName}" with ${dur} minutes total. Break it into focused subtasks with realistic durations in minutes. Include short breaks if >60min. Respond with ONLY a JSON array: [{"name":"Subtask","duration":25}]`;
    const response=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,messages:[{role:"user",content:prompt}]})
    });
    const data=await response.json();
    const text=data.content.map(i=>i.text||'').join('');
    const clean=text.replace(/```json|```/g,'').trim();
    const subs=JSON.parse(clean);
    const remaining=20-_modalSubtasks.length;
    const toAdd=subs.slice(0,Math.max(0,remaining));
    if(toAdd.length<subs.length)showToast(`Added ${toAdd.length} of ${subs.length} (max 20 subtasks)`);
    toAdd.forEach(s=>_modalSubtasks.push({id:genId(),name:s.name,duration:s.duration||0,done:false}));
    renderModalSubtasks();
  }catch(err){
    showToast('AI generation unavailable — add subtasks manually using the + button');
  }
  btn.innerHTML='<svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="vertical-align:-1px"><path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5z" fill="currentColor"/></svg> Generate with AI';btn.style.pointerEvents='';
}

// ══ ATTACHMENT MANAGEMENT ═══════════════════════
function renderModalAttachments(){
  const list=document.getElementById('fAttachList');
  if(!_modalAttachments.length){list.innerHTML='';updateDetailBadges();return;}
  list.innerHTML=_modalAttachments.map((a,i)=>{
    const icon=a.type==='file'?IC_FILE:IC_LINK;
    const display=a.type==='link'?a.url.replace(/^https?:\/\//,'').slice(0,40):a.name;
    return`<div class="attach-item">
      <span class="attach-item-icon">${icon}</span>
      <a class="attach-item-name" href="${esc(a.url)}" target="_blank" onclick="event.stopPropagation()">${esc(display)}</a>
      <button class="attach-item-del" onclick="deleteAttachment(${i})">✕</button>
    </div>`;
  }).join('');
  updateDetailBadges();
}
function addAttachment(){
  const input=document.getElementById('fAttachInput');
  const url=input.value.trim();if(!url)return;
  _modalAttachments.push({type:'link',url,name:url.replace(/^https?:\/\//,'').slice(0,50)});
  input.value='';
  renderModalAttachments();
  input.focus();
}
function deleteAttachment(i){
  _modalAttachments.splice(i,1);
  renderModalAttachments();
}

// Toggle subtask directly from Day view block
function toggleSubtaskInline(taskId,subIdx){
  const t=tasks.find(t=>t.id===taskId);
  if(!t||!t.subtasks||!t.subtasks[subIdx])return;
  t.subtasks[subIdx].done=!t.subtasks[subIdx].done;
  save();renderAll();
}
// Add new blank subtask from Day view [+] button
function addSubtaskInline(taskId,idate){
  const t=tasks.find(t=>t.id===taskId);
  if(!t)return;
  if(!t.subtasks)t.subtasks=[];
  if(t.subtasks.length>=20){showToast('Maximum 20 subtasks per task');return;}
  t.subtasks.push({id:genId(),name:'',duration:0,done:false});
  save();renderAll();
  // Focus the new blank subtask
  setTimeout(()=>{
    const names=document.querySelectorAll(`.day-task-block[data-id="${taskId}"] .day-subtask-name`);
    const last=names[names.length-1];
    if(last){last.focus();placeCaretAtEnd(last);}
  },50);
}
// Save subtask name edited inline on Day view
function saveSubtaskInline(taskId,subIdx,el){
  const t=tasks.find(t=>t.id===taskId);
  if(!t||!t.subtasks||!t.subtasks[subIdx])return;
  const newName=el.textContent.trim();
  if(!newName){
    // Empty name — delete the subtask
    t.subtasks.splice(subIdx,1);
  } else {
    t.subtasks[subIdx].name=newName;
  }
  save();
}
// Handle Enter/Escape on inline subtask editing
function onSubtaskKeydown(e,taskId,subIdx,el){
  if(e.key==='Enter'){
    e.preventDefault();
    // Save current
    saveSubtaskInline(taskId,subIdx,el);
    // Create new subtask below
    const t=tasks.find(t=>t.id===taskId);
    if(!t)return;
    if(!t.subtasks)t.subtasks=[];
    t.subtasks.splice(subIdx+1,0,{id:genId(),name:'',duration:0,done:false});
    save();renderAll();
    // Focus the new subtask's name span
    setTimeout(()=>{
      const blocks=document.querySelectorAll(`.day-task-block[data-id="${taskId}"] .day-subtask-name, .day-task-block.event-block[data-id="${taskId}"] .day-subtask-name`);
      const target=blocks[subIdx+1];
      if(target){target.focus();placeCaretAtEnd(target);}
    },50);
  } else if(e.key==='Escape'){
    el.blur();
  }
}
// Helper: place caret at end of contenteditable
function placeCaretAtEnd(el){
  const range=document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel=window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

// ══ SUBTASK POPUP ════════════════════════════════
let _subPopupTaskId=null,_subPopupDate=null;
function openSubtaskPopup(taskId,idate){
  _subPopupTaskId=taskId;_subPopupDate=idate;
  const t=tasks.find(t=>t.id===taskId);if(!t)return;
  const subs=t.subtasks||[];
  const overlay=document.getElementById('subPopupOverlay');
  if(!overlay)return;
  renderSubtaskPopupContent(t);
  overlay.classList.add('open');
}
function closeSubtaskPopup(){
  const overlay=document.getElementById('subPopupOverlay');
  if(overlay)overlay.classList.remove('open');
  _subPopupTaskId=null;_subPopupDate=null;
  renderAll();
}
function renderSubtaskPopupContent(t){
  if(!t)t=tasks.find(t=>t.id===_subPopupTaskId);
  if(!t)return;
  const subs=t.subtasks||[];
  const done=subs.filter(s=>s.done).length;
  document.getElementById('subPopupTitle').textContent=t.name;
  document.getElementById('subPopupCount').textContent=`${subs.length} subtask${subs.length!==1?'s':''} · ${done} completed`;
  const list=document.getElementById('subPopupList');
  list.innerHTML=subs.map((s,i)=>`<div class="sp-item${s.done?' done':''}" draggable="true"
    ondragstart="onSpDragStart(event,${i})" ondragover="onSpDragOver(event)" ondrop="onSpDrop(event,${i})" ondragend="onSpDragEnd(event)">
    <div class="sp-check${s.done?' checked':''}" onclick="toggleSpSub(${i})"></div>
    <span class="sp-name" contenteditable="true" spellcheck="false" onclick="event.stopPropagation()" onblur="saveSpSub(${i},this)" onkeydown="onSpKeydown(event,${i},this)">${esc(s.name)}</span>
    <span class="sp-grip" title="Drag to reorder">≡</span>
    <button class="sp-del" onclick="deleteSpSub(${i})" title="Remove">×</button>
  </div>`).join('')||'<div class="sp-empty">No subtasks yet</div>';
}
function toggleSpSub(idx){
  const t=tasks.find(t=>t.id===_subPopupTaskId);if(!t||!t.subtasks[idx])return;
  t.subtasks[idx].done=!t.subtasks[idx].done;
  save();renderSubtaskPopupContent(t);
}
function saveSpSub(idx,el){
  const t=tasks.find(t=>t.id===_subPopupTaskId);if(!t||!t.subtasks)return;
  const val=el.textContent.trim();
  if(!val){t.subtasks.splice(idx,1);}
  else{t.subtasks[idx].name=val;}
  save();renderSubtaskPopupContent(t);
}
function deleteSpSub(idx){
  const t=tasks.find(t=>t.id===_subPopupTaskId);if(!t||!t.subtasks)return;
  t.subtasks.splice(idx,1);save();renderSubtaskPopupContent(t);
}
function addSpSub(){
  const t=tasks.find(t=>t.id===_subPopupTaskId);if(!t)return;
  const input=document.getElementById('subPopupInput');
  const name=input.value.trim();if(!name)return;
  if(!t.subtasks)t.subtasks=[];
  if(t.subtasks.length>=20){showToast('Maximum 20 subtasks');return;}
  t.subtasks.push({id:genId(),name,duration:0,done:false});
  input.value='';save();renderSubtaskPopupContent(t);
  input.focus();
}
function onSpKeydown(e,idx,el){
  if(e.key==='Enter'){e.preventDefault();saveSpSub(idx,el);addSpSubFocus();}
  if(e.key==='Escape')el.blur();
}
function addSpSubFocus(){const input=document.getElementById('subPopupInput');if(input)input.focus();}
// Drag reorder in popup
let _spDragFrom=-1;
function onSpDragStart(e,idx){_spDragFrom=idx;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','sp');e.target.classList.add('sp-dragging');}
function onSpDragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';const row=e.target.closest('.sp-item');if(row)row.classList.add('sp-drop-target');}
function onSpDrop(e,toIdx){
  e.preventDefault();e.stopPropagation();
  document.querySelectorAll('.sp-drop-target').forEach(r=>r.classList.remove('sp-drop-target'));
  if(_spDragFrom<0||_spDragFrom===toIdx)return;
  const t=tasks.find(t=>t.id===_subPopupTaskId);if(!t||!t.subtasks)return;
  const moved=t.subtasks.splice(_spDragFrom,1)[0];
  t.subtasks.splice(toIdx,0,moved);
  save();renderSubtaskPopupContent(t);_spDragFrom=-1;
}
function onSpDragEnd(e){e.target.classList.remove('sp-dragging');document.querySelectorAll('.sp-drop-target').forEach(r=>r.classList.remove('sp-drop-target'));_spDragFrom=-1;}

function openNew(dateKey,time){
  mMode='new';mDate=dateKey;mTime=time;mId=null;mInstanceDate=null;
  _itemType='task';_modalSubtasks=[];_modalAllday=false;
  _modalMultiDay=false;_modalEventColor='';_modalSuppressRoutines=false;
  setItemType('task');
  document.getElementById('mTitle').textContent='New Task';
  const d=fromDk(dateKey);
  document.getElementById('mSub').textContent=DLONG[d.getDay()]+', '+MONTHS_LONG[d.getMonth()]+' '+d.getDate()+' · '+fmtT(time);
  document.getElementById('fName').value='';
  document.getElementById('fPri').value='none';
  buildAllCatSelects('none');
  document.getElementById('fNotes').value='';
  document.getElementById('fLocation').value='';
  _modalAttachments=[];
  renderModalAttachments();
  document.getElementById('fRecurOn').checked=false;
  document.getElementById('fRecurN').value=1;
  document.getElementById('fRecurU').value='day';
  document.getElementById('recurOpts').style.display='none';
  document.getElementById('recurDaysRow').style.display='none';
  setRecurDays([]);
  // Reset multi-day fields
  document.getElementById('fMultiStart').value='';
  document.getElementById('fMultiEnd').value='';
  document.getElementById('fMultiDayDates').style.display='none';
  document.getElementById('fMultiDayWrap').style.display='none';
  document.getElementById('fEventColorWrap').style.display='none';
  const mdTog=document.getElementById('fMultiDayToggle');if(mdTog)mdTog.classList.remove('on');
  document.getElementById('btnDel').style.display='none';
  const stEl=document.getElementById('fStartTime');if(stEl)stEl.value=time;
  setDurSpinner(30);
  renderModalSubtasks();
  renderModalAttachments();
  switchDetailTab('notes');
  updateDetailBadges();
  // Hide done checkbox for new tasks + clear any stale done styling
  const mdc=document.getElementById('mDoneCheck');
  if(mdc){mdc.style.display='none';mdc.classList.remove('checked');}
  const nameEl=document.getElementById('fName');
  if(nameEl){nameEl.style.textDecoration='';nameEl.style.opacity='';}
  showModal('mOverlay');
}
function openEdit(id,instanceDate,e){
  e.stopPropagation();
  const t=tasks.find(t=>t.id===id);if(!t)return;
  mMode='edit';mId=id;mInstanceDate=instanceDate;
  _itemType=t.type||'task';
  _modalSubtasks=JSON.parse(JSON.stringify(t.subtasks||[]));
  _editOrigSubtasks=JSON.parse(JSON.stringify(t.subtasks||[]));
  _modalCommitted=false;
  _modalAllday=!!(t.allday);
  setItemType(_itemType);
  // Apply all-day state after setItemType (which shows the toggle)
  if(_itemType==='event')setAlldayModal(_modalAllday);
  document.getElementById('mTitle').textContent='Edit '+(_itemType==='event'?'Event':'Task');
  const d=fromDk(t.date);
  document.getElementById('mSub').textContent=DLONG[d.getDay()]+', '+MONTHS_LONG[d.getMonth()]+' '+d.getDate()+(t.time?' · '+fmtT(t.time):'');
  document.getElementById('fName').value=t.name;
  document.getElementById('fPri').value=t.priority||'none';
  buildAllCatSelects(t.category||'none');
  document.getElementById('fNotes').value=t.notes||'';
  // Load attachments (migrate old link field)
  if(t.attachments){
    _modalAttachments=JSON.parse(JSON.stringify(t.attachments));
  } else if(t.link){
    _modalAttachments=[{type:'link',url:t.link,name:t.link.replace(/^https?:\/\//,'').slice(0,50)}];
  } else {
    _modalAttachments=[];
  }
  renderModalAttachments();
  document.getElementById('fLocation').value=t.location||'';
  document.getElementById('fRecurOn').checked=!!t.recur;
  document.getElementById('fRecurN').value=t.recurN||1;
  document.getElementById('fRecurU').value=t.recurU||'day';
  document.getElementById('recurOpts').style.display=t.recur?'flex':'none';
  // Recur day-of-week buttons
  if(t.recur&&t.recurU==='week'&&t.recurDays&&t.recurDays.length){
    setRecurDays(t.recurDays);
    document.getElementById('recurDaysRow').style.display='flex';
  } else {
    setRecurDays([]);
    document.getElementById('recurDaysRow').style.display='none';
  }
  // Multi-day fields
  _modalMultiDay=!!(t.multiDay);
  _modalEventColor=t.eventColor||'';
  if(_itemType==='event'&&_modalAllday){
    setMultiDayModal(_modalMultiDay);
    if(_modalMultiDay){
      document.getElementById('fMultiStart').value=t.date||'';
      document.getElementById('fMultiEnd').value=t.endDate||'';
    }
  } else {
    setMultiDayModal(false);
  }
  // Suppress routines
  _modalSuppressRoutines=!!(t.suppressRoutines);
  if(_itemType==='event'&&_modalAllday){setSuppressModal(_modalSuppressRoutines);}
  else{setSuppressModal(false);}
  document.getElementById('btnDel').style.display='block';
  const stEl2=document.getElementById('fStartTime');if(stEl2)stEl2.value=t.time||'09:00';
  setDurSpinner(t.duration||30);
  renderModalSubtasks();
  renderModalAttachments();
  switchDetailTab('notes');
  updateDetailBadges();
  // Show done checkbox for tasks, hide for events
  updateModalDoneCheck();
  showModal('mOverlay');
}
function showModal(id){
  document.getElementById(id).classList.add('open');
  setTimeout(()=>{
    const f=document.getElementById('fName');
    if(f){f.focus();autoExpand(f);}
    resetTextareaHeights();
    // Wire scroll fade on the task modal body only
    const body=document.querySelector('#'+id+' .modal-body');
    if(body){
      // Remove any previous listener before adding a new one (prevent accumulation)
      if(body._scrollHandler)body.removeEventListener('scroll',body._scrollHandler);
      const checkScroll=()=>{
        const atBottom=body.scrollHeight-body.scrollTop<=body.clientHeight+8;
        body.classList.toggle('at-bottom',atBottom);
      };
      body._scrollHandler=checkScroll;
      checkScroll();
      body.addEventListener('scroll',checkScroll,{passive:true});
    }
  },150);
}
function closeModal(){
  document.getElementById('mOverlay').classList.remove('open');
  // Remove scroll listener to prevent accumulation
  const body=document.querySelector('#mOverlay .modal-body');
  if(body&&body._scrollHandler){
    body.removeEventListener('scroll',body._scrollHandler);
    body._scrollHandler=null;
  }
  // If user cancelled, restore original subtasks
  if(mMode==='edit'&&mId&&!_modalCommitted){
    const t=tasks.find(t=>t.id===mId);
    if(t){t.subtasks=_editOrigSubtasks;if(curView==='day')renderDay();}
  }
  _modalCommitted=false;
}
function handleMBg(e){if(e.target===e.currentTarget)closeModal()}
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){if(_searchOpen)toggleSearch();closeModal();closeDelModal();closeAddCatModal();closeDrawer();closeBDDetail();closeRecurReschedule();closeClearModal();closeClearConfirm();closeSuggAlready();closeWrapup();closeWeekPlan();closeAISchedule();closeReflow();}
  if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&document.getElementById('mOverlay').classList.contains('open')){e.preventDefault();saveTask();}
});
// ── Modal Done Checkbox ──────────────────────────────
function toggleModalDone(){
  if(mMode!=='edit'||!mId)return;
  const t=tasks.find(t=>t.id===mId);if(!t)return;
  if((t.type||'task')==='event')return;
  if(t.recur&&mInstanceDate){
    if(!t.doneOverrides)t.doneOverrides=[];
    const idx=t.doneOverrides.indexOf(mInstanceDate);
    if(idx===-1){t.doneOverrides.push(mInstanceDate);playDone();}
    else{t.doneOverrides.splice(idx,1);playUndo();}
  } else {
    t.done=!t.done;
    if(t.done)playDone();else playUndo();
  }
  save();
  updateModalDoneCheck();
}
function updateModalDoneCheck(){
  const el=document.getElementById('mDoneCheck');if(!el)return;
  // Hide for new tasks and events
  if(mMode==='new'||_itemType==='event'){el.style.display='none';return;}
  el.style.display='';
  const t=tasks.find(t=>t.id===mId);if(!t){el.classList.remove('checked');return;}
  const isDone=t.done||(t.doneOverrides||[]).includes(mInstanceDate);
  el.classList.toggle('checked',isDone);
  // Strikethrough on name field
  const nameEl=document.getElementById('fName');
  if(nameEl){
    nameEl.style.textDecoration=isDone?'line-through':'';
    nameEl.style.opacity=isDone?'.5':'';
  }
}

function saveTask(){
  const name=document.getElementById('fName').value.trim();if(!name){document.getElementById('fName').focus();return}
  const priority=document.getElementById('fPri').value,category=document.getElementById('fCat').value,notes=document.getElementById('fNotes').value.trim();
  const recur=document.getElementById('fRecurOn').checked,recurN=parseInt(document.getElementById('fRecurN').value)||1,recurU=document.getElementById('fRecurU').value;
  const recurDays=(recur&&recurU==='week')?getRecurDays():[];
  const duration=_selDur||30;
  const location=document.getElementById('fLocation').value.trim();
  const type=_itemType;
  const subtasks=_modalSubtasks;
  const attachments=_modalAttachments;
  const allday=_itemType==='event'&&_modalAllday;
  const startTimeVal=document.getElementById('fStartTime').value||mTime;
  const finalTime=allday?null:startTimeVal;
  // Multi-day event fields
  let multiDay=false,endDate='',eventColor='';
  if(allday&&_modalMultiDay){
    const msVal=document.getElementById('fMultiStart').value;
    const meVal=document.getElementById('fMultiEnd').value;
    if(!msVal||!meVal){showToast('Set start and end dates');return;}
    if(meVal<msVal){showToast('End date must be on or after start date');return;}
    multiDay=true;
    mDate=msVal; // override date to multi-day start
    endDate=meVal;
    eventColor=_modalEventColor||'';
  }
  const suppressRoutines=allday&&_modalSuppressRoutines;
  // Check blocked routine before saving
  if(finalTime&&type==='task'){
    const dateKey=mMode==='new'?mDate:(tasks.find(t=>t.id===mId)?.date||mDate);
    const rBlock=isBlockedByRoutine(dateKey,finalTime);
    if(rBlock.blocked){
      if(!confirm(`${rBlock.routineName} blocks ${fmtT(rBlock.routineStart)} – ${fmtT(rBlock.routineEnd)}.\n\nSchedule here anyway?`))return;
    }
  }
  if(mMode==='new'){tasks.push({id:genId(),name,type,priority:type==='event'?'none':priority,category,notes,attachments,location,date:mDate,time:finalTime,allday,duration,scheduled:true,done:false,recur,recurN,recurU,recurDays,subtasks,doneOverrides:[],deletedOccurrences:[],multiDay,endDate,eventColor,suppressRoutines});}
  else{const t=tasks.find(t=>t.id===mId);if(t)Object.assign(t,{name,type,priority:type==='event'?'none':priority,category,notes,attachments,location,allday,time:finalTime,duration,recur,recurN,recurU,recurDays,subtasks,multiDay,endDate:multiDay?endDate:'',eventColor:multiDay?eventColor:'',suppressRoutines});if(t&&multiDay)t.date=mDate;}
  save();_modalCommitted=true;closeModal();renderAll();
}
function startDelete(){
  const t=tasks.find(t=>t.id===mId);if(!t)return;
  _modalCommitted=true; // prevent subtask restore — task is being deleted
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


// ══ HOLIDAY SCHEDULER ═══════════════════════════
const US_HOLIDAYS={
  2026:[
    {name:"New Year's Day",date:'2026-01-01'},
    {name:'Martin Luther King Jr. Day',date:'2026-01-19'},
    {name:"Presidents' Day",date:'2026-02-16'},
    {name:'Memorial Day',date:'2026-05-25'},
    {name:'Independence Day',date:'2026-07-04'},
    {name:'Labor Day',date:'2026-09-07'},
    {name:'Columbus Day',date:'2026-10-12'},
    {name:"Veterans Day",date:'2026-11-11'},
    {name:'Thanksgiving Day',date:'2026-11-26'},
    {name:'Day After Thanksgiving',date:'2026-11-27'},
    {name:'Christmas Day',date:'2026-12-25'},
  ],
  2027:[
    {name:"New Year's Day",date:'2027-01-01'},
    {name:'Martin Luther King Jr. Day',date:'2027-01-18'},
    {name:"Presidents' Day",date:'2027-02-15'},
    {name:'Memorial Day',date:'2027-05-31'},
    {name:'Independence Day',date:'2027-07-04'},
    {name:'Labor Day',date:'2027-09-06'},
    {name:'Columbus Day',date:'2027-10-11'},
    {name:"Veterans Day",date:'2027-11-11'},
    {name:'Thanksgiving Day',date:'2027-11-25'},
    {name:'Day After Thanksgiving',date:'2027-11-26'},
    {name:'Christmas Day',date:'2027-12-25'},
  ]
};

let _enabledHolidays=[];
try{_enabledHolidays=JSON.parse(localStorage.getItem('clarity_holidays')||'[]')}catch{_enabledHolidays=[]}
function saveHolidays(){try{localStorage.setItem('clarity_holidays',JSON.stringify(_enabledHolidays))}catch(e){console.error(e)}}

function ensureHolidayCategory(){
  if(!categories.find(c=>c.id==='holiday')){
    categories.push({id:'holiday',name:'Holiday',color:'#ef4444'});
    save();
  }
}

function isHolidayEnabled(name,date){
  return _enabledHolidays.some(h=>h.name===name&&h.date===date);
}

function toggleHoliday(name,date){
  if(isHolidayEnabled(name,date)){
    // Remove holiday event
    _enabledHolidays=_enabledHolidays.filter(h=>!(h.name===name&&h.date===date));
    tasks=tasks.filter(t=>!(t._holidayId===name&&t.date===date));
  } else {
    // Add holiday event
    ensureHolidayCategory();
    _enabledHolidays.push({name,date});
    tasks.push({
      id:genId(),name:'\u{1F1FA}\u{1F1F8} '+name,type:'event',date,time:null,
      allday:true,suppressRoutines:true,_holidayId:name,
      category:'holiday',priority:'none',notes:'',location:'',
      duration:30,scheduled:true,done:false,recur:false,recurN:1,recurU:'day',
      subtasks:[],attachments:[],doneOverrides:[],deletedOccurrences:[],
      multiDay:false,endDate:'',eventColor:'',recurDays:[]
    });
  }
  saveHolidays();save();renderHolidaysList();renderAll();
}

function selectAllHolidays(year){
  const list=US_HOLIDAYS[year]||[];
  let changed=false;
  list.forEach(h=>{
    if(!isHolidayEnabled(h.name,h.date)){
      ensureHolidayCategory();
      _enabledHolidays.push({name:h.name,date:h.date});
      tasks.push({
        id:genId(),name:'\u{1F1FA}\u{1F1F8} '+h.name,type:'event',date:h.date,time:null,
        allday:true,suppressRoutines:true,_holidayId:h.name,
        category:'holiday',priority:'none',notes:'',location:'',
        duration:30,scheduled:true,done:false,recur:false,recurN:1,recurU:'day',
        subtasks:[],attachments:[],doneOverrides:[],deletedOccurrences:[],
        multiDay:false,endDate:'',eventColor:'',recurDays:[]
      });
      changed=true;
    }
  });
  if(changed){saveHolidays();save();renderHolidaysList();renderAll();}
}
function clearAllHolidays(year){
  const list=US_HOLIDAYS[year]||[];
  let changed=false;
  list.forEach(h=>{
    if(isHolidayEnabled(h.name,h.date)){
      _enabledHolidays=_enabledHolidays.filter(x=>!(x.name===h.name&&x.date===h.date));
      tasks=tasks.filter(t=>!(t._holidayId===h.name&&t.date===h.date));
      changed=true;
    }
  });
  if(changed){saveHolidays();save();renderHolidaysList();renderAll();}
}

function renderHolidaysList(){
  const el=document.getElementById('holidaysList');if(!el)return;
  const now=new Date();
  const curYear=now.getFullYear();
  const years=[curYear,curYear+1];
  let html='';
  years.forEach(year=>{
    const list=US_HOLIDAYS[year];if(!list)return;
    html+=`<div class="holiday-year-section">`;
    html+=`<div class="holiday-year-hdr"><span class="holiday-year-title">${year} US Federal Holidays</span>
      <div class="holiday-year-actions">
        <button class="holiday-action-btn" onclick="selectAllHolidays(${year})">Select All</button>
        <button class="holiday-action-btn" onclick="clearAllHolidays(${year})">Clear All</button>
      </div></div>`;
    list.forEach(h=>{
      const d=fromDk(h.date);
      const dayName=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
      const monthName=MONTHS_S[d.getMonth()];
      const on=isHolidayEnabled(h.name,h.date);
      html+=`<label class="holiday-item${on?' on':''}">
        <input type="checkbox" class="holiday-cb" ${on?'checked':''} onchange="toggleHoliday('${h.name.replace(/'/g,"\\'")}','${h.date}')">
        <div class="holiday-info">
          <span class="holiday-name">${h.name}</span>
          <span class="holiday-date">${dayName}, ${monthName} ${d.getDate()}</span>
        </div>
      </label>`;
    });
    html+=`</div>`;
  });
  html+=`<div style="text-align:center;padding:16px 0"><button class="routine-add-btn" onclick="openNewHolidayEvent()">+ Add custom day off</button></div>`;
  el.innerHTML=html;
}

function openNewHolidayEvent(){
  ensureHolidayCategory();
  openNew(dk(new Date()),'09:00');
  // Pre-set as event, all-day, suppress routines
  setItemType('event');
  _modalAllday=true;
  setAlldayModal(true);
  _modalSuppressRoutines=true;
  setSuppressModal(true);
  buildAllCatSelects('holiday');
  document.getElementById('fCat').value='holiday';
  document.getElementById('mTitle').textContent='New Day Off';
}

// ══ EXPORT / IMPORT ═════════════════════════════
function exportData(){
  const data={
    tasks,brainDump,categories,
    routineBlocks,monthNotes,monthPlans,
    holidays:_enabledHolidays,
    username:localStorage.getItem('clarity_username')||'',
    journal:JSON.parse(localStorage.getItem('clarity_journal')||'{}'),
    theme:currentTheme,dark:isDark,military:useMilitary,
    weekStartDay,
    exportedAt:new Date().toISOString(),version:'v1.0'
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='luclaro-backup-'+dk(new Date())+'.json';
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
      if(data.routineBlocks){routineBlocks=data.routineBlocks;saveRoutine();renderRoutineList();}
      if(data.holidays){_enabledHolidays=data.holidays;saveHolidays();}
      if(data.monthNotes){monthNotes=data.monthNotes;saveMonthNotesData();}
      if(data.monthPlans){monthPlans=data.monthPlans;saveMonthPlans();}
      if(data.weekStartDay!==undefined)setWeekStart(data.weekStartDay);
      if(data.username)localStorage.setItem('clarity_username',data.username);
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
  // Hover tooltips are meaningless on touch — skip entirely
  if('ontouchstart' in window)return;
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
      let html=`<div class="task-tooltip-title">${esc(t.name)}</div>`;
      const meta=[];
      if(t.category&&t.category!=='none'){const c=catById(t.category);if(c)meta.push(c.name);}
      if(t.priority&&t.priority!=='none')meta.push(t.priority+' priority');
      if(t.recur)meta.push(recurLbl(t));
      if(meta.length)html+=`<div style="font-size:10px;color:var(--text3);margin-bottom:3px">${meta.join(' · ')}</div>`;
      if(t.notes)html+=`<div class="task-tooltip-notes">${esc(t.notes.slice(0,120))}${t.notes.length>120?'…':''}</div>`;
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
      <span class="sr-dot" style="background:${cc};border-top-color:${cc}"></span>
      <div><div class="sr-name">${esc(t.name)}</div><div class="sr-meta">${meta}</div></div>
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
  if(_searchOpen&&!e.target.closest('.search-bar'))toggleSearch();
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
    const _tasksOnly=dayTasks.filter(t=>(t.type||'task')==='task');if(_tasksOnly.length>0&&_tasksOnly.every(t=>t.done||(t.doneOverrides||[]).includes(todayKey))){
      setTimeout(fireConfetti,300);
    }
  }
};

// ══ KEYBOARD NAVIGATION ═════════════════════════
document.addEventListener('keydown',function(e){
  // Skip if typing in an input/textarea/contenteditable
  if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.tagName==='SELECT'||e.target.isContentEditable)return;
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
  if(categories.length>=12){showToast('Maximum 12 categories');return;}
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
      id:genId(),name,type:'task',priority,category,notes,attachments:[],location:'',
      date:dateVal,time,allday:false,duration:30,scheduled:true,done:false,
      recur:false,recurN:1,recurU:'day',recurDays:[],subtasks:[],doneOverrides:[],deletedOccurrences:[],
      multiDay:false,endDate:'',eventColor:'',suppressRoutines:false
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

// Generate a palette of 6 harmonious colors based on the current theme accent
function getSuggPalette(){
  // Read the current accent color from CSS
  const style=getComputedStyle(document.documentElement);
  const accent=style.getPropertyValue('--accent').trim()||'#10b981';
  // Parse hex to HSL
  function hexToHsl(hex){
    hex=hex.replace('#','');
    const r=parseInt(hex.slice(0,2),16)/255;
    const g=parseInt(hex.slice(2,4),16)/255;
    const b=parseInt(hex.slice(4,6),16)/255;
    const max=Math.max(r,g,b),min=Math.min(r,g,b);
    let h,s,l=(max+min)/2;
    if(max===min){h=s=0;}
    else{
      const d=max-min;
      s=l>.5?d/(2-max-min):d/(max+min);
      if(max===r)h=((g-b)/d+(g<b?6:0))/6;
      else if(max===g)h=((b-r)/d+2)/6;
      else h=((r-g)/d+4)/6;
    }
    return[Math.round(h*360),Math.round(s*100),Math.round(l*100)];
  }
  function hslToHex(h,s,l){
    s/=100;l/=100;
    const a=s*Math.min(l,1-l);
    const f=n=>{const k=(n+h/30)%12;const c=l-a*Math.max(Math.min(k-3,9-k,1),-1);return Math.round(255*c).toString(16).padStart(2,'0');};
    return'#'+f(0)+f(8)+f(4);
  }
  const[baseH,baseS,baseL]=hexToHsl(accent);
  // Distribute 6 colors: anchor on the base hue, rotate in pleasing steps
  const offsets=[0,45,90,155,210,270];
  return offsets.map(o=>{
    const h=(baseH+o)%360;
    // Keep saturation similar but clamp lightness to a readable range
    const s=Math.min(85,Math.max(40,baseS+(o>0?-5:0)));
    const l=Math.min(52,Math.max(38,baseL));
    return hslToHex(h,s,l);
  });
}

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
    category:'Self-Care',
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
  const palette=getSuggPalette();
  SUGGESTIONS.forEach((cat,ci)=>{
    const catColor=palette[ci%palette.length];
    html+=`<div class="sugg-category">
      <div class="sugg-cat-title" style="border-bottom-color:${catColor}33"><span class="sugg-cat-icon">${cat.category.split(' ')[0]}</span>${cat.category.slice(cat.category.indexOf(' ')+1)}</div>`;
    cat.items.forEach((item,ii)=>{
      const alreadyAdded=habitNames.has(item.name.toLowerCase().trim());
      const warnClass=alreadyAdded?' sugg-card-warned':'';
      const actionBtn=alreadyAdded
        ?`<span class="sugg-already-badge">⚠ Already added</span>`
        :`<button class="sugg-add-btn" onclick="openIdeaModal(${ci},${ii})">+ Add</button>`;
      html+=`<div class="sugg-card${warnClass}" draggable="true" style="border-left-color:${catColor}"
        ondragstart="onSuggDragStart(event,${ci},${ii})" ondragend="onSuggDragEnd(event)">
        <div class="sugg-card-info">
          <div class="sugg-card-name">${esc(item.name)}</div>
          <div class="sugg-card-sub">${esc(item.sub)}</div>
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
  const palette=getSuggPalette();
  const catColor=palette[ci%palette.length];
  suggDragId={ci,ii,color:catColor};
  dragBdId=null;dragTaskId=null;
  e.dataTransfer.effectAllowed='copy';
  e.dataTransfer.setData('text/plain','sugg');
  setTimeout(()=>e.target.classList.add('dragging'),0);
  _setDragActive(true);
}
function onSuggDragEnd(e){
  e.target.classList.remove('dragging');
  suggDragId=null;
  _setDragActive(false);
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
      showWarnToast(`"${esc(item.name)}" is already in that slot`);suggDragId=null;return;
    }
    if(slotFull(dateKey,defaultTime,null)){
      showWarnToast('That slot already has 3 tasks — pick a different time');suggDragId=null;return;
    }
    tasks.push({id:genId(),name:item.name,type:'task',priority:item.priority,category:'none',notes:item.sub,attachments:[],location:'',
      date:dateKey,time:defaultTime,allday:false,duration:30,scheduled:true,done:false,recur:false,recurN:1,recurU:'day',recurDays:[],subtasks:[],doneOverrides:[],deletedOccurrences:[],multiDay:false,endDate:'',eventColor:'',suppressRoutines:false});
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
      showWarnToast(`"${esc(item.name)}" is already in that slot`);suggDragId=null;return;
    }
    if(slotFull(dateKey,time,null)){
      showWarnToast('That slot already has 3 tasks — pick a different time');suggDragId=null;return;
    }
    tasks.push({id:genId(),name:item.name,type:'task',priority:item.priority,category:'none',notes:item.sub,attachments:[],location:'',
      date:dateKey,time,allday:false,duration:30,scheduled:true,done:false,recur:false,recurN:1,recurU:'day',recurDays:[],subtasks:[],doneOverrides:[],deletedOccurrences:[],multiDay:false,endDate:'',eventColor:'',suppressRoutines:false});
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
    showWarnToast('That slot already has 3 tasks — pick a different time');
    closeSuggAlready(); return;
  }
  tasks.push({
    id:genId(), name:item.name, type:'task', priority:item.priority, category:'none',
    notes:item.sub, attachments:[], location:'', date:dateKey, time:resolvedTime, allday:false, duration:30,
    scheduled:true, done:false, recur:false, recurN:1, recurU:'day', recurDays:[], subtasks:[],
    doneOverrides:[], deletedOccurrences:[], multiDay:false, endDate:'', eventColor:'', suppressRoutines:false
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
  // Day view now-line — find actual pixel position from the slot DOM element
  const dayTimeline=document.getElementById('dayTimeline');
  if(dayTimeline&&isToday(selDate)){
    dayTimeline.querySelectorAll('.now-line').forEach(el=>el.remove());
    const slotH=Math.floor(mins/30);
    const s=slots()[slotH];
    const DAY_H_NOW=window.innerWidth<=640?64:76;
    let top=0;
    if(s){
      const slotEl=dayTimeline.querySelector(`[data-time="${sk(s.h,s.m)}"]`);
      if(slotEl&&slotEl.offsetHeight>0){
        const fracWithin=(mins%30)/30;
        top=slotEl.offsetTop+fracWithin*slotEl.offsetHeight;
      } else {
        // Slot is collapsed — find nearest visible slot and interpolate
        const allSlots=dayTimeline.querySelectorAll('.day-slot[data-time]');
        let prevSlot=null,nextSlot=null;
        const targetMins=mins;
        allSlots.forEach(el=>{
          if(el.offsetHeight===0)return;
          const t=el.getAttribute('data-time');
          const[h2,m2]=t.split(':').map(Number);
          const sMins=h2*60+m2;
          if(sMins<=targetMins)prevSlot={el,mins:sMins};
          if(sMins>targetMins&&!nextSlot)nextSlot={el,mins:sMins};
        });
        if(prevSlot&&nextSlot){
          const frac=(targetMins-prevSlot.mins)/(nextSlot.mins-prevSlot.mins);
          top=prevSlot.el.offsetTop+prevSlot.el.offsetHeight+frac*(nextSlot.el.offsetTop-prevSlot.el.offsetTop-prevSlot.el.offsetHeight);
        } else if(prevSlot){
          top=prevSlot.el.offsetTop+prevSlot.el.offsetHeight;
        } else {
          top=(mins/30)*DAY_H_NOW;
        }
      }
    }
    // Detect time label column width dynamically
    const firstLbl=dayTimeline.querySelector('.day-time-lbl');
    const lblW=firstLbl?firstLbl.offsetWidth:80;
    const line=document.createElement('div');
    line.className='now-line';
    line.style.cssText=`top:${top}px;position:absolute;left:${lblW}px;right:0`;
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
    // Scroll to the slot for the current time
    const slotH=Math.floor(mins/30);
    const s=slots()[slotH];
    let top=0;
    if(s){
      const slotEl=document.querySelector(`#dayTimeline [data-time="${sk(s.h,s.m)}"]`);
      top=slotEl?Math.max(0,slotEl.offsetTop-dv.clientHeight/2):Math.max(0,(mins/30)*52-dv.clientHeight/2);
    }
    dv.scrollTo({top,behavior:'smooth'});
  }
}

// Start the now-line interval
setInterval(()=>{if(curView==='day'||curView==='week')renderNowLine();},60000);

// ══ OVERDUE BADGE ════════════════════════════════════════════════════════════
function updateOverdueBadge(){
  const today=dk(new Date());
  const overdue=tasks.filter(t=>
    t.scheduled&&t.date&&t.date<today&&!t.done&&!t.recur&&
    (t.type||'task')!=='event'
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
  // Close any open modal first since this is user-initiated
  document.querySelectorAll('.modal-overlay.open,.modal-overlay.show').forEach(el=>{
    el.classList.remove('open','show');
  });
  _overdueDismissedToday=false; // reset session dismiss since user explicitly asked
  openOverduePopup();
}

// ══ QUICK-ADD BAR ════════════════════════════════════════════════════════════
let _qaOpen=false;

let _qaDur=30;
let _qaType='task';
function openQuickAdd(){
  if(_qaOpen)return;
  _qaOpen=true;
  _qaDur=30;
  _qaType='task';
  setQaType('task');
  const bar=document.getElementById('quickAddBar');
  const now=new Date();
  document.getElementById('qaDate').value=dk(now);
  const h=String(now.getHours()).padStart(2,'0');
  const m=String(Math.round(now.getMinutes()/30)*30%60).padStart(2,'0');
  document.getElementById('qaTime').value=h+':'+m;
  document.getElementById('qaPri').value='none';
  document.getElementById('qaName').value='';
  // Duration chips
  const QA_DURS=[15,30,45,60,90,120];
  document.getElementById('qaDurRow').innerHTML=QA_DURS.map(d=>
    `<div class="dur-opt${d===_qaDur?' selected':''}" onclick="pickQaDur(${d})">${durLabel(d)}</div>`
  ).join('');
  bar.classList.add('open');
  const bd=document.getElementById('quickAddBackdrop');if(bd)bd.style.display='block';
  setTimeout(()=>document.getElementById('qaName').focus(),80);
}
function pickQaDur(v){
  _qaDur=v;
  document.querySelectorAll('#qaDurRow .dur-opt').forEach(el=>{
    el.classList.toggle('selected',durToMin(el.textContent)===v);
  });
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
  const type=_qaType;
  // ── Guardrails ──
  // 1. Blocked routine check
  if(type==='task'){
    const rBlock=isBlockedByRoutine(dateVal,timeVal);
    if(rBlock.blocked){
      if(!confirm(`${rBlock.routineName} blocks ${fmtT(rBlock.routineStart)} – ${fmtT(rBlock.routineEnd)}.\n\nSchedule here anyway?`))return;
    }
  }
  // 2. Slot full check
  if(slotFull(dateVal,timeVal,null)){
    if(!confirm(`This time slot already has ${MAX_TASKS_PER_SLOT} items.\n\nAdd anyway?`))return;
  }
  // 3. Duplicate check
  if(duplicateInSlot(dateVal,timeVal,name,null)){
    if(!confirm(`"${name}" is already in this time slot.\n\nAdd a duplicate?`))return;
  }
  // 4. Duration overflow into blocked routine
  const routineOverflow=checkRoutineOverflow(dateVal,timeVal,_qaDur);
  if(routineOverflow.blocked){
    showToast(`Note: extends into ${routineOverflow.routineName} at ${fmtT(routineOverflow.routineStart)}`);
  }
  const newTask={
    id:genId(),name,type,priority:type==='event'?'none':priority,category:'none',notes:'',attachments:[],location:'',
    date:dateVal,time:timeVal,allday:false,duration:_qaDur,scheduled:true,done:false,
    recur:false,recurN:1,recurU:'day',recurDays:[],subtasks:[],doneOverrides:[],deletedOccurrences:[],
    multiDay:false,endDate:'',eventColor:'',suppressRoutines:false
  };
  tasks.push(newTask);
  save();renderAll();closeQuickAdd();
  // Undo toast so user can easily revert a quick add
  showUndoToast('"'+name+'" added',()=>{
    tasks=tasks.filter(t=>t.id!==newTask.id);
    save();renderAll();
  });
}

// ── N key opens quick-add ──────────────────────────────────────────────────
document.addEventListener('keydown',function(e){
  if(_qaOpen&&e.key==='Escape'){e.preventDefault();closeQuickAdd();return;}
  if(_qaOpen&&(e.key==='Enter')&&(e.ctrlKey||e.metaKey)){e.preventDefault();saveQuickAdd();return;}
  // Open on N (not when typing in an input/textarea)
  if(e.key==='n'||e.key==='N'){
    const tag=document.activeElement.tagName;
    const inModal=document.activeElement.closest('.modal-overlay.open,.modal');
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||inModal||document.activeElement.isContentEditable)return;
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
  try{localStorage.setItem('clarity_journal', JSON.stringify(journal));}catch(e){showToast('Storage full');console.error(e);}
}
loadJournal();

// ── Month Notes ──
let monthNotes={};
try{monthNotes=JSON.parse(localStorage.getItem('clarity_month_notes')||'{}')}catch{monthNotes={}}
function saveMonthNotesData(){try{localStorage.setItem('clarity_month_notes',JSON.stringify(monthNotes))}catch(e){showToast('Storage full');console.error(e)}}

const MOOD_EMOJIS = ['😔','😐','🙂','😊','🌟'];
const MOOD_LABELS = { '😔':'Rough day','😐':'Just okay','🙂':'Pretty good','😊':'Good day','🌟':'Amazing day' };

function openJournalForDate(dateKey){
  _journalDate = dateKey;
  const entry = journal[dateKey] || {};
  const d = fromDk(dateKey);
  const todayKey = dk(new Date());
  const isToday = dateKey === todayKey;

  // Date label (may not exist in day view journal)
  const dateLabel = DLONG[d.getDay()] + ', ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  const dlEl = document.getElementById('journalDateLabel');
  if(dlEl) dlEl.textContent = isToday ? 'Today' : dateLabel;
  const dsEl = document.getElementById('journalDateSub');
  if(dsEl) dsEl.textContent = isToday ? 'How did your day go?' : dateLabel;

  // Mood
  _journalMood = entry.mood || '';
  MOOD_EMOJIS.forEach((em, i) => {
    const btn = document.getElementById('mood-' + i);
    if(btn) btn.classList.toggle('selected', em === _journalMood);
  });

  // Text
  const ta = document.getElementById('journalTa');
  if(ta) ta.value = entry.text || '';

  // Journal prompt
  renderJournalPrompt();

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
  const palette = getSuggPalette();
  const catColor = palette[ci % palette.length];
  _ideaItem = {name: item.name, sub: item.sub, color: catColor, priority: item.priority};
  _ideaPri = item.priority || 'none';

  // Populate header
  document.getElementById('ideaColorBar').style.background = catColor;
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
      type:     'task',
      priority: _ideaPri,
      category: 'none',
      notes:    notes || _ideaItem.sub,
      attachments: [],
      location: '',
      date:     dateVal,
      time:     timeVal,
      allday:   false,
      duration: 30,
      scheduled: true,
      done:      false,
      recur,
      recurN,
      recurU,
      recurDays: [],
      subtasks: [],
      doneOverrides:      [],
      deletedOccurrences: [],
      multiDay: false, endDate: '', eventColor: '', suppressRoutines: false
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

  // Week start day buttons
  const wkSun=document.getElementById('wkStartSun');
  const wkMon=document.getElementById('wkStartMon');
  if(wkSun&&wkMon){wkSun.classList.toggle('active',weekStartDay===0);wkMon.classList.toggle('active',weekStartDay===1);}

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
  onRoutineTypeChange(); // set initial schedulable toggle state

  // Apply bullet behavior to textareas
  addBulletBehavior(document.getElementById('aiInput'));
  addBulletBehavior(document.getElementById('journalTa'));

  // Sunday evening wrap-up auto-show (guarded by setting)
  const wrapupAuto=localStorage.getItem('clarity_wrapup_auto')==='true';
  const wrapupToggle=document.getElementById('wrapupAutoToggle');
  if(wrapupToggle)wrapupToggle.classList.toggle('on',wrapupAuto);
  const now=new Date();
  if(wrapupAuto&&now.getDay()===0&&now.getHours()>=17){
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
  restoreFocusTimer();

  // Quick event input — enter to add
  const qeInput=document.getElementById('qeInput');
  if(qeInput)qeInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addQuickEvent();}});
}
document.addEventListener('DOMContentLoaded',clarityInit);
