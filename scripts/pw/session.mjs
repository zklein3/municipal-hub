// Logs in with PW_EMAIL / PW_PASS (env vars -- never put the password in a file)
// and picks a department if the account belongs to more than one.
import { login, settle } from '../playwright-drive.mjs'

export async function loginToDept(page, deptName = 'QA Test Department') {
  const { PW_EMAIL, PW_PASS } = process.env
  if (!PW_EMAIL || !PW_PASS) throw new Error('Set PW_EMAIL and PW_PASS env vars')
  await login(page, PW_EMAIL, PW_PASS)
  if (page.url().includes('/select-department')) {
    await page.getByRole('button', { name: new RegExp(`^${deptName}`) }).click()
    await page.waitForURL(u => !u.pathname.includes('/select-department'), { timeout: 60000 })
    await settle(page)
  }
  console.log('In dept:', deptName, '→', page.url())
}
