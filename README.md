# Luclaro — Ship build (2026-09-24)

Upload ALL NINE files to the repo in one commit:
index.html, focus.js, today.js, design.css, favicon.svg, apple-touch-icon.png, icon-192.png, icon-512.png, manifest.json

Commit message: "Focus timer to spec (persistence + mini timer + task countdown), focus ring on Today, app icons"

## What changed
- Focus timer rebuilt on a wall-clock engine: survives navigation AND page refresh (clarity_focus_active, written only on state changes so sync never churns). Mini timer pill follows you on every screen (tap = open Focus, button = pause/resume). Task mode now counts DOWN — the task's duration, or its remaining time if it's already in progress. Reset button while a session exists; mode tabs lock during a session so a stray tap can't lose a timer. Chime + mark-done completion flow unchanged; subtasks/picker unchanged.
- Today: the currently-in-progress task card gets an accent ring + a target button — one tap starts a task focus session without leaving Today (toast confirms, mini pill appears).
- App identity: favicon (emerald dot on ink), iOS home-screen icon, Android manifest icons, theme-color metas. "Add to Home Screen" on the phone now looks like a real app.
- Bug caught pre-ship: liveNow used an out-of-scope variable in renderTimeGrid (would have crashed every grid render) — fixed to isViewingToday().

## Verify after deploy (hard-refresh)
1. Focus → Sprint → play → go to Today: mini pill bottom-right, counting. Tap pill → back on Focus mid-count.
2. Refresh the page mid-sprint → timer resumes where it was.
3. Let one finish → chime + "that's a wrap" (mini pill hides on Focus screen).
4. Add a task covering right now on Today → card shows accent ring + target icon → tap it → toast "Focusing on … until …", pill appears, Focus screen shows it counting down the remaining minutes.
5. Phone: Share → Add to Home Screen → emerald-dot icon, opens standalone.

## Repo sweep (optional, 2 min, in GitHub UI)
Open each of app.js, styles.css, onboarding.js → trash icon → commit. Nothing loads them; deleting prevents future edit-the-wrong-file accidents.

## Still open (post-Japan)
Calendar coherence pass (needs your Year + goals-strip decisions), JSON import, guest sign-in nudge, touch drag for rescheduling cards. And the ten-minute auth/sync gate if you still haven't run it.
