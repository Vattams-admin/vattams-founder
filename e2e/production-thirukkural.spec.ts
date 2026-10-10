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

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /log in|sign in|login/i }).click()
  await page.waitForURL(/\/dashboard(?:$|[?#])/, { timeout: 30_000 })
}

async function login(page: Page) {
  const missing = requiredEnv.filter(name => !process.env[name])
  if (missing.length) throw new Error(`Missing GitHub Actions secrets: ${missing.join(', ')}`)
  await loginAs(page, process.env.E2E_STUDENT_A_EMAIL!, process.env.E2E_STUDENT_A_PASSWORD!)
}

test.describe('production Thirukkural authenticated smoke', () => {
  test('enrolled student can start the 30-question mock test', async ({ page }) => {
    await login(page)

    await page.goto(`/competition/${competitionSlug}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Thirukkural Mastery Championship', { exact: true }).first()).toBeVisible({ timeout: 30_000 })

    const mockButton = page.getByRole('button', { name: /Start Mock Test/i })
    await expect(mockButton).toBeVisible({ timeout: 30_000 })
    await mockButton.click()

    await expect(page.getByText(/Question 1 of 30/i)).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Answered 0\/30/i)).toBeVisible({ timeout: 30_000 })
  })

  test('enrolled student can open the official competition and preparation UI', async ({ page }) => {
    await login(page)

    await page.goto(`/competition/${competitionSlug}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByText('Thirukkural Mastery Championship', { exact: true }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('button', { name: /Start Competition/i })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'Study Materials', exact: true })).toBeVisible({ timeout: 30_000 })
  })
}
  test('Student B cannot fetch Student A\'s mock-test question content', async ({ browser }) => {
    const emailA = process.env.E2E_STUDENT_A_EMAIL
    const passwordA = process.env.E2E_STUDENT_A_PASSWORD
    const emailB = process.env.E2E_STUDENT_B_EMAIL
    const passwordB = process.env.E2E_STUDENT_B_PASSWORD
    if (!emailA || !passwordA || !emailB || !passwordB) {
      throw new Error('Both isolated E2E student credentials must be provisioned.')
    }

    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()
    try {
      await loginAs(pageA, emailA, passwordA)
      await pageA.goto(`/competition/${competitionSlug}`, { waitUntil: 'domcontentloaded' })
      const startAResponse = pageA.waitForResponse(
        response => response.url().includes('/functions/v1/competition-mock-attempt') && response.request().method() === 'POST',
        { timeout: 20_000 },
      )
      await pageA.getByRole('button', { name: /Start Mock Test/i }).click()
      const startA = await (await startAResponse).json()
      const attemptId = startA?.attempt_id
      const questionIds = startA?.question_ids
      if (typeof attemptId !== 'string' || !Array.isArray(questionIds) || questionIds.length !== 30) {
        throw new Error(`Student A could not start a valid 30-question mock attempt: ${JSON.stringify(startA)}`)
      }

      await loginAs(pageB, emailB, passwordB)
      await pageB.goto(`/competition/${competitionSlug}`, { waitUntil: 'domcontentloaded' })
      const startBRequest = pageB.waitForRequest(
        request => request.url().includes('/functions/v1/competition-mock-attempt') && request.method() === 'POST',
        { timeout: 20_000 },
      )
      await pageB.getByRole('button', { name: /Start Mock Test/i }).click()
      const requestB = await startBRequest
      const authorizationB = requestB.headers().authorization
      if (!authorizationB) throw new Error('Student B Firebase authorization header was not captured.')

      const response = await pageB.request.post(`${process.env.SUPABASE_URL}/functions/v1/competition-question-content`, {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY!,
          Authorization: authorizationB,
          'Content-Type': 'application/json',
        },
        data: { course_id: 'DNWt3cPE4ZSJG90CTC1e', attempt_id: attemptId, question_ids: questionIds },
      })
      const body = await response.json()
      expect(response.status()).toBe(403)
      expect(body.error).toContain('does not belong to you')
    } finally {
      await contextA.close()
      await contextB.close()
    }
  })
)
