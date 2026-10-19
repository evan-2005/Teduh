/**
 * Drives the running app, checks the main features work, and saves README screenshots.
 *
 *   npm run dev            (terminal 1, with VITE_ENABLE_AI=true in .env)
 *   npm run dev:server     (terminal 2)
 *   npm run screenshots    (terminal 3)
 *
 * Uses the Microsoft Edge already installed on Windows (no browser download).
 * Set BASE_URL to point at another port, BROWSER_CHANNEL=chrome to use Chrome, and
 * SCREENSHOT_DIR to save the images somewhere other than docs/screenshots.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const CHANNEL = process.env.BROWSER_CHANNEL ?? 'msedge';
const OUT = process.env.SCREENSHOT_DIR ?? 'docs/screenshots';
const VIEWPORT = { width: 1440, height: 900 };
const NARROW_VIEWPORTS = [
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
];
const MIN_MAP_WIDTH_PX = 300;
// A local model's first call loads it into GPU memory (server timeout is 60 s).
const AI_TIMEOUT_MS = 75000;
const LOOKUP_TIMEOUT_MS = 20000;

mkdirSync(OUT, { recursive: true });

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures += 1;
  process.stderr.write(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}\n`);
};

const browser = await chromium.launch({ channel: CHANNEL });
const page = await browser.newPage({ viewport: VIEWPORT });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

// Clear focus rings and hover states so the screenshots look like a normal view.
const shot = async (name) => {
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height - 5);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${OUT}/${name}.png` });
};
const scrollToTop = (locator) => locator.evaluate((el) => el.scrollIntoView({ block: "start" }));
const settle = () => page.waitForTimeout(700);
const demoButton = () => page.getByRole('button', { name: /^Demo: \d+ (am|pm) walk / });
/** The app's pages: Map & routes, Plan builder, Spec pack, AI scan. The map stays on screen. */
const openPage = (name) => page.getByRole('navigation', { name: 'Pages' }).getByRole('button', { name }).click();
const loadDemo = async () => {
  await openPage('Map & routes');
  await demoButton().click();
};
/** Trees the chosen rows promise ("(13 trees)" in their names), to compare with the trees drawn. */
const promisedTrees = () =>
  page.locator('.candidate:has(input:checked) .candidate__name').evaluateAll((els) =>
    els.reduce((sum, el) => sum + Number(/\((\d+) trees\)/.exec(el.textContent)?.[1] ?? 0), 0),
  );

/** True when the topmost element at a marker's centre is that marker (so a click reaches it). */
const markersClickable = () =>
  page.locator('.marker').evaluateAll((els) =>
    els.every((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return hit !== null && el.contains(hit);
    }),
  );

await page.goto(BASE_URL);
await demoButton().waitFor();
await page.waitForLoadState('networkidle').catch(() => undefined);

// First load: a plan is already applied, so Swipe has something to compare
await settle();
await openPage('Plan builder');
check('first load applies the best plan', (await page.locator('.candidate input:checked').count()) > 0);
check('no "no plan" hint once a plan is applied', (await page.locator('.map-hint').count()) === 0);
const treesPromised = await promisedTrees();
check('the map draws every tree the chosen rows promise', (await page.locator('.planted-tree').count()) === treesPromised, `${treesPromised} trees`);
await openPage('Map & routes');
const demoText = await demoButton().innerText();
const demoJourney = await page.locator('.journey-select').locator('option:checked').innerText();
const [walkFrom = '', walkTo = ''] = demoJourney.toLowerCase().split(' → ');
check(
  'demo button names both ends of its own journey',
  demoText.toLowerCase().includes(walkFrom) && demoText.toLowerCase().endsWith(walkTo),
  `${demoText} / ${demoJourney}`,
);
check(
  'walks start at public transport',
  /^(Bus stop|LRT station|MRT station|Train station|Monorail station)/.test(demoJourney),
  demoJourney,
);

// 0. Area context: real layout, landmarks and a switchable background map
check('area card names the place', (await page.locator('.area__name').innerText()).length > 0);
check('landmarks are drawn from the area context', (await page.locator('.landmark').count()) >= 5);
await page.getByRole('button', { name: 'Map layers' }).click();
await page.getByRole('radio', { name: 'Satellite' }).click();
await page.waitForTimeout(1500);
check(
  'satellite background loads',
  (await page.locator('img.leaflet-tile[src*="arcgisonline"]').count()) > 0,
);
await shot('06-area-layers-satellite');
await page.getByRole('radio', { name: 'Light' }).click();
await page.getByLabel('Buildings').uncheck();
await page.getByLabel('Buildings').check();
await page.getByRole('button', { name: 'Map layers' }).click();
await page.waitForTimeout(800);

// 1. Demo preset + swipe
await loadDemo();
const divider = page.getByRole('slider', { name: 'Before and after divider' });
await divider.focus();
for (let i = 0; i < 4; i++) await divider.press('ArrowRight');
await settle();
const headline = await page.locator('.headline__value').innerText();
check('demo preset loads and recommends a plan', Number(headline) > 1, `headline ${headline}`);
check('swipe divider is shown', await divider.isVisible());
await shot('01-before-after-swipe');

