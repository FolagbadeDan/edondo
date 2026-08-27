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
    ONBOARD_LAST
  })`, sandbox);

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

test('the quit-time chips cover the common answers', () => {
  const chips = [...indexHtml.matchAll(/data-quit="([^"]+)"/g)].map(m => m[1]);
  assert.ok(chips.includes('0'), 'needs a "just now" option');
  assert.ok(chips.includes('pick'), 'needs an exact-time escape hatch');
  assert.ok(chips.length >= 3, 'one tap should cover most people');
});
