// Controlled-substance Administer on a truck compartment card.
// Usage: node scripts/pw/test-administer-cs.mjs "BLS 11" "ZZ Test Morphine (CS)" 4
import { launch } from '../playwright-drive.mjs'
import { loginToDept } from './session.mjs'
import { openTruck } from './inventory.mjs'
import { administerControlled } from './medical.mjs'

const [truck = 'BLS 11', med = 'ZZ Test Morphine (CS)', amount = '4'] = process.argv.slice(2)
const { browser, page } = await launch()
try {
  await loginToDept(page, 'QA Test Department')
  await openTruck(page, truck)
  console.log('RESULT:', await administerControlled(page, med, amount))
} finally {
  await browser.close()
}
