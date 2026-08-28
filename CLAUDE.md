# E Don Do — project context

An offline-first sobriety dashboard for people quitting cannabis, built for the Nigerian
market. Formerly "Clearance", which was built for one specific user (32, ten years, day 1).
It is now a product for a market: age, years smoked and start age all vary, and the app
adapts to them.

## Constraints that are not negotiable

- **No backend, no account, no analytics, no network calls to any server we control.**
  All state is `localStorage` under the key `edondo.v1`, with an in-memory fallback when
  storage is blocked.

  This is now a **legal** constraint, not only an architectural one. The Nigeria Data
  Protection Act 2023 treats anyone under 18 as a child, and under-13s cannot consent to
  processing at all. Because nothing leaves the device there is no data controller and no
  children's data to protect. Adding a backend would create that obligation overnight and
  retroactively, for every minor already using the app. Do not add one.

- **No alcohol tracking of any kind.** The whole point is not substituting one for the other.
  The craving overlay carries an explicit anti-substitution warning. Keep it.

- **Every medical claim carries a source in the UI.** `MILESTONES` and `BADGES` in `app.js`
  each have a `src` field rendered as a caption, and a test asserts that none is empty.
  If you add a milestone, you add a citation. Do not write timings from memory — they were
  wrong four times in the first draft.

- **There is no life-expectancy figure below age 25.** The Jha 2013 cohorts start at 25–34.
  `AGE_BANDS` carries `years: null` for the under-18 and 18–24 bands and `renderLife` makes
  a different argument for them. Never invent a number to fill that gap.

## Architecture

Single page, five tabs (`home`, `flow`, `body`, `life`, `you`) toggled by `goto()`.
No router, no framework. `index.html` holds all markup and design tokens; `app.js` holds
state, data, and logic.

`edondo.html` is a generated single-file build — run `npm run build` to regenerate it from
`index.html` + `app.js`. Never edit it directly. (The old `clearance.html` was documented as
generated while nothing generated it, so it silently drifted.)

The montage track's cards are built **once**, on open. Navigation only updates dots,
buttons and smoke opacity. Rewriting the track's `innerHTML` during navigation destroys the
cards and resets `scrollLeft`, which cancels the scroll mid-flight — that is what broke the
Next button on phones while swiping still worked. The track also must not carry Tailwind's
`scroll-smooth`: with CSS `scroll-behavior: smooth`, assigning `scrollLeft` animates too, so
the JS fallback interrupts the scroll it exists to rescue. Tests guard both.

Two clocks: `tick()` every second (counters, rings, countdowns), `slowTick()` every minute
(re-renders lists when a milestone unlocks). `visibilitychange` refreshes both on resume.

### Three separate facts, and what each one drives

Do not confuse these. Conflating them is what produced the original bugs.

| Fact | Field | Drives |
|---|---|---|
| What to call them | `name` | Home greeting, craving screen, onboarding clock question — nowhere else |
| Time since quitting | `quitTs` | Counters, milestones, rings, countdowns |
| Age now | `age` | Which argument the app makes — see `profileFor()` |
| Age at first use | `startAge` | Under 18 switches to the developmental argument |
| How long the habit ran | `yearsSmoked` | The length of the recovery arc, and nothing else |

The arc span is **not** the user's age. It is `yearsSmoked`, floored at 2 (so the two-year
arc stop still fits on the bar) and capped at 10 (where the content ends).

### Tests

`npm test` runs `test/core.test.mjs` against a DOM stub. It covers the age bands, the
content profile, the arc maths, countdown formatting, milestone ordering and citations,
and storage load/merge/corruption. Add to it whenever you touch any of that — this is the
arithmetic the whole app rests on.

Note: `app.js` is a plain browser script with no exports. The test harness evaluates it in
a `vm` context and pulls top-level `const`s out through the context's lexical scope. Keep
`app.js` free of a module system; it does not need one.

### Storage migrations

`SCHEMA` + the `MIGRATIONS` map in `app.js` handle version upgrades. It is empty today
because there were no users at the rename. When a field changes meaning, bump `SCHEMA` and
add a migration function rather than letting `load()` guess.

## Design language

Deep ink-blue base (`#0A0E14`), not flat black. IBM Plex Mono on every number so counters
read as instrument output. Bricolage Grotesque for display. Accents: `dawn` (pale blue,
primary), `oxygen` (seafoam, completion), `ember` (craving state), `alarm` (warnings only).
The hero ring breathes at 5.5 cycles/min — a real coherent-breathing cadence — and all
motion respects `prefers-reduced-motion`. Do not add gradients-as-decoration or a bright
acid-green accent.

