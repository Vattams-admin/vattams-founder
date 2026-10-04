import { test, expect, type Page } from '@playwright/test'

const competitionSlug = 'thirukkural-mastery-championship'

test.describe('production Thirukkural smoke', () => {
  test('public competition route renders without application errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))

    await page.goto('/competitions', { waitUntil: 'domcontentloaded' })

    await expect(page.getByText('Thirukkural Mastery Championship', { exact: true }).first()).toBeVisible({ timeout: 30_000 })

    expect(errors, 'Production page emitted uncaught browser errors').toEqual([])
  })

  test('competition route redirects unauthenticated users to login', async ({ page }) => {
    await page.goto(`/competition/${competitionSlug}`, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/login(?:[?#]|$)/, { timeout: 30_000 })
  })
})

const requiredEnv = ['E2E_STUDENT_A_EMAIL', 'E2E_STUDENT_A_PASSWORD'] as const

async function login(page: Page) {
  const missing = requiredEnv.filter(name => !process.env[name])
  if (missing.length) throw new Error(`Missing GitHub Actions secrets: ${missing.join(', ')}`)

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#email').fill(process.env.E2E_STUDENT_A_EMAIL!)
  await page.locator('#password').fill(process.env.E2E_STUDENT_A_PASSWORD!)
  await page.getByRole('button', { name: /log in|sign in|login/i }).click()
  await page.waitForURL(/\/dashboard(?:$|[?#])/, { timeout: 30_000 })
}

test.describe('production Thirukkural authenticated smoke', () => {
  test('enrolled student can open the official competition and preparation UI', async ({ page }) => {
    await login(page)

    await page.goto(`/competition/${competitionSlug}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Thirukkural Mastery Championship', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: /Start Competition/i })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'Study Materials', exact: true })).toBeVisible({ timeout: 30_000 })
  })
})
