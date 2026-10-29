// Checks that editing PAR on a truck compartment medical row persists after save + reload.
// Usage: PW_BASE_URL=http://localhost:3001 node scripts/pw/test-par-edit.mjs "Unit 1" "Normal Saline"
import { launch } from '../playwright-drive.mjs'
import { loginToDept } from './session.mjs'
import { openTruck, readPar, editPar } from './inventory.mjs'

const [unit = 'Unit 1', med = 'Normal Saline'] = process.argv.slice(2)
const { browser, page } = await launch()
try {
  await loginToDept(page, 'QA Test Department')
  await openTruck(page, unit)
  const before = await readPar(page, med)
  if (before === null) throw new Error(`No PAR button found for "${med}" on ${unit}`)
  const target = before + 1
  await editPar(page, med, target)
  // Poll: distinguishes "refresh is slow" from "refresh never happens"
  let afterSave = await readPar(page, med), waited = 0
  while (afterSave !== target && waited < 15000) { await page.waitForTimeout(500); waited += 500; afterSave = await readPar(page, med) }
  console.log(`UI showed new PAR after ~${waited}ms extra wait`)
  await page.reload()
  await page.waitForLoadState('networkidle')
  const afterReload = await readPar(page, med)
  console.log(`PAR before=${before} target=${target} afterSave=${afterSave} afterReload=${afterReload}`)
  console.log(afterSave === target && afterReload === target ? 'PASS' : 'FAIL')
  await editPar(page, med, before) // restore
} finally {
  await browser.close()
}