### Smoke

Smoke is **subject matter, not decoration** — it is the thing being left behind. It appears
in exactly two places, and only because it means something in both: drifting across the
montage and thinning to nothing by the final card (the argument the montage is making,
drawn instead of stated), and on the craving overlay where it breathes at the same 5.5
breaths per minute as the hero ring, so watching it paces the user's breathing. Never add
it as a background texture; that is the gradients-as-decoration rule it would break.

Implemented as three blurred radial blobs animating transform and opacity only, at three
different periods so they never visibly loop together. No canvas — this has to be cheap on
a low-end Android that needs to hold a charge all day. All of it stops under
`prefers-reduced-motion`.

**Planned:** a light theme alongside the dark one, driven entirely by tokens, because dark
screens are hard to read in Nigerian daylight. When that lands, no colour may be defined
only inside a theme block.

## Visual direction

The app is being moved from text-first to glance-first. The rule is **show the number,
hide the paragraph**: every dense card leads with a visual and one short line, with the
full explanation and its citation one tap away. Nothing is deleted — the citations are the
app's credibility.

One finding that runs against instinct: abstract icons are semantically opaque to
low-literacy users, who consistently prefer concrete photographic images. Lucide glyphs are
exactly that kind of abstract symbol. **Adding more icons makes comprehension worse.** Use
photographs for anything a person does, and never ship an icon without a text label.

### The name

Optional, display-only, never leaves the device. Used in exactly three places: the top of
Home, the craving overlay eyebrow, and the onboarding clock question. Anywhere else and it
starts to read as a wellness app addressing you by name, which the tone rules exist to
prevent. `cleanName()` trims, collapses whitespace, caps at 24 characters and rejects
punctuation-only input; it deliberately accepts accents and non-latin scripts.

## Tone

Plain, direct, and never congratulatory-cheerful. This person is on day one of something
hard. Copy should sound like a knowledgeable friend stating facts, not a wellness app.
No emoji, no exclamation marks in UI copy, no "You've got this!"

**Simple Nigerian English.** Short sentences, everyday words, no clinical register and no
imported idiom. Not Pidgin — that was considered and ruled out, because it doubles every
piece of copy permanently. Write the way a well-informed Nigerian friend would explain it
out loud.

## Judgement calls already made — don't silently reverse them

- The 15-minute craving timer is **not** fully un-dismissible despite the original spec.
  An exit appears after 90 seconds behind a confirm, and leaving early still logs the
  craving rather than punishing the user. Trapping someone in a locked full-screen countdown
  fails badly in a real emergency.
- The arc bar uses a **log scale**. Linear puts day 1 at 0.03%, invisible on the day it
  matters most. There is a 2% floor so hour one still shows movement.
- Life-expectancy figures are keyed to the user's age via `AGE_BANDS` (Jha 2013). The app
  states plainly that this data is from *tobacco* cessation cohorts, because cannabis
  long-term mortality data is far thinner. Do not remove that caveat to make the number
  look stronger.
- Insomnia advice says a hot shower 60–90 min before bed, not the 30 min the original brief
  asked for. The sleep trigger is the core-temperature drop afterwards, which takes about
  an hour.
- Under-18s are **served, not gated**. They are the group the research says has most to
  gain. The cost is an explicit not-medical-advice line, a crisis route, and the permanent
  no-backend commitment above.

## Build

There *is* a build step now — this reverses the original "no build step" rule, deliberately,
because the mobile app requires one and the Tailwind Play CDN recompiles on every page load,
which costs users real money on metered Nigerian data.

The rule that replaces it: **the web output must stay a static folder you can drag onto
Netlify.** No server, no runtime, no framework.

```
npm test       # the arithmetic
npm run build  # regenerate edondo.html and write dist/
```

`app.js` is cache-busted by content hash at build time — `dist/index.html` requests
`app.js?v=<hash>`, `dist/sw.js` precaches the same URL, and the cache name carries the hash
so each build evicts the last. Without this a browser pairs a cached script with fresh
markup, which fails in ways that look like nothing on earth. It bit during development.

`npm run build` writes `dist/`, which is the only thing deployed. It contains the app and
nothing else — no CLAUDE.md, no tests, no build script served as web files. Both Vercel and
Netlify publish `dist`, and a test asserts they agree with each other and with the service
worker's precache list. If you add a file the app loads at runtime, add it to `DEPLOY` in
`build.mjs` or it will 404 in production while working perfectly on localhost.

Still to do: compile Tailwind to a static stylesheet and drop the CDN (Phase 4).
