/* Tests for the arithmetic E Don Do is built on.
   CLAUDE.md records that the timings "were wrong four times in the first draft",
   which is exactly why this file exists. Run with: npm test

   app.js is a browser script with no exports, so we evaluate it against a minimal
   DOM stub and read the functions back out. That keeps the app itself free of a
   module system it does not otherwise need. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, '..', 'app.js'), 'utf8');

/* A DOM stub that answers every query with an inert element, so app.js can run
   its module-level wiring without a browser. */
function stubElement() {
  const el = {
    textContent: '', innerHTML: '', value: '', hidden: false,
    style: {}, dataset: {},
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
    addEventListener() {}, appendChild() {}, setAttribute() {}, removeAttribute() {},
    querySelector: () => stubElement(), querySelectorAll: () => [],
    getContext: () => null, focus() {}, click() {}
  };
  return el;
}

function loadApp({ storage = new Map() } = {}) {
  const doc = {
    querySelector: () => stubElement(),
    querySelectorAll: () => [],
    addEventListener() {},
    createElement: () => stubElement(),
    body: stubElement(),
    documentElement: stubElement(),
    title: '',
    hidden: false
  };

  const sandbox = {
    document: doc,
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: k => storage.delete(k)
    },
    navigator: {},                    // no serviceWorker key: the PWA block stays off
    location: { reload() {} },
    setInterval: () => 0,
    clearInterval: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    addEventListener() {},
    removeEventListener() {},
    scrollTo() {},
    requestAnimationFrame: cb => { cb(0); return 0; },
    confirm: () => false,
    Blob: class {},
    URL: { createObjectURL: () => '', revokeObjectURL() {} },
    lucide: { createIcons() {} },
    console
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'app.js' });

  /* `function` declarations land on the sandbox global, but top-level `const`/`let`
     stay in the context's lexical scope. A second script in the same context can
     still see them, so collect the ones under test by name. */
  const collected = vm.runInContext(`({
    KEY, SCHEMA, state,
    AGE_BANDS, MILESTONES, BADGES, ARC_STOPS,
    arcPct, arcSpanYears, arcSpanDays,
    ARC_MIN_YEARS, ARC_MAX_YEARS,
    ONBOARD_LAST, MONTAGE, MONTAGE_ART, montageCards, CONFETTI_COLORS
  })`, sandbox);
  collected.cleanName = sandbox.cleanName;

  return { ...collected, ageBand: sandbox.ageBand, profileFor: sandbox.profileFor,
           fmtCountdown: sandbox.fmtCountdown };
}

const DAY = 86_400_000;
const YEAR = 365.25 * DAY;

/* ---------------- age bands ---------------- */

test('ageBand never files a minor under an adult band', () => {
  const app = loadApp();
  for (const age of [10, 13, 15, 17]) {
    const b = app.ageBand(age);
    assert.equal(b.band, 'under 18', `age ${age} landed in "${b.band}"`);
    assert.equal(b.years, null, `age ${age} was given a life-expectancy figure`);
  }
});

test('ageBand covers 18-24 with no invented figure', () => {
  const app = loadApp();
  for (const age of [18, 21, 24]) {
    const b = app.ageBand(age);
    assert.equal(b.band, '18–24');
    assert.equal(b.years, null);
  }
});

test('ageBand still returns the Jha figures for adults', () => {
  const app = loadApp();
  assert.equal(app.ageBand(25).years, 10);
  assert.equal(app.ageBand(34).years, 10);
  assert.equal(app.ageBand(35).years, 9);
  assert.equal(app.ageBand(44).years, 9);
  assert.equal(app.ageBand(45).years, 6);
  assert.equal(app.ageBand(55).years, 4);
  assert.equal(app.ageBand(65).years, 3);
  assert.equal(app.ageBand(99).years, 3);
});

test('every age from 10 to 100 lands in exactly one band', () => {
  const app = loadApp();
  for (let age = 10; age <= 100; age++) {
    const matches = app.AGE_BANDS.filter(b => age >= b.min && age <= b.max);
    assert.equal(matches.length, 1, `age ${age} matched ${matches.length} bands`);
  }
});