// 2. Map modes: every candidate marker stays visible and clickable in all three
await openPage('Plan builder');
const candidateCount = await page.locator('.candidate').count();
for (const mode of ['Before', 'After', 'Swipe']) {
  await page.getByRole('radio', { name: mode, exact: true }).click();
  await settle();
  check(`${mode}: all ${candidateCount} markers shown`, (await page.locator('.marker').count()) === candidateCount);
  check(`${mode}: every marker can be clicked`, await markersClickable());
}

// 2b. Recommended alternatives are real trade-offs (each cheaper than the one above)
const planCosts = await page.locator('.plan__meta').evaluateAll((els) =>
  els.map((el) => Number(el.textContent.match(/RM ([\d,]+)/)[1].replace(/,/g, ''))),
);
check(
  'each alternative plan is cheaper than the one above it',
  planCosts.every((cost, i) => i === 0 || cost < planCosts[i - 1]),
  planCosts.join(' > '),
);

// 3. Time of day recolours the map
await openPage('Map & routes');
const exposedCount = () => page.locator('.leaflet-pane path[stroke-dasharray]').count();
const at1400 = await exposedCount();
const timeSlider = page.getByRole('slider', { name: 'Time of day' });
await timeSlider.fill(String(9 * 60));
await settle();
check('changing time changes the exposed segments', (await exposedCount()) !== at1400);
await timeSlider.fill(String(13 * 60 + 30));
await settle();
check('the time slider moves in half hours (1:30 pm)', (await page.getByText('Time of day: 1:30 pm').count()) > 0);
await timeSlider.fill(String(14 * 60));

// 4. Candidates and priorities recalculate
await openPage('Plan builder');
const baseline = await page.locator('.headline__value').innerText();
await page.locator('.candidate input:checked').first().uncheck();
await settle();
// Unticking the only chosen item leaves no headline figure, which is also a recalculation.
const headlineNow = page.locator('.headline__value');
const afterUntick = (await headlineNow.count()) > 0 ? await headlineNow.innerText() : 'no plan';
check('unticking a candidate recalculates results', afterUntick !== baseline, `${baseline} -> ${afterUntick}`);
await page.getByRole('group', { name: 'Priorities' }).getByRole('slider').first().fill('3');
await settle();
check('priority sliders keep recommendations available', (await page.locator('.plan').count()) > 0);

// 4b. Site planning: closer tree spacing plants more trees, and the map draws every one
const atDefaultSpacing = await promisedTrees();
await page.getByLabel(/Street-tree spacing/).fill('6');
await settle();
const closer = await promisedTrees();
check('closer spacing plants more trees', closer > atDefaultSpacing, `${atDefaultSpacing} -> ${closer}`);
check('the map draws every tree at the new spacing', (await page.locator('.planted-tree').count()) === closer);
await page.getByRole('button', { name: 'Reset site planning' }).click();

// 4c. Budget box and prices: a typed budget sticks; a dearer sapling re-prices tree rows
await page.getByLabel('Budget in ringgit').fill('123456');
await settle();
check('a typed budget is used', (await page.getByText('Budget: RM 123,456').count()) > 0);
const treeCost = () =>
  page.locator('.candidate-row', { hasText: 'Trees on' }).first().locator('.candidate__meta .num').innerText();
const before = await treeCost();
await page.getByText(/^Unit costs \(MYR\)/).click();
await page.getByLabel(/Sapling, 2 m container-grown/).fill('500');
await settle();
check('editing a unit price re-prices the tree rows', (await treeCost()) !== before, `${before} -> ${await treeCost()}`);
await page.getByRole('button', { name: 'Back to the estimated prices' }).click();
await loadDemo();

// 5. Future canopy + growth
await page.getByRole('radio', { name: 'Future' }).click();
await openPage('Plan builder');
await page.getByRole('button', { name: 'Recommend a plan' }).click();
await settle();
check('future canopy recommends tree plans', /tree/i.test(await page.locator('.plans').innerText()));
await page.getByRole('radio', { name: 'After' }).click();
await settle();
await shot('02-future-canopy');
await loadDemo();

// 6. Spec pack: opens from the candidate list, and from a marker in Before mode
await openPage('Plan builder');
await page.getByRole('button', { name: /^Spec pack for Trees/ }).first().click();
const pack = page.locator('.fabrication');
await pack.waitFor();
check('candidate list "Details" opens the fabrication pack', (await pack.innerText()).includes('Trees'));
await page.getByRole('radio', { name: 'Before', exact: true }).click();
await page.locator('[title^="Covered walkway"]').first().click();
await pack.getByText(/Fabrication pack: Covered walkway/).waitFor();
await page.getByRole('radio', { name: 'After', exact: true }).click();
await scrollToTop(pack);
check('fabrication pack shows a bill of materials', (await pack.innerText()).includes('Bill of materials'));
check('fabrication pack draws an elevation', (await pack.locator('svg .post').count()) > 10);
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Download CSV' }).click(),
]);
check('CSV export downloads a file', download.suggestedFilename().endsWith('.csv'));
await scrollToTop(pack);
await shot('03-fabrication-pack');

