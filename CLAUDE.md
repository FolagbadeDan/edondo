# Clearance — project context

An offline-first sobriety dashboard for someone quitting a 10-year daily cannabis habit.
Built for one specific user (32, day 1), not a general-purpose app. Keep that focus.

## Constraints that are not negotiable

- **No backend, no account, no analytics, no network calls to any server we control.**
  All state is `localStorage` under the key `clearance.v1`, with an in-memory fallback when
  storage is blocked. Do not add a database, auth, or telemetry.
- **No alcohol tracking of any kind.** The whole point is not substituting one for the other.
  The craving overlay carries an explicit anti-substitution warning. Keep it.
- **No build step.** Tailwind is the Play CDN, Lucide is a UMD script. The repo must stay
  deployable by dragging it onto Netlify. If you introduce a bundler, that is a deliberate
  decision to discuss first, not a refactor to slip in.
- **Every medical claim carries a source in the UI.** `MILESTONES` and `BADGES` in `app.js`
  each have a `src` field rendered as a caption. If you add a milestone, you add a citation.
  Do not write timings from memory — they were wrong four times in the first draft.

## Architecture

Single page, five tabs (`home`, `flow`, `body`, `life`, `you`) toggled by `goto()`.
No router, no framework. `index.html` holds all markup and design tokens; `app.js` holds
state, data, and logic. `clearance.html` is a generated single-file build — it is built by
inlining `app.js` into `index.html`, so **edit the split files and regenerate**, never edit
`clearance.html` directly.

Two clocks: `tick()` every second (counters, rings, countdowns), `slowTick()` every minute
(re-renders lists when a milestone unlocks). `visibilitychange` refreshes both on resume.

## Design language

Deep ink-blue base (`#0A0E14`), not flat black. IBM Plex Mono on every number so counters
read as instrument output. Bricolage Grotesque for display. Accents: `dawn` (pale blue,
primary), `oxygen` (seafoam, completion), `ember` (craving state), `alarm` (warnings only).
The hero ring breathes at 5.5 cycles/min — a real coherent-breathing cadence — and all
motion respects `prefers-reduced-motion`. Do not add gradients-as-decoration or a bright
acid-green accent.

## Judgement calls already made — don't silently reverse them

- The 15-minute craving timer is **not** fully un-dismissible despite the original spec.
  An exit appears after 90 seconds behind a confirm, and leaving early still logs the
  craving rather than punishing the user. Trapping someone in a locked full-screen countdown
  fails badly in a real emergency.
- The ten-year arc bar uses a **log scale**. Linear puts day 1 at 0.03%, invisible on the
  day it matters most. There is a 2% floor so hour one still shows movement.
- Life-expectancy figures are keyed to the user's age via `AGE_BANDS` (Jha 2013). The app
  states plainly that this data is from *tobacco* cessation cohorts, because cannabis
  long-term mortality data is far thinner. Do not remove that caveat to make the number
  look stronger.
- Insomnia advice says a hot shower 60–90 min before bed, not the 30 min the original brief
  asked for. The sleep trigger is the core-temperature drop afterwards, which takes about
  an hour.

## Tone

Plain, direct, and never congratulatory-cheerful. This person is on day one of something
hard. Copy should sound like a knowledgeable friend stating facts, not a wellness app.
No emoji, no exclamation marks in UI copy, no "You've got this!"