test('ageBand rejects nonsense rather than guessing', () => {
  const app = loadApp();
  assert.equal(app.ageBand(null), null);
  assert.equal(app.ageBand(0), null);
  assert.equal(app.ageBand(-5), null);
  assert.equal(app.ageBand('abc'), null);
});

/* ---------------- content profile ---------------- */

test('profileFor routes minors to the teen argument', () => {
  const app = loadApp();
  assert.equal(app.profileFor({ age: 15, startAge: 14 }), 'teen');
  assert.equal(app.profileFor({ age: 17, startAge: null }), 'teen');
});

test('profileFor flags an adult who started before 18', () => {
  const app = loadApp();
  assert.equal(app.profileFor({ age: 26, startAge: 14 }), 'earlyStart');
  assert.equal(app.profileFor({ age: 40, startAge: 17 }), 'earlyStart');
});

test('profileFor leaves a late-starting adult on the adult argument', () => {
  const app = loadApp();
  assert.equal(app.profileFor({ age: 32, startAge: 22 }), 'adult');
  assert.equal(app.profileFor({ age: 32, startAge: null }), 'adult');
});

/* ---------------- the recovery arc ---------------- */

test('arc span follows years smoked, not age', () => {
  const app = loadApp();
  app.state.age = 32; app.state.yearsSmoked = 4;
  assert.equal(app.arcSpanYears(), 4);

  app.state.age = 13;              // the case that started all this
  assert.equal(app.arcSpanYears(), 4, 'changing age moved the arc');
});

test('arc span is floored at 2 years so the 2-year stop still fits', () => {
  const app = loadApp();
  app.state.yearsSmoked = 0.5;
  assert.equal(app.arcSpanYears(), 2);
});

test('arc span is capped at 10 years, where the content ends', () => {
  const app = loadApp();
  app.state.yearsSmoked = 25;
  assert.equal(app.arcSpanYears(), 10);
});

test('arc span falls back to 10 years when unknown', () => {
  const app = loadApp();
  for (const v of [null, undefined, 0, NaN, -3]) {
    app.state.yearsSmoked = v;
    assert.equal(app.arcSpanYears(), 10, `yearsSmoked=${v} did not fall back`);
  }
});

test('arcPct rises monotonically and reaches 100 at the end of the span', () => {
  const app = loadApp();
  app.state.yearsSmoked = 5;
  const span = 5 * YEAR;
  let prev = -1;
  for (const frac of [0, 0.001, 0.01, 0.1, 0.25, 0.5, 0.75, 1]) {
    const p = app.arcPct(span * frac);
    assert.ok(p >= prev, `arcPct went backwards at ${frac}`);
    assert.ok(p >= 0 && p <= 100, `arcPct out of range: ${p}`);
    prev = p;
  }
  assert.ok(app.arcPct(span) > 99.9, 'arc did not reach the end of its own span');
});

test('arcPct never exceeds 100 past the end of the span', () => {
  const app = loadApp();
  app.state.yearsSmoked = 3;
  assert.equal(app.arcPct(50 * YEAR), 100);
});

test('the log scale keeps day one visible', () => {
  const app = loadApp();
  app.state.yearsSmoked = 10;
  // linear would put day 1 at 0.03%; the log scale must do far better
  assert.ok(app.arcPct(DAY) > 5, `day one sat at ${app.arcPct(DAY)}%`);
});

/* ---------------- countdown formatting ---------------- */

test('fmtCountdown pads and rolls over correctly', () => {
  const app = loadApp();
  assert.equal(app.fmtCountdown(0), 'unlocked');
  assert.equal(app.fmtCountdown(-1), 'unlocked');
  assert.equal(app.fmtCountdown(5_000), '00h 00m 05s');
  assert.equal(app.fmtCountdown(65_000), '00h 01m 05s');
  assert.equal(app.fmtCountdown(3_600_000), '01h 00m 00s');
  assert.equal(app.fmtCountdown(DAY), '1d 00h 00m 00s');
  assert.equal(app.fmtCountdown(DAY + 3_600_000 + 120_000 + 3_000), '1d 01h 02m 03s');
});

