import { test, expect, type Page } from '@playwright/test'

const requiredEnv = [
  'E2E_TUTOR_EMAIL',
  'E2E_TUTOR_PASSWORD',
  'E2E_STUDENT_A_EMAIL',
  'E2E_STUDENT_A_PASSWORD',
  'E2E_STUDENT_B_EMAIL',
  'E2E_STUDENT_B_PASSWORD',
] as const

function requireE2EAccounts() {
  const missing = requiredEnv.filter((name) => !process.env[name])
  if (missing.length > 0) {
    throw new Error(`Missing E2E account environment variables: ${missing.join(', ')}`)
  }

  return {
    tutor: {
      email: process.env.E2E_TUTOR_EMAIL!,
      password: process.env.E2E_TUTOR_PASSWORD!,
    },
    studentA: {
      email: process.env.E2E_STUDENT_A_EMAIL!,
      password: process.env.E2E_STUDENT_A_PASSWORD!,
    },
    studentB: {
      email: process.env.E2E_STUDENT_B_EMAIL!,
      password: process.env.E2E_STUDENT_B_PASSWORD!,
    },
  }
}

async function login(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })

  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: /log in|sign in|login/i }).click()

  await page.waitForURL(/\/(dashboard|tutor\/dashboard)(?:$|[?#])/, {
    timeout: 30_000,
  })
}

async function openLiveClassroomAsTutor(page: Page): Promise<string> {
  await page.goto('/tutor/live-sessions', { waitUntil: 'domcontentloaded' })

  const liveCard = page
    .locator('.card')
    .filter({ has: page.getByRole('button', { name: 'Open VATTAMS Classroom' }) })
    .filter({ hasText: /live/i })
    .first()

  await expect(liveCard).toBeVisible({ timeout: 30_000 })

  await liveCard
    .getByRole('button', { name: 'Open VATTAMS Classroom' })
    .click()

  await page.waitForURL(/\/live-classroom\/[^/?#]+/, { timeout: 30_000 })

  return new URL(page.url()).pathname.split('/').pop()!
}

async function joinAsStudent(page: Page, sessionId: string, email: string, password: string) {
  await login(page, email, password)
  await page.goto(`/live-session/${sessionId}`, {
    waitUntil: 'domcontentloaded',
  })

  await expect(
    page.getByRole('button', { name: 'Join Live Session' }),
  ).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Join Live Session' }).click()

  await page.waitForURL(`/live-classroom/${sessionId}`, {
    timeout: 30_000,
  })
}

async function classroomMetrics(page: Page) {
  return page.locator('main').filter({ hasText: 'Participants:' }).first().evaluate((main) => {
    const text = main.textContent ?? ''
    const participants = text.match(/Participants:\s*(\d+)/)?.[1]
    const remoteStreams = text.match(/Remote streams:\s*(\d+)/)?.[1]
    const webRTC = text.match(/WebRTC:\s*([a-zA-Z_]+)/)?.[1]

    return {
      participants: Number(participants ?? NaN),
      remoteStreams: Number(remoteStreams ?? NaN),
      webRTC: webRTC ?? '',
    }
  })
}

test('public shell recovers from offline to online', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await context.setOffline(true)

    await expect(
      page.getByRole('status', {
        name: /you are offline/i,
      }),
    ).toBeVisible({ timeout: 10_000 })

    await context.setOffline(false)

    await expect(
      page.getByRole('status', {
        name: /you are offline/i,
      }),
    ).toBeHidden({ timeout: 10_000 })
  } finally {
    await context.close()
  }
})


test.describe('production live classroom', () => {
  test('Tutor + Student A + Student B establish a live classroom', async ({
    browser,
  }) => {
    // WebRTC setup can legitimately exceed Playwright's 30s default.
    test.setTimeout(180_000)

    const accounts = requireE2EAccounts()

    const tutorContext = await browser.newContext({
      permissions: ['camera', 'microphone'],
    })
    const studentAContext = await browser.newContext({
      permissions: ['camera', 'microphone'],
    })
    const studentBContext = await browser.newContext({
      permissions: ['camera', 'microphone'],
    })

    const tutor = await tutorContext.newPage()
    const studentA = await studentAContext.newPage()
    const studentB = await studentBContext.newPage()

    try {
      await login(tutor, accounts.tutor.email, accounts.tutor.password)

      const sessionId = await openLiveClassroomAsTutor(tutor)

      await expect(tutor.getByText('Live', { exact: true })).toBeVisible({
        timeout: 30_000,
      })

      await joinAsStudent(studentA, sessionId, accounts.studentA.email, accounts.studentA.password)
      await joinAsStudent(studentB, sessionId, accounts.studentB.email, accounts.studentB.password)

      // A room may contain another active participant; require the three
      // smoke-test accounts rather than an artificially exact room size.
      await Promise.all([
        expect.poll(async () => (await classroomMetrics(tutor)).participants, { timeout: 60_000 }).toBeGreaterThanOrEqual(3),
        expect.poll(async () => (await classroomMetrics(studentA)).participants, { timeout: 60_000 }).toBeGreaterThanOrEqual(3),
        expect.poll(async () => (await classroomMetrics(studentB)).participants, { timeout: 60_000 }).toBeGreaterThanOrEqual(3),
      ])

      // Remote stream count is the authoritative browser-level media signal.
      // The aggregate RTCPeerConnection state can remain "connecting" in
      // Chromium after tracks are already flowing.
      await Promise.all([
        expect.poll(async () => (await classroomMetrics(tutor)).remoteStreams, { timeout: 60_000 }).toBeGreaterThanOrEqual(2),
        expect.poll(async () => (await classroomMetrics(studentA)).remoteStreams, { timeout: 60_000 }).toBeGreaterThanOrEqual(1),
        expect.poll(async () => (await classroomMetrics(studentB)).remoteStreams, { timeout: 60_000 }).toBeGreaterThanOrEqual(1),
      ])

      await Promise.all([
        expect.poll(async () => (await classroomMetrics(tutor)).webRTC, { timeout: 15_000 }).toMatch(/connected|connecting/),
        expect.poll(async () => (await classroomMetrics(studentA)).webRTC, { timeout: 15_000 }).toMatch(/connected|connecting/),
        expect.poll(async () => (await classroomMetrics(studentB)).webRTC, { timeout: 15_000 }).toMatch(/connected|connecting/),
      ])

      const micButton = tutor.getByRole('button', { name: /Mic/ })
      await expect(micButton).toBeEnabled()

      const initialMicText = await micButton.innerText()
      await micButton.click()

      await expect
        .poll(() => micButton.innerText(), { timeout: 5_000 })
        .not.toBe(initialMicText)

      await micButton.click()

      await expect
        .poll(() => micButton.innerText(), { timeout: 5_000 })
        .toBe(initialMicText)

      await pageStabilityCheck(tutor, 10_000)
      await pageStabilityCheck(studentA, 10_000)
      await pageStabilityCheck(studentB, 10_000)
    } finally {
      await Promise.allSettled([
        tutorContext.close(),
        studentAContext.close(),
        studentBContext.close(),
      ])
    }
  })
})

async function pageStabilityCheck(page: Page, durationMs: number) {
  await expect
    .poll(
      async () => (await classroomMetrics(page)).webRTC,
      { timeout: durationMs },
    )
    .toBe('connected')
}
