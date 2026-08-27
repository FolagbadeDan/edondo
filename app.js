/* ===========================================================
   E Don Do — day-one recovery tracker
   Local-only. No network calls, no account, no telemetry.

   The no-backend rule is not a preference. Under the Nigeria
   Data Protection Act 2023 anyone under 18 is a child, and
   under-13s cannot consent to processing at all. Because
   nothing ever leaves the device there is no controller and
   no children's data to protect. Adding a backend would
   create that obligation retroactively, for every minor
   already using the app. Do not add one.
   =========================================================== */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const MIN = 60_000, HOUR = 3_600_000, DAY = 86_400_000;
const WEEK = 7 * DAY, MONTH = 30 * DAY, YEAR = 365.25 * DAY;

/* ---------------- storage (degrades to memory) ---------------- */
const KEY = 'edondo.v1';
const SCHEMA = 1;   // bump when a field changes meaning, then migrate in load()
let storageOK = true;
try {
  localStorage.setItem('__probe', '1');
  localStorage.removeItem('__probe');
} catch { storageOK = false; }

let memory = null;

const defaults = () => ({
  schema: SCHEMA,
  quitTs: null,
  age: null,         // age now, drives which argument the app makes
  startAge: null,    // age at first use — under 18 changes the content profile
  yearsSmoked: null, // how long the habit ran; drives the arc, not age
  why: '',
  logs: [],          // { ts, sharpness, note }
  cravings: [],      // { ts, survived, note }
  dopamine: [],      // { ts, activity }
  sessions: 0,
  focusMinutes: 0,
  gateUnlockedFor: null
});

/* Migrations run oldest-first. Each one takes the stored blob and returns it
   one version newer. There are no v0 users in the wild, so this is empty —
   but the hook exists so the next schema change costs a function, not a release. */
const MIGRATIONS = {
  // 1: s => ({ ...s, newField: derive(s) }),
};

function migrate(stored) {
  let s = stored, from = s.schema ?? 0;
  while (from < SCHEMA && MIGRATIONS[from]) { s = MIGRATIONS[from](s); from++; }
  return { ...defaults(), ...s, schema: SCHEMA };
}

function load() {
  if (!storageOK) return memory ?? (memory = defaults());
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? migrate(JSON.parse(raw)) : defaults();
  } catch { return defaults(); }
}

function save() {
  if (!storageOK) { memory = state; return; }
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { toast('Could not save — storage is full or blocked'); }
}

let state = load();

/* ---------------- small helpers ---------------- */
const pad = n => String(Math.floor(n)).padStart(2, '0');
const elapsed = () => state.quitTs ? Math.max(0, Date.now() - state.quitTs) : 0;
const clamp01 = n => Math.min(1, Math.max(0, n));

function fmtCountdown(ms) {
  if (ms <= 0) return 'unlocked';
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MIN);
  const s = Math.floor((ms % MIN) / 1000);
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

const group = n => n.toLocaleString();

function toLocalInput(ts) {
  const d = new Date(ts - new Date(ts).getTimezoneOffset() * MIN);
  return d.toISOString().slice(0, 16);
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('opacity-0', 'translate-y-3');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('opacity-0', 'translate-y-3'), 2600);
}

function icons() { if (window.lucide) lucide.createIcons(); }

/* ---------------- content ---------------- */
const MILESTONES = [
  { at: 12 * HOUR, name: 'Carbon monoxide cleared',
    desc: 'Combustion smoke loads your blood with carbon monoxide, which has a half-life of only a few hours off the smoke. Oxygen-carrying capacity is already back to normal.',
    src: 'Surgeon General, Health Benefits of Smoking Cessation' },

  { at: 24 * HOUR, name: 'Withdrawal begins',
    desc: 'For heavy daily users, symptoms start 24 to 48 hours after the last one — irritability, poor sleep, no appetite, sweating. Their arrival means it is working.',
    src: 'DSM-5 cannabis withdrawal; Cleveland Clinic' },

  { at: 6 * DAY, name: 'Past the peak',
    desc: 'Withdrawal severity peaks between days 2 and 6. From here the curve only goes down. This is the single hardest window and you are through it.',
    src: 'Cleveland Clinic; American Addiction Centers' },

  { at: WEEK, name: 'Memory starts returning',
    desc: 'In a controlled abstinence trial, the ability to learn and recall new information improved measurably — and the improvement happened largely inside the first week. Attention did not improve in that month; memory did.',
    src: 'Schuster et al., J Clin Psychiatry 2018 (ages 16–25)' },

  { at: 2 * WEEK, name: 'Acute withdrawal resolves',
    desc: 'Most acute symptoms clear within one to two weeks. Some psychological symptoms run to three weeks in very heavy users. The physical fight is essentially over.',
    src: 'Cleveland Clinic; DSM-5' },

  { at: 4 * WEEK, name: 'CB1 receptors normalised',
    desc: 'Daily use downregulates brain CB1 receptors by roughly 15–20%. PET imaging shows that after about 28 days of abstinence, receptor density is statistically indistinguishable from people who never used. This is the four-week reset, and it is real.',
    src: 'Hirvonen et al., Molecular Psychiatry 2012; D\'Souza et al. 2016' },

  { at: 30 * DAY, name: 'THC fully eliminated',
    desc: 'Cannabis metabolites store in fat and leave slowly. In heavy daily users, urinary THC-COOH can take up to 30 days of verified abstinence to fully clear. Past this point there is nothing of it left in you.',
    src: 'Schuster et al., J Psychopharmacol 2020' },

  { at: 6 * WEEK, name: 'Sleep architecture rebuilds',
    desc: 'Sleep is the symptom that outlasts all the others. Insomnia and vivid dreams commonly persist 30 to 45 days, then settle. Sleep problems are the most common reason people relapse — knowing they end matters.',
    src: 'American Addiction Centers; cannabis withdrawal literature' },

  { at: 3 * MONTH, name: 'Bronchitis symptoms resolve',
    desc: 'Cannabis smoke causes cough, sputum and wheeze through airway inflammation rather than the fixed structural damage tobacco causes. Because it is inflammatory, it reverses: quitters end up no more likely to have chronic respiratory symptoms than people who never smoked.',
    src: 'Hancox et al., Eur Respir J 2015; NASEM 2017' },

  { at: YEAR, name: 'Structural habit rewiring',
    desc: 'A full year of birthdays, arguments, boredom and celebration handled without it. The cues that used to trigger a smoke have been overwritten by other responses rather than just suppressed.',
    src: 'Relapse-prevention literature' },

  { at: 2 * YEAR, name: 'Relapse risk at its lowest',
    desc: 'Across substance use disorders, relapse risk falls steeply through the first year and reaches its lowest sustained level after roughly two to five years of continuous abstinence.',
    src: 'Substance use disorder relapse cohort data' }
];

