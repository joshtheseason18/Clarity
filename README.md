# Luclaro — Ship build (2026-09-24 FINAL)

Upload ALL ELEVEN files in one commit:
index.html, main.js, focus.js, today.js, design.css, sw.js, favicon.svg, apple-touch-icon.png, icon-192.png, icon-512.png, manifest.json

Commit message: "Focus timer to spec, offline support, living brand mark, sync nudge, app icons"

## The identity system (new in FINAL)
- TAB: the pulse — transparent-background green favicon; deep green on light tab bars, bright emerald on dark (SVG prefers-color-scheme).
- IN-APP: the living mark at the top of the rail — SUNRISE in day theme, the LUCERO STAR at night. It follows the resolved theme (so `system` flips it by time of day), and it IS the theme toggle: tap the sun, get the star.
- HOME SCREEN: pulse on ink (iOS/Android tiles can't be transparent).

## Also in this build (recap)
Focus timer rebuilt (survives navigation + refresh, mini pill everywhere, Task mode counts down remaining time); focus ring + one-tap focus on Today's in-progress card; OFFLINE support via service worker (app loads with no connection; Supabase never cached); guest sync nudge on Today; capture bar auto-focus on desktop; favicon/manifest/touch icons; liveNow scope-bug fix.

## Verify after deploy (hard-refresh TWICE — second load activates the worker)
1. Tab shows the green pulse on a clear background.
2. Rail top: sunrise (day theme) → tap it → night theme + the star. Set theme to System in Settings → mark follows the clock.
3. Sync nudge → sign in on Mac AND phone → "sync test" crosses → nudge gone.
4. Sprint → play → Today: mini pill counts; refresh mid-sprint → resumes.
5. In-progress card → ring + target → tap → toast + countdown of remaining minutes.
6. OFFLINE: load once, airplane mode, reload → app opens with your data.
7. Phone: Add to Home Screen → pulse icon, standalone.

## Notes
- Favicons cache hard: if the tab icon doesn't change, close the tab and open a fresh one (the ?v=2 handles most browsers).
- After ANY future deploy: refresh twice (network-first worker). If ever stale: DevTools → Application → Service Workers → Unregister → reload.
- Optional repo sweep while uploading: delete app.js, styles.css, onboarding.js.

## Post-Japan queue
Calendar coherence pass (Year + goals decisions), JSON import, touch drag.