/* ---------------- milestones ---------------- */

test('milestones are ordered and every one carries a source', () => {
  const app = loadApp();
  for (let i = 1; i < app.MILESTONES.length; i++) {
    assert.ok(app.MILESTONES[i].at >= app.MILESTONES[i - 1].at,
      `milestone ${i} ("${app.MILESTONES[i].name}") is out of order`);
  }
  for (const m of [...app.MILESTONES, ...app.BADGES]) {
    assert.ok(m.src && m.src.trim().length > 0, `"${m.name}" has no citation`);
    assert.ok(m.desc && m.desc.trim().length > 0, `"${m.name}" has no description`);
  }
});

test('arc stops all sit inside the maximum span', () => {
  const app = loadApp();
  const maxSpan = 10 * YEAR;
  for (const s of app.ARC_STOPS) {
    assert.ok(s.at <= maxSpan, `arc stop "${s.full}" sits past the end of the bar`);
  }
});

/* ---------------- storage ---------------- */

test('state loads clean when storage is empty', () => {
  const app = loadApp();
  assert.equal(app.state.quitTs, null);
  assert.equal(app.state.yearsSmoked, null);
  assert.equal(app.state.startAge, null);
  assert.equal(app.state.schema, app.SCHEMA);
});

test('stored state is merged over defaults, so new fields appear', () => {
  const storage = new Map([['edondo.v1', JSON.stringify({ quitTs: 1234, age: 32 })]]);
  const app = loadApp({ storage });
  assert.equal(app.state.quitTs, 1234);
  assert.equal(app.state.age, 32);
  assert.equal(app.state.yearsSmoked, null, 'a field added later did not default');
  assert.equal(app.state.schema, app.SCHEMA, 'schema was not stamped on load');
});

test('corrupt stored state falls back to defaults instead of throwing', () => {
  const storage = new Map([['edondo.v1', '{not json']]);
  const app = loadApp({ storage });
  assert.equal(app.state.quitTs, null);
});

test('the storage key is the renamed one', () => {
  const app = loadApp();
  assert.equal(app.KEY, 'edondo.v1');
});

/* ---------------- the name ---------------- */

test('cleanName tidies input without mangling real names', () => {
  const app = loadApp();
  assert.equal(app.cleanName('  Daniel  '), 'Daniel');
  assert.equal(app.cleanName('Folagbade   Daniel'), 'Folagbade Daniel');
  assert.equal(app.cleanName("N'Golo"), "N'Golo");
  assert.equal(app.cleanName('Chiamaka-Ada'), 'Chiamaka-Ada');
  assert.equal(app.cleanName('Adé'), 'Adé', 'accented letters must survive');
  assert.equal(app.cleanName('陳'), '陳', 'non-latin scripts must survive');
});

test('cleanName rejects empty and punctuation-only input', () => {
  const app = loadApp();
  for (const v of ['', '   ', null, undefined, '...', '---', '!!!']) {
    assert.equal(app.cleanName(v), '', `"${v}" should clean to empty`);
  }
});

test('cleanName caps length so it cannot break a heading', () => {
  const app = loadApp();
  const out = app.cleanName('x'.repeat(200));
  assert.equal(out.length, 24);
});

test('the name defaults to empty and is part of stored state', () => {
  const app = loadApp();
  assert.equal(app.state.name, '');
  assert.ok('name' in app.state);
});

test('a stored name survives a load', () => {
  const storage = new Map([['edondo.v1', JSON.stringify({ quitTs: 1234, name: 'Ada' })]]);
  const app = loadApp({ storage });
  assert.equal(app.state.name, 'Ada');
});

/* ---------------- the montage ---------------- */