const SKIN = [
  { end: 3 * DAY, tag: 'Days 1–3', name: 'Inflammation phase',
    desc: 'Skin may look pale or puffy — withdrawal stress and sweating are doing that, not damage. Keep the water going all day.' },
  { end: WEEK, tag: 'Week 1', name: 'Capillary re-oxygenation',
    desc: 'Carbon monoxide has fully cleared the blood. Oxygen and nutrient delivery to facial skin cells spikes as capillaries reopen.' },
  { end: 4 * WEEK, tag: 'Week 4', name: 'Cellular turnover reset',
    desc: 'A full skin renewal cycle completes without THC-induced vasoconstriction. Facial puffiness and dark under-eye circles noticeably drop. Eyes look brighter.' },
  { end: 3 * MONTH, tag: 'Month 3', name: 'Collagen stability',
    desc: 'The toxic hydrocarbon load is gone. Elasticity improves and the premature ageing lines from smoke exposure begin to reverse.' }
];

/* Years of life gained by quitting, by age at cessation.
   Jha et al., NEJM 2013 (n=202,248): quitting at 25–34 gained ~10 years,
   35–44 ~9, 45–54 ~6, 55–64 ~4, versus continuing to smoke. */
/* Jha 2013 studied adults. Its youngest cohort is 25–34, so there is no honest
   life-expectancy number to quote at anyone below 25 — the old table had no floor
   and filed a 13-year-old under "25–34", which was simply wrong.

   Under 25 the app makes a different argument entirely (see PROFILES): the payoff
   that matters at that age is neurological, not actuarial. `years: null` means
   "no figure exists for this band" and renderLife must not print one. */
const AGE_BANDS = [
  { min: 0,  max: 17,  years: null, band: 'under 18', profile: 'teen'  },
  { min: 18, max: 24,  years: null, band: '18–24',    profile: 'young' },
  { min: 25, max: 34,  years: 10,   band: '25–34',    profile: 'adult' },
  { min: 35, max: 44,  years: 9,    band: '35–44',    profile: 'adult' },
  { min: 45, max: 54,  years: 6,    band: '45–54',    profile: 'adult' },
  { min: 55, max: 64,  years: 4,    band: '55–64',    profile: 'adult' },
  { min: 65, max: 200, years: 3,    band: '65+',      profile: 'adult' }
];

function ageBand(age) {
  const n = Number(age);
  if (!isFinite(n) || n <= 0) return null;
  return AGE_BANDS.find(b => n >= b.min && n <= b.max) || AGE_BANDS[AGE_BANDS.length - 1];
}

/* Which case the app makes. Age at first use outranks current age: a 26-year-old
   who started at 14 took the developmental hit, and should be told so. */
function profileFor(state) {
  const band = ageBand(state.age);
  if (band && band.profile === 'teen') return 'teen';
  if (state.startAge && Number(state.startAge) < 18) return 'earlyStart';
  return band ? band.profile : 'adult';
}

const BADGES = [
  { at: 3 * YEAR, name: 'Excess risk largely averted',
    desc: 'Pooled data across 1.48 million adults found the mortality benefit of quitting is already measurable by three years. For people who quit before 40, roughly 90% of the excess death risk from continued smoking is averted.',
    src: 'Cho et al., NEJM Evidence 2024' },
  { at: 10 * YEAR, name: 'Trajectory reset',
    desc: 'At ten or more years since quitting, about ten years of life lost are averted and survival is similar to people who never smoked. The decade of smoke is, statistically, undone.',
    src: 'Cho et al., NEJM Evidence 2024; Jha et al., NEJM 2013' }
];

const SYMPTOMS = [
  { icon: 'moon', title: 'Insomnia & night sweats',
    body: [
      'Take a hot shower 60–90 minutes before bed. The temperature crash afterwards is what triggers sleep onset, so the drop matters more than the heat.',
      'Get the room below 18°C / 65°F. Night sweats are your thermoregulation recalibrating, and a cold room means you wake up less.',
      'Expect vivid, exhausting dreams for two to six weeks. THC suppressed REM for a decade and your brain is repaying the debt all at once — this is recovery, not a symptom of something wrong.',
      'Keep a towel and a spare shirt beside the bed so a 3am sweat is a 30-second problem instead of a reason to get up.',
      'No screens for the last hour, and no naps after 4pm, until sleep stabilises.'
    ] },
  { icon: 'utensils', title: 'Appetite crash',
    body: [
      'Do not force heavy meals. Drink your calories instead — protein shakes, milk-based smoothies, fruit juice, soups and yoghurt drinks go down when a plate of food will not.',
      'Eat something small every few hours rather than waiting for hunger to show up. It will not show up for a while.',
      'Nausea usually comes from an empty stomach and stomach acid that has not renormalised yet. Something bland and starchy — toast, rice, bananas — settles it.',
      'Appetite typically returns to normal within one to three weeks. If you are still unable to keep food down after that, see a doctor.'
    ] },
  { icon: 'zap', title: 'Irritability & restlessness',
    body: [
      'Peak is days 2 to 6, and it falls off sharply after the first two weeks. Knowing the shape of the curve makes it survivable.',
      'Move the energy through your body instead of sitting in it — a hard 10-minute walk outdoors does more than an hour of trying to talk yourself down.',
      'Warn the people you live with today, not after you snap at them. "I am detoxing, it peaks this week" costs one sentence.'
    ] }
];

