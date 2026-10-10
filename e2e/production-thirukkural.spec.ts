import { test, expect, type Page } from '@playwright/test'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

const competitionSlug = 'thirukkural-mastery-championship'
const competitionCourseId = 'DNWt3cPE4ZSJG90CTC1e'

async function setCompetitionCacheAccess(email: string, active: boolean) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.SUPABASE_URL
  if (!serviceAccountJson || !serviceRoleKey || !supabaseUrl) {
    throw new Error('Firebase service account and Supabase service-role configuration are required for the revocation test.')
  }
  const app = getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(serviceAccountJson)) })
  const user = await getAuth(app).getUserByEmail(email)
  const response = await fetch(
    `${supabaseUrl}/rest/v1/competition_access_cache?student_id=eq.${encodeURIComponent(user.uid)}&course_id=eq.${encodeURIComponent(competitionCourseId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ enrolment_active: active, checked_at: new Date().toISOString() }),
    },
  )
  if (!response.ok) throw new Error(`Unable to update isolated E2E competition access cache: HTTP ${response.status}`)
}

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
  test.describe.configure({ mode: 'serial' })
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


  test('revoked competition access blocks question delivery, answer saving and submission', async ({ page }) => {
    const email = process.env.E2E_STUDENT_A_EMAIL
    const password = process.env.E2E_STUDENT_A_PASSWORD
    if (!email || !password) throw new Error('E2E Student A credentials were not provisioned.')

    await loginAs(page, email, password)
    await page.goto(`/competition/${competitionSlug}`, { waitUntil: 'domcontentloaded' })
    const attemptRequestPromise = page.waitForRequest(
      request => request.url().includes('/functions/v1/competition-official-attempt') && request.method() === 'POST',
      { timeout: 20_000 },
    )
    const attemptResponsePromise = page.waitForResponse(
      response => response.url().includes('/functions/v1/competition-official-attempt') && response.request().method() === 'POST',
      { timeout: 20_000 },
    )
    const questionRequestPromise = page.waitForRequest(
      request => request.url().includes('/functions/v1/competition-official-question-content') && request.method() === 'POST',
      { timeout: 20_000 },
    )
    await page.getByRole('button', { name: /Start Competition/i }).click()
    const [attemptRequest, attemptResponse] = await Promise.all([attemptRequestPromise, attemptResponsePromise])
    const attempt = await attemptResponse.json()
    const questionRequest = await questionRequestPromise
    const authorization = attemptRequest.headers().authorization
    const attemptId = attempt?.attempt_id
    const questionIds = attempt?.question_ids
    if (!authorization || typeof attemptId !== 'string' || !Array.isArray(questionIds) || questionIds.length !== 30) {
      throw new Error(`Could not start official 30-question attempt for revocation test: ${JSON.stringify(attempt)}`)
    }

    const headers = {
      apikey: process.env.SUPABASE_ANON_KEY!,
      Authorization: authorization,
      'Content-Type': 'application/json',
    }
    const mockStartResponse = await page.request.post(`${process.env.SUPABASE_URL}/functions/v1/competition-mock-attempt`, {
      headers,
      data: { course_id: competitionCourseId },
    })
    expect(mockStartResponse.status()).toBe(200)
    const mockAttempt = await mockStartResponse.json()
    if (typeof mockAttempt?.attempt_id !== 'string' || !Array.isArray(mockAttempt.question_ids) || mockAttempt.question_ids.length !== 30) {
      throw new Error(`Could not start mock attempt for revocation test: ${JSON.stringify(mockAttempt)}`)
    }

    try {
      await setCompetitionCacheAccess(email, false)
      const questionResponse = await page.request.post(`${process.env.SUPABASE_URL}/functions/v1/competition-official-question-content`, {
        headers,
        data: { attempt_id: attemptId, question_ids: questionIds },
      })
      expect(questionResponse.status()).toBe(403)
      expect((await questionResponse.json()).error).toContain('no longer have access')

      const saveResponse = await page.request.post(`${process.env.SUPABASE_URL}/functions/v1/competition-official-scoring`, {
        headers,
        data: { action: 'save_answer', attempt_id: attemptId, questionId: questionIds[0], answer: 'E2E revocation test' },
      })
      expect(saveResponse.status()).toBe(403)
      expect((await saveResponse.json()).error).toContain('no longer have access')

      const submitResponse = await page.request.post(`${process.env.SUPABASE_URL}/functions/v1/competition-official-scoring`, {
        headers,
        data: { action: 'submit', attempt_id: attemptId, answers: [] },
      })
      expect(submitResponse.status()).toBe(403)
      expect((await submitResponse.json()).error).toContain('no longer have access')

      const mockQuestionResponse = await page.request.post(`${process.env.SUPABASE_URL}/functions/v1/competition-question-content`, {
        headers,
        data: { course_id: competitionCourseId, attempt_id: mockAttempt.attempt_id, question_ids: mockAttempt.question_ids },
      })
      expect(mockQuestionResponse.status()).toBe(403)
      expect((await mockQuestionResponse.json()).error).toContain('no longer have access')

      const mockSaveResponse = await page.request.post(`${process.env.SUPABASE_URL}/functions/v1/competition-mock-scoring`, {
        headers,
        data: { action: 'save_answer', attemptId: mockAttempt.attempt_id, questionId: mockAttempt.question_ids[0], answer: 'E2E revocation test' },
      })
      expect(mockSaveResponse.status()).toBe(403)
      expect((await mockSaveResponse.json()).error).toContain('no longer have access')

      const mockSubmitResponse = await page.request.post(`${process.env.SUPABASE_URL}/functions/v1/competition-mock-scoring`, {
        headers,
        data: { action: 'submit_mock', attemptId: mockAttempt.attempt_id, answers: [] },
      })
      expect(mockSubmitResponse.status()).toBe(403)
      expect((await mockSubmitResponse.json()).error).toContain('no longer have access')
    } finally {
      await setCompetitionCacheAccess(email, true)
    }
    expect(questionRequest.url()).toContain('/functions/v1/competition-official-question-content')
  })

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
      const questionContentRequestA = pageA.waitForRequest(
        request => request.url().includes('/functions/v1/competition-question-content') && request.method() === 'POST',
        { timeout: 20_000 },
      )
      await pageA.getByRole('button', { name: /Start Mock Test|Resume Mock Test/i }).click()
      const startA = await (await startAResponse).json()
      const requestA = await questionContentRequestA
      const authorizationA = requestA.headers().authorization
      const attemptId = startA?.attempt_id
      const questionIds = startA?.question_ids
      if (typeof attemptId !== 'string' || !Array.isArray(questionIds) || questionIds.length !== 30 || !authorizationA) {
        throw new Error(`Student A could not start a valid 30-question mock attempt: ${JSON.stringify(startA)}`)
      }

      const ownContentResponse = await pageA.request.post(`${process.env.SUPABASE_URL}/functions/v1/competition-question-content`, {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY!,
          Authorization: authorizationA,
          'Content-Type': 'application/json',
        },
        data: { course_id: 'DNWt3cPE4ZSJG90CTC1e', attempt_id: attemptId, question_ids: questionIds },
      })
      expect(ownContentResponse.status()).toBe(200)
      const ownContent = await ownContentResponse.json()
      expect(ownContent.questions).toHaveLength(30)
      for (const question of ownContent.questions) {
        expect(question).not.toHaveProperty('answer')
        expect(question).not.toHaveProperty('correct_option_index')
        expect(question).not.toHaveProperty('explanation')
      }

      await loginAs(pageB, emailB, passwordB)
      await pageB.goto(`/competition/${competitionSlug}`, { waitUntil: 'domcontentloaded' })
      const startBRequest = pageB.waitForRequest(
        request => request.url().includes('/functions/v1/competition-mock-attempt') && request.method() === 'POST',
        { timeout: 20_000 },
      )
      await pageB.getByRole('button', { name: /Start Mock Test|Resume Mock Test/i }).click()
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
})