test('every montage claim carries a source, and every card has art', () => {
  const app = loadApp();
  for (const c of app.MONTAGE) {
    assert.ok(c.head && c.body, 'a montage card is missing text');
    assert.ok(app.MONTAGE_ART[c.art], `card "${c.head}" points at missing art "${c.art}"`);
  }
  // cards stating a research finding must cite it; the reflective ones need not
  const factual = app.MONTAGE.filter(c => /research|study|percent|risk|found/i.test(c.body));
  assert.ok(factual.length >= 3, 'expected several evidence-bearing cards');
  for (const c of factual) {
    assert.ok(c.src && c.src.trim(), `"${c.head}" makes a factual claim with no source`);
  }
});

test('the developmental card is shown only to people who started before 18', () => {
  const app = loadApp();
  const wiring = app.MONTAGE.find(c => c.art === 'wiring');
  assert.ok(wiring.when, 'the developmental card must be conditional');
  assert.equal(!!wiring.when({ startAge: 14 }), true);
  assert.equal(!!wiring.when({ startAge: 22 }), false);
  assert.equal(!!wiring.when({ startAge: null }), false);
});

test('montageCards filters by the current state', () => {
  const app = loadApp();
  const all = app.MONTAGE.length;

  app.state.startAge = 14;
  assert.equal(app.montageCards().length, all, 'an early starter should see every card');

  app.state.startAge = 25;
  assert.equal(app.montageCards().length, all - 1, 'a late starter should not see the teen card');
});

test('the montage ends on the reframe, not on a statistic', () => {
  const app = loadApp();
  const last = app.MONTAGE[app.MONTAGE.length - 1];
  assert.ok(!last.when, 'the closing card must never be conditional — everyone needs it');
  assert.match(last.head + ' ' + last.body, /setup/i,
    'the last beat turns explanation into something actionable; keep it');
});

test('the montage never blames the music', () => {
  const app = loadApp();
  const text = app.MONTAGE.map(c => c.head + ' ' + c.body).join(' ');
  for (const bad of [/bad music/i, /stop listening/i, /music is to blame/i, /blame the/i]) {
    assert.ok(!bad.test(text), `montage copy drifted into blaming: ${bad}`);
  }
});

/* ---------------- deploy ---------------- */

test('every local file the service worker precaches is in the deploy folder', () => {
  const sw = readFileSync(join(here, '..', 'sw.js'), 'utf8');
  const build = readFileSync(join(here, '..', 'build.mjs'), 'utf8');

  const shell = [...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean);
  const deploy = build.split('const DEPLOY = [')[1].split(']')[0];

  for (const path of shell) {
    const top = path.split('/')[0];
    assert.ok(deploy.includes(`'${top}'`),
      `sw.js precaches "${path}" but build.mjs never copies "${top}" into dist/ — it would 404 in production`);
  }
});

test('the deploy folder excludes source and docs', () => {
  const build = readFileSync(join(here, '..', 'build.mjs'), 'utf8');
  const deploy = build.split('const DEPLOY = [')[1].split(']')[0];
  for (const f of ['CLAUDE.md', 'README.md', 'package.json', 'build.mjs', 'test']) {
    assert.ok(!deploy.includes(`'${f}'`), `${f} must not be served as a web file`);
  }
});

test('both hosts publish the same directory the build writes', () => {
  const vercel = JSON.parse(readFileSync(join(here, '..', 'vercel.json'), 'utf8'));
  const netlify = readFileSync(join(here, '..', 'netlify.toml'), 'utf8');
  assert.equal(vercel.outputDirectory, 'dist');
  assert.match(netlify, /publish\s*=\s*"dist"/);
});

/* ---------------- milestone unlock ---------------- */

test('exactly the landmark milestones are marked big', () => {
  const app = loadApp();
  const big = [...app.MILESTONES, ...app.BADGES].filter(m => m.big).map(m => m.name);
  assert.deepEqual(big.sort(), [
    'CB1 receptors normalised',
    'Excess risk largely averted',
    'Structural habit rewiring',
    'THC fully eliminated',
    'Trajectory reset'
  ].sort(), 'confetti is reserved for the moments people actually count toward');
});