const DOPAMINE_MENU = [
  { name: '20 max push-ups', meta: '2 min · to failure', icon: 'dumbbell' },
  { name: 'Cold shower blast', meta: '3 min · cold only', icon: 'droplets' },
  { name: 'Inversion breathing', meta: '5 min · box breathing, 4-4-4-4', icon: 'wind' },
  { name: 'Brisk walk outside', meta: '10–15 min · daylight on your face', icon: 'footprints' },
  { name: '60-second wall sit', meta: '3 rounds · legs shaking is the point', icon: 'flame' },
  { name: 'Stair sprints', meta: '5 min · up fast, down slow', icon: 'trending-up' }
];

/* ---------------- rendering: static lists ---------------- */
function renderMilestones() {
  const t = elapsed();
  $('#milestoneList').innerHTML = MILESTONES.map(m => {
    const done = t >= m.at;
    return `
      <li class="relative pl-6 pb-5">
        <span class="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full ${done ? 'bg-oxygen' : 'bg-line ring-4 ring-ink'}"></span>
        <div class="flex items-center gap-2">
          <h3 class="font-display font-semibold tracking-tight ${done ? 'text-body' : 'text-faint'}">${m.name}</h3>
          ${done ? '<i data-lucide="check" class="w-3.5 h-3.5 text-oxygen"></i>' : '<i data-lucide="lock" class="w-3 h-3 text-faint"></i>'}
        </div>
        <p class="text-[13px] leading-relaxed mt-1 ${done ? 'text-muted' : 'text-faint/70'}">${m.desc}</p>
        <p class="text-[10px] text-faint/60 mt-1.5 italic">${m.src}</p>
      </li>`;
  }).join('');
  icons();
}

function ringSvg(pct, color) {
  const r = 22, c = 2 * Math.PI * r;
  return `<svg viewBox="0 0 52 52" class="w-[52px] h-[52px] -rotate-90 shrink-0">
    <circle cx="26" cy="26" r="${r}" fill="none" stroke="#222E3D" stroke-width="4"/>
    <circle cx="26" cy="26" r="${r}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round"
      stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"/>
  </svg>`;
}

function renderSkin() {
  const t = elapsed();
  $('#skinList').innerHTML = SKIN.map(p => {
    const pct = clamp01(t / p.end);
    const done = pct >= 1;
    return `
      <div class="card rounded-xl2 p-5 flex gap-4 items-start">
        <div class="relative flex items-center justify-center">
          ${ringSvg(pct, done ? '#79C8B4' : '#8FB8E8')}
          <span class="absolute font-mono tnum text-[10px] ${done ? 'text-oxygen' : 'text-dawn'}">${Math.round(pct * 100)}</span>
        </div>
        <div class="min-w-0">
          <p class="eyebrow ${done ? 'text-oxygen' : 'text-faint'}">${p.tag}</p>
          <h3 class="font-display font-semibold tracking-tight mt-1">${p.name}</h3>
          <p class="text-[13px] text-muted leading-relaxed mt-1.5">${p.desc}</p>
        </div>
      </div>`;
  }).join('');
}

function renderSymptoms() {
  $('#symptomList').innerHTML = SYMPTOMS.map(s => `
    <details class="card rounded-xl2 overflow-hidden">
      <summary class="p-5 flex items-center gap-3">
        <i data-lucide="${s.icon}" class="w-4 h-4 text-ember shrink-0"></i>
        <span class="font-display font-semibold tracking-tight flex-1">${s.title}</span>
        <i data-lucide="chevron-down" class="chev w-4 h-4 text-faint"></i>
      </summary>
      <div class="px-5 pb-5 space-y-3 border-t border-line/60 mt-1 pt-4">
        ${s.body.map(p => `<p class="text-[13px] text-muted leading-relaxed">${p}</p>`).join('')}
      </div>
    </details>`).join('');
  icons();
}

function renderBadges() {
  const t = elapsed();
  $('#badgeList').innerHTML = BADGES.map(b => {
    const done = t >= b.at;
    const pct = clamp01(t / b.at);
    return `
      <div class="card rounded-xl2 p-5 ${done ? '' : 'opacity-90'}">
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-full grid place-items-center shrink-0 ${done ? 'bg-oxygen/15' : 'bg-line/60'}">
            <i data-lucide="${done ? 'award' : 'lock'}" class="w-4 h-4 ${done ? 'text-oxygen' : 'text-faint'}"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="eyebrow ${done ? 'text-oxygen' : 'text-faint'}">${Math.round(b.at / YEAR)} years sober</p>
            <h3 class="font-display font-semibold tracking-tight mt-1">${b.name}</h3>
            <p class="text-[13px] text-muted leading-relaxed mt-1.5">${b.desc}</p>
            <div class="h-1 rounded-full bg-line overflow-hidden mt-4">
              <div class="h-full rounded-full ${done ? 'bg-oxygen' : 'bg-dawn'}" style="width:${(pct * 100).toFixed(4)}%"></div>
            </div>
            <p class="font-mono tnum text-xs mt-2 ${done ? 'text-oxygen' : 'text-dawn'}" data-badge-countdown="${b.at}">—</p>
            <p class="text-[10px] text-faint/60 mt-2 italic">${b.src}</p>
          </div>
        </div>
      </div>`;
  }).join('');
  icons();
}

