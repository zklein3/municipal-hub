// Times key pages: wall-clock load, number of Supabase requests, total/slowest request time.
// Needs a server started with PERF_LOG=1 and its output going to a file:
//   PERF_LOG=1 npx next start -p 3001 > perf.log 2>&1
//   PW_BASE_URL=http://localhost:3001 PERF_LOG_FILE=perf.log PW_EMAIL=... PW_PASS=... node scripts/pw/perf-pages.mjs
// Each page is visited twice; the second (warm) visit is the one reported.
import fs from 'fs'
import { launch, BASE, settle } from '../playwright-drive.mjs'
import { loginToDept } from './session.mjs'
import { openTruck } from './inventory.mjs'

const LOG = process.env.PERF_LOG_FILE
if (!LOG) throw new Error('Set PERF_LOG_FILE to the server log path')

const PAGES = [
  ['dashboard', '/dashboard'],
  ['inventory', '/equipment'],
  ['medical', '/medical'],
  ['medical bags', '/medical?mode=bags'],
  ['dept admin hub', '/dept-admin'],
  ['dept admin setup', '/dept-admin/setup'],
  ['inspections', '/inspections'],
  ['events', '/events'],
  ['personnel', '/personnel'],
  ['operations', '/operations'],
  ['incidents', '/incidents'],
  ['training', '/training'],
  ['apparatus', '/apparatus'],
  ['announcements', '/announcements'],
  ['inbox', '/inbox'],
  ['reports hub', '/reports'],
  ['officer hub', '/officer'],
  ['fuel', '/fuel'],
  ['iso hub', '/iso'],
  ['station storage', '/equipment/storage'],
]
const TRUCK = process.env.PERF_TRUCK || 'Engine 1'

function readSince(offset) {
  const text = fs.readFileSync(LOG, 'utf8').slice(offset)
  const rows = [...text.matchAll(/\[perf\] (\d+)ms (\w+) (\S+)/g)].map(m => ({ ms: +m[1], method: m[2], what: m[3] }))
  return { rows, size: fs.statSync(LOG).size }
}

async function measure(page, name, go) {
  await go(); await settle(page) // warm-up (first hit compiles / warms caches)
  await page.waitForTimeout(1500)
  const start = fs.statSync(LOG).size
  const t0 = Date.now()
  await go(); await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {})
  const wall = Date.now() - t0
  await page.waitForTimeout(1500) // let trailing log lines land
  // Browser navigation timing: how long until the server answered vs. until the page was usable
  const nav = await page.evaluate(() => {
    const n = performance.getEntriesByType('navigation')[0]
    return n ? { ttfb: Math.round(n.responseStart), html: Math.round(n.responseEnd), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null
  })
  const { rows } = readSince(start)
  const total = rows.reduce((s, r) => s + r.ms, 0)
  const top = [...rows].sort((a, b) => b.ms - a.ms).slice(0, 3).map(r => `${r.ms}ms ${r.what.replace('rest/v1/', '')}`).join('; ')
  const navStr = nav ? `server ${String(nav.ttfb).padStart(5)}ms, page ready ${String(nav.dcl).padStart(5)}ms, loaded ${String(nav.load).padStart(5)}ms` : 'no nav timing'
  console.log(`${name.padEnd(18)} ${navStr} | ${String(rows.length).padStart(3)} db requests, ${String(total).padStart(5)}ms summed | idle-wall ${wall}ms | slowest: ${top}`)
}

const { browser, page } = await launch()
try {
  await loginToDept(page, process.env.PERF_DEPT || 'QA Test Department')
  for (const [name, path] of PAGES) await measure(page, name, () => page.goto(`${BASE}${path}`))
  if (!process.env.PERF_NO_TRUCK) {
    let truckUrl
    await openTruck(page, TRUCK); truckUrl = page.url()
    await measure(page, `truck (${TRUCK})`, () => page.goto(truckUrl))
  }
} finally {
  await browser.close()
}
