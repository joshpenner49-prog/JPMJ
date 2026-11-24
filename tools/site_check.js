// Site regression check: pages, links, interactive features.
// Usage: python3 -m http.server 8765 (in the repo), then node tools/site_check.js
// Update the race-week and per-race expectations each week.
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const U = 'http://localhost:8765/';
const PAGES = ['index.html', 'archive.html', 'standings.html', 'drivers.html', 'drivers/1/index.html', 'drivers/12/index.html',
  'verdict.html', 'lightsout.html', 'raceday.html', 'about.html', 'contact.html', 'privacy.html', 'command-centre.html'];
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { cond ? pass++ : fail++; if (!cond) console.log('FAIL', name, extra || ''); };
(async () => {
  const b = await pw.chromium.launch();
  for (const [w, tag] of [[1280, 'desktop'], [390, 'mobile']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('jp-analytics-consent', 'denied'); } catch (e) {} });
    for (const pg of PAGES) {
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message));
      p.on('response', r => { if (r.status() >= 400 && r.url().startsWith(U)) errs.push(r.status() + ' ' + r.url()); });
      await p.goto(U + pg, { waitUntil: 'networkidle' });
      ok(`${tag} ${pg} no errors`, errs.length === 0, errs.join(' | '));
      ok(`${tag} ${pg} no sideways scroll`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)));
      ok(`${tag} ${pg} race week`, (await p.$eval('html', e => e.dataset.raceWeek)) === 'qatar');
      await p.close();
    }
    await ctx.close();
  }
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('jp-analytics-consent', 'denied'); } catch (e) {} });
  const p = await ctx.newPage();
  // every internal link on every page resolves
  const links = new Set();
  for (const pg of PAGES) {
    await p.goto(U + pg, { waitUntil: 'domcontentloaded' });
    for (const h of await p.$$eval('a[href]', as => as.map(a => a.href))) if (h.startsWith(U)) links.add(h.split('#')[0]);
  }
  for (const l of links) { const r = await p.request.get(l); ok('link ' + l.replace(U, ''), r.status() === 200, r.status()); }
  // homepage
  await p.goto(U + 'index.html', { waitUntil: 'networkidle' });
  ok('countdown label', /Qatar GP/.test(await p.textContent('[data-countdown-label]')));
  ok('lead circuit is Lusail', /4\.304|5\.419/.test(await p.textContent('.lead')) && /Lusail/.test(await p.textContent('.lead')));
  ok('ticker duplicated for scrolling', (await p.$$eval('.ticker-item', e => e.length)) === 12);
  ok('home standings 10 rows', (await p.$$eval('.intel-table tbody tr', e => e.length)) === 10);
  ok('vegas sign hidden', !(await p.isVisible('.vegas-stage')));
  ok('odds board hidden', !(await p.isVisible('.odds-board')));
  ok('no 3D sphere loaded', !(await p.$('.vg3d')));
  await p.click('[data-target="recap-more"]'); ok('recap expands', await p.isVisible('#recap-more'));
  await p.click('[data-target="breaking-more"]'); ok('breaking expands', await p.isVisible('#breaking-more'));
  // standings
  await p.goto(U + 'standings.html', { waitUntil: 'networkidle' });
  ok('standings 25 drivers', (await p.$$eval('#drivers-panel tbody tr', e => e.length)) === 25);
  ok('standings LVG column', /LVG/.test(await p.textContent('#drivers-panel thead')));
  // drivers search + career toggle
  await p.goto(U + 'drivers.html'); await p.fill('#driverSearch', 'ferrari');
  ok('drivers search', (await p.$$eval('.driver-grid-card', c => c.filter(x => getComputedStyle(x).display !== 'none' && !x.classList.contains('hidden')).length)) === 2);
  await p.goto(U + 'drivers/3/index.html', { waitUntil: 'networkidle' });
  await p.click('.stat-toggle button[data-range="career"]');
  ok('career toggle shows figures', (await p.$$eval('.tile-value', t => t.map(x => x.textContent).join(' '))).length > 5);
  // archive
  await p.goto(U + 'archive.html', { waitUntil: 'networkidle' });
  await p.click('#round-21 .race-row-head');
  ok('archive round 21 opens', await p.isVisible('#round-21 .race-detail'));
  // race day page: no download for the upcoming Qatar edition
  await p.goto(U + 'raceday.html', { waitUntil: 'networkidle' });
  ok('raceday latest is Qatar', /Qatar Grand Prix/.test(await p.textContent('.rd-latest')));
  ok('no premature download', !(await p.$('.rd-latest a[download]')));
  ok('archive has 3 editions', (await p.$$eval('.rd-archive li', e => e.length)) === 3);
  // lights out game: no jackpot outside Vegas
  await p.goto(U + 'lightsout.html', { waitUntil: 'networkidle' });
  ok('no jackpot outside Vegas', !(await p.$('.pit-jackpot')));
  console.log(`${pass} passed, ${fail} failed`);
  await b.close();
})();