/* ---------------- live clock ---------------- */
const RING_C = 2 * Math.PI * 98;

function phaseCopy(t) {
  const h = t / HOUR;
  if (h < 6)   return 'The first hours are the loudest. Nothing is wrong with you — this is a decade-old loop looking for its cue.';
  if (h < 24)  return 'Carbon monoxide is clearing your blood right now. Sleep will be poor tonight; that is expected and temporary.';
  if (h < 72)  return 'You are climbing toward the crest. Sweats, short temper and no appetite peak around day 3, then fall.';
  if (t < WEEK)  return 'Past the peak. The worst of the chemistry is behind you and the rest is habit, which is a different fight.';
  if (t < MONTH) return 'Your airways are clearing tar and your sleep is rebuilding. Vivid dreams mean REM is coming back online.';
  if (t < 3 * MONTH) return 'Receptor density is climbing back toward baseline. Ordinary things are starting to register as good again.';
  return 'You are past the chemistry entirely. Everything from here is the life you built without it.';
}


/* ---------------- age-driven life expectancy ---------------- */
const JHA_SRC = 'Jha et al., NEJM 2013 — 21st-Century Hazards of Smoking and Benefits of Cessation';
const YOUTH_SRC = 'Psychological Medicine, age-dependent association of cannabis use with psychotic disorder; J Dual Diagnosis 2023';

function renderLife() {
  const age = state.age;
  const el = $('#lifeYears'), hd = $('#lifeHeadline'), ex = $('#lifeExplain');
  const unit = $('#lifeUnit'), src = $('#lifeSrc');

  if (!age) {
    el.textContent = '—';
    unit.textContent = 'years of life expectancy reclaimed';
    src.textContent = JHA_SRC;
    hd.textContent = 'Add your age to see what quitting bought you.';
    ex.textContent = 'What you get back depends almost entirely on the age you stop. Set it on the You tab.';
    return;
  }

  const b = ageBand(age);

  /* No life-expectancy figure exists below 25 — the cessation cohorts start there.
     Quoting one anyway would be inventing a number, so we make the argument that
     actually applies at this age instead. */
  if (!b.years) {
    const early = profileFor(state) === 'teen' || (state.startAge && Number(state.startAge) < 18);
    el.textContent = '2×';
    unit.textContent = 'the risk you are stepping away from';
    src.textContent = YOUTH_SRC;
    hd.textContent = early
      ? 'You started young. That is exactly why stopping now counts.'
      : 'You are young enough that this is about your brain, not your lifespan.';
    ex.textContent = early
      ? 'Research finds the risk of developing a psychotic disorder roughly doubles when cannabis use starts before ages 16 to 18, and that earlier starts are linked to earlier, more severe symptoms. The brain is still pruning and myelinating through adolescence, and the endocannabinoid system helps run both. The product also changed: cannabis ran 3 to 4 percent THC in earlier decades and runs 15 to 25 percent now. Stopping while that development is still underway is the whole point.'
      : 'The life-expectancy figures on this screen come from cessation studies of adults 25 and older, so there is no honest number to give you yet. What the research does show at your age is that risk of a psychotic disorder is roughly doubled when use begins before 16 to 18, and that today’s cannabis is several times stronger than what earlier generations used. Stopping now is the version of this decision with the most left to gain.';
    return;
  }

  el.textContent = '~' + b.years;
  unit.textContent = 'years of life expectancy reclaimed';
  src.textContent = JHA_SRC;

  if (age < 40) {
    hd.textContent = 'You quit before 40. That is the whole ballgame.';
    ex.textContent = `Quitting between ${b.band} was associated with about ${b.years} years of life gained compared with continuing. Cessation before 40 averts roughly 90% of the excess death risk from continued smoking.`;
  } else if (age < 55) {
    hd.textContent = 'Later than ideal. Still worth years of your life.';
    ex.textContent = `Quitting between ${b.band} was associated with about ${b.years} years of life gained compared with continuing. The gain is smaller than quitting at 30, and far larger than quitting at 60.`;
  } else {
    hd.textContent = 'There is no age at which this stops paying.';
    ex.textContent = `Quitting between ${b.band} was associated with roughly ${b.years} years of life gained compared with continuing. Benefits show up within three years at every age studied.`;
  }
}

/* ---------------- the recovery arc ---------------- */
/* Linear time puts day 1 at 0.03% — invisible, and demoralising on the exact day
   it matters most. A log scale keeps early progress legible while still showing
   how much of the span is left.

   The span is how long the habit ran, NOT the user's age. Someone who smoked two
   years sees a two-year arc. Floored at 2 years because ARC_STOPS carries a stop
   at the two-year mark, and capped at 10 because the content stops there — the
   last badge is at ten years. */
const ARC_MIN_YEARS = 2, ARC_MAX_YEARS = 10;

function arcSpanYears() {
  const y = state.yearsSmoked;
  if (!y || !isFinite(y) || y <= 0) return ARC_MAX_YEARS;   // unknown: assume the full span
  return Math.min(ARC_MAX_YEARS, Math.max(ARC_MIN_YEARS, y));
}

const arcSpanDays = () => arcSpanYears() * 365.25;
const arcPct = t => clamp01(Math.log(1 + t / DAY) / Math.log(1 + arcSpanDays())) * 100;