// 7. AI shade scan (mock if the server has no key) + explainer
if (await page.getByRole('navigation', { name: 'Pages' }).getByRole('button', { name: 'AI scan' }).count()) {
  await openPage('AI scan');
}
const scan = page.getByRole('region', { name: 'AI shade scan' });
if (await scan.count()) {
  await scrollToTop(scan);
  const png = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 480;
    canvas.height = 300;
    const g = canvas.getContext('2d');
    g.fillStyle = '#bcd6e6';
    g.fillRect(0, 0, 480, 120);
    g.fillStyle = '#9aa38f';
    g.fillRect(0, 120, 480, 180);
    g.fillStyle = '#d6cdb8';
    g.beginPath();
    g.moveTo(170, 300);
    g.lineTo(310, 300);
    g.lineTo(260, 120);
    g.lineTo(220, 120);
    g.fill();
    g.fillStyle = '#2f6b4f';
    g.beginPath();
    g.arc(120, 90, 70, 0, 7);
    g.fill();
    g.fillStyle = 'rgba(31,93,76,0.35)';
    g.fillRect(170, 200, 140, 100);
    g.fillStyle = '#1b2a26';
    g.font = '14px sans-serif';
    g.fillText('Placeholder image (not a real survey photo)', 70, 20);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await scan.locator('input[type=file]').setInputFiles({
    name: 'placeholder.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png),
  });
  await scan.getByRole('button', { name: 'Estimate shade' }).click();
  await scan.getByText(/AI estimate:/).waitFor({ timeout: AI_TIMEOUT_MS });
  check('AI scan returns an estimate (MOCK is labelled when there is no key)', true);
  await scan.getByRole('button', { name: /Confirm and apply/ }).click();
  check('confirming applies an ai-confirmed edit', await scan.getByText(/confirmed edit/).isVisible());
  await scrollToTop(scan);
  await shot('04-ai-shade-scan');
  await page.getByRole('button', { name: 'Explain this plan' }).click();
  await page.getByText(/from the numbers above\./).waitFor({ timeout: AI_TIMEOUT_MS });
  check('plan explainer writes a summary', true);
  await scrollToTop(page.getByRole('region', { name: 'Plan explainer' }));
  await shot('05-plan-explainer');
} else {
  check('AI panels visible (set VITE_ENABLE_AI=true)', false);
}

// 8. Place lookup (live search; the slow download-and-analyse step is covered by unit tests)
await page.getByRole('button', { name: 'Look up a place' }).click();
await page.getByLabel('Town, neighbourhood or landmark').fill('Subang Jaya');
await page.getByRole('button', { name: 'Search', exact: true }).click();
const results = page.locator('.place-search__results button');
const found = await results.first().waitFor({ timeout: LOOKUP_TIMEOUT_MS }).then(() => true, () => false);
check('place search returns results', found);
if (found) await shot('07-place-search');
await page.getByRole('button', { name: 'Look up a place' }).click();

// 9. Area picker: switch to a different shipped area and check the app reloads onto it
const picker = page.getByLabel('Choose an area');
const options = await picker.locator('option').evaluateAll((els) => els.map((e) => ({ value: e.value, label: e.textContent })));
check('area picker lists several shipped areas', options.filter((o) => !o.value.startsWith('custom:') && o.value !== 'seed').length >= 6, `${options.length} options`);
await openPage('Map & routes');
const currentName = await page.locator('.area__name').innerText();
const other = options.find((o) => o.label !== currentName && o.value !== 'seed' && !o.value.startsWith('custom:'));
if (other) {
  await Promise.all([page.waitForNavigation(), picker.selectOption(other.value)]);
  await page.locator('.area__name').waitFor();
  check('switching area loads that area', (await page.locator('.area__name').innerText()) === other.label, other.label);
  await loadDemo();
  await settle();
  check('demo preset works in the new area', Number(await page.locator('.headline__value').innerText()) >= 0);
}

// 10. Narrow screens: the map stays usable and the page never scrolls sideways
for (const size of NARROW_VIEWPORTS) {
  await page.setViewportSize(size);
  await settle();
  const layout = await page.evaluate(() => ({
    mapWidth: document.querySelector('.leaflet-container').getBoundingClientRect().width,
    sideways: document.documentElement.scrollWidth > window.innerWidth,
  }));
  check(`${size.width}px: map is at least ${MIN_MAP_WIDTH_PX}px wide`, layout.mapWidth >= MIN_MAP_WIDTH_PX, `${Math.round(layout.mapWidth)}px`);
  check(`${size.width}px: no horizontal page scroll`, !layout.sideways);
}
await page.setViewportSize(VIEWPORT);

check('no uncaught page errors', errors.length === 0, errors.join(' | '));
await browser.close();
process.exit(failures === 0 ? 0 : 1);
