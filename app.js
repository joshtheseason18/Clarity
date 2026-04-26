// ══ SUPABASE AUTH ══════════════════════════
const SUPABASE_URL='https://owvevphwezdqzsiywrwm.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im93dmV2cGh3ZXpkcXpzaXl3cndtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNzEzMDUsImV4cCI6MjA5MTg0NzMwNX0.QAYElYBPc3dcbJvPAvHJo6hTifQcVNHJC8KyM6hZsUE';
const EDGE_FN_URL=SUPABASE_URL+'/functions/v1/claude-proxy';

let _supabase=null;
let _authUser=null;
let _isGuest=false;

// ══ TIER GATING ═══════════════════════════════
// Guest: everything works, nothing saves on refresh
// Signed in (free): data saves, some features locked
// Pro (signed in + paid): everything
function isMid(){return !_isGuest && !!_authUser;}
function isPro(){return !_isGuest && !!_authUser;} // Phase 1: signed-in = Pro for testing. Phase 2: check _subscription?.status
function canUsePro(feature){
  // Guests can try everything (no save anyway)
  if(_isGuest)return true;
  // Signed-in: must be Pro
  return isPro();
}
function showProPrompt(feature){
  const el=document.getElementById('proPromptOverlay');if(!el)return;
  const title=document.getElementById('proPromptTitle');
  const desc=document.getElementById('proPromptDesc');
  const btn=document.getElementById('proPromptBtn');
  if(title)title.textContent=feature||'Unlock this feature';
  const msgs={
    'Plan My Day':'Luclaro reads your routines, avoids conflicts, and fills your calendar in seconds.',
    'Deadlines':'Track due dates, schedule work sessions, and stay on top of assignments.',
    'Subtasks':'Automatically break tasks into smaller steps.',
    'Custom themes':'Personalize your LuClaro experience with custom color themes.',
    'Save your work':'Your tasks and schedule will be saved when you sign in.',
  };
  if(desc)desc.textContent=msgs[feature]||'Sign in with Google to unlock this feature.';
  if(btn)btn.textContent=_isGuest?'Sign in to save':'Upgrade to Pro';
  // Phase A step 2 hotfix: .modal-overlay defaults to opacity:0; pointer-events:none.
  // display:flex alone left this modal invisible.
  el.style.display='flex';
  void el.offsetWidth;
  el.classList.add('show');
}
function closeProPrompt(){
  const el=document.getElementById('proPromptOverlay');if(!el)return;
  el.classList.remove('show');
  setTimeout(()=>{el.style.display='none';},200);
}

// Guest mode: clear data on fresh page load
function clearGuestData(){
  if(!_isGuest)return;
  const keysToKeep=['clarity_username','clarity_dark']; // keep name + dark mode pref
  const allKeys=Object.keys(localStorage).filter(k=>k.startsWith('clarity_'));
  allKeys.forEach(k=>{if(!keysToKeep.includes(k))localStorage.removeItem(k);});
}

// ══ NEW STATE ══════════════════════════════════
function updateTierUI(){
  // Update deadlines tab lock icon
  const dlLock=document.getElementById('dlTabLock');
  if(dlLock)dlLock.style.display=canUsePro('Deadlines')?'none':'';
  // Guest banner
  const gb=document.getElementById('guestBanner');
  if(gb)gb.style.display=_isGuest?'flex':'none';
  // Theme swatch lock indicators
  ['rose','slate','amber'].forEach(t=>{
    const sw=document.getElementById('sw-'+t);
    if(!sw)return;
    const existing=sw.querySelector('.theme-swatch-lock');
    if(!canUsePro('Custom themes')&&!_isGuest){
      // Signed-in non-Pro: show lock
      if(!existing){
        const lock=document.createElement('div');lock.className='theme-swatch-lock';lock.textContent='Pro';
        sw.style.position='relative';sw.appendChild(lock);
      }
    } else {
      // Guest or Pro: no lock
      if(existing)existing.remove();
    }
  });
  // Re-render brain dump with tier-appropriate features
  if(sidebarOpen)renderBD();
}

let _justScheduled=[]; // {id,name,dest,type,time,date,undoFn}
let _bdSortMode='urgency'; // 'urgency' or 'priority'
let _bdSelectedIds=new Set(); // selected for batch schedule (mid tier)

function initSupabase(){
  if(window.supabase&&window.supabase.createClient){
    _supabase=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
  }
}
initSupabase();

async function checkAuthState(){
  if(!_supabase){showSplashState('signin');return;}
  try{
    const{data:{session}}=await _supabase.auth.getSession();
    if(session&&session.user){
      _authUser=session.user;
      _isGuest=false;
      const meta=session.user.user_metadata||{};
      const currentName=localStorage.getItem('clarity_username');
      if(!currentName&&meta.full_name){
        localStorage.setItem('clarity_username',meta.full_name.split(' ')[0]);
      }
      // If user has a name already, go straight to app
      if(localStorage.getItem('clarity_username')){
        showSplashState('entering');
        setTimeout(()=>enterApp(),600);
      } else {
        showSplashState('name');
      }
    } else {
      showSplashState('signin');
    }
  }catch(e){
    console.error('Auth check failed:',e);
    showSplashState('signin');
  }
}

function showSplashState(state){
  const authWrap=document.getElementById('splashAuthWrap');
  const authLoading=document.getElementById('splashAuthLoading');
  const nameStep=document.getElementById('splashNameStep');
  if(!authWrap)return;
  authWrap.style.display='none';
  authLoading.style.display='none';
  nameStep.style.display='none';
  if(state==='signin'){
    authWrap.style.display='';
  } else if(state==='loading'){
    authLoading.style.display='';
  } else if(state==='name'){
    nameStep.style.display='';
    const nameInput=document.getElementById('splashName');
    if(nameInput)setTimeout(()=>nameInput.focus(),400);
  } else if(state==='entering'){
    // briefly show nothing before app loads
  }
}

function finishNameStep(){
  const nameInput=document.getElementById('splashName');
  const name=(nameInput?nameInput.value.trim():'');
  if(!name){nameInput.focus();return;}
  localStorage.setItem('clarity_username',name);
  if(!_authUser){
    _isGuest=true;
    clearGuestData();
  }
  enterApp();
}

function startGuestMode(){
  // Show name step for guest entry
  showSplashState('name');
}

async function signInWithGoogle(){
  if(!_supabase){showToast('Authentication unavailable');return;}
  showSplashState('loading');
  try{
    const{error}=await _supabase.auth.signInWithOAuth({
      provider:'google',
      options:{
        redirectTo:window.location.origin+window.location.pathname
      }
    });
    if(error)throw error;
  }catch(e){
    console.error('Google sign-in error:',e);
    showToast('Sign-in failed — try again');
    showSplashState('signin');
  }
}

async function signOutUser(){
  if(_supabase){
    try{await _supabase.auth.signOut();}catch(e){console.error(e);}
  }
  _authUser=null;
  _isGuest=false;
  closeDrawer();
  const splash=document.getElementById('splash');
  splash.style.display='';
  splash.classList.remove('hiding');
  showSplashState('signin');
}

function updateAccountUI(){
  const accSection=document.getElementById('accountSection');
  if(!accSection)return;
  if(_authUser){
    accSection.style.display='';
    const meta=_authUser.user_metadata||{};
    const name=meta.full_name||_authUser.email||'User';
    const email=_authUser.email||'';
    const initials=name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    document.getElementById('accountAvatar').textContent=initials;
    document.getElementById('accountName').textContent=name;
    document.getElementById('accountEmail').textContent=email;
  } else {
    accSection.style.display='none';
  }
}

// Get auth token for API calls
async function getAuthToken(){
  if(!_supabase||_isGuest)return null;
  try{
    const{data:{session}}=await _supabase.auth.getSession();
    return session?.access_token||null;
  }catch(e){return null;}
}

// Proxied API call — uses Edge Function when authenticated, direct when in artifact.
// Model defaults to Haiku 4.5 (3× cheaper than Sonnet). Pass a different model string
// (e.g. 'claude-sonnet-4-6') to override. Used by callClaudeAPIWithFallback for
// silent tiered escalation when Haiku's output is insufficient.
async function callClaudeAPI(messages,maxTokens=400,model='claude-haiku-4-5'){
  // Hard cap to protect cost
  const cappedTokens=Math.min(maxTokens,800);
  const token=await getAuthToken();
  const body=JSON.stringify({model,max_tokens:cappedTokens,messages});
  let data;
  if(token){
    // Authenticated — use Edge Function proxy
    const res=await fetch(EDGE_FN_URL,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer '+token
      },
      body
    });
    data=await res.json();
  } else {
    // Guest/artifact mode — try direct (works in claude.ai artifacts)
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body
    });
    data=await res.json();
  }
  // Validate response has expected structure
  if(data.error){
    console.error('Claude API error:',data.error);
    throw new Error(typeof data.error==='string'?data.error:data.error.message||'API returned an error');
  }
  if(!data.content||!Array.isArray(data.content)){
    console.error('Unexpected API response:',data);
    throw new Error('Unexpected response from Luclaro — check console for details');
  }
  return data;
}

// ── Silent tiered fallback ──
// Tries Haiku first. If the call throws OR the caller-provided validator returns
// null/undefined (signalling bad output), silently retries with Sonnet.
// User sees nothing — just gets a good result. Only pays double on the ~5% of
// calls where Haiku's output is unusable.
//
// `validator` receives the raw API response and should return the parsed/validated
// result (truthy) to accept, or null to trigger fallback.
async function callClaudeAPIWithFallback(messages,maxTokens,validator){
  let haikuErr=null;
  // Attempt 1: Haiku 4.5
  try{
    const data=await callClaudeAPI(messages,maxTokens,'claude-haiku-4-5');
    const validated=validator?validator(data):data;
    if(validated){return{result:validated,model:'haiku'};}
    // Validator rejected — fall through to Sonnet
    console.warn('Haiku output rejected by validator, falling back to Sonnet');
  }catch(err){
    haikuErr=err;
    console.warn('Haiku call failed, falling back to Sonnet:',err.message);
  }
  // Attempt 2: Sonnet 4.6 (silent upgrade)
  bumpStat('ai_fallback_sonnet');
  try{
    const data=await callClaudeAPI(messages,maxTokens,'claude-sonnet-4-6');
    const validated=validator?validator(data):data;
    if(validated){return{result:validated,model:'sonnet'};}
    // Both models failed validation
    throw new Error('Both models returned invalid output');
  }catch(err){
    // Prefer Haiku error message if Sonnet also failed (usually same cause)
    throw haikuErr||err;
  }
}

// Listen for auth state changes (handles redirect back from Google)
if(_supabase){
  _supabase.auth.onAuthStateChange((event,session)=>{
    if(event==='SIGNED_IN'&&session?.user){
      _authUser=session.user;
      _isGuest=false;
      updateTierUI();
      const meta=session.user.user_metadata||{};
      const currentName=localStorage.getItem('clarity_username');
      if(!currentName&&meta.full_name){
        localStorage.setItem('clarity_username',meta.full_name.split(' ')[0]);
      }
      // If on splash, proceed to name step or enter app
      const splash=document.getElementById('splash');
      if(splash&&splash.style.display!=='none'){
        if(localStorage.getItem('clarity_username')){
          showSplashState('entering');
          setTimeout(()=>enterApp(),600);
        } else {
          showSplashState('name');
        }
      }
    }
  });
}

// Check auth on page load
checkAuthState();

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
function setTheme(t){
  if(t!=='emerald'&&!canUsePro('Custom themes')){
    showProPrompt('Custom themes');return;
  }
  applyTheme(t);
}

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

// ══ TOUR (replaced by sandbox demo — see onboarding.js) ═══
function replayTour(){
  if(typeof startSandboxDemo==='function'){
    closeDrawer();
    closeHelp();
    setTimeout(()=>startSandboxDemo(),300);
  } else {
    showToast('Tour unavailable — reload and try again');
  }
}