const ARC_STOPS = [
  { at: 2 * WEEK,  short: 'Wk 1–2', full: 'Cilia awakening & tar clearance' },
  { at: MONTH,     short: 'Mo 1',   full: 'REM rebound & memory restoration' },
  { at: 3 * MONTH, short: 'Mo 3',   full: 'CB1 normalised & dopamine reset' },
  { at: 2 * YEAR,  short: 'Yr 1–2', full: 'Habit rewired, relapse risk lowest' }
];

function renderArc() {
  const years = arcSpanYears();
  const spanMs = arcSpanDays() * DAY;
  const stops = ARC_STOPS.filter(s => s.at <= spanMs);   // never label past the end of the bar

  const n = years % 1 ? years.toFixed(1) : String(years);
  const plural = years === 1 ? 'year' : 'years';
  $('#arcTitle').textContent = `The ${n}-year arc`;
  $('#arcCaption').textContent = state.yearsSmoked
    ? `${n} ${plural} of smoking, mapped against ${n} ${plural} of undoing it`
    : 'Your recovery so far. Add how long you smoked on the You tab to scale this properly.';

  $('#arcTicks').innerHTML = stops.map(s => {
    const done = elapsed() >= s.at;
    return `<span class="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-1 h-4 rounded-full ${done ? 'bg-oxygen' : 'bg-faint/50'}"
      style="left:${arcPct(s.at).toFixed(2)}%"></span>`;
  }).join('');

  $('#arcLabels').innerHTML = stops.map((s, i) => {
    const done = elapsed() >= s.at;
    const p = arcPct(s.at);
    const align = i === 0 ? 'translate-x-0 text-left' : i === stops.length - 1 ? '-translate-x-full text-right' : '-translate-x-1/2 text-center';
    return `<span class="absolute top-0 ${align} w-24" style="left:${p.toFixed(2)}%">
      <span class="block font-mono tnum text-[10px] ${done ? 'text-oxygen' : 'text-faint'}">${s.short}</span>
      <span class="block text-[9px] leading-tight mt-0.5 ${done ? 'text-muted' : 'text-faint/60'}">${s.full}</span>
    </span>`;
  }).join('');
}

