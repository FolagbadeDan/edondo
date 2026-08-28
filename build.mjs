/* Generates edondo.html — the single-file build that runs from anywhere,
   including file://, without the PWA parts.

   This exists because the old clearance.html was documented as "generated" while
   nothing generated it, so it quietly drifted into a stale copy of the app.
   Run with: npm run build

   The single-file build still needs the network for Tailwind and Lucide. Phase 4
   replaces the Tailwind CDN with a compiled stylesheet; until then this file is a
   convenience copy, not the offline story. index.html plus sw.js is the real app. */

import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(here, f), 'utf8');
const dist = join(here, 'dist');

const html = read('index.html');
const app = read('app.js');

const SCRIPT_TAG = '<script src="app.js"></script>';
if (!html.includes(SCRIPT_TAG)) {
  console.error(`build failed: could not find ${SCRIPT_TAG} in index.html`);
  process.exit(1);
}

/* A literal </script> anywhere in app.js would close the tag early. There is none
   today, but a future string could add one, so fail loudly rather than emit a
   broken file. */
if (/<\/script/i.test(app)) {
  console.error('build failed: app.js contains a literal </script>, which would break the inline tag');
  process.exit(1);
}

const out = html
  // the manifest and service worker are meaningless in a single file
  .replace(/^.*<link rel="manifest".*$\n?/m, '')
  .replace(SCRIPT_TAG, `<script>\n${app}\n</script>`);

writeFileSync(join(here, 'edondo.html'), out, 'utf8');

/* dist/ is what actually gets deployed. Keeping it separate from the repo root
   means CLAUDE.md, the tests and this script are never served as web files, and
   it gives Vercel and Netlify one unambiguous directory to publish. It stays a
   plain static folder you can drag onto Netlify by hand — that is the rule that
   replaced "no build step", and it is the whole point of doing it this way. */
const DEPLOY = [
  'index.html',
  'app.js',
  'sw.js',
  'manifest.webmanifest',
  'edondo.html',
  'icons'
];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const missing = DEPLOY.filter(f => !existsSync(join(here, f)));
if (missing.length) {
  console.error(`build failed: missing deploy files: ${missing.join(', ')}`);
  process.exit(1);
}
for (const f of DEPLOY) cpSync(join(here, f), join(dist, f), { recursive: true });

/* Cache-bust app.js by content hash.

   Without this, a browser holding a cached app.js pairs it with a freshly
   fetched index.html — new markup driven by old code, which fails in ways that
   look like nothing on this earth. Stamping the hash into the URL means a
   changed script is simply a different URL, so there is nothing to invalidate.

   The service worker's precache list is stamped with the same hash, or it would
   cache ./app.js while the page requests ./app.js?v=... and offline would break.
   Folding the hash into the cache name also evicts the previous build's cache. */
const hash = createHash('sha256').update(app).digest('hex').slice(0, 8);

const distIndex = join(dist, 'index.html');
const stampedHtml = readFileSync(distIndex, 'utf8').replace(SCRIPT_TAG, `<script src="app.js?v=${hash}"></script>`);
if (!stampedHtml.includes(`app.js?v=${hash}`)) {
  console.error('build failed: could not stamp the app.js version into dist/index.html');
  process.exit(1);
}
writeFileSync(distIndex, stampedHtml, 'utf8');

const distSw = join(dist, 'sw.js');
const stampedSw = readFileSync(distSw, 'utf8')
  .replace("'./app.js'", `'./app.js?v=${hash}'`)
  .replace(/const CACHE = '([^']+)'/, `const CACHE = '$1-${hash}'`);
if (!stampedSw.includes(`app.js?v=${hash}`) || !stampedSw.includes(`-${hash}'`)) {
  console.error('build failed: could not stamp the version into dist/sw.js');
  process.exit(1);
}
writeFileSync(distSw, stampedSw, 'utf8');

const kb = n => (n / 1024).toFixed(1) + 'kb';
console.log(`built edondo.html  ${kb(out.length)}  (index.html ${kb(html.length)} + app.js ${kb(app.length)})`);
console.log(`dist/ ready with ${DEPLOY.length} entries, app.js stamped v=${hash}`);