// ══ HELP CENTER ════════════════════════════════
const HELP_TOPICS=[
  {cat:'Getting Started',items:[
    {q:'What is Brain Dump?',a:'Brain Dump is your inbox for thoughts. Open the sidebar and write down anything — tasks, ideas, reminders. Don\'t organize, just dump. When you\'re ready, drag items onto the calendar to schedule them.<div class="help-tip"><strong>Shortcut:</strong> Press <span class="help-key">N</span> to open Quick Add from anywhere.</div>'},
    {q:'How do I schedule a task?',a:'Three ways:<br><br><strong>1. Drag from Brain Dump</strong> — open the sidebar, grab a card, drop it onto any time slot.<br><br><strong>2. Click a time slot</strong> — click any empty slot in Day or Week view to create a new task.<br><br><strong>3. Plan My Day</strong> — tap the sparkle button, list what you want to do, and Luclaro builds the schedule around your routines.'},
    {q:'How do I move a task?',a:'Grab from the <strong>top edge</strong> of any task block — the top ~25 pixels are the drag zone. You\'ll see a subtle grip line and the area highlights on hover. Click and hold there, then drag to a new time slot.<br><br>Clicking <strong>below</strong> the top edge opens the edit modal instead.<div class="help-tip"><strong>Tip:</strong> The colored border + grip line = drag zone. Everything below = tap to edit.</div>'}
  ]},
  {cat:'Quick Events',items:[
    {q:'How does Quick Event parsing work?',a:'Type naturally in the Quick Event bar (Schedule tab). Luclaro extracts the name, date, time, duration, and location automatically.<br><br><strong>Examples:</strong><br><code>Dinner Friday 7pm</code> → Dinner, this Friday, 7:00 PM<br><code>Meeting 4/20 2pm for 2 hours</code> → 2h duration<br><code>Dentist tomorrow 10am at Dr. Lee</code> → with location<br><code>Mom\'s birthday 5/15</code> → all-day, repeats yearly<div class="help-tip"><strong>Missing info?</strong> If date or time isn\'t detected, the event goes to Brain Dump so you can add details later.</div>'},
    {q:'How do birthdays work?',a:'Type any event with <strong>"birthday"</strong>, <strong>"bday"</strong>, or <strong>"anniversary"</strong> in the name. Luclaro automatically sets it as an all-day event that recurs every year.<br><br><code>Mom\'s birthday 5/15</code> → All Day, May 15, ↻ yearly<br><br>You can also create them manually: new event → toggle All Day → set Repeat to every 1 year.'}
  ]},
  {cat:'Routines',items:[
    {q:'What are routines?',a:'Routines are <strong>time containers</strong>, not tasks. They define the structure of your day — when you work, exercise, sleep, commute. You never "check off" a routine. They show as background bands on the calendar.<br><br>Go to <strong>Schedule → My Routine</strong> to set them up.'},
    {q:'Window vs Block — what\'s the difference?',a:'<strong>Window</strong> = time is reserved but <strong>open for tasks</strong>. Luclaro actively places matching tasks here. You can manually schedule tasks inside windows too.<br><br><strong>Block</strong> = <strong>fully reserved</strong>. Nothing gets scheduled here — not manually, not automatically.<div class="help-tip"><strong>Key insight:</strong> Windows are containers. Put your "Chest & Triceps" recurring task inside your Gym window. The routine says <em>when</em>, the task says <em>what</em>.</div>'},
    {q:'Can I skip a routine for one day?',a:'Yes! In Day view, you\'ll see routine chips at the top of the timeline. Each chip has a <strong>Skip</strong> button. Tap it to skip that routine for just that day. Tap <strong>Undo</strong> to restore it.'}
  ]},
  {cat:'Events',items:[
    {q:'How do multi-day events work?',a:'When creating or editing an event, toggle <strong>Multi-day event</strong>. Pick a start and end date. The event appears as a colored bar across all days in your calendar.<br><br>Toggle <strong>Pause routines</strong> to keep the days completely open — perfect for vacations and trips.'},
    {q:'How does recurrence work?',a:'In any task or event\'s edit modal, toggle <strong>Repeat</strong>. Set the frequency (daily, weekly, monthly) and interval.<br><br>For <strong>weekly recurrence</strong>, pick specific days: Mon/Wed/Fri for gym, Tue/Thu for class. Day-of-week buttons appear when you choose "week".<br><br><strong>Yearly</strong> works great for birthdays and anniversaries.'}
  ]},
  {cat:'Holidays',items:[
    {q:'How do I add holidays?',a:'Go to <strong>Schedule → Holidays</strong>. Toggle any US federal holiday and it creates an all-day event that automatically pauses your routines.<br><br>Use <strong>Select All</strong> for all holidays, or <strong>+ Add custom day off</strong> for personal days.'}
  ]},
  {cat:'Plan My Day',items:[
    {q:'How does Plan My Day work?',a:'Tap the <strong>Plan My Day</strong> button to let Luclaro place your brain dump items and typed tasks into open time windows. It considers:<br><br><strong>✓ Routine windows</strong> — places matching tasks inside them<br><strong>✕ Blocked time</strong> — avoids completely<br><strong>✓ Existing tasks & events</strong> — won\'t double-book<br><strong>✓ Holidays</strong> — knows if routines are paused<br><strong>✓ Multi-day events</strong> — sees vacations spanning the day<br><br>Luclaro also infers realistic durations, detects events and birthdays, handles day-of-week recurrence, and splits tasks with sub-item lists into subtasks automatically.'},
    {q:'What should I type in the "Anything else?" box?',a:'Type tasks one per line. For instant scheduling, include a time like <code>3pm</code> and duration like <code>45min</code>. Examples:<br><br><code>Study 3pm 45min</code><br><code>Lunch tomorrow noon</code><br><code>Gym Mon/Wed/Fri 6pm</code><br><code>Mom\'s birthday 5/15</code><br><br>Free-form text works too — Luclaro figures out durations based on common keywords (gym ≈ 45min, meeting ≈ 30min, etc.) and learns your personal patterns over time.'},
    {q:'Does Luclaro learn my habits?',a:'Yes. Every time you schedule a task, Luclaro quietly remembers the duration, category, and time you chose. After you repeat a task 3+ times, it starts using <em>your</em> typical values as the default — so "gym" will auto-fill with your usual 45 or 60 minutes instead of a generic default.<br><br>This data stays on your device and is never shared.'},
    {q:'Can Luclaro generate subtasks?',a:'Yes! When editing a task, go to the <strong>Subtasks</strong> tab and tap <strong>Generate Subtasks</strong>. Luclaro uses:<br><br><strong>1.</strong> Pattern split — if the task name contains a list like <code>"Study: geography, calculus, physics"</code>, it auto-splits into subtasks<br><strong>2.</strong> Templates — common patterns (study, workout, write, clean, code, etc.) have pre-built subtask structures<br><strong>3.</strong> Smart fallback — for unique tasks, Luclaro generates custom subtasks on demand'}
  ]},
  {cat:'Focus Mode',items:[
    {q:'How does Focus Mode work?',a:'Click <strong>▶ Focus</strong> on any task to start a timed session. Choose your mode:<br><br><strong>Sprint</strong> — 25-minute focused blocks<br><strong>Task duration</strong> — uses the task\'s set duration<br><strong>Custom</strong> — set your own time with the slider<br><br>You can minimize to a floating pill timer while you work.'}
  ]},
  {cat:'Keyboard Shortcuts',items:[
    {q:'What shortcuts are available?',a:'<span class="help-key">N</span> — Open Quick Add<br><span class="help-key">Esc</span> — Close any modal or overlay<br><span class="help-key">Ctrl</span>+<span class="help-key">Enter</span> — Save task in modal<br><span class="help-key">←</span> <span class="help-key">→</span> — Navigate dates<br><span class="help-key">/</span> — Open search'}
  ]}
];
function openHelp(){
  document.getElementById('helpOverlay').classList.add('open');
  document.getElementById('helpSearch').value='';
  renderHelpContent();
}
function closeHelp(){document.getElementById('helpOverlay').classList.remove('open')}
function renderHelpContent(filter){
  const body=document.getElementById('helpBody');
  let html='';
  HELP_TOPICS.forEach(cat=>{
    const items=filter?cat.items.filter(i=>i.q.toLowerCase().includes(filter)||i.a.toLowerCase().includes(filter)):cat.items;
    if(!items.length)return;
    html+=`<div class="help-cat"><div class="help-cat-title">${cat.cat}</div>`;
    items.forEach((item,i)=>{
      html+=`<div class="help-item" onclick="this.classList.toggle('open')">
        <div class="help-q">${item.q}<span class="help-q-icon">›</span></div>
        <div class="help-a">${item.a}</div>
      </div>`;
    });
    html+=`</div>`;
  });
  if(!html)html='<div style="text-align:center;padding:40px 0;color:var(--text3);font-size:13px">No results found</div>';
  body.innerHTML=html;
}
function filterHelp(q){renderHelpContent(q.toLowerCase().trim()||null)}

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
  'What\'s one idea you had today?',
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
  // Scope to the week containing the selected day
  const sel=new Date(selDate);sel.setHours(0,0,0,0);
  const dow=(sel.getDay()-weekStartDay+7)%7;
  const weekStart=addDays(sel,-dow);
  const weekEnd=addDays(weekStart,6);
  // Get events for this week, starting from today (don't show past events)
  const rangeStart=today>weekStart?today:weekStart;
  if(rangeStart>weekEnd){el.innerHTML='';return;} // selected week is entirely in the past
  const upcoming=expandedTasks(rangeStart,weekEnd).filter(t=>(t.type||'task')==='event'&&t._instanceDate>=todayKey).sort((a,b)=>(a._instanceDate+(a.time||'')).localeCompare(b._instanceDate+(b.time||'')));
  // Deduplicate multi-day events
  const seenMd=new Set();
  const filtered=upcoming.filter(t=>{
    if(t._isMultiDay){if(seenMd.has(t.id))return false;seenMd.add(t.id);}
    return true;
  });
  if(!filtered.length){el.innerHTML='';return;}
  const count=Math.min(filtered.length,5);
  const shown=filtered.slice(0,count);
  let html=`<button class="upcoming-toggle" onclick="_upcomingExpanded=!_upcomingExpanded;renderUpcomingEvents()">
    <span>${_upcomingExpanded?'▾':'▸'}</span> ${filtered.length} event${filtered.length!==1?'s':''} this week
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
    if(filtered.length>5)html+=`<div style="text-align:center;font-size:10px;color:var(--text3);padding:4px">+${filtered.length-5} more</div>`;
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
  updateAccountUI();
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
  // Ideas tab moved to Schedule view — no sidebar visibility toggle needed
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
  setTimeout(()=>{splash.style.display='none';updateAccountUI();updateTierUI();renderAll();},500);
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
let _scheduleTab='tasks'; // 'tasks','habits','routine','holidays','ideas'
let catFilter='all';
let showDone=false;
let _taskViewFilter='all'; // 'all','active','completed','overdue','deadlines','events'
function switchScheduleTab(tab){
  _scheduleTab=tab;
  document.querySelectorAll('.sched-seg-btn').forEach(b=>b.classList.remove('active'));
  const btn=document.getElementById('schedTab_'+tab);
  if(btn)btn.classList.add('active');
  // Show/hide areas
  ['Tasks','Habits','Routine','Holidays','Ideas'].forEach(area=>{
    const el=document.getElementById('cat'+area+'Area');
    if(el)el.style.display=tab===area.toLowerCase()?'':'none';
  });
  // Chips row: visible on tasks only
  const chipsRow=document.getElementById('catChips');
  if(chipsRow)chipsRow.style.display=tab==='tasks'?'flex':'none';
  const taskControls=document.getElementById('catTaskControls');
  if(taskControls)taskControls.style.display=tab==='tasks'?'flex':'none';
  if(tab==='tasks')renderCat();
  else if(tab==='habits')renderHabits();
  else if(tab==='routine')renderRoutineList();
  else if(tab==='holidays')renderHolidaysList();
  else if(tab==='ideas')renderSuggestions();
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
  // Truncate recurring events: max 3 instances per recurring source, then summary
  const recurCount={};
  const MAX_RECUR_SHOW=2;
  const truncated=[];
  const recurSummaries={};
  events.forEach(t=>{
    if(t.recur){
      const rid=t.id;
      recurCount[rid]=(recurCount[rid]||0)+1;
      if(recurCount[rid]<=MAX_RECUR_SHOW){
        truncated.push(t);
      } else if(recurCount[rid]===MAX_RECUR_SHOW+1){
        const unitLabel=t.recurU==='day'?'daily':t.recurU==='week'?(t.recurN===1?'weekly':'every '+t.recurN+' weeks'):t.recurU==='year'?(t.recurN===1?'yearly':'every '+t.recurN+' years'):(t.recurN===1?'monthly':'every '+t.recurN+' months');
        recurSummaries[rid]={name:t.name,unit:unitLabel,id:rid,idate:t._instanceDate||t.date,cc:catColor(t.category)};
      }
    } else {
      truncated.push(t);
    }
  });
  const todayKey=dk(today);
  let html='';
  if(!truncated.length&&!Object.keys(recurSummaries).length){
    html=`<div class="cat-empty" style="padding:40px 0;text-align:center">
      <div style="font-size:28px;margin-bottom:8px"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="3" stroke="currentColor" stroke-width="1.5" opacity=".5"/><line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" stroke-width="1.5" opacity=".5"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity=".5"/></svg></div>
      <div style="font-size:13px;font-weight:500;color:var(--text)">No events yet</div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px">Create an event from the Day or Week view</div>
    </div>`;
  } else {
    const upcoming=truncated.filter(t=>t._instanceDate>todayKey);
    const todayEvs=truncated.filter(t=>t._instanceDate===todayKey);
    const pastEvs=truncated.filter(t=>t._instanceDate<todayKey);
    if(todayEvs.length){
      html+=`<div class="cat-section"><div class="cat-sec-title">Today</div>`;
      todayEvs.forEach(t=>{html+=eventRow(t)});
      html+=`</div>`;
    }
    if(upcoming.length||Object.keys(recurSummaries).length){
      html+=`<div class="cat-section"><div class="cat-sec-title">Upcoming</div>`;
      upcoming.forEach(t=>{
        html+=eventRow(t);
        // Insert recurrence summary after the last shown instance
        const rid=t.id;
        if(recurSummaries[rid]&&recurCount[rid]&&t===upcoming.filter(u=>u.id===rid).pop()){
          const s=recurSummaries[rid];
          const extraCount=(recurCount[rid]||0)-MAX_RECUR_SHOW;
          html+=`<div class="recur-summary-row" onclick="openCatEdit('${s.id}','${s.idate}',event)">
            <span class="recur-summary-dot" style="background:${s.cc}"></span>
            <span class="recur-summary-text"><strong>${esc(s.name)}</strong> · repeats ${s.unit}${extraCount>0?' · '+extraCount+' more':''}
            </span><span class="recur-summary-icon">↻</span>
          </div>`;
          delete recurSummaries[rid];
        }
      });
      // Any remaining summaries
      Object.values(recurSummaries).forEach(s=>{
        html+=`<div class="recur-summary-row" onclick="openCatEdit('${s.id}','${s.idate}',event)">
          <span class="recur-summary-dot" style="background:${s.cc}"></span>
          <span class="recur-summary-text"><strong>${esc(s.name)}</strong> · repeats ${s.unit}</span>
          <span class="recur-summary-icon">↻</span>
        </div>`;
      });
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

// ══ SMART SCHEDULER ═══════════════════════════════════════════════════
// Algorithm-first planning. AI is the final fallback only when needed.
// All the "AI" capabilities we promised users are fulfilled by code below,
// with Haiku 4.5 as a safety net for genuinely ambiguous prose.

// Keyword → duration (minutes) dictionary — seed defaults
const SMART_DUR_RULES=[
  {words:['call','phone','text','voicemail'],mins:15},
  {words:['email','reply','respond','inbox','check'],mins:15},
  {words:['quick','minor','remind','ping','confirm'],mins:15},
  {words:['standup','daily','scrum','huddle'],mins:15},
  {words:['meeting','sync','catchup','1on1','1-on-1','check-in'],mins:30},
  {words:['review','admin','errand','plan','outline'],mins:30},
  {words:['breakfast','coffee','snack'],mins:30},
  {words:['clean','tidy','laundry','dishes','organize'],mins:30},
  {words:['shopping','grocery','groceries'],mins:45},
  {words:['workout','gym','run','yoga','exercise','training','walk','hike','bike'],mins:45},
  {words:['lunch','dinner','meal','brunch'],mins:60},
  {words:['study','read','learn','research','homework'],mins:60},
  {words:['focus','deep work','deep-work','concentrate'],mins:90},
  {words:['write','draft','design','code','build','create','develop','implement'],mins:90},
  {words:['project','presentation','prepare','prep'],mins:60},
];

// Keyword → category guess (for smart category matching)
const SMART_CAT_RULES=[
  {words:['workout','gym','run','yoga','exercise','walk','hike','bike','training'],cat:'health'},
  {words:['meal','lunch','dinner','breakfast','brunch','cook','recipe'],cat:'personal'},
  {words:['study','read','learn','research','homework','class','lecture','school'],cat:'learning'},
  {words:['email','reply','call','meeting','sync','standup','review','project','work','office'],cat:'work'},
  {words:['clean','tidy','laundry','dishes','organize','shopping','grocery','errand'],cat:'personal'},
  {words:['write','draft','design','code','build','create'],cat:'work'},
];

// Subtask templates — {keyword: (totalDur) => [[pct, 'name'], ...]}
const SMART_SUB_TEMPLATES={
  study:     d=>[['Review notes',30],['Practice problems',40],['Summarize key points',30]],
  workout:   d=>[['Warmup',15],['Main sets',70],['Cooldown',15]],
  gym:       d=>[['Warmup',15],['Main sets',70],['Cooldown',15]],
  prepare:   d=>[['Review objectives',25],['Gather materials',25],['Practice walkthrough',50]],
  prep:      d=>[['Review objectives',25],['Gather materials',25],['Practice walkthrough',50]],
  write:     d=>[['Outline',25],['First draft',50],['Revise',25]],
  draft:     d=>[['Outline',25],['First draft',50],['Revise',25]],
  clean:     d=>[['Declutter',40],['Deep clean',40],['Put things away',20]],
  code:      d=>[['Design & plan',20],['Implement',60],['Test',20]],
  build:     d=>[['Design & plan',20],['Implement',60],['Test',20]],
  read:      d=>[['Preview / skim',20],['Deep read',60],['Notes & takeaways',20]],
  plan:      d=>[['Brainstorm',30],['Structure',50],['Finalize',20]],
  research:  d=>[['Gather sources',30],['Analyze & note',50],['Summarize findings',20]],
  meeting:   d=>[['Review agenda',20],['Main discussion',60],['Action items',20]],
  project:   d=>[['Review scope',20],['Execute main work',60],['Wrap-up & review',20]],
  shop:      d=>[['List items',20],['Shop',60],['Unpack & put away',20]],
  travel:    d=>[['Prepare & pack',25],['Travel',50],['Settle in',25]],
  review:    d=>[['Read through',40],['Identify issues',40],['Write feedback',20]],
};

// Personal pattern learning — stored as {name_lowered: {avgDur, cat, count, lastTime}}
let userPatterns={};
try{userPatterns=JSON.parse(localStorage.getItem('clarity_patterns')||'{}')}catch{userPatterns={}}
function saveUserPatterns(){
  try{localStorage.setItem('clarity_patterns',JSON.stringify(userPatterns))}catch(e){}
}
function recordPattern(name,dur,cat,time){
  if(!name)return;
  const key=name.toLowerCase().trim();
  if(!key||key.length>60)return; // ignore huge names
  const p=userPatterns[key]||{avgDur:0,count:0,cats:{},times:[]};
  p.count++;
  p.avgDur=Math.round(((p.avgDur*(p.count-1))+dur)/p.count/15)*15;
  if(cat&&cat!=='none'){p.cats[cat]=(p.cats[cat]||0)+1;}
  if(time&&p.times.length<10)p.times.push(time);
  userPatterns[key]=p;
  // Cap at 500 entries — evict least-used to prevent unbounded growth
  const keys=Object.keys(userPatterns);
  if(keys.length>500){
    const sorted=keys.sort((a,b)=>userPatterns[a].count-userPatterns[b].count);
    sorted.slice(0,keys.length-500).forEach(k=>delete userPatterns[k]);
  }
  saveUserPatterns();
}

// Smart usage stats (silent tracking)
let smartStats={};
try{smartStats=JSON.parse(localStorage.getItem('clarity_smart_stats')||'{}')}catch{smartStats={}}
function bumpStat(key,n){smartStats[key]=(smartStats[key]||0)+(n||1);try{localStorage.setItem('clarity_smart_stats',JSON.stringify(smartStats))}catch(e){}}

// Infer duration from task name — checks personal history first, then keywords
function inferDuration(name){
  if(!name)return 30;
  const key=name.toLowerCase().trim();
  // 1. Personal pattern (only trust after 3+ repetitions)
  const p=userPatterns[key];
  if(p&&p.count>=3&&p.avgDur>=15&&p.avgDur<=480)return p.avgDur;
  // 2. Keyword dictionary — match any word in the name
  const words=key.split(/\W+/).filter(Boolean);
  for(const rule of SMART_DUR_RULES){
    for(const w of words){
      if(rule.words.includes(w))return rule.mins;
    }
    // Also check multi-word phrases in original
    for(const phrase of rule.words){
      if(phrase.includes(' ')&&key.includes(phrase))return rule.mins;
    }
  }
  // 3. Fallback
  return 30;
}

// Infer category from task name
function inferCategory(name){
  if(!name)return null;
  const key=name.toLowerCase().trim();
  const p=userPatterns[key];
  if(p&&p.count>=3&&p.cats){
    // Most-common category for this task
    const topCat=Object.entries(p.cats).sort((a,b)=>b[1]-a[1])[0];
    if(topCat&&topCat[1]>=2)return topCat[0];
  }
  const words=key.split(/\W+/).filter(Boolean);
  for(const rule of SMART_CAT_RULES){
    for(const w of words){
      if(rule.words.includes(w))return rule.cat;
    }
  }
  return null;
}

// Pattern split: "Study: geography, calculus" → {name:'Study', subtasks:[...]}
// Also: "Meeting prep — slides, handouts" / "Clean kitchen - dishes, counters"
function patternSplitSubtasks(name,totalDur){
  if(!name)return null;
  const m=name.match(/^(.+?)\s*[:—–\-]\s*(.+)$/);
  if(!m)return null;
  const baseName=m[1].trim();
  const listStr=m[2].trim();
  if(!baseName||!listStr)return null;
  // Split on comma, semicolon, or "and"
  const items=listStr.split(/\s*[,;]\s*|\s+and\s+/i).map(s=>s.trim()).filter(Boolean);
  if(items.length<2)return null; // need at least 2 for it to be a real list
  if(items.some(i=>i.length>40))return null; // probably not a subtask list
  const durEach=Math.max(15,Math.round(totalDur/items.length/15)*15);
  return{
    name:baseName,
    subtasks:items.map(i=>({id:genId(),name:i,duration:durEach,done:false}))
  };
}

// Template-based subtask generator — returns subtasks or null
function templateSubtasks(taskName,totalDur){
  if(!taskName||totalDur<20)return null;
  const key=taskName.toLowerCase();
  const words=key.split(/\W+/).filter(Boolean);
  // Find first matching template keyword
  for(const w of words){
    const tmpl=SMART_SUB_TEMPLATES[w];
    if(tmpl){
      const parts=tmpl(totalDur);
      // parts = [['name', pct], ...]  — pct out of 100
      const subs=parts.map(([name,pct])=>{
        const d=Math.max(15,Math.round(totalDur*pct/100/15)*15);
        return{id:genId(),name,duration:d,done:false};
      });
      return subs;
    }
  }
  return null;
}

// Parse weekday patterns from text: "Mon/Wed/Fri" → [1,3,5], "every Monday" → [1]
// Returns {days:[], strippedText:string}
function extractWeekdays(text){
  if(!text)return{days:[],strippedText:text};
  const dayMap={sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6,
                sunday:0,monday:1,tuesday:2,wednesday:3,thursday:4,friday:5,saturday:6};
  const days=new Set();
  let t=text;
  // Pattern: "Mon/Wed/Fri" or "Mon Wed Fri" or "Mon, Wed, Fri"
  const slashPat=/\b((?:sun|mon|tue|wed|thu|fri|sat)(?:day)?)(?:\s*[\/,\s]+\s*((?:sun|mon|tue|wed|thu|fri|sat)(?:day)?))+\b/gi;
  const matches=[...t.matchAll(slashPat)];
  matches.forEach(m=>{
    const raw=m[0].toLowerCase();
    const nameRe=/\b(sun|mon|tue|wed|thu|fri|sat)(?:day)?\b/g;
    let dm;while((dm=nameRe.exec(raw))!==null){
      if(dayMap[dm[1]]!==undefined)days.add(dayMap[dm[1]]);
    }
    t=t.replace(m[0],'').trim();
  });
  // Pattern: "every Monday" / "every weekday" / "weekends"
  if(/\bevery\s+weekday\b/i.test(t)){[1,2,3,4,5].forEach(d=>days.add(d));t=t.replace(/\bevery\s+weekday\b/i,'').trim();}
  if(/\b(every\s+)?weekends?\b/i.test(t)){days.add(0);days.add(6);t=t.replace(/\b(every\s+)?weekends?\b/i,'').trim();}
  const everyPat=/\bevery\s+(sun|mon|tue|wed|thu|fri|sat)(?:day)?\b/gi;
  const em=[...text.matchAll(everyPat)];
  em.forEach(m=>{
    const d=dayMap[m[1].toLowerCase()];
    if(d!==undefined)days.add(d);
    t=t.replace(m[0],'').trim();
  });
  return{days:[...days].sort((a,b)=>a-b),strippedText:t.replace(/\s+/g,' ').trim()};
}

// ══ PLACEMENT ALGORITHM ═══════════════════════════════════════════════
// Find open 15-min slots in a day, respecting routines and existing tasks
function findOpenWindows(dateKey,startMin){
  // Returns array of [startMin, endMin] open windows on the day
  const routines=getRoutineForDay(dateKey);
  const suppressed=isRoutineSuppressed(dateKey);
  const dayTasks=tasksOn(dateKey).filter(t=>t.time&&!t.allday);
  // Start with the full day (from user's day start)
  const DAY_END=24*60;
  let windows=[[Math.max(0,startMin||8*60),DAY_END]];
  // Carve out blocked routines (only if not suppressed)
  if(!suppressed){
    routines.forEach(b=>{
      const isBlocked=b.schedulable!==undefined?!b.schedulable:!(ROUTINE_TYPES[b.type]?.schedulable);
      if(!isBlocked)return;
      const[bsh,bsm]=b.start.split(':').map(Number);
      const[beh,bem]=b.end.split(':').map(Number);
      const bStart=bsh*60+bsm,bEnd=beh*60+bem;
      // Handle overnight routines (e.g. Sleep 10pm-6am) — split into two carves
      if(bEnd<=bStart){
        windows=_carveRange(windows,bStart,DAY_END);
        windows=_carveRange(windows,0,bEnd);
      } else {
        windows=_carveRange(windows,bStart,bEnd);
      }
    });
  }
  // Carve out existing tasks
  dayTasks.forEach(t=>{
    const[h,m]=t.time.split(':').map(Number);
    const tStart=h*60+m;
    const tEnd=tStart+(t.duration||30);
    windows=_carveRange(windows,tStart,tEnd);
  });
  return windows.filter(([s,e])=>e-s>=15);
}
function _carveRange(windows,cutStart,cutEnd){
  const out=[];
  windows.forEach(([s,e])=>{
    if(cutEnd<=s||cutStart>=e){out.push([s,e]);return;}
    if(cutStart>s)out.push([s,cutStart]);
    if(cutEnd<e)out.push([cutEnd,e]);
  });
  return out;
}
// Check if a routine window matches the task's preferred time zone
function _routineMatchesTaskTime(b,hour){
  const[bsh]=b.start.split(':').map(Number);
  const[beh]=b.end.split(':').map(Number);
  return hour>=bsh&&hour<beh;
}

// Main smart scheduler — returns {scheduled:[], unscheduled:[], needsAI:[]}
// selectedBd: brain dump items to schedule
// extraLines: array of text lines (each could be a task)
// dateKey: target day
// prefs: {includeBreaks, prefMorning, prefAfternoon, startTime}
function smartSchedule(selectedBd,extraLines,dateKey,prefs){
  const scheduled=[];
  const unscheduled=[];
  const needsAI=[];
  const[sh,sm]=(prefs.startTime||'08:00').split(':').map(Number);
  const dayStartMin=sh*60+sm;
  const breakBuffer=prefs.includeBreaks?15:0;

  // 1. Parse each extra line
  const fromLines=[];
  (extraLines||[]).forEach(line=>{
    line=line.trim();if(!line)return;
    // Try the existing quick event parser first
    const parsed=parseQuickEvent(line);
    if(parsed&&parsed.name){
      // Extract weekdays from the original line
      const wd=extractWeekdays(parsed.name);
      const cleanName=wd.strippedText||parsed.name;
      fromLines.push({
        name:cleanName,
        time:parsed.time||null,
        duration:parsed.duration||inferDuration(cleanName),
        allday:parsed.allday||false,
        location:parsed.location||'',
        recur:parsed.recur||wd.days.length>0,
        recurN:parsed.recurN||1,
        recurU:wd.days.length>0?'week':(parsed.recurU||'day'),
        recurDays:wd.days.length>0?wd.days:[],
        category:inferCategory(cleanName)||'none',
        _fromLine:true,
      });
    } else {
      // Parser failed — might need AI
      needsAI.push(line);
    }
  });

  // 2. Build the task queue: fixed-time first (anchors), then everything else
  const allItems=[
    ...selectedBd.map(b=>({
      name:b.name,
      time:null,
      duration:b.duration||inferDuration(b.name),
      category:b.category&&b.category!=='none'?b.category:inferCategory(b.name)||'none',
      priority:b.priority||'none',
      notes:b.notes||'',
      _fromBd:true,
      _bdId:b.id,
    })),
    ...fromLines,
  ];

  // Detect subtask patterns in names
  allItems.forEach(item=>{
    if(item.subtasks&&item.subtasks.length)return;
    const split=patternSplitSubtasks(item.name,item.duration);
    if(split){
      item.name=split.name;
      item.subtasks=split.subtasks;
    }
  });

  // Separate into fixed-time (anchors) and flexible
  const fixed=allItems.filter(i=>i.time&&!i.allday);
  const flexible=allItems.filter(i=>!i.time&&!i.allday);
  const alldays=allItems.filter(i=>i.allday);

  // 3. Place fixed-time items first (they have priority — pre-declared times)
  fixed.forEach(item=>{
    const mins=_timeToMin(item.time);
    // Check if this slot is blocked (warn but still place)
    const blocked=isBlockedByRoutine(dateKey,item.time);
    scheduled.push({...item,time:_snap15Mins(mins),duration:Math.max(15,Math.round(item.duration/15)*15),_blocked:blocked.blocked});
  });
  alldays.forEach(item=>scheduled.push({...item,time:null,duration:item.duration||30}));

  // 4. Place flexible items into open windows
  // Sort by priority, morning/afternoon preference
  flexible.sort((a,b)=>{
    const pri={high:0,medium:1,low:2,none:3};
    return (pri[a.priority]||3)-(pri[b.priority]||3);
  });

  // Refresh open windows after fixed placements
  const tempTasks=[...tasks];
  const tempFixed=fixed.map(f=>({time:f.time,duration:f.duration}));

  flexible.forEach(item=>{
    const dur=Math.max(15,Math.round(item.duration/15)*15);
    const durWithBuffer=dur+breakBuffer;
    // Recompute windows with currently-placed items
    const placedTimes=scheduled.filter(s=>s.time&&!s.allday).map(s=>{
      const m=_timeToMin(s.time);return[m,m+s.duration];
    });
    const routineWindows=findOpenWindows(dateKey,dayStartMin);
    // Remove overlaps with already-scheduled items
    let avail=routineWindows;
    placedTimes.forEach(([ps,pe])=>{avail=_carveRange(avail,ps,pe+breakBuffer);});
    avail=avail.filter(([s,e])=>e-s>=dur);
    if(!avail.length){unscheduled.push(item);return;}

    // Pick slot based on preference
    let pickedStart=null;
    if(prefs.prefMorning){
      // Prefer slots before 12:00
      const morning=avail.filter(([s,e])=>s<12*60);
      pickedStart=morning.length?morning[0][0]:avail[0][0];
    } else if(prefs.prefAfternoon){
      const afternoon=avail.filter(([s,e])=>s>=12*60);
      pickedStart=afternoon.length?afternoon[0][0]:avail[avail.length-1][0];
    } else {
      pickedStart=avail[0][0];
    }
    // Snap to 15
    pickedStart=Math.round(pickedStart/15)*15;
    scheduled.push({...item,time:_minToTime(pickedStart),duration:dur});
  });

  return{scheduled,unscheduled,needsAI};
}
function _timeToMin(t){const[h,m]=t.split(':').map(Number);return h*60+m}
function _minToTime(mins){const h=Math.floor(mins/60)%24,m=mins%60;return(h<10?'0':'')+h+':'+(m<10?'0':'')+m}
function _snap15Mins(mins){return _minToTime(Math.round(mins/15)*15)}

// Input sanitization for AI calls — strip injection attempts
function sanitizeAIInput(text){
  if(!text)return'';
  return String(text)
    .replace(/<\|[^|]*\|>/g,'') // Strip special tokens
    .replace(/\b(ignore|disregard|forget)\s+(previous|all|above|prior)\b/gi,'[removed]')
    .replace(/\byou\s+are\s+now\b/gi,'[removed]')
    .replace(/\bsystem\s*[:>]/gi,'')
    .replace(/\bassistant\s*[:>]/gi,'')
    .slice(0,500); // Hard cap
}

// ══ END SMART SCHEDULER ══════════════════════════════════════════════



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

// Snap a time string to the nearest 15-minute mark
function snapTo15(timeStr){
  if(!timeStr)return timeStr;
  const[h,m]=timeStr.split(':').map(Number);
  const snapped=Math.round(m/15)*15;
  const totalMins=h*60+(snapped>=60?60:snapped);
  return pad(Math.floor(totalMins/60)%24)+':'+pad(totalMins%60);
}

// Phase A step 2 hotfix: deadline session-picker conflict checker calls toMins/fromMins
// which were never defined anywhere. Function exists as _timeToMin. Add aliases plus
// the inverse so existing calls work, without rewriting checkSessionConflicts.
function toMins(t){return _timeToMin(t);}
function fromMins(mins){const m=Math.max(0,Math.min(1439,mins|0));return pad(Math.floor(m/60)%24)+':'+pad(m%60);}

// Find the next available time within a 30-min slot when tasks already exist there
function nextAvailableTime(dateKey, slotTime){
  const allTasks=expandedTasks(fromDk(dateKey),fromDk(dateKey));
  const slotTasks=allTasks.filter(t=>{
    const td=(t._instanceDate||t.date);
    if(td!==dateKey||!t.time||!t.scheduled||t.allday)return false;
    const[sh,sm]=slotTime.split(':').map(Number);
    const[th,tm]=t.time.split(':').map(Number);
    const slotStart=sh*60+sm;
    const slotEnd=slotStart+30;
    const tStart=th*60+tm;
    // Task overlaps this slot if it starts within the 30-min window
    return tStart>=slotStart&&tStart<slotEnd;
  });
  if(!slotTasks.length)return slotTime;
  // Find the latest end time among existing tasks in this slot
  const[sh,sm]=slotTime.split(':').map(Number);
  const slotStartMins=sh*60+sm;
  let latestEnd=slotStartMins;
  slotTasks.forEach(t=>{
    const[th,tm]=t.time.split(':').map(Number);
    const endM=th*60+tm+(t.duration||30);
    if(endM>latestEnd)latestEnd=endM;
  });
  // Round up to nearest 15 minutes
  latestEnd=Math.ceil(latestEnd/15)*15;
  // Don't go past the next full slot boundary
  if(latestEnd>=slotStartMins+30)return slotTime;
  return pad(Math.floor(latestEnd/60)%24)+':'+pad(latestEnd%60);
}
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
          const recurEndDate=t.recurEnd?fromDk(t.recurEnd):null;
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
              if(recurEndDate&&dayDate>recurEndDate)continue; // past recurrence end date
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
        const recurEndDate2=t.recurEnd?fromDk(t.recurEnd):null;
        let iStart=1;
        const daysBetween=Math.floor((s-base)/(86400000));
        if(daysBetween>0){
          let step=t.recurU==='day'?t.recurN:t.recurU==='week'?t.recurN*7:t.recurU==='year'?t.recurN*365:t.recurN*30;
          if(step>0)iStart=Math.max(1,Math.floor(daysBetween/step)-1);
        }
        for(let i=iStart;i<=730;i++){
          let next=new Date(base);
          if(t.recurU==='day')next.setDate(next.getDate()+t.recurN*i);
          else if(t.recurU==='week')next.setDate(next.getDate()+t.recurN*7*i);
          else if(t.recurU==='year')next.setFullYear(next.getFullYear()+t.recurN*i);
          else next.setMonth(next.getMonth()+t.recurN*i);
          if(next>e)break;
          if(recurEndDate2&&next>recurEndDate2)break; // past recurrence end date
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
  document.querySelectorAll('.side-tab').forEach(b=>{
    const t=b.getAttribute('data-tab');
    b.classList.toggle('active',t===tab);
  });
  document.querySelectorAll('.side-panel').forEach(p=>p.classList.remove('active'));
  const panel=document.getElementById('panel-'+tab);
  if(panel)panel.classList.add('active');
  if(tab==='braindump'){renderBD();}
  if(tab==='deadlines'){
    if(!canUsePro('Deadlines')){showProPrompt('Deadlines');switchSide('braindump');return;}
    renderDeadlines();
  }
  // Focus mini-timer: show when not on focus overlay
  if(_focusRunning&&!_focusOverlayOpen)showFocusMiniTimer();
}
function toggleSidebar(){
  sidebarOpen=!sidebarOpen;
  document.getElementById('sidebar').classList.toggle('collapsed',!sidebarOpen);
  const bd=document.getElementById('sidebarBackdrop');
  if(bd)bd.classList.toggle('open',sidebarOpen);
  if(sidebarOpen){renderBD();if(activeSide==='deadlines'&&canUsePro('Deadlines'))renderDeadlines();}
  if(!sidebarOpen&&_focusRunning&&!_focusOverlayOpen)showFocusMiniTimer();
}

// ══ HABIT STREAKS ═══════════════════════════════
function getRecurringHabits(){
  return tasks.filter(t=>t.recur&&t.scheduled&&!t.done&&(t.type||'task')==='task');
}
function getExpectedDates(t,startDate,endDate){
  // Generate all expected occurrence dates for a recurring task within a range
  const dates=[];
  const start=fromDk(t.date);
  const end=endDate;
  const deleted=new Set(t.deletedOccurrences||[]);
  if(t.recurDays&&t.recurDays.length&&t.recurU==='week'){
    // Day-of-week recurrence
    let d=new Date(Math.max(start,startDate));d.setHours(0,0,0,0);
    while(d<=end){
      if(t.recurDays.includes(d.getDay())&&dk(d)>=t.date&&!deleted.has(dk(d))){
        dates.push(dk(d));
      }
      d=addDays(d,1);
    }
  } else {
    // Standard interval recurrence
    let d=new Date(start);d.setHours(0,0,0,0);
    while(d<=end){
      if(d>=startDate&&!deleted.has(dk(d))){
        dates.push(dk(d));
      }
      // Advance by interval
      if(t.recurU==='day')d=addDays(d,t.recurN||1);
      else if(t.recurU==='week')d=addDays(d,7*(t.recurN||1));
      else if(t.recurU==='month'){d.setMonth(d.getMonth()+(t.recurN||1));}
      else if(t.recurU==='year'){d.setFullYear(d.getFullYear()+(t.recurN||1));}
      else d=addDays(d,1);
    }
  }
  return dates;
}
function getHabitStats(t){
  const today=new Date();today.setHours(0,0,0,0);
  const todayKey=dk(today);
  const doneSet=new Set(t.doneOverrides||[]);
  // Look back 90 days for stats
  const lookback=addDays(today,-90);
  const taskStart=fromDk(t.date);
  const rangeStart=taskStart>lookback?taskStart:lookback;
  const expected=getExpectedDates(t,rangeStart,today);
  // Filter to past and today only
  const pastExpected=expected.filter(d=>d<=todayKey);
  const completed=pastExpected.filter(d=>doneSet.has(d));
  const rate=pastExpected.length?Math.round(completed.length/pastExpected.length*100):0;
  // Current streak: count backwards from most recent expected date
  let streak=0;
  for(let i=pastExpected.length-1;i>=0;i--){
    if(doneSet.has(pastExpected[i]))streak++;
    else break;
  }
  // Best streak
  let best=0,cur=0;
  pastExpected.forEach(d=>{
    if(doneSet.has(d)){cur++;if(cur>best)best=cur;}
    else cur=0;
  });
  // Last 16 weeks for heatmap
  const hmStart=addDays(today,-112);
  const hmExpected=getExpectedDates(t,hmStart,today);
  const heatmap=hmExpected.map(d=>({date:d,done:doneSet.has(d)}));
  return{streak,best,rate,completed:completed.length,total:pastExpected.length,heatmap};
}
let _habitExpanded=null;
function renderHabits(){
  const panel=document.getElementById('habitsPanel');if(!panel)return;
  const habits=getRecurringHabits();
  if(!habits.length){
    panel.innerHTML=`<div style="text-align:center;padding:40px 0;color:var(--text3)">
      <div style="font-size:24px;margin-bottom:8px;color:var(--accent)"><svg width="24" height="24" viewBox="0 0 16 16" fill="none"><path d="M4 8.5l2.5 2.5 5.5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 1a7 7 0 110 14A7 7 0 018 1z" stroke="currentColor" stroke-width="1.3"/></svg></div>
      <div style="font-size:13px;font-weight:600;color:var(--text)">No habits yet</div>
      <div style="font-size:11px;margin-top:4px">Create a recurring task to start tracking streaks</div>
    </div>`;
    return;
  }
  let html='<div style="font-size:11px;color:var(--text3);margin-bottom:10px">Recurring tasks tracked as habits</div>';
  habits.forEach(t=>{
    const stats=getHabitStats(t);
    const cc=catColor(t.category);
    const isOpen=_habitExpanded===t.id;
    const recurLabel=t.recurDays&&t.recurDays.length
      ?t.recurDays.map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join('/')
      :t.recurU==='day'?'Daily':t.recurU==='week'?'Weekly':'Monthly';
    html+=`<div class="habit-card${isOpen?' open':''}" onclick="toggleHabitCard('${t.id}')">
      <div class="habit-card-hdr">
        <div class="habit-card-dot" style="background:${cc}"></div>
        <div class="habit-card-info">
          <div class="habit-card-name">${esc(t.name)}</div>
          <div class="habit-card-meta">${recurLabel} · Best: ${stats.best} days</div>
          <div class="habit-bar"><div class="habit-bar-fill" style="width:${stats.rate}%"></div></div>
        </div>
        <div class="habit-streak">${stats.streak>0?'<span style="color:#f59e0b">●</span>':''} ${stats.streak}</div>
      </div>`;
    if(isOpen){
      html+=`<div class="habit-detail">
        <div class="habit-stat-row">
          <div class="habit-stat"><span class="habit-stat-val">${stats.rate}%</span><span class="habit-stat-lbl">Rate</span></div>
          <div class="habit-stat"><span class="habit-stat-val">${stats.streak}</span><span class="habit-stat-lbl">Current</span></div>
          <div class="habit-stat"><span class="habit-stat-val">${stats.best}</span><span class="habit-stat-lbl">Best</span></div>
          <div class="habit-stat"><span class="habit-stat-val">${stats.completed}/${stats.total}</span><span class="habit-stat-lbl">Done</span></div>
        </div>
        <div class="habit-heatmap">${renderHabitHeatmap(stats.heatmap)}</div>
      </div>`;
    }
    html+=`</div>`;
  });
  panel.innerHTML=html;
}
function toggleHabitCard(id){
  _habitExpanded=_habitExpanded===id?null:id;
  renderHabits();
}
function renderHabitHeatmap(data){
  if(!data.length)return'<div style="font-size:10px;color:var(--text3);text-align:center;padding:8px">Not enough data yet</div>';
  // Group by week
  const weeks={};
  data.forEach(d=>{
    const date=fromDk(d.date);
    const weekStart=addDays(date,-(date.getDay()));
    const wk=dk(weekStart);
    if(!weeks[wk])weeks[wk]=[];
    weeks[wk].push(d);
  });
  const weekKeys=Object.keys(weeks).sort();
  let html='<div class="hm-grid">';
  weekKeys.forEach(wk=>{
    weeks[wk].forEach(d=>{
      const cls=d.done?'hm-done':'hm-miss';
      const date=fromDk(d.date);
      const label=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getDay()]+' '+(date.getMonth()+1)+'/'+date.getDate();
      html+=`<div class="hm-cell ${cls}" title="${label}: ${d.done?'✓':'✗'}"></div>`;
    });
  });
  html+='</div>';
  html+=`<div class="hm-legend"><span>✗ missed</span><span>✓ completed</span></div>`;
  return html;
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
function goToday(){curYear=new Date().getFullYear();selDate=new Date();cursor=new Date();cursor.setDate(1);cursor.setHours(0,0,0,0);switchView('day')}

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
    
    
  }
  if(curView==='categories'){renderCatChips();buildAllCatSelects();}
  else buildAllCatSelects();
  updateOverdueBadge();
  // Only render now-line in views that use it
  if(curView==='day'||curView==='week'){
    setTimeout(()=>{renderNowLine();},0);
  }
  renderProgressiveHint();
}

// ══ PROGRESSIVE HINTS (disabled — sandbox demo handles onboarding) ═══
function renderProgressiveHint(){
  const el=document.getElementById('progressiveHint');if(el)el.innerHTML='';
}
function dismissHint(){}
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
      const isCompact=dur<=15;
      const hPx=Math.max(isCompact?26:14,dur/30*WK_SLOT_H-1-wkBannerH);
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
      const compactCls=isCompact?' wk-task-compact':'';
      const subs=t.subtasks||[];
      const wkDurLabel=dur>30?`<span class="wk-task-block-dur">${durLabel(dur)}</span>`:'';
      const wkDurStep=dur>30?`<div class="wk-dur-stepper"><button class="wk-dur-btn" onclick="event.stopPropagation();adjustDuration('${t.id}','${t._instanceDate||k}',-15,event)">−</button><span class="wk-task-block-dur">${durLabel(dur)}</span><button class="wk-dur-btn" onclick="event.stopPropagation();adjustDuration('${t.id}','${t._instanceDate||k}',15,event)">+</button></div>`:'';
      const wkSubPill=subs.length?`<span class="wk-sub-pill" onclick="event.stopPropagation();openSubtaskPopup('${t.id}','${t._instanceDate||k}')">☰ ${subs.length}</span>`:'';
      if(isEvent){
        return`<div class="wk-task-block event-block${narrowCls}${compactCls}" data-id="${t.id}" title="${esc(t.name)}"
          draggable="true" ondragstart="onTaskDragStart(event,'${t.id}','${t._instanceDate||k}')" ondragend="onTaskDragEnd(event)"
          style="top:${topPx}px;height:${hPx}px;left:${leftVal};right:${rightVal};background:${cc};border-top-color:${cc}"
          onclick="openEdit('${t.id}','${t._instanceDate||k}',event)">
          ${isCompact?'':`<div class="drag-grip"><span class="grip-dots"></span></div>`}
          <span class="wk-task-block-name">${esc(t.name)}</span>
          ${!isCompact&&ci.total<=2?`<div class="wk-task-meta-row">${wkSubPill}${wkDurStep}</div>`:''}
        </div>`;
      }
      return`<div class="wk-task-block${isDone?' done-block':''}${narrowCls}${compactCls}" data-id="${t.id}" title="${esc(t.name)}"
        draggable="true" ondragstart="onTaskDragStart(event,'${t.id}','${t._instanceDate||k}')" ondragend="onTaskDragEnd(event)"
        style="top:${topPx}px;height:${hPx}px;left:${leftVal};right:${rightVal};border-left-color:${cc};border-top-color:${cc};background:${taskBlockBg(t.category)}"
        onclick="openEdit('${t.id}','${t._instanceDate||k}',event)">
        ${isCompact?'':`<div class="drag-grip"><span class="grip-dots"></span></div>`}
        <div style="display:flex;align-items:center;gap:2px;min-width:0">
          ${ci.total<=2?`<div class="task-check${isDone?' checked':''}" onclick="toggleDone('${t.id}','${t._instanceDate||k}',event,this)"></div>`:''}
          <span class="wk-task-block-name task-lbl">${esc(t.name)}</span>${ci.total<=2&&t.recur?'<span class="recur-icon">↻</span>':''}${t.dueDate&&!isCompact?`<span class="day-due-badge ${dueBadgeClass(t.dueDate)}" style="font-size:7px">${fmtDueBadge(t.dueDate)}</span>`:''}
          ${isCompact?`<button class="compact-expand-btn" onclick="event.stopPropagation();adjustDuration('${t.id}','${t._instanceDate||k}',15,event)" title="Extend to 30 min">15m +</button>`:''}
        </div>
        ${!isCompact&&ci.total<=2?`<div class="wk-task-meta-row">${wkSubPill}${wkDurStep}</div>`:''}
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
function onWkSlot(k,t,e){if(e.target.closest('.wk-task-block,.now-line,.task-check'))return;const rb=isBlockedByRoutine(k,t);if(rb.blocked){showWarnToast(`${rb.routineName} blocks ${fmtT(rb.routineStart)} – ${fmtT(rb.routineEnd)}`);return;}openNew(k,nextAvailableTime(k,t))}

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
        ${t.dueDate?`<span class="day-due-badge ${dueBadgeClass(t.dueDate)}">${fmtDueBadge(t.dueDate)}</span>`:(t._parentBdId?(()=>{const p=brainDump.find(b=>b.id===t._parentBdId);return p&&p.dueDate?`<span class="day-due-badge ${dueBadgeClass(p.dueDate)}">${fmtDueBadge(p.dueDate)}</span>`:''})():'')}
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

  // ── Overdue + due-this-week banners ──────────────────────────────────────
  const overdueWrap=document.getElementById('dayOverdueBanner');
  if(overdueWrap){
    const showBanners=localStorage.getItem('clarity_show_overdue')!=='false';
    const dismissed=JSON.parse(localStorage.getItem('clarity_overdue_dismiss')||'{}');
    const todayKey=dk(new Date());
    if(showBanners){
      const overdueTasks=brainDump.filter(t=>t.dueDate&&t.dueDate<todayKey&&!t.done&&!dismissed[t.id]);
      const dueWeekTasks=brainDump.filter(t=>t.dueDate&&t.dueDate>=todayKey&&t.dueDate<=dk(addDays(new Date(),7))&&!t.done);
      let bhtml='';
      if(overdueTasks.length){
        bhtml+=`<div class="overdue-banner overdue-red">
          <span class="overdue-cnt">${overdueTasks.length}</span> overdue task${overdueTasks.length!==1?'s':''}
          <span class="overdue-names">${overdueTasks.map(t=>esc(t.name)).join(', ')}</span>
          <span class="overdue-x" onclick="dismissOverdueBanners()">×</span>
        </div>`;
      }
      if(dueWeekTasks.length){
        bhtml+=`<div class="overdue-banner overdue-amber">
          <span class="overdue-cnt">${dueWeekTasks.length}</span> due this week
          <span class="overdue-x" onclick="dismissDueWeekBanner()">×</span>
        </div>`;
      }
      overdueWrap.innerHTML=bhtml;
      overdueWrap.style.display=bhtml?'':'none';
    } else {
      overdueWrap.innerHTML='';
      overdueWrap.style.display='none';
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
        const isCompact=dur<=15;
        const hPx=Math.max(isCompact?30:36,dur/30*DAY_SLOT_H-bannerH);

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
          blockHtml=`<div class="day-task-block event-block${isCompact?' day-task-compact':''}" data-id="${t.id}" title="${esc(t.name)}"
            draggable="true" ondragstart="onTaskDragStart(event,'${t.id}','${idate}')" ondragend="onTaskDragEnd(event)"
            style="background:${cc};border-top-color:${cc};height:100%;margin:0;border-radius:0 6px 6px 0"
            onclick="openEdit('${t.id}','${idate}',event)">
            ${isCompact?'':`<div class="drag-grip"><span class="grip-dots"></span></div>`}
            <div class="day-task-block-check">
              <span class="day-task-block-name">${esc(t.name)}</span>
              ${isCompact?`<button class="compact-expand-btn" onclick="event.stopPropagation();adjustDuration('${t.id}','${idate}',15,event)" title="Extend to 30 min">15m +</button>`:''}
              ${!isCompact?`<button class="day-add-sub-btn event-add-sub" data-tip="Add subtask" onclick="event.stopPropagation();openSubtaskPopup('${t.id}','${idate}')">+</button>`:''}
              ${ci.total<=3&&!isCompact?timeRB:''}
            </div>
            ${dur>15?`<div class="day-task-meta-row">${durStep}${ci.total<=3&&t.location?` · <span class="event-location">${IC_PIN} ${esc(t.location)}</span>`:''}${ci.total<=3&&t.recur?' ↻':''}${subPillInline}</div>`:''}
          </div>`;
        } else {
          const focusPill2=ci.total<=2&&!isDone&&dur>15?`<button class="day-focus-pill" onclick="event.stopPropagation();startFocusForTask('${t.id}','${idate}')">▶ Focus</button>`:'';
          blockHtml=`<div class="day-task-block${isDone?' done-block':''}${isCompact?' day-task-compact':''}" data-id="${t.id}" title="${esc(t.name)}"
            draggable="true" ondragstart="onTaskDragStart(event,'${t.id}','${idate}')" ondragend="onTaskDragEnd(event)"
            style="border-left-color:${cc};border-top-color:${cc};background:${taskBlockBg(t.category)};height:100%;margin:0;border-radius:0 6px 6px 0"
            onclick="openEdit('${t.id}','${idate}',event)">
            ${isCompact?'':`<div class="drag-grip"><span class="grip-dots"></span></div>`}
            <div class="day-task-block-check">
              <div class="task-check${isDone?' checked':''}" style="${isCompact?'width:14px;height:14px;min-width:14px':''}" onclick="toggleDone('${t.id}','${idate}',event,this)"></div>
              <span class="day-task-block-name task-lbl">${esc(t.name)}</span>
              ${isCompact?`<button class="compact-expand-btn" onclick="event.stopPropagation();adjustDuration('${t.id}','${idate}',15,event)" title="Extend to 30 min">15m +</button>`:''}
              ${!isCompact?`<button class="day-add-sub-btn" data-tip="Add subtask" onclick="event.stopPropagation();openSubtaskPopup('${t.id}','${idate}')">+</button>`:''}
              ${ci.total<=3&&t.recur?`<span class="recur-icon">↻</span>`:''}
              ${ci.total<=3&&!isCompact?timeRB:''}
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
function onDaySlot(k,t,e){if(e.target.closest('.day-task-block,.day-task-slot-wrap,.now-line,.task-check'))return;const rb=isBlockedByRoutine(k,t);if(rb.blocked){showWarnToast(`${rb.routineName} blocks ${fmtT(rb.routineStart)} – ${fmtT(rb.routineEnd)}`);return;}openNew(k,nextAvailableTime(k,t))}

// ══ CATEGORIES ════════════════════════════════
function renderCatChips(){
  const wrap=document.getElementById('catChips');if(!wrap)return;
  // Status filter chips
  const filters=[
    {key:'all',label:'All'},
    {key:'active',label:'Active'},
    {key:'completed',label:'Completed'},
    {key:'overdue',label:'Overdue',cls:'chip-danger'},
    {key:'deadlines',label:'Tasks with Deadlines'},
    {key:'events',label:'Events'}
  ];
  let html='<div class="cat-status-chips">';
  filters.forEach(f=>{
    html+=`<div class="cat-status-chip${_taskViewFilter===f.key?' active':''}${f.cls?' '+f.cls:''}" onclick="setTaskFilter('${f.key}')">${f.label}</div>`;
  });
  html+='</div>';
  // Category chips below
  html+=`<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">`;
  html+=`<div class="cat-chip all-chip${catFilter==='all'?' active':''}" onclick="setCF('all')">All Categories</div>`;
  categories.forEach(c=>{
    const isActive=catFilter===c.id;
    html+=`<div class="cat-chip${isActive?' active':''}" style="${isActive?`background:${c.color}`:'background:var(--surface3)'};${isActive?'':'color:var(--text2)'}" onclick="setCF('${c.id}')">
      ${c.name}${!c.locked?`<button class="cat-chip-del" onclick="delCat('${c.id}',event)">×</button>`:''}
    </div>`;
  });
  html+=`</div>`;
  wrap.innerHTML=html;
}
function setTaskFilter(f){_taskViewFilter=f;renderCatChips();renderCat();}
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
  renderCatChips();
  const today=new Date();today.setHours(0,0,0,0);
  const todayKey=dk(today);
  const weekEnd=dk(addDays(today,7));
  let all=expandedTasks(addDays(today,-365),addDays(today,180));
  brainDump.forEach(t=>all.push({...t,scheduled:false,_instanceDate:null}));
  const seen=new Set();all=all.filter(t=>{const k=t.id+'|'+(t._instanceDate||'bd');if(seen.has(k))return false;seen.add(k);return true;});
  if(catFilter!=='all')all=all.filter(t=>(t.category||'none')===catFilter);

  // Apply status filter
  if(_taskViewFilter==='active')all=all.filter(t=>!t.done);
  else if(_taskViewFilter==='completed')all=all.filter(t=>!!t.done);
  else if(_taskViewFilter==='overdue')all=all.filter(t=>t.dueDate&&t.dueDate<todayKey&&!t.done);
  else if(_taskViewFilter==='deadlines')all=all.filter(t=>!!t.dueDate);
  else if(_taskViewFilter==='events')all=all.filter(t=>(t.type||'task')==='event');

  // Separate infinite habits from normal tasks
  const infiniteHabitIds=new Set(tasks.filter(t=>isInfiniteHabit(t)).map(t=>t.id));
  const habitMap=new Map();
  const normalTasks=[];

  all.forEach(t=>{
    if(infiniteHabitIds.has(t.id)){
      if(!t.done){
        const existing=habitMap.get(t.id);
        if(!existing||(t.date&&(!existing.date||t.date<existing.date)))habitMap.set(t.id,t);
      }
    } else {
      normalTasks.push(t);
    }
  });

  const habits=[...habitMap.values()];

  // Group by time horizon
  const overdue=normalTasks.filter(t=>!t.done&&t.dueDate&&t.dueDate<todayKey);
  const todayTasks=normalTasks.filter(t=>!t.done&&t.date===todayKey&&!overdue.includes(t));
  const thisWeek=normalTasks.filter(t=>!t.done&&t.date>todayKey&&t.date<=weekEnd&&!overdue.includes(t));
  const upcoming=normalTasks.filter(t=>!t.done&&t.date>weekEnd&&!overdue.includes(t));
  const unscheduled=normalTasks.filter(t=>!t.done&&!t.date&&!overdue.includes(t));
  const done=normalTasks.filter(t=>!!t.done);

  let html='';

  // Overdue section
  if(overdue.length){
    html+=`<div class="cat-section"><div class="cat-sec-title" style="color:#A32D2D">Overdue <span style="font-weight:400;opacity:.6;margin-left:4px">${overdue.length}</span></div>`;
    overdue.forEach(t=>{html+=catRow(t)});
    html+=`</div>`;
  }

  // Today section
  if(todayTasks.length){
    html+=`<div class="cat-section"><div class="cat-sec-title">Today <span style="font-weight:400;opacity:.6;margin-left:4px">${todayTasks.length}</span></div>`;
    todayTasks.forEach(t=>{html+=catRow(t)});
    html+=`</div>`;
  }

  // This week section
  if(thisWeek.length){
    html+=`<div class="cat-section"><div class="cat-sec-title">This week <span style="font-weight:400;opacity:.6;margin-left:4px">${thisWeek.length}</span></div>`;
    thisWeek.forEach(t=>{html+=catRow(t)});
    html+=`</div>`;
  }

  // Upcoming section
  if(upcoming.length){
    html+=`<div class="cat-section"><div class="cat-sec-title">Upcoming <span style="font-weight:400;opacity:.6;margin-left:4px">${upcoming.length}</span></div>`;
    upcoming.forEach(t=>{html+=catRow(t)});
    html+=`</div>`;
  }

  // Unscheduled section
  if(unscheduled.length){
    html+=`<div class="cat-section"><div class="cat-sec-title">Unscheduled <span style="font-weight:400;opacity:.6;margin-left:4px">${unscheduled.length}</span></div>`;
    unscheduled.forEach(t=>{html+=catRow(t)});
    html+=`</div>`;
  }

  // Recurring habits
  if(habits.length&&_taskViewFilter!=='events'){
    html+=`<div class="cat-section"><div class="cat-sec-title">↻ Recurring <span style="font-weight:400;opacity:.6;margin-left:4px">${habits.length}</span></div>`;
    habits.forEach(t=>{html+=catHabitRow(t)});
    html+=`</div>`;
  }

  // Completed section (collapsed by default)
  if(done.length&&(showDone||_taskViewFilter==='completed')){
    html+=`<div class="cat-section"><div class="cat-sec-title" style="color:var(--accent)">Completed <span style="font-weight:400;opacity:.6;margin-left:4px">${done.length}</span></div>`;
    done.forEach(t=>{html+=catRow(t)});
    html+=`</div>`;
  } else if(done.length){
    html+=`<div class="cat-section"><div class="cat-sec-title cat-collapsed-done" onclick="toggleSD()" style="cursor:pointer;color:var(--text3)">${done.length} completed — tap to show</div></div>`;
  }

  if(!normalTasks.length&&!habits.length){
    html=`<div class="cat-empty" style="padding:40px 0;text-align:center">
      <div style="font-size:13px;font-weight:500;color:var(--text)">No tasks found</div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px">Try a different filter or add some tasks</div>
    </div>`;
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
    ?`<span class="streak-badge${streak>=7?' fire':''}">● ${streak} day streak</span>`
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
        ${(t.type||'task')==='event'?`<span class="mbadge" style="background:var(--accent-pale);color:var(--accent)">event</span>`:''}
        ${t.dueDate?`<span class="mbadge ${dueBadgeClass(t.dueDate)}">${fmtDueBadge(t.dueDate)}</span>`:''}
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
      <div class="routine-hero-desc">Tell Luclaro about your typical day so your schedule can build around it.</div>
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
        <div class="routine-instr-item"><span class="routine-instr-dot" style="background:var(--text3)"></span><div><strong>Block</strong> — Protected time Luclaro won't schedule over</div></div>
        <div class="routine-instr-hint">Add blocks like Work, Gym, Sleep, or Church. Luclaro will build your schedule around them.</div>
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
      <div class="routine-instr-item"><span class="routine-instr-dot" style="background:var(--text3)"></span><div><strong>Block</strong> — Protected time Luclaro won't schedule over</div></div>
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
let _focusMode='task'; // 'sprint' (25m),'task' (task duration),'custom' (slider)
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
    const fe=document.getElementById('focusEmpty');if(fe)fe.style.display='none';
    const fa=document.getElementById('focusActive');if(fa)fa.style.display='';
    const t=tasks.find(t=>t.id===_focusTaskId);
    if(t){
      const fsn=document.getElementById('focusSideName');if(fsn)fsn.textContent=t.name;
      updateSidebarTimer();
    }
  } else {
    const fe=document.getElementById('focusEmpty');if(fe)fe.style.display='';
    const fa=document.getElementById('focusActive');if(fa)fa.style.display='none';
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
  // Update sidebar (elements may not exist if sidebar was simplified)
  const _fe=document.getElementById('focusEmpty');if(_fe)_fe.style.display='none';
  const _fa=document.getElementById('focusActive');if(_fa)_fa.style.display='';
  const _fsn=document.getElementById('focusSideName');if(_fsn)_fsn.textContent=t.name;
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
  if(mode==='sprint'){
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
    const mKey=m==='sprint'?'sprint':m==='task'?'task':'custom';
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
    const endMins=h*60+m+(t.duration||30); // use actual task duration, not focus timer
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
    const _rfe=document.getElementById('focusEmpty');if(_rfe)_rfe.style.display='none';
    const _rfa=document.getElementById('focusActive');if(_rfa)_rfa.style.display='';
    const _rfsn=document.getElementById('focusSideName');if(_rfsn)_rfsn.textContent=t.name;
    updateFocusDisplay();
    toggleFocusTimer(); // auto-start
    // Show mini-timer (overlay not open on restore)
    showFocusMiniTimer();
  }catch(e){localStorage.removeItem('clarity_focus_active');}
}
function addFocusTime(){
  const t=tasks.find(t=>t.id===_focusTaskId);
  // Calculate the actual new task duration (original + 15, snapped to 15-min)
  const currentTaskDur=t?(t.duration||30):30;
  const newTaskDur=Math.round((currentTaskDur+15)/15)*15;
  if(t&&t.time&&t.date){
    const overflow=checkDurationOverflow(t.id,_focusDate||t.date,t.time,newTaskDur);
    if(overflow.blocked){
      showFocusNotification(`Can't extend — ${overflow.count} tasks already at ${fmtT(overflow.slotTime)}`,'error');
      return;
    }
    const routineCheck=checkRoutineOverflow(_focusDate||t.date,t.time,newTaskDur);
    if(routineCheck.blocked){
      showFocusNotification(`Extending runs into ${routineCheck.routineName} (${fmtT(routineCheck.routineStart)})`,'warn');
    }
  }
  // Extend focus timer by 15 min
  _focusRemaining+=15*60;
  _focusTotal+=15*60;
  _focusDur+=15;
  // Extend the actual task duration by 15 min (not setting it to _focusDur)
  if(t){t.duration=newTaskDur;save();}
  if(_focusRunning){
    localStorage.setItem('clarity_focus_active',JSON.stringify({
      taskId:_focusTaskId,date:_focusDate,
      endAt:Date.now()+_focusRemaining*1000,
      total:_focusTotal
    }));
  }
  updateFocusDisplay();
  updateFocusMetaTime();
  showFocusNotification(`+15 min · Task now ${durLabel(newTaskDur)}`,'ok');
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
  if(false)return; // focus sidebar removed
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
// ══ OVERDUE BANNER DISMISS ════════════════════
function dismissOverdueBanners(){
  const todayKey=dk(new Date());
  const overdueTasks=brainDump.filter(t=>t.dueDate&&t.dueDate<todayKey&&!t.done);
  const dismissed=JSON.parse(localStorage.getItem('clarity_overdue_dismiss')||'{}');
  overdueTasks.forEach(t=>{dismissed[t.id]=todayKey;});
  localStorage.setItem('clarity_overdue_dismiss',JSON.stringify(dismissed));
  renderDay();
}
function dismissDueWeekBanner(){
  localStorage.setItem('clarity_due_week_dismiss',dk(new Date()));
  const el=document.querySelector('.overdue-banner.overdue-amber');
  if(el)el.remove();
}

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
      <div class="od-hdr-icon"><svg width="20" height="20" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/><polyline points="8,4 8,8 11,10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
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
  const isNew=!localStorage.getItem('clarity_onboarded');
  _origEnterApp();
  setTimeout(checkOverdueTasks,1500);
  localStorage.setItem('clarity_onboarded','true');
  // New users: launch sandbox demo
  if(isNew&&typeof startSandboxDemo==='function'){
    setTimeout(()=>startSandboxDemo(),800);
  }
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
  showToast(val?'Weekly priority saved':'Priority cleared');
}

// ══ WEEKLY REVIEW (5-step guided ritual) ═══════
let _reviewStep=0;
let _reviewData={wentWell:'',toImprove:'',intention:'',carryOver:[]};
let _reviewWeekStart=null,_reviewWeekEnd=null;
let _reviewStats={};

function openWrapup(){
  const today=new Date();today.setHours(0,0,0,0);
  const dow=(today.getDay()-weekStartDay+7)%7;
  _reviewWeekEnd=today;
  _reviewWeekStart=addDays(today,-dow);
  
  document.getElementById('wrapupDateRange').textContent=
    MONTHS_S[_reviewWeekStart.getMonth()]+' '+_reviewWeekStart.getDate()+' – '+
    MONTHS_S[_reviewWeekEnd.getMonth()]+' '+_reviewWeekEnd.getDate()+', '+_reviewWeekEnd.getFullYear();

  // Compute stats
  const weekTasks=expandedTasks(_reviewWeekStart,_reviewWeekEnd).filter(t=>(t.type||'task')==='task');
  const isDoneT=t=>t.done||(t.doneOverrides||[]).includes(t._instanceDate);
  const completed=weekTasks.filter(isDoneT);
  const incomplete=weekTasks.filter(t=>!isDoneT(t)&&t._instanceDate<dk(today));

  const habitTasks=weekTasks.filter(t=>t.recur);
  const habitDone=habitTasks.filter(isDoneT);
  const habitRate=habitTasks.length?Math.round(habitDone.length/habitTasks.length*100):0;

  const habits=getRecurringHabits();
  const habitStats=habits.map(t=>{const s=getHabitStats(t);return{name:t.name,streak:s.streak,weekDone:habitTasks.filter(h=>h.id===t.id&&isDoneT(h)).length,weekTotal:habitTasks.filter(h=>h.id===t.id).length};});

  _reviewStats={total:weekTasks.length,done:completed.length,incomplete,habitRate,habitStats};
  _reviewData={wentWell:'',toImprove:'',intention:'',carryOver:incomplete.map(t=>({id:t.id,idate:t._instanceDate,name:t.name,keep:true}))};

  // Load saved review if exists
  const saved=localStorage.getItem('clarity_review_'+dk(_reviewWeekStart));
  if(saved){try{const d=JSON.parse(saved);_reviewData.wentWell=d.wentWell||'';_reviewData.toImprove=d.toImprove||'';_reviewData.intention=d.intention||'';}catch(e){}}

  _reviewStep=0;
  document.getElementById('wrapupOverlay').classList.add('open');
  renderReviewStep();
}

function renderReviewStep(){
  const content=document.getElementById('wrapupContent');
  const footer=document.getElementById('wrapupFooter');
  const dots=document.getElementById('wrapupDots');
  const titles=['What went well','Carry over','What could improve','● Habit check','🎯 Next week'];
  
  // Dots
  dots.innerHTML=Array.from({length:5},(_,i)=>`<span class="wr-dot${i===_reviewStep?' on':''}"></span>`).join('');

  // Footer nav
  const isFirst=_reviewStep===0,isLast=_reviewStep===4;
  footer.innerHTML=`
    ${!isFirst?'<button class="modal-btn-sec" onclick="prevReviewStep()">← Back</button>':'<button class="modal-btn-sec" onclick="closeWrapup()">Close</button>'}
    <button class="modal-btn-pri" onclick="${isLast?'saveReview()':'nextReviewStep()'}">
      ${isLast?'Save Review ✓':'Next →'}
    </button>`;

  // Step content
  const s=_reviewStats;
  let html='';
  if(_reviewStep===0){
    // What went well
    const rate=s.total?Math.round(s.done/s.total*100):0;
    html=`<div class="wr-step-title">${titles[0]}</div>
      <div class="wr-auto-stat">You completed <strong>${s.done} of ${s.total}</strong> tasks this week (${rate}%).</div>
      <textarea class="fi wr-textarea" id="wrWentWell" placeholder="What else went well this week?" rows="3">${esc(_reviewData.wentWell)}</textarea>`;
  } else if(_reviewStep===1){
    // Carry over
    html=`<div class="wr-step-title">${titles[1]}</div>
      <div class="wr-auto-stat">${_reviewData.carryOver.length} task${_reviewData.carryOver.length!==1?'s':''} didn't get done. Tap to keep or dismiss:</div>
      <div class="wr-carry-list">`;
    if(!_reviewData.carryOver.length){
      html+=`<div style="text-align:center;color:var(--text3);padding:16px;font-size:12px">All tasks completed! Nothing to carry over.</div>`;
    }
    _reviewData.carryOver.forEach((t,i)=>{
      html+=`<div class="wr-carry-item${t.keep?'':' dimmed'}" onclick="toggleCarryOver(${i})">
        <span class="wr-carry-check">${t.keep?'✓':'✕'}</span>
        <span class="wr-carry-name">${esc(t.name)}</span>
      </div>`;
    });
    html+=`</div>`;
  } else if(_reviewStep===2){
    // What could improve
    html=`<div class="wr-step-title">${titles[2]}</div>
      <div class="wr-auto-stat">What would you do differently next week?</div>
      <textarea class="fi wr-textarea" id="wrToImprove" placeholder="Reflect on what you'd change…" rows="3">${esc(_reviewData.toImprove)}</textarea>`;
  } else if(_reviewStep===3){
    // Habit check
    html=`<div class="wr-step-title">${titles[3]}</div>
      <div class="wr-auto-stat">Habit consistency: ${s.habitRate}% this week</div>
      <div class="wr-habit-list">`;
    if(!s.habitStats.length){
      html+=`<div style="text-align:center;color:var(--text3);padding:16px;font-size:12px">No recurring habits tracked yet.</div>`;
    }
    s.habitStats.forEach(h=>{
      const pct=h.weekTotal?Math.round(h.weekDone/h.weekTotal*100):0;
      html+=`<div class="wr-habit-row">
        <span class="wr-habit-name">${esc(h.name)}</span>
        <span class="wr-habit-score">${h.weekDone}/${h.weekTotal}</span>
        <span class="wr-habit-pct">${pct}%</span>
        ${h.streak>0?`<span class="wr-habit-streak">● ${h.streak}</span>`:''}
      </div>`;
    });
    html+=`</div>`;
  } else if(_reviewStep===4){
    // Next week intention
    html=`<div class="wr-step-title">${titles[4]}</div>
      <div class="wr-auto-stat">What's the one thing you want to accomplish next week?</div>
      <textarea class="fi wr-textarea" id="wrIntention" placeholder="My #1 priority for next week…" rows="3">${esc(_reviewData.intention)}</textarea>`;
  }
  content.innerHTML=html;
}

function nextReviewStep(){
  saveReviewStepData();
  _reviewStep=Math.min(4,_reviewStep+1);
  renderReviewStep();
}
function prevReviewStep(){
  saveReviewStepData();
  _reviewStep=Math.max(0,_reviewStep-1);
  renderReviewStep();
}
function saveReviewStepData(){
  if(_reviewStep===0){const el=document.getElementById('wrWentWell');if(el)_reviewData.wentWell=el.value;}
  if(_reviewStep===2){const el=document.getElementById('wrToImprove');if(el)_reviewData.toImprove=el.value;}
  if(_reviewStep===4){const el=document.getElementById('wrIntention');if(el)_reviewData.intention=el.value;}
}
function toggleCarryOver(i){
  _reviewData.carryOver[i].keep=!_reviewData.carryOver[i].keep;
  renderReviewStep();
}
function saveReview(){
  saveReviewStepData();
  // Save review text
  const key='clarity_review_'+dk(_reviewWeekStart);
  localStorage.setItem(key,JSON.stringify({wentWell:_reviewData.wentWell,toImprove:_reviewData.toImprove,intention:_reviewData.intention,date:dk(new Date())}));
  // Save intention for next week
  const nextWeekStart=addDays(_reviewWeekStart,7);
  if(_reviewData.intention)localStorage.setItem('clarity_intention_'+dk(nextWeekStart),_reviewData.intention);
  // Carry over incomplete tasks
  const toCarry=_reviewData.carryOver.filter(c=>c.keep);
  if(toCarry.length){
    const nextMonday=addDays(_reviewWeekStart,7);
    const nextMondayKey=dk(nextMonday);
    toCarry.forEach(c=>{
      const t=tasks.find(t=>t.id===c.id);
      if(t&&!t.recur){t.date=nextMondayKey;}
    });
    save();renderAll();
  }
  closeWrapup();
  showToast(`Review saved · ${toCarry.length} task${toCarry.length!==1?'s':''} carried over`);
}
function closeWrapup(){document.getElementById('wrapupOverlay').classList.remove('open')}
function toggleWrapupAuto(){
  const cur=localStorage.getItem('clarity_wrapup_auto')==='true';
  localStorage.setItem('clarity_wrapup_auto',cur?'false':'true');
  const toggle=document.getElementById('wrapupAutoToggle');
  if(toggle)toggle.classList.toggle('on',!cur);
}

// ══ ANALYTICS DASHBOARD ════════════════════════
function openAnalytics(){
  document.getElementById('analyticsOverlay').classList.add('open');
  renderAnalytics();
}
function closeAnalytics(){document.getElementById('analyticsOverlay').classList.remove('open')}

function renderAnalytics(){
  const body=document.getElementById('analyticsBody');if(!body)return;
  const today=new Date();today.setHours(0,0,0,0);
  const todayKey=dk(today);

  // This week range
  const dow=(today.getDay()-weekStartDay+7)%7;
  const weekStart=addDays(today,-dow);
  const weekEnd=addDays(weekStart,6);
  const lastWeekStart=addDays(weekStart,-7);
  const lastWeekEnd=addDays(weekStart,-1);

  // Get tasks for this week and last week
  const thisWeekTasks=expandedTasks(weekStart,weekEnd).filter(t=>(t.type||'task')==='task');
  const lastWeekTasks=expandedTasks(lastWeekStart,lastWeekEnd).filter(t=>(t.type||'task')==='task');

  const isDone=t=>t.done||(t.doneOverrides||[]).includes(t._instanceDate);
  const twCompleted=thisWeekTasks.filter(isDone);
  const lwCompleted=lastWeekTasks.filter(isDone);
  const twRate=thisWeekTasks.length?Math.round(twCompleted.length/thisWeekTasks.length*100):0;
  const lwRate=lastWeekTasks.length?Math.round(lwCompleted.length/lastWeekTasks.length*100):0;
  const rateDiff=twRate-lwRate;
  const countDiff=twCompleted.length-lwCompleted.length;

  // Focus time this week (from done tasks' durations)
  const focusMins=twCompleted.reduce((sum,t)=>sum+(t.duration||30),0);
  const focusHrs=(focusMins/60).toFixed(1);

  // Best habit streak
  const habits=getRecurringHabits();
  let bestStreak=0;
  habits.forEach(t=>{const s=getHabitStats(t);if(s.streak>bestStreak)bestStreak=s.streak;});

  // Tasks per day this week
  const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const daysInWeek=[];
  for(let i=0;i<7;i++){
    const d=addDays(weekStart,i);
    const dayKey=dk(d);
    const dayTasks=thisWeekTasks.filter(t=>t._instanceDate===dayKey);
    const done=dayTasks.filter(isDone).length;
    daysInWeek.push({day:dayNames[d.getDay()],done,total:dayTasks.length});
  }
  const maxDone=Math.max(1,...daysInWeek.map(d=>d.done));

  // Time by category
  const catTime={};
  twCompleted.forEach(t=>{
    const cat=catById(t.category);
    const name=cat?cat.name:'Other';
    catTime[name]=(catTime[name]||0)+(t.duration||30);
  });
  const catEntries=Object.entries(catTime).sort((a,b)=>b[1]-a[1]);
  const totalCatTime=catEntries.reduce((s,e)=>s+e[1],0)||1;
  const CAT_COLORS=['#3b82f6','#22c55e','#f43f5e','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316'];

  // Peak hours
  const hourBuckets=new Array(12).fill(0);
  twCompleted.forEach(t=>{
    if(t.time){const h=parseInt(t.time.split(':')[0]);const idx=Math.max(0,Math.min(11,h-6));hourBuckets[idx]++;}
  });
  const maxHour=Math.max(1,...hourBuckets);
  const peakIdx=hourBuckets.indexOf(maxHour);
  const peakLabel=(peakIdx+6)+(peakIdx+6<12?'–'+(peakIdx+7)+' AM':'–'+(peakIdx+7>12?peakIdx-5:peakIdx+7)+' PM');

  // Render
  let html='';
  // Top stats
  html+=`<div class="ana-stats">
    <div class="ana-stat">
      <div class="ana-stat-val" style="color:#22c55e">${twRate}%</div>
      <div class="ana-stat-lbl">Completion</div>
      <div class="ana-stat-change ${rateDiff>=0?'ana-up':'ana-down'}">${rateDiff>=0?'↑':'↓'} ${Math.abs(rateDiff)}% vs last wk</div>
    </div>
    <div class="ana-stat">
      <div class="ana-stat-val" style="color:#3b82f6">${twCompleted.length}</div>
      <div class="ana-stat-lbl">Completed</div>
      <div class="ana-stat-change ${countDiff>=0?'ana-up':'ana-down'}">${countDiff>=0?'↑':'↓'} ${Math.abs(countDiff)} tasks</div>
    </div>
    <div class="ana-stat">
      <div class="ana-stat-val" style="color:#f59e0b">${focusHrs}h</div>
      <div class="ana-stat-lbl">Focus time</div>
    </div>
    <div class="ana-stat">
      <div class="ana-stat-val" style="color:#f43f5e">${bestStreak>0?'● ':''}${bestStreak}</div>
      <div class="ana-stat-lbl">Best streak</div>
    </div>
  </div>`;

  // Bar chart — tasks per day
  html+=`<div class="ana-section">
    <div class="ana-sec-title">Tasks completed this week</div>
    <div class="ana-bars">`;
  daysInWeek.forEach(d=>{
    const pct=d.done/maxDone*100;
    const isToday=dayNames[today.getDay()]===d.day;
    html+=`<div class="ana-bar-col">
      <div class="ana-bar-val">${d.done}</div>
      <div class="ana-bar" style="height:${Math.max(2,pct)}%;background:var(--accent);opacity:${isToday?1:.5+d.done/maxDone*.5}"></div>
      <div class="ana-bar-lbl${isToday?' ana-today':''}">${d.day}</div>
    </div>`;
  });
  html+=`</div></div>`;

  // Category breakdown
  if(catEntries.length){
    html+=`<div class="ana-section"><div class="ana-sec-title">Time by category</div><div class="ana-cats">`;
    catEntries.forEach((e,i)=>{
      const pct=Math.round(e[1]/totalCatTime*100);
      const color=CAT_COLORS[i%CAT_COLORS.length];
      html+=`<div class="ana-cat-row">
        <div class="ana-cat-dot" style="background:${color}"></div>
        <div class="ana-cat-name">${esc(e[0])}</div>
        <div class="ana-cat-bar"><div class="ana-cat-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="ana-cat-pct">${pct}%</div>
      </div>`;
    });
    html+=`</div></div>`;
  }

  // Peak hours
  html+=`<div class="ana-section"><div class="ana-sec-title">Peak productivity hours</div>
    <div class="ana-peak">`;
  const hrLabels=['6a','7','8','9','10','11','12p','1','2','3','4','5'];
  hourBuckets.forEach((v,i)=>{
    const intensity=v/maxHour;
    html+=`<div class="ana-peak-cell" style="background:rgba(var(--accent-rgb),${intensity*.7+.05})">${hrLabels[i]}</div>`;
  });
  html+=`</div>`;
  if(maxHour>0)html+=`<div style="text-align:center;font-size:10px;color:var(--accent);font-weight:700;margin-top:6px">🎯 Most productive: ${peakLabel}</div>`;
  html+=`</div>`;

  body.innerHTML=html;
}

// ══ AI SCHEDULE ═════════════════════════════════
let _aiTasks=[];
let _aiPlacedBdIds=new Set(); // BD items that were actually placed (prevent data loss on accept)
let _aiUnscheduled=[];        // Items that couldn't fit (for warning UI)

function openAISchedule(preSelectedIds){
  if(!canUsePro('Plan My Day')){showProPrompt('Plan My Day');return;}
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
  // Pre-select from batch schedule or default to all
  if(preSelectedIds&&preSelectedIds.size){
    preSelectedIds.forEach(id=>_aiBdSelected.add(id));
  }
  renderAiBdChips();
  document.getElementById('aiScheduleOverlay').classList.add('open');
  setTimeout(()=>{
    const ta=document.getElementById('aiInput');
    if(!brainDump.length)ta.focus();
    autoExpand(ta);
  },150);
  // Clear batch selection
  _bdSelectedIds.clear();
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
  const extraInput=document.getElementById('aiInput').value.trim();
  if(!selectedBd.length&&!extraInput){document.getElementById('aiInput').focus();return;}

  const dateVal=document.getElementById('aiDate').value;
  const startTime=document.getElementById('aiStartTime').value||'08:00';
  const d=fromDk(dateVal);
  const dayName=DLONG[d.getDay()];

  // Preferences
  const includeBreaks=document.getElementById('aiPrefBreaks').classList.contains('on');
  const prefMorning=document.getElementById('aiPrefMorning').classList.contains('on');
  const prefAfternoon=document.getElementById('aiPrefAfternoon').classList.contains('on');

  // Show spinner
  document.getElementById('aiGenLabel').style.display='none';
  document.getElementById('aiSpinner').style.display='';
  document.getElementById('aiError').style.display='none';
  document.getElementById('aiPreviewWrap').style.display='none';

  // ── LAYER 1: Try algorithmic scheduling first ──
  const extraLines=extraInput?extraInput.split('\n').filter(l=>l.trim()):[];
  bumpStat('plan_total');

  const result=smartSchedule(selectedBd,extraLines,dateVal,{
    includeBreaks,prefMorning,prefAfternoon,startTime
  });

  // Convert scheduled items to the format used by the preview/accept code
  const algorithmicTasks=result.scheduled.map(item=>({
    name:item.name,
    time:item.time,
    duration:item.duration,
    priority:item.priority||'medium',
    category:item.category||'none',
    type:item.allday?'event':'task',
    location:item.location||'',
    allday:!!item.allday,
    recur:!!item.recur,
    recurN:item.recurN||1,
    recurU:item.recurU||'day',
    recurDays:item.recurDays||[],
    subtasks:item.subtasks||[],
    _bdId:item._bdId,
    _smartPath:'algorithm'
  }));
  // Track which BD items actually got placed (for accept step — prevents data loss)
  _aiPlacedBdIds=new Set(result.scheduled.filter(s=>s._bdId).map(s=>s._bdId));
  // Track items that couldn't fit, so we can warn the user
  _aiUnscheduled=result.unscheduled.map(u=>u.name);

  // ── LAYER 2: If there are unparseable prose lines, use AI for those only ──
  if(result.needsAI.length){
    bumpStat('plan_ai_calls');
    try{
      const sanitized=result.needsAI.map(sanitizeAIInput).filter(Boolean);
      if(sanitized.length){
        // Minimal prompt — only the unparsed lines + essential context
        const routineStr=routineContextStr(dateVal);
        const existingTimed=tasksOn(dateVal).filter(t=>t.time).map(t=>`${fmtT(t.time)}-${esc(t.name)} (${t.duration||30}m)`).slice(0,10).join(', ');
        const existingStr=existingTimed?`\nExisting: ${existingTimed}`:'';
        let prefStr='';
        if(prefMorning)prefStr=' Prefer morning.';
        if(prefAfternoon)prefStr=' Prefer afternoon.';
        const prompt=`Parse these task descriptions for ${dayName}, ${dateVal} (day starts ${startTime}).${prefStr}${routineStr}${existingStr}

Input:
${sanitized.join('\n')}

Return ONLY a JSON array. All times HH:MM, durations in 15-min increments. Avoid existing times. Detect events/birthdays/recurrence. For "X: a, b, c" create subtasks.
[{"name":"...","time":"HH:MM","duration":30,"priority":"medium","category":"none","type":"task","allday":false,"recur":false,"recurN":1,"recurU":"day","recurDays":[],"subtasks":[]}]`;

        // Validator: returns parsed array if valid, null to trigger Sonnet fallback
        const validate=(data)=>{
          try{
            const text=data.content.map(i=>i.text||'').join('');
            const clean=text.replace(/```json|```/g,'').trim();
            const parsed=JSON.parse(clean);
            if(!Array.isArray(parsed)||parsed.length===0)return null;
            if(!parsed.every(t=>t&&typeof t.name==='string'&&t.name.trim()))return null;
            return parsed;
          }catch{return null;}
        };
        const{result:aiTasks,model:usedModel}=await callClaudeAPIWithFallback(
          [{role:"user",content:prompt}],400,validate
        );
        if(usedModel==='sonnet')bumpStat('plan_sonnet_upgrades');

        // Validate each AI task before accepting
        if(Array.isArray(aiTasks)){
          aiTasks.forEach(t=>{
            if(!t||!t.name)return;
            const dur=Math.max(15,Math.min(480,Math.round((t.duration||30)/15)*15));
            const snapped=t.time?snapTo15(t.time):null;
            algorithmicTasks.push({
              name:String(t.name).slice(0,100),
              time:snapped,
              duration:dur,
              priority:t.priority||'medium',
              category:t.category||'none',
              type:t.type||'task',
              location:t.location||'',
              allday:!!t.allday,
              recur:!!t.recur,
              recurN:t.recurN||1,
              recurU:t.recurU||'day',
              recurDays:Array.isArray(t.recurDays)?t.recurDays.filter(d=>d>=0&&d<=6):[],
              subtasks:Array.isArray(t.subtasks)?t.subtasks.slice(0,20).map(s=>({name:String(s.name||'').slice(0,80),duration:Math.max(15,Math.round((s.duration||15)/15)*15)})):[],
              _smartPath:'ai'
            });
          });
        }
      }
    }catch(err){
      console.error('AI fallback failed:',err);
      // Don't hard-fail — we still have algorithmic results
      if(!algorithmicTasks.length){
        document.getElementById('aiError').textContent='Something went wrong — try again. '+(err.message||'');
        document.getElementById('aiError').style.display='';
        document.getElementById('aiGenLabel').style.display='';
        document.getElementById('aiSpinner').style.display='none';
        return;
      }
    }
  }

  // Log which path handled this
  const aiCount=algorithmicTasks.filter(t=>t._smartPath==='ai').length;
  const algCount=algorithmicTasks.length-aiCount;
  bumpStat('plan_alg_tasks',algCount);
  bumpStat('plan_ai_tasks',aiCount);

  _aiTasks=algorithmicTasks;

  if(!_aiTasks.length){
    document.getElementById('aiError').textContent='Nothing to schedule — add some tasks to your brain dump or type them in the box.';
    document.getElementById('aiError').style.display='';
    document.getElementById('aiGenLabel').style.display='';
    document.getElementById('aiSpinner').style.display='none';
    return;
  }

  // Show preview
  const preview=document.getElementById('aiPreview');
  preview.innerHTML=_aiTasks.map((t,i)=>{
    const isEvent=(t.type||'task')==='event';
    const isAllday=!!(t.allday);
    const subs=t.subtasks||[];
    const recurDays=t.recurDays||[];
    const DAY_NAMES=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const recurLabel=t.recur?(recurDays.length?' · ↻ '+recurDays.map(d=>DAY_NAMES[d]).join('/'):(t.recurU==='year'?' · ↻ yearly':t.recurU==='month'?' · ↻ monthly':t.recurU==='week'?' · ↻ weekly':' · ↻ daily')):'';
    let subsHtml=subs.length?`<div style="margin-left:26px;margin-top:3px">${subs.map(s=>`<div style="font-size:10px;color:var(--text3);padding-left:10px;border-left:2px solid var(--border)">↳ ${esc(s.name)}${s.duration?' · '+durLabel(s.duration):''}</div>`).join('')}</div>`:'';
    return`<div class="ai-preview-task" style="${isEvent?'border-left:3px solid var(--accent);background:var(--accent-pale)':''}">
      <span style="font-size:11px;font-weight:700;color:var(--text3);min-width:18px">${i+1}.</span>
      <span class="ai-preview-time">${isAllday?'All Day':t.time?fmtT(t.time):''}</span>
      <span class="ai-preview-name">${esc(t.name)}${isEvent?' <span style="font-size:9px;background:var(--accent);color:#fff;padding:1px 5px;border-radius:3px;font-weight:600">EVENT</span>':''}${recurLabel?'<span style="font-size:9px;color:var(--text3)">'+recurLabel+'</span>':''}</span>
      ${isAllday?'':` <span class="ai-preview-dur">${durLabel(t.duration||30)}</span>`}
    </div>${subsHtml}`;
  }).join('');
  // Show warning if some items couldn't fit
  if(_aiUnscheduled.length){
    preview.innerHTML+=`<div style="margin-top:8px;padding:8px 10px;background:var(--red-pale,#fef2f2);border-radius:8px;font-size:11px;color:var(--red,#ef4444);line-height:1.5">
      <strong>Couldn't fit ${_aiUnscheduled.length} item${_aiUnscheduled.length!==1?'s':''}:</strong> ${_aiUnscheduled.map(n=>esc(n)).join(', ')}. They'll stay in your Brain Dump.
    </div>`;
  }
  document.getElementById('aiPreviewWrap').style.display='';
  document.getElementById('aiGenBtn').style.display='';
  document.getElementById('aiGenLabel').textContent='Regenerate';
  document.getElementById('aiAcceptBtn').style.display='';
  document.getElementById('aiGenLabel').style.display='';
  document.getElementById('aiSpinner').style.display='none';
}

function acceptAISchedule(){
  const dateVal=document.getElementById('aiDate').value;
  _aiTasks.forEach(t=>{
    const subs=(t.subtasks||[]).map(s=>({id:genId(),name:s.name,duration:Math.round((s.duration||15)/15)*15||15,done:false}));
    const isAllday=!!(t.allday);
    const dur=Math.round((t.duration||30)/15)*15||15;
    const time=isAllday?null:(t.time?snapTo15(t.time):null);
    tasks.push({
      id:genId(),
      name:t.name,
      type:t.type||'task',
      date:dateVal,
      time:time,
      allday:isAllday,
      duration:dur,
      priority:t.priority||'none',
      category:t.category||'none',
      location:t.location||'',
      attachments:[],
      notes:'',
      subtasks:subs,
      scheduled:true,
      done:false,
      recur:!!(t.recur),recurN:t.recurN||1,recurU:t.recurU||'day',recurDays:t.recurDays||[],
      doneOverrides:[],deletedOccurrences:[],
      multiDay:false,endDate:'',eventColor:'',suppressRoutines:false
    });
    // Record pattern for personal learning
    if((t.type||'task')==='task'&&!isAllday)recordPattern(t.name,dur,t.category||'none',time);
  });
  // Remove ONLY Brain Dump items that were actually placed (not ones that couldn't fit)
  if(_aiPlacedBdIds.size){
    brainDump=brainDump.filter(t=>!_aiPlacedBdIds.has(t.id));
  }
  _aiBdSelected.clear();
  _aiPlacedBdIds=new Set();
  _aiUnscheduled=[];
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
  const el=document.getElementById('bdInput')||document.getElementById('qeInput');
  if(!el)return;
  const raw=el.value.trim();if(!raw)return;
  // Simple single-item add via Quick Add input
  brainDump.push({id:genId(),name:raw,type:'task',priority:'none',category:'none',notes:'',subtasks:[]});
  el.value='';
  save();renderBD();
  showToast('"'+raw+'" added to Brain Dump');
}
function bdAutoFocus(el){
  autoExpand(el);
  if(!el.value.trim())el.value='• ';
}
// bdInput textarea removed — Quick Add input (qeInput) handles all input via onkeydown in HTML

// ══ QUICK EVENT ADD ════════════════════════════
function parseQuickEvent(raw){
  let text=raw.trim();if(!text)return null;
  let time=null,date=null,location=null,allday=false,duration=null;
  let recur=false,recurN=1,recurU='day';

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

  // 2b. Auto-detect birthdays & anniversaries → all-day + yearly recurrence
  if(/\b(birthday|bday|b-day|anniversary)\b/i.test(text)){
    allday=true;recur=true;recurN=1;recurU='year';
  }

  // 3. Extract duration: "for 2 hours", "1.5hr", "30 min", "90 minutes"
  const durRe=/\b(?:for\s+)?(\d+(?:\.\d+)?)\s*(hours?|hrs?|minutes?|mins?|m)\b/i;
  const durM=text.match(durRe);
  if(durM){
    const val=parseFloat(durM[1]);
    const unit=durM[2].toLowerCase();
    if(unit.startsWith('h')){duration=Math.round(val*60);}
    else{duration=Math.round(val);}
    if(duration<5)duration=null; // sanity check
    text=text.replace(durM[0],'').replace(/\bfor\b\s*/i,'').trim();
  }

  // 4. Extract numeric dates: 5/11, 05/11, 5/11/2026, 5-11, 5-11-2026
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

  // 5. Extract named dates: today, tomorrow, day names, month names
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

  // 6. Extract "at <location>" — only if content after "at" contains a letter (not a date/number)
  const atMatch=text.match(/\s+at\s+((?=.*[a-zA-Z]).+)$/i);
  if(atMatch){location=atMatch[1].trim();text=text.slice(0,atMatch.index).trim();}

  // 7. Clean up name — strip trailing prepositions, extra whitespace
  const name=text.replace(/\s+(at|on|in|for)$/i,'').replace(/\s+/g,' ').replace(/^[\-,·]\s*/,'').replace(/\s*[\-,·]$/,'').trim();
  if(!name)return null;
  return{name,date:date||null,time:allday?null:(time||null),allday,location,duration,recur,recurN,recurU};
}
let _lastQeId=null;
function addQuickEvent(){
  const input=document.getElementById('qeInput');if(!input)return;
  const raw=input.value.trim();if(!raw){showToast('Type a task or event name');input.focus();return;}
  
  // ── Check for "due" keyword → deadline task to Brain Dump ──
  const dueMatch=raw.match(/\bdue\s+(.+)$/i);
  if(dueMatch){
    const name=raw.replace(/\s*\bdue\s+.+$/i,'').trim();
    const dueDate=parseDateFromText(dueMatch[1]);
    if(name){
      brainDump.push({id:genId(),name:name,type:'task',category:'none',priority:'none',notes:'',subtasks:[],dueDate:dueDate||'',sessions:[],done:false});
      input.value='';
      save();renderAll();
      showToast('"'+name+'" added'+(dueDate?' — due '+fmtDueBadge(dueDate):' to Brain Dump'));
      return;
    }
  }
  
  const parsed=parseQuickEvent(raw);
  if(!parsed){
    // Couldn't parse — just add as plain brain dump item
    brainDump.push({id:genId(),name:raw,type:'task',category:'none',priority:'none',notes:'',subtasks:[]});
    input.value='';save();renderAll();
    showToast('"'+raw+'" added to Brain Dump');
    return;
  }
  input.value='';

  const hasDate=!!parsed.date;
  const hasTime=!!parsed.time||parsed.allday;
  const isComplete=hasDate&&hasTime;
  const dur=parsed.duration||60;

  // ── Incomplete → save to Brain Dump for later ──
  if(!isComplete){
    const bdItem={
      id:genId(),name:parsed.name,type:'task',category:'none',priority:'none',
      notes:'',subtasks:[],
      _pendingDate:parsed.date||'',_pendingTime:parsed.time||'',
      _pendingLocation:parsed.location||'',_pendingAllday:parsed.allday,_pendingDuration:dur,
      _pendingRecur:!!parsed.recur,_pendingRecurN:parsed.recurN||1,_pendingRecurU:parsed.recurU||'day'
    };
    brainDump.push(bdItem);
    save();renderAll();
    if(!hasDate&&!hasTime){
      showToast('"'+parsed.name+'" added to Brain Dump');
    } else {
      const missing=[];
      if(!hasDate)missing.push('date');
      if(!hasTime)missing.push('time');
      showToast('"'+parsed.name+'" saved to Brain Dump — needs '+missing.join(' & '));
    }
    return;
  }

  // ── Complete → schedule with draft flag ──
  const newId=genId();
  _lastQeId=newId;
  const qeTime=parsed.allday?null:(parsed.time?snapTo15(parsed.time):null);
  const qeDur=Math.round((dur)/15)*15||15;
  tasks.push({id:newId,name:parsed.name,type:'event',priority:'none',category:'none',notes:'',date:parsed.date,time:qeTime,allday:parsed.allday,duration:qeDur,scheduled:true,done:false,location:parsed.location||'',recur:!!parsed.recur,recurN:parsed.recurN||1,recurU:parsed.recurU||'day',recurDays:[],subtasks:[],attachments:[],doneOverrides:[],deletedOccurrences:[],multiDay:false,endDate:'',eventColor:'',suppressRoutines:false,_draft:true});
  // Track in Just Scheduled
  const jsD=fromDk(parsed.date);
  _justScheduled.unshift({id:newId,name:parsed.name,dest:DAYS_S[jsD.getDay()]+' '+(parsed.allday?'all day':fmtT(qeTime)),type:'event',date:parsed.date,time:qeTime});
  save();renderAll();
  // Show confirmation card
  const d=fromDk(parsed.date);
  const dateStr=DLONG[d.getDay()]+', '+MONTHS_S[d.getMonth()]+' '+d.getDate();
  const timeStr=parsed.allday?'All Day':fmtT(parsed.time);
  const locStr=parsed.location?` · ${esc(parsed.location)}`:'';
  const durStr=!parsed.allday&&dur!==60?' · '+durLabel(dur):'';
  const recurStr=parsed.recur?(parsed.recurU==='year'?' · ↻ yearly':parsed.recurU==='month'?' · ↻ monthly':' · ↻ recurring'):'';
  const el=document.getElementById('qeConfirm');
  if(el){
    el.innerHTML=`<div class="qe-confirm-icon"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 8.5l3 3 5-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="qe-confirm-body">
        <div class="qe-confirm-title">${esc(parsed.name)}</div>
        <div class="qe-confirm-detail">${dateStr} · ${timeStr}${durStr}${recurStr}${locStr}</div>
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
  // User accepted — clear draft flag
  if(_lastQeId){const t=tasks.find(t=>t.id===_lastQeId);if(t)delete t._draft;save();}
}
function openQeEdit(){
  dismissQeConfirm();
  if(!_lastQeId)return;
  const t=tasks.find(t=>t.id===_lastQeId);if(!t)return;
  const fakeEvent={stopPropagation:()=>{}};
  openEdit(_lastQeId,t.date,fakeEvent);
}

// ── Phase A step 2: BD accordion state & event detection ──
// An item is "event-flavored" if it carries any pending event fields, OR has explicit type='event'.
// Plain tasks (including those with dueDate / sessions) live in the Tasks section.
function isBdEvent(t){return !!(t&&(t._pendingDate||t._pendingTime||t._pendingAllday||t.type==='event'));}
const BD_ACC_DEFAULT={tasks:true,events:true,justScheduled:false};
function getBdAccordionState(){
  try{return Object.assign({},BD_ACC_DEFAULT,JSON.parse(localStorage.getItem('clarity_bd_accordion')||'{}'));}
  catch{return Object.assign({},BD_ACC_DEFAULT);}
}
function saveBdAccordionState(s){try{localStorage.setItem('clarity_bd_accordion',JSON.stringify(s));}catch{}}
function toggleBdAccordion(key){
  const s=getBdAccordionState();
  s[key]=!s[key];
  saveBdAccordionState(s);
  renderBD();
}

// ── Phase A step 2: card renderer (extracted so all sections share one path) ──
function renderBdCard(t,mid){
  const cc=catColor(t.category);
  const sel=_bdSelectedIds.has(t.id);
  const hasDue=!!t.dueDate;
  const isEvent=isBdEvent(t);
  const hasDate=!!t._pendingDate||!!t.date;
  const hasTime=!!t._pendingTime||!!t.time;
  const ready=isEvent?(hasDate&&hasTime):true;

  let badges='';
  if(t.priority&&t.priority!=='none')badges+=`<span class="bd-badge pri-${t.priority}">${t.priority}</span>`;
  if(hasDue){
    const dueStr=fmtDueBadge(t.dueDate);
    const cls=dueBadgeClass(t.dueDate);
    badges+=`<span class="bd-badge ${cls}">${dueStr}</span>`;
    const sessCnt=(t.sessions||[]).length;
    badges+=`<span class="bd-badge bd-badge-sess">${sessCnt} session${sessCnt!==1?'s':''}</span>`;
  }
  if(!ready){
    if(!hasDate)badges+=`<span class="bd-badge bd-badge-miss">needs date</span>`;
    if(!hasTime)badges+=`<span class="bd-badge bd-badge-miss">needs time</span>`;
  }
  if(t.category&&t.category!=='none'){const cat=catById(t.category);badges+=`<span class="bd-badge" style="background:${cc}1a;color:${cc}">${cat?cat.name:t.category}</span>`;}

  const chkHtml=mid?`<div class="bd-chk${sel?' on':''}${!ready&&isEvent?' dis':''}" onclick="event.stopPropagation();toggleBdSel('${t.id}',${ready||!isEvent})" data-id="${t.id}"></div>`:'';

  return `<div class="bd-card${sel?' bd-selected':''}${!ready?' bd-card-pending':''}" draggable="true" style="border-left-color:${cc}"
    ondragstart="onBDS(event,'${t.id}')" ondragend="onBDE(event)"
    onclick="openBDDetail('${t.id}')">
    ${chkHtml}
    <div class="bd-card-body">
      <div class="bd-name">${esc(t.name)}</div>
      <div class="bd-meta">${badges}<button class="bd-del" onclick="event.stopPropagation();delBD('${t.id}')">Remove</button></div>
    </div>
    <span class="bd-grip">::</span>
  </div>`;
}

// ── Phase A step 2.1: per-section select-all (Mid tier) ──
// Returns 'all' | 'some' | 'none' for the section's selection state.
// Disabled (unselectable) items are excluded from the calculation so a section
// of dimmed events doesn't pretend to be "all selected" when it's all-disabled.
function bdSectionSelState(items){
  const eligible=items.filter(t=>{
    const isEv=isBdEvent(t);
    if(!isEv)return true;
    const hasDate=!!t._pendingDate||!!t.date;
    const hasTime=!!t._pendingTime||!!t.time;
    return hasDate&&hasTime;
  });
  if(!eligible.length)return 'none';
  const sel=eligible.filter(t=>_bdSelectedIds.has(t.id)).length;
  if(sel===0)return 'none';
  if(sel===eligible.length)return 'all';
  return 'some';
}
function toggleBdSectionSelAll(key){
  const items=key==='tasks'
    ? brainDump.filter(t=>!isBdEvent(t))
    : brainDump.filter(t=>isBdEvent(t));
  const eligible=items.filter(t=>{
    const isEv=isBdEvent(t);
    if(!isEv)return true;
    const hasDate=!!t._pendingDate||!!t.date;
    const hasTime=!!t._pendingTime||!!t.time;
    return hasDate&&hasTime;
  });
  if(!eligible.length){renderBD();return;}
  const state=bdSectionSelState(items);
  // 'all' → deselect all in section; 'none' or 'some' → select all eligible
  if(state==='all'){
    eligible.forEach(t=>_bdSelectedIds.delete(t.id));
  } else {
    eligible.forEach(t=>_bdSelectedIds.add(t.id));
  }
  renderBD();
}

// ── Phase A step 2: render an accordion section (tasks/events) ──
function renderBdAccordion(key,label,items,mid,emptyText){
  const acc=getBdAccordionState();
  const open=!!acc[key];
  const cnt=items.length;
  // Section-level select-all checkbox (Mid only, only when section has items)
  let selAllHtml='';
  if(mid&&cnt>0){
    const state=bdSectionSelState(items);
    const cls=state==='all'?'bd-acc-selall on':state==='some'?'bd-acc-selall indet':'bd-acc-selall';
    selAllHtml=`<div class="${cls}" onclick="event.stopPropagation();toggleBdSectionSelAll('${key}')" title="Select all in ${label.toLowerCase()}"></div>`;
  }
  const cards=cnt
    ? items.map(t=>renderBdCard(t,mid)).join('')
    : `<div class="bd-acc-empty">${emptyText}</div>`;
  return `<div class="bd-acc${open?' open':''}" data-acc="${key}">
    <div class="bd-acc-hdr" onclick="toggleBdAccordion('${key}')">
      ${selAllHtml}
      <span class="bd-acc-arrow">${open?'▼':'▶'}</span>
      <span class="bd-acc-label">${label}</span>
      <span class="bd-acc-cnt">${cnt}</span>
    </div>
    <div class="bd-acc-body" ${open?'':'hidden'}>${cards}</div>
  </div>`;
}

function renderBD(){
  const list=document.getElementById('bdList');if(!list)return;
  const mid=isMid();

  // Sort
  const sorted=[...brainDump];
  if(_bdSortMode==='priority'){
    const p={high:0,medium:1,low:2,none:3};
    sorted.sort((a,b)=>(p[a.priority||'none']||3)-(p[b.priority||'none']||3));
  }

  // Split into Tasks vs Events accordions
  const tasksList=sorted.filter(t=>!isBdEvent(t));
  const eventsList=sorted.filter(t=>isBdEvent(t));

  // First-time empty hint (no items at all)
  const nothing=!brainDump.length&&!_justScheduled.length;
  let html='';

  if(nothing){
    html+=`<div class="bd-hint">Type above, then drag cards to the calendar →</div>`;
  }

  // Section 1: Tasks
  html+=renderBdAccordion('tasks','Tasks',tasksList,mid,'No tasks yet — type above to add one.');

  // Section 2: Events
  html+=renderBdAccordion('events','Events',eventsList,mid,'No events yet — try "Coffee with Sam Friday 3pm".');

  // Schedule button — sits between Events and Just Scheduled (Mid tier only)
  if(mid){
    const selCount=_bdSelectedIds.size;
    html+=`<button class="bd-batch-btn${selCount?' active':''}" onclick="batchScheduleSelected()" ${selCount?'':'disabled'}>
      ${selCount?'Schedule these '+selCount+' item'+(selCount!==1?'s':''):'Select items to schedule'}</button>`;
  }

  // Section 3: Just Scheduled (accordion, dashed wrap, collapsed by default)
  html+=renderJustScheduledAccordion();

  // Plan My Day (Pro / locked)
  if(canUsePro('Plan My Day')){
    html+=`<button class="bd-pmd-btn" onclick="openAISchedule()">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5z" fill="currentColor"/></svg>
      Plan My Day</button>`;
  } else {
    html+=`<button class="bd-pmd-btn locked" onclick="showProPrompt('Plan My Day')">
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      Plan My Day</button>`;
  }

  // Bottom hint
  html+=`<div class="bd-hint-bottom">${mid?'Drag to calendar, select + schedule, or use Plan My Day':'Drag cards to the calendar to schedule'}</div>`;

  list.innerHTML=html;
}

// ══ JUST SCHEDULED (accordion section, always visible, dashed wrap) ═══════
function renderJustScheduledAccordion(){
  const acc=getBdAccordionState();
  const open=!!acc.justScheduled;
  const cnt=_justScheduled.length;

  const body=cnt
    ? _justScheduled.map((js,i)=>`
      <div class="js-card">
        <span class="js-check">✓</span>
        <div class="js-body">
          <div class="js-name">${esc(js.name)}</div>
          <div class="js-dest">${js.dest} · ${js.type}</div>
          <div class="js-acts">
            <span class="js-act" onclick="undoJustScheduled(${i})">Undo</span>
            <span class="js-act" onclick="editJustScheduled(${i})">Edit</span>
          </div>
        </div>
        <span class="js-x" onclick="dismissJustScheduled(${i})">×</span>
      </div>`).join('')
    : `<div class="bd-acc-empty">Nothing scheduled yet — items you schedule from this panel will land here briefly so you can undo.</div>`;

  const clearLink=cnt?`<span class="bd-acc-clear" onclick="event.stopPropagation();clearJustScheduled()">Clear all</span>`:'';

  return `<div class="bd-acc bd-acc-js${open?' open':''}" data-acc="justScheduled">
    <div class="bd-acc-hdr" onclick="toggleBdAccordion('justScheduled')">
      <span class="bd-acc-arrow">${open?'▼':'▶'}</span>
      <span class="bd-acc-label">Just scheduled</span>
      <span class="bd-acc-cnt">${cnt}</span>
      ${clearLink}
    </div>
    <div class="bd-acc-body ${cnt?'js-area-dashed':''}" ${open?'':'hidden'}>${body}</div>
  </div>`;
}
// Back-compat alias — older call sites or external scripts may still call renderJustScheduled().
function renderJustScheduled(){return renderJustScheduledAccordion();}

function dismissJustScheduled(i){_justScheduled.splice(i,1);renderBD();}
function clearJustScheduled(){_justScheduled=[];renderBD();}
function undoJustScheduled(i){
  const js=_justScheduled[i];if(!js)return;
  // Remove from tasks, add back to brain dump
  tasks=tasks.filter(t=>t.id!==js.id);
  brainDump.push({id:js.id,name:js.name,type:js.type||'task',category:'none',priority:'none',notes:'',subtasks:[]});
  _justScheduled.splice(i,1);
  save();renderAll();
}
function editJustScheduled(i){
  const js=_justScheduled[i];if(!js)return;
  const t=tasks.find(t=>t.id===js.id);if(!t)return;
  openEdit(js.id,t.date,{stopPropagation:()=>{}});
}
// Back-compat: old toggleJsCollapse kept as alias to the accordion toggle so any
// stale event handlers in cached HTML don't throw.
function toggleJsCollapse(){toggleBdAccordion('justScheduled');}

// ══ BRAIN DUMP SELECTION (MID TIER) ════════════
function toggleBdSel(id,allowed){
  if(!allowed)return;
  if(_bdSelectedIds.has(id))_bdSelectedIds.delete(id);
  else _bdSelectedIds.add(id);
  renderBD();
}

function batchScheduleSelected(){
  if(!_bdSelectedIds.size)return;
  // Phase A step 1: tier-based routing.
  // Pro + guest → AI Plan My Day path (current behavior).
  // Mid (signed-in, non-Pro) → Pro prompt for now.
  // TODO Phase A step 4: Mid branch should route to scheduleSelectedItems()
  //                       (algorithmic placer) once that function ships.
  if(!canUsePro('Plan My Day')){showProPrompt('Plan My Day');return;}
  // Open Plan My Day with pre-selected items
  openAISchedule(_bdSelectedIds);
}

// ══ DUE DATE HELPERS ════════════════════════════
function fmtDueBadge(dueDateStr){
  if(!dueDateStr)return'';
  const due=fromDk(dueDateStr);
  const now=new Date();now.setHours(0,0,0,0);
  const diff=Math.round((due-now)/(1000*60*60*24));
  if(diff<0)return Math.abs(diff)+' day'+(Math.abs(diff)!==1?'s':'')+' late';
  if(diff===0)return'Due today';
  if(diff===1)return'Due tomorrow';
  if(diff<=7){const dName=DAYS_S[due.getDay()];return'Due '+dName;}
  return'Due '+MONTHS_S[due.getMonth()]+' '+due.getDate();
}
function dueBadgeClass(dueDateStr){
  if(!dueDateStr)return'';
  const due=fromDk(dueDateStr);
  const now=new Date();now.setHours(0,0,0,0);
  const diff=Math.round((due-now)/(1000*60*60*24));
  if(diff<0)return'bd-badge-overdue';
  if(diff<=2)return'bd-badge-due-urgent';
  if(diff<=7)return'bd-badge-due-soon';
  return'bd-badge-due-later';
}

// ══ DEADLINES TAB ═════════════════════════════
function renderDeadlines(){
  const panel=document.getElementById('deadlinesPanel');if(!panel)return;
  const deadlineTasks=brainDump.filter(t=>!!t.dueDate);
  const now=new Date();now.setHours(0,0,0,0);
  const todayKey=dk(now);
  const weekEnd=dk(addDays(now,7));
  
  // Categorize
  const overdue=deadlineTasks.filter(t=>t.dueDate<todayKey&&!t.done);
  const dueWeek=deadlineTasks.filter(t=>t.dueDate>=todayKey&&t.dueDate<=weekEnd&&!t.done);
  const dueLater=deadlineTasks.filter(t=>t.dueDate>weekEnd&&!t.done);
  const completed=deadlineTasks.filter(t=>!!t.done);
  
  // Collapse states
  const cs=JSON.parse(localStorage.getItem('clarity_dl_collapse')||'{}');
  
  function section(key,label,items,colorClass,defaultOpen){
    const open=cs[key]!==undefined?cs[key]:defaultOpen;
    let html=`<div class="dl-sec-hdr" onclick="toggleDlSection('${key}')">
      <div class="dl-sec-left"><span class="dl-sec-arrow">${open?'▼':'▶'}</span>
      <span class="dl-sec-lbl ${colorClass}">${label}</span>
      <span class="dl-sec-cnt">${items.length}</span></div></div>`;
    if(open&&items.length){
      items.forEach(t=>{
        const sessCnt=(t.sessions||[]).length;
        const dueBadge=fmtDueBadge(t.dueDate);
        const dueClass=dueBadgeClass(t.dueDate);
        html+=`<div class="dl-card">
          <div class="dl-chk${t.done?' done':''}" onclick="event.stopPropagation();toggleDeadlineDone('${t.id}')"></div>
          <div class="dl-left" style="background:${colorClass==='dl-red'?'var(--red)':colorClass==='dl-amber'?'var(--amber)':colorClass==='dl-blue'?'var(--blue)':'var(--green)'}"></div>
          <div class="dl-card-body" onclick="openBDDetail('${t.id}')">
            <div class="dl-card-name${t.done?' done-text':''}">${esc(t.name)}</div>
            <div class="dl-card-meta">
              <span class="bd-badge ${dueClass}">${dueBadge}</span>
              <span class="bd-badge bd-badge-sess">${sessCnt} session${sessCnt!==1?'s':''}</span>
            </div>
          </div>
          <div class="dl-plus" onclick="event.stopPropagation();openSessionPicker('${t.id}')" title="Add session">+</div>
        </div>`;
      });
    } else if(open&&!items.length){
      html+=`<div class="dl-empty">None</div>`;
    }
    return html;
  }
  
  let html=`<div class="dl-add-bar">
    <input class="dl-add-input" id="dlAddInput" placeholder="New task with deadline..." onkeydown="if(event.key==='Enter'){event.preventDefault();addDeadlineTask();}">
    <button class="dl-add-btn" onclick="addDeadlineTask()">+ Add</button>
  </div>`;
  
  html+=section('overdue','Overdue',overdue,'dl-red',true);
  html+=section('dueWeek','Due this week',dueWeek,'dl-amber',true);
  html+=section('dueLater','Due later',dueLater,'dl-blue',false);
  html+=section('completed','Completed',completed,'dl-green',false);
  
  panel.innerHTML=html;
}

function toggleDlSection(key){
  const cs=JSON.parse(localStorage.getItem('clarity_dl_collapse')||'{}');
  cs[key]=cs[key]===undefined?false:!cs[key];
  localStorage.setItem('clarity_dl_collapse',JSON.stringify(cs));
  renderDeadlines();
}

function toggleDeadlineDone(id){
  const t=brainDump.find(t=>t.id===id);if(!t)return;
  t.done=!t.done;
  save();renderDeadlines();if(activeSide==='braindump')renderBD();
}

function addDeadlineTask(){
  const input=document.getElementById('dlAddInput');if(!input)return;
  const raw=input.value.trim();if(!raw){showToast('Enter a task name');return;}
  // Parse due date from end: "Essay research due Sunday"
  let name=raw,dueDate='';
  const dueMatch=raw.match(/\bdue\s+(.+)$/i);
  if(dueMatch){
    name=raw.replace(/\s*\bdue\s+.+$/i,'').trim();
    dueDate=parseDateFromText(dueMatch[1]);
  }
  if(!dueDate){
    // If no due date parsed, default to end of this week
    const fri=new Date();fri.setDate(fri.getDate()+(5-fri.getDay()+7)%7||7);
    dueDate=dk(fri);
  }
  brainDump.push({id:genId(),name:name,type:'task',category:'none',priority:'none',notes:'',subtasks:[],dueDate:dueDate,sessions:[],done:false});
  input.value='';
  save();renderDeadlines();renderBD();
  showToast('"'+name+'" added with deadline');
}

// ══ SESSION PICKER ════════════════════════════
function openSessionPicker(bdId){
  const t=brainDump.find(t=>t.id===bdId);if(!t)return;
  _sessionPickerBdId=bdId;
  const el=document.getElementById('sessionPickerOverlay');if(!el)return;
  document.getElementById('spTaskName').textContent=t.name;
  document.getElementById('spDueInfo').textContent=t.dueDate?'Due '+fmtDueBadge(t.dueDate):'No due date set';
  renderSessionList(t);
  // Default next session to tomorrow at next open slot
  const tomorrow=addDays(new Date(),1);
  document.getElementById('spDate').value=dk(tomorrow);
  document.getElementById('spTime').value='14:00';
  document.getElementById('spDur').value='60';
  document.getElementById('spConflict').innerHTML='';
  // Phase A step 2.1: .modal-overlay defaults to opacity:0;pointer-events:none.
  // Need both display:flex AND the .show class for the modal to be visible+clickable.
  el.style.display='flex';
  // Force a reflow so the opacity transition fires from 0 → 1 (otherwise it would
  // skip the transition because display:flex and class:show are set in the same tick).
  void el.offsetWidth;
  el.classList.add('show');
}
let _sessionPickerBdId='';

function renderSessionList(t){
  const list=document.getElementById('spSessionList');if(!list)return;
  if(!t.sessions||!t.sessions.length){
    list.innerHTML='<div class="sp-empty">No sessions scheduled yet</div>';
    return;
  }
  list.innerHTML=t.sessions.map((s,i)=>{
    const d=fromDk(s.date);
    const dayName=DAYS_S[d.getDay()];
    return`<div class="sp-session-row">
      <span class="sp-session-day">${dayName}</span>
      <span class="sp-session-time">${fmtT(s.time)}</span>
      <span class="sp-session-dur">${durLabel(s.duration)}</span>
      <span class="sp-session-del" onclick="removeSession('${t.id}',${i})">×</span>
    </div>`;
  }).join('');
}

function addSessionFromPicker(){
  const t=brainDump.find(t=>t.id===_sessionPickerBdId);if(!t)return;
  const date=document.getElementById('spDate').value;
  const time=document.getElementById('spTime').value;
  const dur=parseInt(document.getElementById('spDur').value)||60;
  if(!date||!time){showToast('Pick a date and time');return;}
  
  // Conflict check
  const conflicts=checkSessionConflicts(date,time,dur);
  const conflictEl=document.getElementById('spConflict');
  if(conflicts){
    if(conflictEl)conflictEl.innerHTML=`<div class="sp-conflict-warn">${conflicts}</div>`;
    return;
  }
  
  if(!t.sessions)t.sessions=[];
  t.sessions.push({date,time:snapTo15(time),duration:dur});
  t.sessions.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
  
  // Create a task on the calendar for this session
  const sessId=genId();
  tasks.push({id:sessId,name:t.name,type:'task',priority:t.priority||'none',category:t.category||'none',notes:'Session for: '+t.name,date:date,time:snapTo15(time),duration:dur,scheduled:true,done:false,recur:false,subtasks:[],attachments:[],doneOverrides:[],deletedOccurrences:[],_parentBdId:t.id});
  
  save();renderSessionList(t);renderDeadlines();renderAll();
  if(conflictEl)conflictEl.innerHTML=`<div class="sp-conflict-ok">Session added for ${fmtT(snapTo15(time))} on ${DAYS_S[fromDk(date).getDay()]}</div>`;
}

function checkSessionConflicts(dateKey,time,dur){
  const startMin=toMins(time);
  const endMin=startMin+dur;
  // Check existing tasks
  const dayTasks=tasks.filter(t=>t.date===dateKey&&t.time&&t.scheduled&&!t.done);
  for(const t of dayTasks){
    const ts=toMins(t.time),te=ts+(t.duration||30);
    if(startMin<te&&endMin>ts)return`Conflicts with "${t.name}" at ${fmtT(t.time)}. Try ${fmtT(fromMins(te))} instead.`;
  }
  // Phase A step 2 hotfix: isBlockedByRoutine returns an object {blocked, ...}, not a
  // boolean. Treating the object as truthy made this branch fire on EVERY call (the
  // false case still returns {blocked:false}, which is truthy). Read .blocked properly.
  const rb=isBlockedByRoutine(dateKey,time);
  if(rb.blocked)return`Blocked by ${rb.routineName} (${fmtT(rb.routineStart)} – ${fmtT(rb.routineEnd)}). Try a different time.`;
  return null;
}

function removeSession(bdId,idx){
  const t=brainDump.find(t=>t.id===bdId);if(!t||!t.sessions)return;
  const sess=t.sessions[idx];
  // Remove corresponding calendar task
  if(sess)tasks=tasks.filter(tk=>!(tk._parentBdId===bdId&&tk.date===sess.date&&tk.time===sess.time));
  t.sessions.splice(idx,1);
  save();renderSessionList(t);renderDeadlines();renderAll();
}

function closeSessionPicker(){
  const el=document.getElementById('sessionPickerOverlay');if(!el)return;
  el.classList.remove('show');
  // Hide after the opacity transition completes (200ms) so it animates out.
  setTimeout(()=>{el.style.display='none';},200);
}

// ══ PARSE DUE DATE FROM TEXT ══════════════════
function parseDateFromText(text){
  if(!text)return'';
  const t=text.trim().toLowerCase();
  const now=new Date();
  // Day names
  const dayMap={sun:0,sunday:0,mon:1,monday:1,tue:2,tuesday:2,wed:3,wednesday:3,thu:4,thursday:4,fri:5,friday:5,sat:6,saturday:6};
  for(const[name,dayNum]of Object.entries(dayMap)){
    if(t===name||t.startsWith(name+' ')){
      const diff=(dayNum-now.getDay()+7)%7||7;
      return dk(addDays(now,diff));
    }
  }
  if(t==='today')return dk(now);
  if(t==='tomorrow')return dk(addDays(now,1));
  // Try date parsing (e.g. "4/20", "Apr 20")
  const d=new Date(text);
  if(!isNaN(d.getTime())){
    if(d<now)d.setFullYear(d.getFullYear()+1);
    return dk(d);
  }
  return'';
}
function delBD(id){
  // Phase A step 2 hotfix: deadline tasks have linked session tasks on the calendar
  // (created by addSessionFromPicker, joined via _parentBdId). Without this filter,
  // deleting the deadline orphaned those sessions and they stayed on the calendar
  // forever with broken parent references.
  const t=brainDump.find(b=>b.id===id);
  if(t&&t.dueDate){
    tasks=tasks.filter(tk=>tk._parentBdId!==id);
  }
  brainDump=brainDump.filter(t=>t.id!==id);
  save();renderAll();
}
function toggleBdSort(){
  _bdSortMode=_bdSortMode==='urgency'?'priority':'urgency';
  const btn=document.getElementById('bdSortBtn');
  if(btn)btn.textContent='Sort: '+_bdSortMode;
  renderBD();
}
function signInGoogle(){
  closeProPrompt();
  if(_supabase){
    _supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+window.location.pathname}});
  } else {showToast('Sign in not available — try refreshing');}
}

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
}
// Safety net: if any drag ends without proper cleanup, reset everything
document.addEventListener('dragend',function(){
  document.querySelectorAll('.dragging-task').forEach(el=>el.classList.remove('dragging-task'));
  const tl=document.getElementById('dayTimeline');if(tl)tl.classList.remove('drag-active');
  const wg=document.getElementById('weekGrid');if(wg)wg.classList.remove('drag-active');
  dragTaskId=null;dragInstanceDate=null;dragBdId=null;
});
// Track whether a drag actually started (to suppress click → edit modal)
let _wasDragged=false;
function onBDS(e,id){dragBdId=id;dragTaskId=null;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','bd:'+id);setTimeout(()=>e.target.classList.add('dragging'),0);_setDragActive(true)}
function onBDE(e){e.target.classList.remove('dragging');dragBdId=null;_setDragActive(false)}
function onTaskDragStart(e,id,idate){
  // Allow drag from anywhere on the task block — browser's built-in
  // drag threshold (~5px) prevents accidental drags on normal clicks
  _wasDragged=true;
  dragTaskId=id;dragInstanceDate=idate;dragBdId=null;
  e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','task:'+id);
  setTimeout(()=>{const el=e.target.closest('.day-task-block,.wk-task-block,.m-chip,.cat-task-row,.cat-habit-row');if(el)el.classList.add('dragging-task');},0);
  e.stopPropagation();_setDragActive(true);
}
function onTaskDragEnd(){
  document.querySelectorAll('.dragging-task').forEach(el=>el.classList.remove('dragging-task'));
  dragTaskId=null;dragInstanceDate=null;_setDragActive(false);
  // Reset _wasDragged after a short delay so the click handler can check it
  setTimeout(()=>{_wasDragged=false;},50);
}
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
      else if(t.recurU==='year') candidate.setFullYear(candidate.getFullYear() + t.recurN * i);
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
  const smartTime=nextAvailableTime(dateKey,time);
  if(dragBdId){
    const t=brainDump.find(t=>t.id===dragBdId);if(!t)return;
    // Check blocked routine
    const rBlock=isBlockedByRoutine(dateKey,smartTime);
    if(rBlock.blocked){
      showWarnToast(`Can't drop here — blocked by ${rBlock.routineName} (${fmtT(rBlock.routineStart)} – ${fmtT(rBlock.routineEnd)})`);
      dragBdId=null;return;
    }
    if(duplicateInSlot(dateKey,smartTime,t.name,null)){
      showWarnToast(`"${esc(t.name)}" is already in that slot`);dragBdId=null;return;
    }
    if(slotFull(dateKey,smartTime,null)){
      showWarnToast('That slot already has 3 tasks — pick a different time');dragBdId=null;return;
    }
    const newTaskId=t.dueDate?genId():t.id; // deadline tasks get new IDs for sessions
    tasks.push({...t,id:newTaskId,type:t.type||'task',date:dateKey,time:smartTime,allday:false,duration:t._pendingDuration||30,scheduled:true,done:false,recur:false,recurN:1,recurU:'day',recurDays:[],attachments:t.attachments||[],location:t._pendingLocation||t.location||'',doneOverrides:[],deletedOccurrences:[],multiDay:false,endDate:'',eventColor:'',suppressRoutines:false,_parentBdId:t.dueDate?t.id:undefined});
    recordPattern(t.name,t._pendingDuration||30,t.category||'none',smartTime);
    if(t.dueDate){
      // Deadline task: stays in BD, creates a session
      if(!t.sessions)t.sessions=[];
      t.sessions.push({date:dateKey,time:smartTime,duration:t._pendingDuration||30});
      t.sessions.sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
      dragBdId=null;save();renderAll();
      showToast('Session added for "'+t.name+'"');
    } else {
      // Phase A step 2 hotfix: register in Just Scheduled before removing from BD,
      // so the count pill in the panel updates and the user has an Undo affordance.
      const jsD=fromDk(dateKey);
      _justScheduled.unshift({id:newTaskId,name:t.name,dest:DAYS_S[jsD.getDay()]+' '+fmtT(smartTime),type:t.type||'task',date:dateKey,time:smartTime});
      // Regular task: remove from BD
      brainDump=brainDump.filter(t=>t.id!==dragBdId);dragBdId=null;save();renderAll();
    }
    setTimeout(()=>snapFlash(dropEl),100);
  }else if(dragTaskId){
    rescheduleTask(dragTaskId,dragInstanceDate,dateKey,smartTime,dropEl);
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

  function findDraggable(el,touchY){
    // Don't start drag on checkboxes or resize handles
    if(el.closest('.task-check'))return null;
    const bd=el.closest('.bd-card[draggable]');if(bd)return{el:bd,type:'bd',id:bd.getAttribute('ondragstart')?.match(/'([^']+)'/)?.[1]};
    const task=el.closest('.cat-task-row[draggable],.cat-habit-row[draggable]');
    if(task){
      const m=task.getAttribute('ondragstart')?.match(/'([^']+)','([^']*)'/);
      if(m)return{el:task,type:'task',id:m[1],idate:m[2]};
    }
    // Week/Day view: only start drag from the top zone of the block
    const block=el.closest('.wk-task-block,.day-task-block');
    if(block&&touchY!==undefined){
      const rect=block.getBoundingClientRect();
      const relY=touchY-rect.top;
      if(relY<=30){
        const m=block.getAttribute('ondragstart')?.match(/'([^']+)','([^']*)'/);
        if(m)return{el:block,type:'task',id:m[1],idate:m[2]};
      }
    }
    const sugg=el.closest('.sugg-card[draggable]');
    if(sugg){
      const m=sugg.getAttribute('ondragstart')?.match(/(\d+),(\d+)/);
      if(m)return{el:sugg,type:'sugg',ci:+m[1],ii:+m[2]};
    }
    return null;
  }

  document.addEventListener('touchstart',function(e){
    const info=findDraggable(e.target,e.touches[0].clientY);if(!info)return;
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
  let hr=parseInt(document.getElementById('fDurHr').value)||0;
  let mn=parseInt(document.getElementById('fDurMin').value)||0;
  // Rollover: 45 + 15 = 60 → add 1 hour, 0 minutes
  if(mn>=60){hr+=Math.floor(mn/60);mn=mn%60;}
  // Rollback: 0 - 15 = -15 → subtract 1 hour, 45 minutes
  if(mn<0&&hr>0){hr--;mn=60+mn;}
  if(mn<0)mn=0;
  mn=Math.round(mn/15)*15;
  if(hr>12){hr=12;mn=0;}
  if(hr<0)hr=0;
  document.getElementById('fDurHr').value=hr;
  document.getElementById('fDurMin').value=mn;
  _selDur=Math.min(720,hr*60+mn); // cap at 12 hours
  if(_selDur<15)_selDur=15;
  syncEndTimeFromDur();
}

// ── Start / End time picker (hour grid + minute pills) ──
function buildTimeOptions(inputEl, selectedTime){
  // Backward-compat wrapper: sets the hidden input value and updates the grid picker UI
  if(!inputEl)return;
  const time=selectedTime||'09:00';
  inputEl.value=time;
  // Update display label and sync state
  const wrap=inputEl.closest('.tp-wrap');
  if(wrap){
    const lbl=wrap.querySelector('[id$="Lbl"]');
    if(lbl)lbl.textContent=fmtT(time);
    const[h24,m]=time.split(':').map(Number);
    _tpState[wrap.id]={h12:h24%12||12,min:m,pm:h24>=12};
  }
}

function _buildTPDropdown(wrap,time){
  const drop=wrap.querySelector('.tp-drop');if(!drop)return;
  const[h24,m]=time?time.split(':').map(Number):[9,0];
  const isPm=h24>=12;
  const h12=h24%12||12;
  const inputId=wrap.querySelector('input[type=hidden]').id;
  const isStart=inputId==='fStartTime';

  let html=`<div class="tp-ampm">
    <button class="tp-ampm-btn${!isPm?' tp-sel':''}" onclick="_tpAmPm('${wrap.id}',false)">AM</button>
    <button class="tp-ampm-btn${isPm?' tp-sel':''}" onclick="_tpAmPm('${wrap.id}',true)">PM</button>
  </div>`;
  html+=`<div class="tp-section-lbl">Hour</div><div class="tp-hr-grid">`;
  for(let i=1;i<=12;i++){
    html+=`<button class="tp-hr-btn${i===h12?' tp-sel':''}" onclick="_tpHour('${wrap.id}',${i})">${i}</button>`;
  }
  html+=`</div>`;
  html+=`<div class="tp-section-lbl">Minute</div><div class="tp-min-row">`;
  [0,15,30,45].forEach(mn=>{
    html+=`<button class="tp-min-btn${mn===m?' tp-sel':''}" onclick="_tpMin('${wrap.id}',${mn})">:${pad(mn)}</button>`;
  });
  html+=`</div>`;
  drop.innerHTML=html;
}

// Store picker state per wrap
const _tpState={};
function _tpGetState(wrapId){
  if(!_tpState[wrapId]){
    const wrap=document.getElementById(wrapId);
    const input=wrap?wrap.querySelector('input[type=hidden]'):null;
    const val=input?input.value:'09:00';
    const[h24,m]=val.split(':').map(Number);
    _tpState[wrapId]={h12:h24%12||12,min:m,pm:h24>=12};
  }
  return _tpState[wrapId];
}
function _tpApply(wrapId){
  const s=_tpGetState(wrapId);
  let h24=s.h12%12;if(s.pm)h24+=12;
  const val=pad(h24)+':'+pad(s.min);
  const wrap=document.getElementById(wrapId);if(!wrap)return;
  const input=wrap.querySelector('input[type=hidden]');if(input)input.value=val;
  const lbl=wrap.querySelector('[id$="Lbl"]');if(lbl)lbl.textContent=fmtT(val);
  // Trigger change logic
  if(input&&input.id==='fStartTime'){mTime=val;syncEndTimeFromDur();}
  else if(input&&input.id==='fEndTime'){onEndTimeChange();}
  // Rebuild dropdown to update selected states
  _buildTPDropdown(wrap,val);
}
function _tpAmPm(wrapId,pm){const s=_tpGetState(wrapId);s.pm=pm;_tpApply(wrapId)}
function _tpHour(wrapId,h){const s=_tpGetState(wrapId);s.h12=h;_tpApply(wrapId)}
function _tpMin(wrapId,m){const s=_tpGetState(wrapId);s.min=m;_tpApply(wrapId);
  // Auto-close after selecting minute (full time chosen)
  const wrap=document.getElementById(wrapId);if(wrap)wrap.classList.remove('tp-open');
}

function toggleTP(wrapId){
  const wrap=document.getElementById(wrapId);if(!wrap)return;
  // Close all other pickers
  document.querySelectorAll('.tp-wrap.tp-open').forEach(w=>{if(w.id!==wrapId)w.classList.remove('tp-open')});
  const opening=!wrap.classList.contains('tp-open');
  wrap.classList.toggle('tp-open');
  if(opening){
    // Sync state from current value
    const input=wrap.querySelector('input[type=hidden]');
    const val=input?input.value:'09:00';
    const[h24,m]=val.split(':').map(Number);
    _tpState[wrapId]={h12:h24%12||12,min:m,pm:h24>=12};
    _buildTPDropdown(wrap,val);
  }
}

// Close time picker when clicking outside
document.addEventListener('click',function(e){
  if(!e.target.closest('.tp-wrap')){
    document.querySelectorAll('.tp-wrap.tp-open').forEach(w=>w.classList.remove('tp-open'));
  }
});
function syncEndTimeFromDur(){
  const startEl=document.getElementById('fStartTime');
  const endEl=document.getElementById('fEndTime');
  if(!startEl||!endEl||!startEl.value)return;
  const[sh,sm]=startEl.value.split(':').map(Number);
  const endMins=sh*60+sm+_selDur;
  const endVal=pad(Math.floor(endMins/60)%24)+':'+pad(endMins%60);
  endEl.value=endVal;
  // Update display label
  const endLbl=document.getElementById('tpEndLbl');
  if(endLbl)endLbl.textContent=fmtT(endVal);
  // Sync picker state
  const[eh]=endVal.split(':').map(Number);
  _tpState['tpEnd']={h12:(Math.floor(endMins/60)%24)%12||12,min:endMins%60,pm:Math.floor(endMins/60)%24>=12};
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
  diff=Math.round(diff/15)*15;
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
  // Show/hide recurrence end date row
  const endRow=document.getElementById('recurEndRow');
  if(endRow)endRow.style.display=on?'flex':'none';
  if(!on){
    const endCb=document.getElementById('fRecurEnd');
    if(endCb)endCb.checked=false;
    const endDate=document.getElementById('fRecurEndDate');
    if(endDate){endDate.value='';endDate.disabled=true;}
  }
  onRecurUnitChange();
}
function onRecurUnitChange(){
  const on=document.getElementById('fRecurOn').checked;
  const unit=document.getElementById('fRecurU').value;
  const row=document.getElementById('recurDaysRow');
  if(row)row.style.display=(on&&unit==='week')?'flex':'none';
}
function toggleRecurEnd(){
  const cb=document.getElementById('fRecurEnd');
  const dateEl=document.getElementById('fRecurEndDate');
  if(!cb||!dateEl)return;
  dateEl.disabled=!cb.checked;
  if(cb.checked&&!dateEl.value){
    // Default to 3 months from task date
    const base=mDate?fromDk(mDate):new Date();
    base.setMonth(base.getMonth()+3);
    dateEl.value=dk(base);
  }
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
  document.getElementById('fMultiDayWrap').style.display=type==='event'?'':'none';
  document.getElementById('fPriRow').style.display=type==='event'?'none':'';
  document.getElementById('fRecurLabel').textContent=type==='event'?'event':'task';
  document.getElementById('mTitle').textContent=mMode==='edit'?'Edit '+(type==='event'?'Event':'Task'):'New '+(type==='event'?'Event':'Task');
  // When switching away from event, clear all-day and multi-day
  if(type!=='event'){setAlldayModal(false);setMultiDayModal(false);}
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
  // Gray out time row when all-day
  const timeRow=document.getElementById('fTimeRow');
  if(timeRow){
    timeRow.style.opacity=val?'.35':'';
    timeRow.style.pointerEvents=val?'none':'';
  }
  // Show/hide suppress routines toggle (visible when all-day OR multi-day)
  const supWrap=document.getElementById('fSuppressWrap');
  if(supWrap)supWrap.style.display=(val||_modalMultiDay)?'':'none';
  // If all-day turned off, also turn off multi-day (multi-day requires all-day)
  if(!val&&_modalMultiDay){setMultiDayModal(false);}
  if(!val&&!_modalMultiDay){setSuppressModal(false);}
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
  // Auto-enable All Day when multi-day is turned on
  if(val&&!_modalAllday){setAlldayModal(true);}
  // Show suppress toggle when multi-day or all-day
  const supWrap=document.getElementById('fSuppressWrap');
  if(supWrap)supWrap.style.display=(val||_modalAllday)?'':'none';
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
    updateMultiDaySub();
  } else {
    // Reset subtitle when turning off
    const sub=document.getElementById('fMultiDaySub');
    if(sub)sub.textContent='Spans multiple days like a vacation or conference';
  }
}
function toggleMultiDayModal(){setMultiDayModal(!_modalMultiDay);}

function updateMultiDaySub(){
  const sub=document.getElementById('fMultiDaySub');if(!sub)return;
  const startVal=document.getElementById('fMultiStart').value;
  const endVal=document.getElementById('fMultiEnd').value;
  if(startVal&&endVal&&endVal>=startVal){
    const sd=fromDk(startVal),ed=fromDk(endVal);
    const days=Math.round((ed-sd)/86400000)+1;
    sub.textContent=`${MONTHS_S[sd.getMonth()]} ${sd.getDate()} – ${MONTHS_S[ed.getMonth()]} ${ed.getDate()} · ${days} day${days!==1?'s':''}`;
    sub.style.color='var(--accent)';
  } else {
    sub.textContent='Spans multiple days like a vacation or conference';
    sub.style.color='var(--text3)';
  }
}

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
  // Phase A step 1: Pro gate — guests get a preview, Mid users hit the Pro prompt.
  if(!canUsePro('Subtasks')){showProPrompt('Subtasks');return;}
  const taskName=document.getElementById('fName').value.trim();
  const dur=_selDur||30;
  if(!taskName){showToast('Enter a task name first');return;}
  const btn=document.querySelector('.subtask-gen-btn-full');
  const origBtnHtml=btn.innerHTML;
  btn.textContent='⏳ Generating…';btn.style.pointerEvents='none';
  bumpStat('subtask_total');

  const remaining=20-_modalSubtasks.length;
  if(remaining<=0){
    showToast('Max 20 subtasks');
    btn.innerHTML=origBtnHtml;btn.style.pointerEvents='';
    return;
  }

  // ── LAYER 1: Pattern split ("Task: a, b, c") ──
  const split=patternSplitSubtasks(taskName,dur);
  if(split&&split.subtasks&&split.subtasks.length){
    bumpStat('subtask_pattern');
    const toAdd=split.subtasks.slice(0,remaining);
    toAdd.forEach(s=>_modalSubtasks.push(s));
    renderModalSubtasks();
    // Also update the task name in the input (strip the subtask list)
    document.getElementById('fName').value=split.name;
    btn.innerHTML=origBtnHtml;btn.style.pointerEvents='';
    return;
  }

  // ── LAYER 2: Template library ──
  const tmpl=templateSubtasks(taskName,dur);
  if(tmpl&&tmpl.length){
    bumpStat('subtask_template');
    const toAdd=tmpl.slice(0,remaining);
    toAdd.forEach(s=>_modalSubtasks.push(s));
    renderModalSubtasks();
    btn.innerHTML=origBtnHtml;btn.style.pointerEvents='';
    return;
  }

  // ── LAYER 3: AI fallback (only for tasks without templates) ──
  bumpStat('subtask_ai');
  try{
    const sanitized=sanitizeAIInput(taskName);
    const prompt=`Task: "${sanitized}" (${dur} min). Break into focused subtasks with 15-min-increment durations. Return ONLY a JSON array: [{"name":"...","duration":25}]`;
    // Validator: parsed array of objects with names
    const validate=(data)=>{
      try{
        const text=data.content.map(i=>i.text||'').join('');
        const clean=text.replace(/```json|```/g,'').trim();
        const parsed=JSON.parse(clean);
        if(!Array.isArray(parsed)||parsed.length===0)return null;
        if(!parsed.every(s=>s&&typeof s.name==='string'&&s.name.trim()))return null;
        return parsed;
      }catch{return null;}
    };
    const{result:subs,model:usedModel}=await callClaudeAPIWithFallback(
      [{role:"user",content:prompt}],300,validate
    );
    if(usedModel==='sonnet')bumpStat('subtask_sonnet_upgrades');
    const toAdd=subs.slice(0,remaining).map(s=>({
      id:genId(),
      name:String(s.name||'').slice(0,80),
      duration:Math.max(15,Math.round((s.duration||15)/15)*15),
      done:false
    })).filter(s=>s.name);
    if(toAdd.length<subs.length)showToast(`Added ${toAdd.length} of ${subs.length} (max 20 subtasks)`);
    toAdd.forEach(s=>_modalSubtasks.push(s));
    renderModalSubtasks();
  }catch(err){
    console.error('Subtask generation failed:',err);
    showToast('Could not generate subtasks — try the + button to add manually');
  }
  btn.innerHTML=origBtnHtml;btn.style.pointerEvents='';
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
  const dueDateNew=document.getElementById('fDueDate');if(dueDateNew)dueDateNew.value='';
  _modalAttachments=[];
  renderModalAttachments();
  document.getElementById('fRecurOn').checked=false;
  document.getElementById('fRecurN').value=1;
  document.getElementById('fRecurU').value='day';
  document.getElementById('recurOpts').style.display='none';
  document.getElementById('recurDaysRow').style.display='none';
  const recurEndRow=document.getElementById('recurEndRow');if(recurEndRow)recurEndRow.style.display='none';
  const recurEndCb=document.getElementById('fRecurEnd');if(recurEndCb)recurEndCb.checked=false;
  const recurEndDate=document.getElementById('fRecurEndDate');if(recurEndDate){recurEndDate.value='';recurEndDate.disabled=true;}
  setRecurDays([]);
  // Reset multi-day fields
  document.getElementById('fMultiStart').value='';
  document.getElementById('fMultiEnd').value='';
  document.getElementById('fMultiDayDates').style.display='none';
  document.getElementById('fEventColorWrap').style.display='none';
  document.getElementById('fSuppressWrap').style.display='none';
  const mdTog=document.getElementById('fMultiDayToggle');if(mdTog)mdTog.classList.remove('on');
  const supTog=document.getElementById('fSuppressToggle');if(supTog)supTog.classList.remove('on');
  const mdSub=document.getElementById('fMultiDaySub');if(mdSub){mdSub.textContent='Spans multiple days like a vacation or conference';mdSub.style.color='var(--text3)';}
  document.getElementById('btnDel').style.display='none';
  // Build time dropdowns
  const stEl=document.getElementById('fStartTime');if(stEl)buildTimeOptions(stEl,time);
  const etEl=document.getElementById('fEndTime');if(etEl)buildTimeOptions(etEl,null);
  setDurSpinner(30);
  // Ensure time row is not grayed out
  const timeRow=document.getElementById('fTimeRow');
  if(timeRow){timeRow.style.opacity='';timeRow.style.pointerEvents='';}
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
  // If a drag was just completed, don't open the modal
  if(_wasDragged){_wasDragged=false;return;}
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
  // Due date
  const dueDateEl=document.getElementById('fDueDate');
  if(dueDateEl)dueDateEl.value=t.dueDate||'';
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
  // Recurrence end date
  const recurEndRow=document.getElementById('recurEndRow');
  if(recurEndRow)recurEndRow.style.display=t.recur?'flex':'none';
  const recurEndCb=document.getElementById('fRecurEnd');
  const recurEndDate=document.getElementById('fRecurEndDate');
  if(recurEndCb&&recurEndDate){
    if(t.recurEnd){
      recurEndCb.checked=true;
      recurEndDate.disabled=false;
      recurEndDate.value=t.recurEnd;
    } else {
      recurEndCb.checked=false;
      recurEndDate.disabled=true;
      recurEndDate.value='';
    }
  }
  // Multi-day fields
  _modalMultiDay=!!(t.multiDay);
  _modalEventColor=t.eventColor||'';
  if(_itemType==='event'){
    setMultiDayModal(_modalMultiDay);
    if(_modalMultiDay){
      document.getElementById('fMultiStart').value=t.date||'';
      document.getElementById('fMultiEnd').value=t.endDate||'';
      updateMultiDaySub();
    }
  } else {
    setMultiDayModal(false);
  }
  // Suppress routines
  _modalSuppressRoutines=!!(t.suppressRoutines);
  if(_itemType==='event'&&(_modalAllday||_modalMultiDay)){setSuppressModal(_modalSuppressRoutines);}
  else{setSuppressModal(false);}
  document.getElementById('btnDel').style.display='block';
  // Build time dropdowns
  const stEl2=document.getElementById('fStartTime');if(stEl2)buildTimeOptions(stEl2,t.time||'09:00');
  const etEl2=document.getElementById('fEndTime');if(etEl2)buildTimeOptions(etEl2,null);
  // Ensure time row reflects allday state
  const timeRow=document.getElementById('fTimeRow');
  if(timeRow){timeRow.style.opacity=_modalAllday?'.35':'';timeRow.style.pointerEvents=_modalAllday?'none':'';}
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
  // If user cancelled editing...
  if(mMode==='edit'&&mId&&!_modalCommitted){
    const t=tasks.find(t=>t.id===mId);
    if(t){
      // Draft tasks (from quick-add) get removed on cancel
      if(t._draft){
        tasks=tasks.filter(x=>x.id!==mId);
        save();renderAll();
      } else {
        // Restore original subtasks for non-draft tasks
        t.subtasks=_editOrigSubtasks;if(curView==='day')renderDay();
      }
    }
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
  const name=document.getElementById('fName').value.trim();if(!name){showToast('Enter a task name first');document.getElementById('fName').focus();return}
  const priority=document.getElementById('fPri').value,category=document.getElementById('fCat').value,notes=document.getElementById('fNotes').value.trim();
  const recur=document.getElementById('fRecurOn').checked,recurN=parseInt(document.getElementById('fRecurN').value)||1,recurU=document.getElementById('fRecurU').value;
  const recurDays=(recur&&recurU==='week')?getRecurDays():[];
  const recurEndCb=document.getElementById('fRecurEnd');
  const recurEndDateEl=document.getElementById('fRecurEndDate');
  const recurEnd=(recur&&recurEndCb&&recurEndCb.checked&&recurEndDateEl&&recurEndDateEl.value)?recurEndDateEl.value:'';
  const duration=Math.round((_selDur||30)/15)*15||15; // snap duration to 15-min
  const location=document.getElementById('fLocation').value.trim();
  const type=_itemType;
  const subtasks=_modalSubtasks;
  const attachments=_modalAttachments;
  const allday=_itemType==='event'&&_modalAllday;
  const startTimeVal=document.getElementById('fStartTime').value||mTime;
  const finalTime=allday?null:(startTimeVal?snapTo15(startTimeVal):startTimeVal);
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
  const dueDate=document.getElementById('fDueDate')?document.getElementById('fDueDate').value:'';
  // Check blocked routine before saving
  if(finalTime&&type==='task'){
    const dateKey=mMode==='new'?mDate:(tasks.find(t=>t.id===mId)?.date||mDate);
    const rBlock=isBlockedByRoutine(dateKey,finalTime);
    if(rBlock.blocked){
      if(!confirm(`${rBlock.routineName} blocks ${fmtT(rBlock.routineStart)} – ${fmtT(rBlock.routineEnd)}.\n\nSchedule here anyway?`))return;
    }
    // Check slot capacity for new tasks
    if(mMode==='new'&&slotFull(dateKey,finalTime,null)){
      showToast('That time slot already has 3 tasks — try a different time');return;
    }
  }
  if(mMode==='new'){tasks.push({id:genId(),name,type,priority:type==='event'?'none':priority,category,notes,attachments,location,date:mDate,time:finalTime,allday,duration,scheduled:true,done:false,recur,recurN,recurU,recurDays,recurEnd,subtasks,doneOverrides:[],deletedOccurrences:[],multiDay,endDate,eventColor,suppressRoutines,dueDate});}
  else{const t=tasks.find(t=>t.id===mId);if(t){Object.assign(t,{name,type,priority:type==='event'?'none':priority,category,notes,attachments,location,allday,time:finalTime,duration,recur,recurN,recurU,recurDays,recurEnd,subtasks,multiDay,endDate:multiDay?endDate:'',eventColor:multiDay?eventColor:'',suppressRoutines,dueDate});delete t._draft;}if(t&&multiDay)t.date=mDate;}
  // Record pattern for personal learning (only real tasks, not events or all-day)
  if(type==='task'&&!allday)recordPattern(name,duration,category,finalTime);
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
// Holiday templates — dates computed per year automatically
const HOLIDAY_TEMPLATES=[
  {name:"New Year's Day",month:1,day:1},
  {name:'Martin Luther King Jr. Day',month:1,week:3,weekday:1},
  {name:"Presidents' Day",month:2,week:3,weekday:1},
  {name:'Memorial Day',month:5,week:-1,weekday:1},
  {name:'Juneteenth',month:6,day:19},
  {name:'Independence Day',month:7,day:4},
  {name:'Labor Day',month:9,week:1,weekday:1},
  {name:'Columbus Day',month:10,week:2,weekday:1},
  {name:"Veterans Day",month:11,day:11},
  {name:'Thanksgiving Day',month:11,week:4,weekday:4},
  {name:'Day After Thanksgiving',month:11,week:4,weekday:4,offset:1},
  {name:'Christmas Day',month:12,day:25},
];

// Compute the actual date for a holiday template in a given year
function holidayDate(tmpl,year){
  if(tmpl.day){
    // Fixed date
    const d=new Date(year,tmpl.month-1,tmpl.day);
    if(tmpl.offset)d.setDate(d.getDate()+tmpl.offset);
    return dk(d);
  }
  // Nth weekday of month (or last if week === -1)
  if(tmpl.week===-1){
    // Last occurrence of weekday in month
    const last=new Date(year,tmpl.month,0); // last day of month
    let d=last.getDate()-(last.getDay()-tmpl.weekday+7)%7;
    const result=new Date(year,tmpl.month-1,d);
    if(tmpl.offset)result.setDate(result.getDate()+tmpl.offset);
    return dk(result);
  }
  // Nth occurrence (1st, 2nd, 3rd, 4th)
  const first=new Date(year,tmpl.month-1,1);
  let dayOff=(tmpl.weekday-first.getDay()+7)%7;
  let d=1+dayOff+(tmpl.week-1)*7;
  const result=new Date(year,tmpl.month-1,d);
  if(tmpl.offset)result.setDate(result.getDate()+tmpl.offset);
  return dk(result);
}

// Format a template's typical date description
function holidayDesc(tmpl){
  const mNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  if(tmpl.day){
    let s=mNames[tmpl.month-1]+' '+tmpl.day;
    if(tmpl.offset)s+=' + '+tmpl.offset+' day';
    return s;
  }
  const wdNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const ordinal=tmpl.week===-1?'Last':['','1st','2nd','3rd','4th','5th'][tmpl.week];
  let s=ordinal+' '+wdNames[tmpl.weekday]+' in '+mNames[tmpl.month-1];
  if(tmpl.offset)s+=' + '+tmpl.offset+' day';
  return s;
}

// Enabled holidays — stored as array of template names
let _enabledHolidays=[];
try{
  const raw=JSON.parse(localStorage.getItem('clarity_holidays')||'[]');
  // Migrate old format: [{name,date}] → ['name']
  if(raw.length&&typeof raw[0]==='object'&&raw[0].date){
    _enabledHolidays=[...new Set(raw.map(h=>h.name))];
  } else {
    _enabledHolidays=raw;
  }
}catch{_enabledHolidays=[]}
function saveHolidays(){try{localStorage.setItem('clarity_holidays',JSON.stringify(_enabledHolidays))}catch(e){console.error(e)}}

function ensureHolidayCategory(){
  if(!categories.find(c=>c.id==='holiday')){
    categories.push({id:'holiday',name:'Holiday',color:'#ef4444'});
    save();
  }
}

function isHolidayEnabled(name){
  return _enabledHolidays.includes(name);
}

function toggleHoliday(name){
  const now=new Date();
  const curYear=now.getFullYear();
  const years=[curYear,curYear+1];
  const tmpl=HOLIDAY_TEMPLATES.find(t=>t.name===name);

  if(isHolidayEnabled(name)){
    // Remove — delete all events for this holiday
    _enabledHolidays=_enabledHolidays.filter(n=>n!==name);
    tasks=tasks.filter(t=>t._holidayTemplate!==name&&t._holidayId!==name);
  } else {
    // Add — create events for current year + next year
    ensureHolidayCategory();
    _enabledHolidays.push(name);
    // Clean any stale events first
    tasks=tasks.filter(t=>t._holidayTemplate!==name&&t._holidayId!==name);
    years.forEach(yr=>{
      if(!tmpl)return;
      const dateKey=holidayDate(tmpl,yr);
      tasks.push({
        id:genId(),name:name,type:'event',date:dateKey,time:null,
        allday:true,suppressRoutines:true,_holidayTemplate:name,
        category:'holiday',priority:'none',notes:'',location:'',
        duration:30,scheduled:true,done:false,recur:false,recurN:1,recurU:'day',
        subtasks:[],attachments:[],doneOverrides:[],deletedOccurrences:[],
        multiDay:false,endDate:'',eventColor:'',recurDays:[]
      });
    });
  }
  saveHolidays();save();renderHolidaysList();renderAll();
}

function selectAllHolidays(){
  let changed=false;
  const now=new Date();
  const curYear=now.getFullYear();
  const years=[curYear,curYear+1];
  HOLIDAY_TEMPLATES.forEach(tmpl=>{
    if(!isHolidayEnabled(tmpl.name)){
      ensureHolidayCategory();
      _enabledHolidays.push(tmpl.name);
      tasks=tasks.filter(t=>t._holidayTemplate!==tmpl.name&&t._holidayId!==tmpl.name);
      years.forEach(yr=>{
        const dateKey=holidayDate(tmpl,yr);
        tasks.push({
          id:genId(),name:tmpl.name,type:'event',date:dateKey,time:null,
          allday:true,suppressRoutines:true,_holidayTemplate:tmpl.name,
          category:'holiday',priority:'none',notes:'',location:'',
          duration:30,scheduled:true,done:false,recur:false,recurN:1,recurU:'day',
          subtasks:[],attachments:[],doneOverrides:[],deletedOccurrences:[],
          multiDay:false,endDate:'',eventColor:'',recurDays:[]
        });
      });
      changed=true;
    }
  });
  if(changed){saveHolidays();save();renderHolidaysList();renderAll();}
}

function clearAllHolidays(){
  if(!_enabledHolidays.length)return;
  _enabledHolidays.forEach(name=>{
    tasks=tasks.filter(t=>t._holidayTemplate!==name&&t._holidayId!==name);
  });
  _enabledHolidays=[];
  saveHolidays();save();renderHolidaysList();renderAll();
}

function renderHolidaysList(){
  const el=document.getElementById('holidaysList');if(!el)return;
  const now=new Date();now.setHours(0,0,0,0);
  const curYear=now.getFullYear();
  const enabledCount=_enabledHolidays.length;

  let html=`<div class="holiday-year-hdr">
    <span class="holiday-year-title">US Federal Holidays</span>
    <div class="holiday-year-actions">
      <button class="holiday-action-btn" onclick="selectAllHolidays()">Select All</button>
      <button class="holiday-action-btn" onclick="clearAllHolidays()">Clear All</button>
    </div>
  </div>`;

  HOLIDAY_TEMPLATES.forEach(tmpl=>{
    // Find the next occurrence
    let nextDate=holidayDate(tmpl,curYear);
    if(fromDk(nextDate)<now)nextDate=holidayDate(tmpl,curYear+1);
    const d=fromDk(nextDate);
    const dayName=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];
    const monthName=MONTHS_S[d.getMonth()];
    const on=isHolidayEnabled(tmpl.name);
    const desc=holidayDesc(tmpl);
    const escapedName=tmpl.name.replace(/'/g,"\\'");
    html+=`<label class="holiday-item${on?' on':''}">
      <input type="checkbox" class="holiday-cb" ${on?'checked':''} onchange="toggleHoliday('${escapedName}')">
      <div class="holiday-info">
        <span class="holiday-name">${tmpl.name}</span>
        <span class="holiday-date">Next: ${dayName}, ${monthName} ${d.getDate()}, ${d.getFullYear()} · ${desc}</span>
      </div>
    </label>`;
  });

  html+=`<div style="text-align:center;padding:16px 0"><button class="routine-add-btn" onclick="openNewHolidayEvent()">+ Add custom day off</button></div>`;
  el.innerHTML=html;
}

function openNewHolidayEvent(){
  ensureHolidayCategory();
  openNew(dk(new Date()),'09:00');
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
let _searchJustOpened=false;
function toggleSearch(){
  _searchOpen=!_searchOpen;
  document.getElementById('searchBar').classList.toggle('open',_searchOpen);
  if(_searchOpen){
    _searchJustOpened=true;
    setTimeout(()=>{_searchJustOpened=false;},0);
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
    (t.location&&t.location.toLowerCase().includes(q))||
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
  if(_searchOpen&&!_searchJustOpened&&!e.target.closest('.search-bar'))toggleSearch();
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
  // Phase A step 2 hotfix: data lives in _pendingDate / _pendingTime (set by addQuickEvent
  // for incomplete events). The old code read scheduledDate / scheduledTime which were
  // never populated, so the time always rendered empty. Read _pending* first, fall back
  // to scheduled* (in case any old data shape exists), then empty.
  document.getElementById('bdDetailDate').value=t._pendingDate||t.scheduledDate||'';
  document.getElementById('bdDetailTime').value=t._pendingTime||t.scheduledTime||'';
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
  // Phase A step 2 hotfix: same as delBD — clean up linked calendar sessions.
  const t=brainDump.find(b=>b.id===bdDetailId);
  if(t&&t.dueDate){
    tasks=tasks.filter(tk=>tk._parentBdId!==bdDetailId);
  }
  brainDump=brainDump.filter(t=>t.id!==bdDetailId);
  save();closeBDDetail();renderAll();
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
  const timeValRaw=document.getElementById('bdDetailTime').value;

  // Phase A step 2 hotfix: snap to 15-min so times like 6:43 PM don't break the slot grid.
  const timeVal=timeValRaw?snapTo15(timeValRaw):'';

  // If a date was provided, schedule it directly
  if(dateVal){
    // If user didn't fill the time field, fall back to any _pendingTime they had,
    // then to a sensible default. (Old code dropped _pendingTime on the floor.)
    const time=timeVal||snapTo15(t._pendingTime||'')||'09:00';
    const dur=t._pendingDuration||30;
    const newId=genId();
    tasks.push({
      id:newId,name,type:'task',priority,category,notes,attachments:[],location:t._pendingLocation||'',
      date:dateVal,time,allday:false,duration:dur,scheduled:true,done:false,
      recur:false,recurN:1,recurU:'day',recurDays:[],subtasks:[],doneOverrides:[],deletedOccurrences:[],
      multiDay:false,endDate:'',eventColor:'',suppressRoutines:false
    });
    // Phase A step 2 hotfix: register in Just Scheduled so user can undo, and so the
    // count pill in the BD panel actually moves when they schedule from the modal.
    const jsD=fromDk(dateVal);
    _justScheduled.unshift({id:newId,name,dest:DAYS_S[jsD.getDay()]+' '+fmtT(time),type:'task',date:dateVal,time});
    brainDump=brainDump.filter(t=>t.id!==bdDetailId);
  } else {
    // Keep in Brain Dump but update details. Preserve any _pendingTime so the
    // info the user typed in the time field doesn't vanish.
    Object.assign(t,{name,priority,category,notes});
    if(timeVal)t._pendingTime=timeVal;
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
    category:'Mindfulness & Wellness',
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
    category:'Health & Fitness',
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
    category:'Learning & Growth',
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
    category:'Work & Productivity',
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
  const dateVal=document.getElementById('qaDate').value;
  const timeVal=document.getElementById('qaTime').value;
  const priority=document.getElementById('qaPri').value;
  const type=_qaType;
  const isIncomplete=!dateVal||!timeVal;
  // ── Incomplete → save to brain dump for later scheduling ──
  if(isIncomplete){
    brainDump.push({
      id:genId(),name,type,category:'none',priority:type==='event'?'none':priority,
      notes:'',subtasks:[],
      _pendingDate:dateVal||'',_pendingTime:timeVal||''
    });
    save();renderAll();closeQuickAdd();
    showToast('"'+name+'" saved to Brain Dump — add missing details to schedule it');
    return;
  }
  // ── Complete → schedule with draft flag ──
  // Guardrails
  if(type==='task'){
    const rBlock=isBlockedByRoutine(dateVal,timeVal);
    if(rBlock.blocked){
      if(!confirm(`${rBlock.routineName} blocks ${fmtT(rBlock.routineStart)} – ${fmtT(rBlock.routineEnd)}.\n\nSchedule here anyway?`))return;
    }
  }
  if(slotFull(dateVal,timeVal,null)){
    if(!confirm(`This time slot already has ${MAX_TASKS_PER_SLOT} items.\n\nAdd anyway?`))return;
  }
  if(duplicateInSlot(dateVal,timeVal,name,null)){
    if(!confirm(`"${name}" is already in this time slot.\n\nAdd a duplicate?`))return;
  }
  const routineOverflow=checkRoutineOverflow(dateVal,timeVal,_qaDur);
  if(routineOverflow.blocked){
    showToast(`Note: extends into ${routineOverflow.routineName} at ${fmtT(routineOverflow.routineStart)}`);
  }
  const newTask={
    id:genId(),name,type,priority:type==='event'?'none':priority,category:'none',notes:'',attachments:[],location:'',
    date:dateVal,time:timeVal,allday:false,duration:_qaDur,scheduled:true,done:false,
    recur:false,recurN:1,recurU:'day',recurDays:[],subtasks:[],doneOverrides:[],deletedOccurrences:[],
    multiDay:false,endDate:'',eventColor:'',suppressRoutines:false,
    _draft:true
  };
  tasks.push(newTask);
  save();renderAll();closeQuickAdd();
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

  // Quick event input — Enter handled via HTML onkeydown attribute
}
document.addEventListener('DOMContentLoaded',clarityInit);
