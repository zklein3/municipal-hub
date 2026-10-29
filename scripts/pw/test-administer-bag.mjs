// Controlled-substance Administer from inside a bag.
// Usage: node scripts/pw/test-administer-bag.mjs "BLS 11" "Trauma Box 1" "ZZ Test Morphine (CS)" 3
import { launch } from '../playwright-drive.mjs'
import { loginToDept } from './session.mjs'
import { openTruck } from './inventory.mjs'
import { administerControlled, bagScope } from './medical.mjs'

const [truck = 'BLS 11', bag = 'Trauma Box 1', med = 'ZZ Test Morphine (CS)', amount = '3'] = process.argv.slice(2)
const { browser, page } = await launch()
try {
  await loginToDept(page, 'QA Test Department')
  await openTruck(page, truck)
  const scope = await bagScope(page, bag)
  console.log('RESULT:', await administerControlled(page, med, amount, scope))
} finally {
  await browser.close()
}