test('most milestones are not landmarks', () => {
  const app = loadApp();
  const big = app.MILESTONES.filter(m => m.big).length;
  assert.ok(big < app.MILESTONES.length / 2,
    'if most milestones are landmarks, none of them are — and the tone rule is gone for nothing');
});

test('celebratedThrough starts null so history is acknowledged silently', () => {
  const app = loadApp();
  assert.equal(app.state.celebratedThrough, null,
    'a new user, or an import of old data, must not be shown a pile of overlays at once');
});

test('a stored celebratedThrough survives a load', () => {
  // 10 days in, which is exactly 4 milestones passed (12h, 24h, day 6, week 1),
  // so boot has nothing new to acknowledge and must leave the stored value alone
  const storage = new Map([['edondo.v1', JSON.stringify({
    quitTs: Date.now() - 10 * DAY, celebratedThrough: 4
  })]]);
  const app = loadApp({ storage });
  assert.equal(app.state.celebratedThrough, 4);
});

test('milestones passed while the app was closed are acknowledged on next open', () => {
  // stored at 4 acknowledged, but 20 days have actually passed — the two-week
  // milestone crossed while the app was shut, and must not be silently skipped
  const storage = new Map([['edondo.v1', JSON.stringify({
    quitTs: Date.now() - 20 * DAY, celebratedThrough: 4
  })]]);
  const app = loadApp({ storage });
  assert.ok(app.state.celebratedThrough > 4,
    'a milestone reached while the app was closed should still be shown when it reopens');
});

test('confetti is skipped entirely under reduced motion', () => {
  const src = readFileSync(join(here, '..', 'app.js'), 'utf8');
  const fn = src.split('function fireConfetti(')[1].split('\n}')[0];
  assert.match(fn, /reduced-motion/, 'confetti must not fire for users who ask for less motion');
  const guardBeforeDraw = fn.indexOf('reduced') < fn.indexOf('requestAnimationFrame');
  assert.ok(guardBeforeDraw, 'the reduced-motion check must come before any drawing starts');
});

test('the confetti canvas is unhidden before it is measured', () => {
  const src = readFileSync(join(here, '..', 'app.js'), 'utf8');
  const fn = src.split('function fireConfetti(')[1].split('\n}')[0];
  assert.ok(fn.indexOf('canvas.hidden = false') < fn.indexOf('canvas.clientWidth'),
    'a hidden element reports clientWidth 0, which sizes the canvas to nothing and draws into the void');
});

test('confetti uses the app palette, not a rainbow', () => {
  const app = loadApp();
  const tokens = ['#8FB8E8', '#79C8B4', '#E5A25C', '#E7EEF7'];
  for (const c of app.CONFETTI_COLORS) {
    assert.ok(tokens.includes(c), `${c} is not one of the app's colours`);
  }
});

/* ---------------- markup guards ----------------
   These are string checks against index.html rather than real layout tests, but
   they pin two mistakes that already happened once: onboarding grew taller than
   a phone screen with no way to scroll to the submit button, and form fields
   were left under 16px, which makes iOS zoom in on focus and never zoom back. */

const indexHtml = readFileSync(join(here, '..', 'index.html'), 'utf8');

test('the onboarding overlay can always be scrolled', () => {
  const overlay = indexHtml.match(/<div id="onboard"[^>]*>/)[0];
  assert.match(overlay, /overflow-y-auto/,
    'onboarding is fixed-position; without overflow-y-auto, content taller than the screen is unreachable');
});

test('onboarding markup has one section per step', () => {
  const app = loadApp();
  const steps = [...indexHtml.matchAll(/data-ostep="(\d+)"/g)].map(m => Number(m[1]));
  assert.equal(steps.length, app.ONBOARD_LAST,
    `ONBOARD_LAST is ${app.ONBOARD_LAST} but markup has ${steps.length} steps`);
  assert.deepEqual(steps, Array.from({ length: app.ONBOARD_LAST }, (_, i) => i + 1),
    'step numbers must run 1..n with no gaps');
});