function tick() {
  if (!state.quitTs) return;
  const t = elapsed();
  const days = Math.floor(t / DAY);
  const h = Math.floor((t % DAY) / HOUR);
  const m = Math.floor((t % HOUR) / MIN);
  const s = Math.floor((t % MIN) / 1000);

  $('#heroDays').textContent  = days + 1;
  $('#heroClock').textContent = `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  $('#stripDay').textContent  = `Day ${days + 1}`;
  $('#stripClock').textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
  $('#heroPhase').textContent = phaseCopy(t);

  // ring shows progress through the current day
  const dayPct = (t % DAY) / DAY;
  $('#dayRing').setAttribute('stroke-dashoffset', (RING_C * (1 - dayPct)).toFixed(2));

  /* Airway recovery. Cannabis smoke drives reversible inflammatory bronchitis
     rather than tobacco's fixed structural damage, so this curve is faster than
     a tobacco tar model and it genuinely returns to baseline. */
  const lung = (1 - Math.exp(-(t / DAY) / 60)) * 100;
  $('#lungBar').style.width  = Math.min(100, lung).toFixed(2) + '%';
  $('#lungPct').textContent  = Math.min(100, lung).toFixed(1) + '%';
  $('#lungStage').textContent =
    t < 3 * DAY  ? 'Airways relaxing — smoke irritation stops arriving' :
    t < MONTH    ? 'Cilia recovering; cough may briefly increase as they clear debris' :
    t < 3 * MONTH? 'Airway inflammation resolving — cough, sputum and wheeze receding' :
    t < 6 * MONTH? 'Bronchitis symptoms approaching never-smoker levels' :
                   'Recovered. Quitters match never-smokers on chronic respiratory symptoms.';

  // ten-year arc — floored so the head is visible from minute one
  const ap = Math.max(2, arcPct(t));
  $('#arcBar').style.width = ap.toFixed(2) + '%';
  $('#arcHead').style.left = ap.toFixed(2) + '%';
  $('#arcPos').textContent =
    t < MONTH      ? `Day ${days + 1}` :
    t < YEAR       ? `Month ${(t / MONTH).toFixed(1)}` :
                     `Year ${(t / YEAR).toFixed(1)}`;

  // next milestone
  const next = MILESTONES.find(x => t < x.at);
  if (next) {
    $('#nextName').textContent = next.name;
    $('#nextDesc').textContent = next.desc;
    $('#nextCountdown').textContent = fmtCountdown(next.at - t);
  } else {
    $('#nextName').textContent = 'Every milestone unlocked';
    $('#nextDesc').textContent = 'Two years clear. There is nothing left on this list to wait for.';
    $('#nextCountdown').textContent = '—';
  }

  // longevity
  const mins = Math.floor(t / MIN);
  $('#longevityMinutes').textContent = group(mins);
  $('#lgHours').textContent = group(Math.floor(t / HOUR));
  $('#lgDays').textContent  = group(Math.floor(t / DAY));
  $('#lgWeeks').textContent = group(Math.floor(t / WEEK));

  $$('[data-badge-countdown]').forEach(el => {
    const at = Number(el.dataset.badgeCountdown);
    el.textContent = t >= at ? 'Unlocked' : fmtCountdown(at - t);
  });
}

let lastMilestoneCount = -1;
function slowTick() {
  const t = elapsed();
  const reached = MILESTONES.filter(m => t >= m.at).length;
  if (reached !== lastMilestoneCount) {
    lastMilestoneCount = reached;
    renderMilestones();
    renderBadges();
    renderArc();
  }
  renderSkin();
  tick();
}

/* ---------------- navigation ---------------- */
function goto(tab) {
  $$('[data-tab]').forEach(s => s.hidden = s.id !== 'tab-' + tab);
  $$('.navbtn').forEach(b => {
    const on = b.dataset.goto === tab;
    b.classList.toggle('text-dawn', on);
    b.classList.toggle('text-faint', !on);
  });
  window.scrollTo({ top: 0, behavior: 'instant' });
}
$$('[data-goto]').forEach(b => b.addEventListener('click', () => goto(b.dataset.goto)));

/* ---------------- dopamine gate + pomodoro ---------------- */
let chosenActivity = null;

function renderMenu(selected = -1) {
  $('#menuOptions').innerHTML = DOPAMINE_MENU.map((o, i) => {
    const on = i === selected;
    return `
    <button data-opt="${i}" class="tap w-full text-left rounded-xl p-4 flex items-center gap-3 border transition
      ${on ? 'border-dawn bg-dawn/[.07]' : 'border-line hover:bg-raised'}">
      <i data-lucide="${o.icon}" class="w-4 h-4 text-dawn shrink-0"></i>
      <span class="flex-1 min-w-0">
        <span class="block font-medium text-sm">${o.name}</span>
        <span class="block text-xs text-faint mt-0.5">${o.meta}</span>
      </span>
      <i data-lucide="${on ? 'circle-check' : 'circle'}" class="w-4 h-4 shrink-0 ${on ? 'text-dawn' : 'text-faint'}"></i>
    </button>`;
  }).join('');
  icons();

  $$('#menuOptions [data-opt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = +btn.dataset.opt;
      chosenActivity = DOPAMINE_MENU[i].name;
      renderMenu(i);
    });
  });
  $('#menuConfirm').disabled = selected < 0;
}

function gateIsOpen() {
  return state.gateUnlockedFor && Date.now() - state.gateUnlockedFor < 3 * HOUR;
}

function refreshGate() {
  const open = gateIsOpen();
  $('#gateIcon').innerHTML =
    `<i data-lucide="${open ? 'lock-open' : 'lock'}" class="w-4 h-4 ${open ? 'text-oxygen' : 'text-ember'}"></i>`;
  $('#gateStatus').textContent = open
    ? 'Unlocked. You earned this focus block chemically — the timer is live for the next three hours.'
    : 'The timer is locked. Pick one 5–15 minute physical trigger and finish it first.';
  $('#openMenu').textContent = open ? 'Log another trigger' : 'Open the menu';
  $('#pomoStart').disabled = !open && mode === 'work';
  icons();
}

$('#openMenu').addEventListener('click', () => { chosenActivity = null; renderMenu(); $('#menuModal').hidden = false; });
$('#menuClose').addEventListener('click', () => $('#menuModal').hidden = true);
$('#menuModal').addEventListener('click', e => { if (e.target === $('#menuModal')) $('#menuModal').hidden = true; });

$('#menuConfirm').addEventListener('click', () => {
  if (!chosenActivity) return;
  state.dopamine.push({ ts: Date.now(), activity: chosenActivity });
  state.gateUnlockedFor = Date.now();
  save();
  $('#menuModal').hidden = true;
  chosenActivity = null;
  refreshGate();
  renderStats();
  toast('Timer unlocked. Go.');
});

let mode = 'work', remaining = 25 * MIN, running = false, endAt = 0, pomoInterval;
const POMO_C = 2 * Math.PI * 88;
const durations = { work: 25 * MIN, break: 5 * MIN };

function paintPomo() {
  const total = Math.ceil(remaining / 1000);
  const mm = Math.floor(total / 60), ss = total % 60;
  $('#pomoTime').textContent = `${pad(mm)}:${pad(ss)}`;
  $('#pomoRing').setAttribute('stroke-dashoffset',
    (POMO_C * (1 - remaining / durations[mode])).toFixed(2));
  $('#pomoRing').setAttribute('stroke', mode === 'work' ? '#79C8B4' : '#8FB8E8');
  $('#pomoLabel').textContent = mode === 'work' ? 'focus' : 'recover';
  $('#pomoStart').textContent = running ? 'Pause' : 'Start';
  document.title = running ? `${pad(mm)}:${pad(ss)} — E Don Do` : 'E Don Do';
}

function setMode(m) {
  mode = m; running = false; clearInterval(pomoInterval);
  remaining = durations[m];
  $$('.seg').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
  refreshGate();
  paintPomo();
}
$$('.seg').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));

function finishPomo() {
  clearInterval(pomoInterval); running = false;
  if (mode === 'work') {
    state.sessions++; state.focusMinutes += 25; save(); renderStats();
    toast('Session done, sober and sharp. Log it.');
    setMode('break');
  } else {
    toast('Break over. Back in.');
    setMode('work');
  }
}

$('#pomoStart').addEventListener('click', () => {
  if (mode === 'work' && !gateIsOpen()) { toast('Do a dopamine trigger first'); return; }
  if (running) {
    running = false; clearInterval(pomoInterval); paintPomo(); return;
  }
  running = true;
  endAt = Date.now() + remaining;
  pomoInterval = setInterval(() => {
    remaining = Math.max(0, endAt - Date.now());
    paintPomo();
    if (remaining === 0) finishPomo();
  }, 250);
  paintPomo();
});
$('#pomoReset').addEventListener('click', () => setMode(mode));

/* ---------------- cognitive log ---------------- */
let sharpness = 3;
function renderScale() {
  $('#sharpScale').innerHTML = [1, 2, 3, 4, 5].map(n => `
    <button data-sharp="${n}" class="tap flex-1 py-2.5 rounded-lg border text-sm font-mono tnum transition
      ${n === sharpness ? 'border-dawn bg-dawn/10 text-dawn' : 'border-line text-faint hover:text-muted'}">${n}</button>`).join('');
  $$('[data-sharp]').forEach(b => b.addEventListener('click', () => {
    sharpness = +b.dataset.sharp; renderScale();
  }));
}

