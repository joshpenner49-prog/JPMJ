// Render a JP Race Day programme.html to an A4 PDF and a cover thumbnail.
// Usage: node tools/raceday_render.js programme.html out.pdf cover.png
// Needs the "playwright" npm package (npm i playwright && npx playwright install chromium).
let pw;
try { pw = require('playwright'); } catch (e) {
  pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
}
const path = require('path');
(async () => {
  const [src, pdf, png] = process.argv.slice(2);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await page.goto('file://' + path.resolve(src), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family).filter((v, i, a) => a.indexOf(v) === i));
  // QA: nothing may be clipped by a page's fixed A4 box
  const clipped = await page.evaluate(() => [...document.querySelectorAll('.page')].map((p, i) => {
    // the bottom margin counts as clipped too: the running footer must sit above it
    const box = p.getBoundingClientRect(); const over = [];
    const floor = box.bottom - parseFloat(getComputedStyle(p).paddingBottom) + 1;
    p.querySelectorAll('*').forEach(el => { if (getComputedStyle(el).position === 'absolute') return; const r = el.getBoundingClientRect(); if (r.height && (r.bottom > floor || r.right > box.right + 0.5)) over.push(el.className || el.tagName); });
    return over.length ? `page ${i + 1}: ${[...new Set(over)].slice(0, 6).join(', ')}` : null;
  }).filter(Boolean));
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: pdf, format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true, outline: false });
  await page.emulateMedia({ media: 'screen' });
  const first = await page.$('.page');
  await first.screenshot({ path: png });
  await browser.close();
  console.log('fonts loaded: ' + fonts.join(', '));
  if (clipped.length) { console.error('CLIPPED CONTENT:\n' + clipped.join('\n')); process.exit(2); }
  console.log('layout check: no clipped content on any page');
})();