test('every onboarding step is reachable from the step before it', () => {
  const app = loadApp();
  // the only forward control is #onboardNext, and back is #onboardBack
  assert.match(indexHtml, /id="onboardNext"/);
  assert.match(indexHtml, /id="onboardBack"/);
  assert.ok(app.ONBOARD_LAST >= 2, 'a stepped flow needs at least two steps');
});

test('form fields are kept at 16px so iOS does not zoom on focus', () => {
  assert.match(indexHtml, /input\[class\][^{]*\{[^}]*font-size:\s*16px/,
    'the 16px rule must beat Tailwind\'s .text-sm on specificity, or it silently does nothing');
});

test('arc labels are laid out by flow, not by percentage', () => {
  const labels = indexHtml.match(/<div id="arcLabels"[^>]*>/)[0];
  assert.match(labels, /flex/,
    'percentage-positioned arc labels overlapped by up to 120px on a 360px screen; keep them in flow');
  assert.ok(!/absolute/.test(labels));
});

test('the app.js reference is cache-busted at build time', () => {
  const build = readFileSync(join(here, '..', 'build.mjs'), 'utf8');
  assert.match(build, /createHash/, 'app.js must be stamped, or a cached script pairs with fresh markup');
  assert.match(build, /app\.js\?v=\$\{hash\}/);
  // the service worker must precache the same URL the page asks for
  assert.match(build, /'\.\/app\.js\?v=\$\{hash\}'/,
    'sw.js must precache the stamped URL or offline breaks');
});

test('data can be imported, not only exported', () => {
  assert.match(indexHtml, /id="importBtn"/, 'export with no import makes a new phone a total loss');
  assert.match(indexHtml, /id="importFile"/);
});

test('the montage track does not set CSS smooth scrolling', () => {
  const track = indexHtml.match(/<div id="montageTrack"[^>]*>/)[0];
  assert.ok(!/scroll-smooth/.test(track),
    'CSS scroll-behavior:smooth makes a direct scrollLeft assignment animate too, so the JS fallback ' +
    'interrupts and restarts the scroll instead of rescuing it, and Next never advances on a phone');
  assert.match(track, /snap-x/, 'swipe still needs snap');
});

test('montage navigation never rebuilds the track', () => {
  const app = readFileSync(join(here, '..', 'app.js'), 'utf8');
  const goMontage = app.split('function goMontage(')[1].split('\n}')[0];
  const chrome = app.split('function renderMontageChrome(')[1].split('\n}')[0];
  for (const [name, body] of [['goMontage', goMontage], ['renderMontageChrome', chrome]]) {
    assert.ok(!/montageTrack'\)\.innerHTML\s*=/.test(body),
      `${name} writes to the track's innerHTML, which resets scrollLeft and cancels the scroll mid-flight`);
  }
});

test('a new service worker reloads the page instead of stranding the user', () => {
  const app = readFileSync(join(here, '..', 'app.js'), 'utf8');
  assert.match(app, /controllerchange/, 'without this a user must clear site data to see a release');
  assert.match(app, /hadController/, 'the first install must not trigger a pointless reload');
});

test('smoke animation is opt-out under reduced motion', () => {
  const reduced = indexHtml.split('@media (prefers-reduced-motion: reduce)').slice(1).join('');
  assert.match(reduced, /\.smoke i/, 'drifting smoke must stop for users who ask for less motion');
});

test('the quit-time chips cover the common answers', () => {
  const chips = [...indexHtml.matchAll(/data-quit="([^"]+)"/g)].map(m => m[1]);
  assert.ok(chips.includes('0'), 'needs a "just now" option');
  assert.ok(chips.includes('pick'), 'needs an exact-time escape hatch');
  assert.ok(chips.length >= 3, 'one tap should cover most people');
});