function renderLogs() {
  const logs = [...state.logs].reverse().slice(0, 6);
  $('#logList').innerHTML = logs.map(l => `
    <div class="border border-line rounded-xl px-4 py-3">
      <div class="flex items-center justify-between mb-1">
        <span class="font-mono tnum text-xs text-dawn">sharpness ${l.sharpness}/5</span>
        <span class="font-mono tnum text-[10px] text-faint">${fmtDate(l.ts)}</span>
      </div>
      ${l.note ? `<p class="text-[13px] text-muted leading-relaxed">${escapeHtml(l.note)}</p>` : ''}
    </div>`).join('');

  if (state.logs.length) {
    const avg = state.logs.reduce((a, l) => a + l.sharpness, 0) / state.logs.length;
    $('#logAvgWrap').hidden = false;
    $('#logAvg').textContent = avg.toFixed(1);
  } else {
    $('#logAvgWrap').hidden = true;
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

$('#logSave').addEventListener('click', () => {
  const note = $('#logNote').value.trim();
  state.logs.push({ ts: Date.now(), sharpness, note });
  save();
  $('#logNote').value = '';
  renderLogs(); renderStats();
  toast('Logged');
});

/* ---------------- stats + you tab ---------------- */
function renderStats() {
  $('#statSessions').textContent = state.sessions;
  $('#statMinutes').textContent  = group(state.focusMinutes);
  $('#statCravings').textContent = state.cravings.filter(c => c.survived).length;
  $('#statDopamine').textContent = state.dopamine.length;
  $('#statLogs').textContent     = state.logs.length;

  const list = [...state.cravings].reverse().slice(0, 8);
  $('#cravingList').innerHTML = list.length ? list.map(c => `
    <div class="border border-line rounded-xl px-4 py-3">
      <div class="flex items-center justify-between mb-1">
        <span class="flex items-center gap-1.5 text-xs font-medium ${c.survived ? 'text-oxygen' : 'text-ember'}">
          <i data-lucide="${c.survived ? 'shield-check' : 'clock'}" class="w-3.5 h-3.5"></i>
          ${c.survived ? 'Rode it out' : 'Left early'}
        </span>
        <span class="font-mono tnum text-[10px] text-faint">${fmtDate(c.ts)}</span>
      </div>
      ${c.note ? `<p class="text-[13px] text-muted leading-relaxed">${escapeHtml(c.note)}</p>` : ''}
    </div>`).join('')
    : '<p class="text-sm text-faint">No cravings logged yet. When one hits, hit the button.</p>';
  icons();
}

$('#whySave').addEventListener('click', () => {
  state.why = $('#whyEdit').value.trim(); save(); toast('Statement saved');
});
$('#ageSave').addEventListener('click', () => {
  const v = parseInt($('#ageEdit').value, 10);
  if (!isFinite(v) || v < 10 || v > 100) { toast('Enter an age between 10 and 100'); return; }
  if (state.startAge && v < state.startAge) { toast('That is younger than the age you started'); return; }
  state.age = v; save(); renderLife(); renderMilestones(); toast('Age updated');
});
$('#startAgeSave').addEventListener('click', () => {
  const v = parseInt($('#startAgeEdit').value, 10);
  if (!isFinite(v) || v < 5 || v > 100) { toast('Enter a starting age between 5 and 100'); return; }
  if (state.age && v > state.age) { toast('You cannot have started older than you are now'); return; }
  state.startAge = v; save(); renderLife(); toast('Starting age updated');
});
$('#yearsSave').addEventListener('click', () => {
  const v = parseFloat($('#yearsEdit').value);
  if (!isFinite(v) || v < 0 || v > 80) { toast('Enter how many years, between 0 and 80'); return; }
  if (state.age && v > state.age) { toast('That is more years than you have been alive'); return; }
  state.yearsSmoked = v; save(); renderArc(); tick(); toast('Recovery bar updated');
});
$('#quitSave').addEventListener('click', () => {
  const v = $('#quitEdit').value;
  if (!v) return;
  const ts = new Date(v).getTime();
  if (ts > Date.now()) { toast('That is in the future'); return; }
  state.quitTs = ts; save(); lastMilestoneCount = -1; tick(); slowTick();
  toast('Clock updated');
});
$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `edondo-${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
});
$('#resetBtn').addEventListener('click', () => {
  if (!confirm('Erase your quit date, statement and every log on this device? This cannot be undone.')) return;
  state = defaults();
  if (storageOK) localStorage.removeItem(KEY); else memory = state;
  location.reload();
});

/* ---------------- the 15-minute rule ---------------- */
const PANIC_MS = 15 * MIN;
const PANIC_C = 2 * Math.PI * 120;
let panicEnd = 0, panicInt = null, panicOpened = 0;

const PANIC_PHASES = [
  { from: 15, to: 12, text: 'Drop everything. Change your physical room right now. Drink a freezing cold glass of water.' },
  { from: 12, to: 5,  text: 'Do 20 jumping jacks or deep box breathing. The chemical wave in your brain is peaking and will crash soon.' },
  { from: 5,  to: 0,  text: 'Read your statement below and write down exactly how you feel right now.' }
];

function openPanic() {
  panicOpened = Date.now();
  panicEnd = Date.now() + PANIC_MS;
  $('#panicOverlay').hidden = false;
  document.body.classList.add('panic-mode');
  document.body.style.overflow = 'hidden';
  $('#panicWhy').textContent = state.why || 'You did not write a statement yet. Write one on the You tab when this passes — it is the strongest tool in here.';
  $('#panicNote').value = '';
  $('#panicDone').hidden = true;
  $('#panicExit').hidden = true;
  $('#panicWhyBox').hidden = true;
  $('#panicNoteBox').hidden = true;
  clearInterval(panicInt);
  panicInt = setInterval(panicTick, 250);
  panicTick();
  if (navigator.vibrate) navigator.vibrate(40);
}

function panicTick() {
  const left = Math.max(0, panicEnd - Date.now());
  const total = Math.ceil(left / 1000);
  $('#panicTime').textContent = `${pad(total / 60)}:${pad(total % 60)}`;
  $('#panicRing').setAttribute('stroke-dashoffset', (PANIC_C * (1 - left / PANIC_MS)).toFixed(2));

  const minsLeft = left / MIN;
  const phase = PANIC_PHASES.find(p => minsLeft <= p.from && minsLeft > p.to) || PANIC_PHASES[2];
  $('#panicInstruction').textContent = phase.text;

  const finalPhase = minsLeft <= 5;
  $('#panicWhyBox').hidden = !finalPhase;
  $('#panicNoteBox').hidden = !finalPhase;

  // an exit exists after 90 seconds — never trap someone in a screen
  $('#panicExit').hidden = Date.now() - panicOpened < 90_000 || left === 0;

  if (left === 0) {
    clearInterval(panicInt);
    $('#panicInstruction').textContent = 'It passed. It was always going to pass — you just proved it.';
    $('#panicDone').hidden = false;
    $('#panicExit').hidden = true;
    if (navigator.vibrate) navigator.vibrate([60, 80, 60]);
  }
}

function closePanic(survived) {
  clearInterval(panicInt);
  state.cravings.push({ ts: Date.now(), survived, note: $('#panicNote').value.trim() });
  save();
  $('#panicOverlay').hidden = true;
  document.body.classList.remove('panic-mode');
  document.body.style.overflow = '';
  renderStats();
  toast(survived ? 'Logged. That craving is behind you.' : 'Logged. Come back the second it returns.');
}

$('#panicBtn').addEventListener('click', openPanic);
$('#panicDone').addEventListener('click', () => closePanic(true));
$('#panicExit').addEventListener('click', () => {
  if (confirm('The wave crashes on its own in a few more minutes. Leave the timer anyway?')) closePanic(false);
});

/* ---------------- onboarding ---------------- */
$('#onboardNow').addEventListener('click', () => {
  $('#onboardTime').value = toLocalInput(Date.now());
});
/* Validation the first version did not have: a future quit time was silently
   snapped to now, and any age at all was accepted. Both now say what is wrong
   and how to fix it, rather than quietly doing something else. */
function onboardError(msg) {
  const el = $('#onboardError');
  if (!msg) { el.hidden = true; return false; }
  el.textContent = msg;
  el.hidden = false;
  return true;
}

$('#onboardStart').addEventListener('click', () => {
  const v = $('#onboardTime').value;
  const ts = v ? new Date(v).getTime() : Date.now();
  const age = parseInt($('#onboardAge').value, 10);
  const startAge = parseInt($('#onboardStartAge').value, 10);
  const years = parseFloat($('#onboardYears').value);

  if (v && !isFinite(ts))
    return onboardError('That date did not read properly. Pick it again, or tap "Just now".');
  if (ts > Date.now() + MIN)
    return onboardError('That time is in the future. Pick when you actually last smoked.');
  if ($('#onboardAge').value && (!isFinite(age) || age < 10 || age > 100))
    return onboardError('Enter an age between 10 and 100.');
  if ($('#onboardStartAge').value && (!isFinite(startAge) || startAge < 5 || startAge > 100))
    return onboardError('Enter a starting age between 5 and 100.');
  if (isFinite(age) && isFinite(startAge) && startAge > age)
    return onboardError('You cannot have started at an age older than you are now.');
  if ($('#onboardYears').value && (!isFinite(years) || years < 0 || years > 80))
    return onboardError('Enter how many years, between 0 and 80.');
  if (isFinite(age) && isFinite(years) && years > age)
    return onboardError('That is more years of smoking than you have been alive.');

  onboardError(null);
  state.quitTs = Math.min(ts, Date.now());
  state.age = isFinite(age) ? age : null;
  state.startAge = isFinite(startAge) ? startAge : null;
  state.yearsSmoked = isFinite(years) ? years : null;
  state.why = $('#onboardWhy').value.trim();
  save();
  boot();
});

/* ---------------- boot ---------------- */
function boot() {
  if (!state.quitTs) {
    $('#onboard').hidden = false;
    $('#shell').hidden = true;
    $('#onboardTime').value = toLocalInput(Date.now());
    icons();
    return;
  }
  $('#onboard').hidden = true;
  $('#shell').hidden = false;
  $('#whyEdit').value      = state.why || '';
  $('#ageEdit').value      = state.age || '';
  $('#startAgeEdit').value = state.startAge || '';
  $('#yearsEdit').value    = state.yearsSmoked ?? '';
  $('#quitEdit').value     = toLocalInput(state.quitTs);
  $('#storageWarn').hidden = storageOK;

  goto('home');
  renderMilestones();
  renderLife();
  renderArc();
  renderSkin();
  renderSymptoms();
  renderBadges();
  renderScale();
  renderLogs();
  renderStats();
  refreshGate();
  setMode('work');
  tick();
  slowTick();
  icons();
}

boot();
setInterval(tick, 1000);
setInterval(slowTick, 60_000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); slowTick(); } });

/* keyboard: escape closes the dopamine menu only — never the craving timer */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('#menuModal').hidden) $('#menuModal').hidden = true;
});

/* ---------------- PWA ---------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
