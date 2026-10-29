// Helpers for medication modals (Use / Administer ...) on the truck screen.
import { settle } from '../playwright-drive.mjs'
import { medRow } from './inventory.mjs'

// Draws a squiggle on every signature canvas inside the modal.
async function signAllPads(page, modal) {
  const canvases = modal.locator('canvas')
  const n = await canvases.count()
  for (let i = 0; i < n; i++) {
    const box = await canvases.nth(i).boundingBox()
    await page.mouse.move(box.x + 20, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + 15, { steps: 8 })
    await page.mouse.move(box.x + box.width - 20, box.y + box.height - 15, { steps: 8 })
    await page.mouse.up()
  }
  return n
}

// The bag section of the truck screen, with the named bag's tab selected (when the truck has several bags).
export async function bagScope(page, bagName) {
  const section = page.locator('div').filter({ has: page.getByText('Check history') })
    .filter({ has: page.getByRole('button', { name: bagName, exact: true }) }).last()
  await section.getByRole('button', { name: bagName, exact: true }).click()
  return section
}

// Controlled substance: pick the first available vial, give `amount`, sign (and witness) and confirm.
// Returns the success/error banner text.
export async function administerControlled(page, medName, amount, scope = null) {
  const row = scope
    ? scope.locator('div.rounded-xl').filter({ has: page.getByText(medName, { exact: true }) })
        .filter({ has: page.getByRole('button', { name: 'Administer' }) }).last()
    : medRow(page, medName)
  await row.getByRole('button', { name: 'Administer' }).click()
  const modal = page.locator('div.fixed', { has: page.getByText('Confirm Administration') }).last()
  await modal.waitFor()
  const vial = modal.locator('select').first()
  await vial.selectOption({ index: 1 })
  await modal.locator('input[type="number"]').first().fill(String(amount))
  // witness = first real person in the second person dropdown, if there is one
  const selects = modal.locator('select')
  if ((await selects.count()) > 2) await selects.nth(2).selectOption({ index: 1 })
  await signAllPads(page, modal)
  await modal.getByRole('button', { name: 'Confirm Administration' }).click()
  const banner = page.locator('div.bg-green-50, div.bg-red-50').first()
  await banner.waitFor({ timeout: 30000 }).catch(() => {})
  const modalStillOpen = await modal.isVisible().catch(() => false)
  const err = modalStillOpen ? await modal.locator('.text-red-700, .bg-red-50').first().innerText().catch(() => '') : ''
  await settle(page)
  return err ? `ERROR: ${err}` : ((await banner.innerText().catch(() => '')) || '(no banner)')
}
