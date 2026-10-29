// Page helpers for the Inventory / truck screen (/equipment and /equipment/[id]).
// Selectors are written once here so a test script is just a few named steps.
// If the UI changes, fix the selector in this file only.
//
//   import { launch, login } from '../playwright-drive.mjs'
//   import { openTruck, readPar, editPar } from './inventory.mjs'

import { BASE, settle } from '../playwright-drive.mjs'

// Opens the truck screen for the apparatus whose card contains `unitText` (e.g. "Unit 1").
export async function openTruck(page, unitText) {
  await page.goto(`${BASE}/equipment`)
  await settle(page)
  const card = page.locator('div', { hasText: unitText }).filter({ has: page.getByText('View Inventory') }).last()
  await card.getByText('View Inventory').first().click()
  await page.waitForURL(/\/equipment\/[0-9a-f-]{36}$/, { timeout: 90000 })
  await settle(page)
  return page.url()
}

// The medical row (PAR button's container) for a medication name on the truck screen.
export function medRow(page, medName) {
  // .last() = innermost matching card (outer compartment containers match too)
  return page.locator('div.rounded-xl')
    .filter({ has: page.getByText(medName, { exact: true }) })
    .filter({ has: page.locator('[title="Change PAR"], input[type="number"]') }).last()
}

// Returns the PAR number currently shown for a medication, or null if not found.
export async function readPar(page, medName) {
  const btn = medRow(page, medName).getByTitle('Change PAR')
  if (!(await btn.count())) return null
  const m = (await btn.innerText()).match(/PAR\s+(\d+)/)
  return m ? Number(m[1]) : null
}

// Clicks the PAR figure, types a new value, saves, and waits for the refresh to settle.
export async function editPar(page, medName, value) {
  const row = medRow(page, medName)
  await row.getByTitle('Change PAR').click()
  await row.locator('input[type="number"]').fill(String(value))
  await row.getByRole('button', { name: 'Save' }).click()
  await settle(page)
}
