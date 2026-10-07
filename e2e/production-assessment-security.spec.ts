import { test, expect, type Page } from "@playwright/test";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const COURSE_ID = "tnpsc-group-iv-vao";
const CANDIDATE_ASSESSMENTS = [
  "tnpsc-group-iv-vao-mock-01",
  "tnpsc-group-iv-vao-mock-02",
  "tnpsc-group-iv-vao-mock-03",
];
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "";
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "";

function getAdmin() {
  if (!FIREBASE_SERVICE_ACCOUNT_JSON) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
  const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
  const app = getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
  return { auth: getAuth(app), db: getFirestore(app) };
}

async function setEnrollmentStatus(email: string, status: "active" | "revoked") {
  const { auth, db } = getAdmin();
  const user = await auth.getUserByEmail(email);
  await db.collection("enrolments").doc(`${user.uid}_${COURSE_ID}`).set({
    student_id: user.uid,
    course_id: COURSE_ID,
    status,
    updated_at: new Date().toISOString(),
  }, { merge: true });
}

async function removeAssessmentEnrollment(email: string) {
  const { auth, db } = getAdmin();
  const user = await auth.getUserByEmail(email);
  await db.collection("enrolments").doc(`${user.uid}_${COURSE_ID}`).delete();
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /log in|sign in|login/i }).click();
  await page.waitForURL(/\/dashboard(?:$|[?#])/, { timeout: 30000 });
}

async function getPublishedAssessmentIds() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/assessment-catalog?course_id=${encodeURIComponent(COURSE_ID)}`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  if (!response.ok) return [];
  const body = await response.json();
  const assessments = Array.isArray(body?.assessments) ? body.assessments : [];
  return assessments
    .map((item: { assessment_id?: unknown; status?: unknown }) => item)
    .filter((item) => item.status === "published" && typeof item.assessment_id === "string")
    .map((item) => item.assessment_id as string);
}

async function startPublishedAssessment(page: Page) {
  const publishedIds = await getPublishedAssessmentIds();
  const candidateIds = publishedIds.length ? publishedIds : CANDIDATE_ASSESSMENTS;
  for (const assessmentId of candidateIds) {
    await page.goto(`/assessment/${COURSE_ID}/${assessmentId}`);
    const requestPromise = page.waitForRequest(
      request => request.url().includes("/functions/v1/assessment-attempt") && request.method() === "POST",
      { timeout: 15000 },
    );
    const responsePromise = page.waitForResponse(
      response => response.url().includes("/functions/v1/assessment-attempt") && response.request().method() === "POST",
      { timeout: 15000 },
    );
    await page.getByRole("button", { name: "Start / Resume" }).click();
    const [request, response] = await Promise.all([requestPromise, responsePromise]);
    const body = await response.json();
    if (response.ok() && body?.attempt_id && Array.isArray(body.question_ids) && body.question_ids.length) {
      const authorization = request.headers().authorization;
      if (!authorization) throw new Error("Firebase authorization header was not captured.");
      return { assessmentId, attemptId: body.attempt_id as string, questionId: body.question_ids[0] as string, authorization };
    }
    if (!JSON.stringify(body).includes("Assessment is not published")) {
      throw new Error(`Unable to start ${assessmentId}: ${JSON.stringify(body)}`);
    }
  }
  throw new Error("No published TNPSC Group IV / VAO assessment is available for production E2E.");
}

async function callFunction(page: Page, functionName: string, authorization: string, body: Record<string, unknown>) {
  const response = await page.request.post(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authorization, "Content-Type": "application/json" },
    data: body,
  });
  return { response, body: await response.json() };
}

test.describe("production assessment security boundary", () => {
  test.describe.configure({ mode: "serial" });

  test("revocation blocks question delivery, answer saving and submission", async ({ page }) => {
    const email = process.env.E2E_STUDENT_A_EMAIL;
    const password = process.env.E2E_STUDENT_A_PASSWORD;
    if (!email || !password) throw new Error("E2E Student A credentials were not provisioned.");

    await setEnrollmentStatus(email, "active");
    await login(page, email, password);
    const started = await startPublishedAssessment(page);

    try {
      await setEnrollmentStatus(email, "revoked");

      const question = await callFunction(page, "assessment-question-content", started.authorization, {
        action: "load", attempt_id: started.attemptId,
      });
      expect(question.response.status()).toBe(400);
      expect(question.body.error).toContain("no longer have access");

      const answer = await callFunction(page, "assessment-answer", started.authorization, {
        action: "save_answer", attempt_id: started.attemptId,
        question_id: started.questionId, selected_option_index: 0, answer: "0",
      });
      expect(answer.response.status()).toBe(400);
      expect(answer.body.error).toContain("no longer have access");

      const submit = await callFunction(page, "assessment-submit", started.authorization, {
        action: "submit", attempt_id: started.attemptId,
      });
      expect(submit.response.status()).toBe(400);
      expect(submit.body.error).toContain("no longer have access");
    } finally {
      await removeAssessmentEnrollment(email);
    }
  });

  test("Student B cannot read Student A's attempt", async ({ browser }) => {
    const emailA = process.env.E2E_STUDENT_A_EMAIL;
    const passwordA = process.env.E2E_STUDENT_A_PASSWORD;
    const emailB = process.env.E2E_STUDENT_B_EMAIL;
    const passwordB = process.env.E2E_STUDENT_B_PASSWORD;
    if (!emailA || !passwordA || !emailB || !passwordB) throw new Error("E2E student credentials were not provisioned.");

    await setEnrollmentStatus(emailA, "active");
    await setEnrollmentStatus(emailB, "active");
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    try {
      await login(pageA, emailA, passwordA);
      const started = await startPublishedAssessment(pageA);

      await login(pageB, emailB, passwordB);
      const bRequest = pageB.waitForRequest(
      request => request.url().includes("/functions/v1/assessment-attempt") && request.method() === "POST",
      { timeout: 15000 },
    );
      await pageB.goto(`/assessment/${COURSE_ID}/${started.assessmentId}`);
      await pageB.getByRole("button", { name: "Start / Resume" }).click();
      const bAttemptRequest = await bRequest;
      const authorization = bAttemptRequest.headers().authorization;
      if (!authorization) throw new Error("Student B authorization header was not captured.");

      const crossStudent = await callFunction(pageB, "assessment-question-content", authorization, {
      action: "load", attempt_id: started.attemptId,
    });
      expect(crossStudent.response.status()).toBe(400);
      expect(crossStudent.body.error).toContain("does not belong to this student");
    } finally {
      await contextA.close();
      await contextB.close();
      await removeAssessmentEnrollment(emailA);
      await removeAssessmentEnrollment(emailB);
    }
  });

  test("private answer keys are not anonymously downloadable", async ({ request }) => {
    expect(SUPABASE_URL).toBeTruthy();
    expect(SUPABASE_ANON_KEY).toBeTruthy();
    for (const assessmentId of CANDIDATE_ASSESSMENTS) {
      const path = `assessments/competitive-exam/${COURSE_ID}/${assessmentId}.private.json`;
      const response = await request.get(`${SUPABASE_URL}/storage/v1/object/academia-course-materials/${path}`, {
        headers: { apikey: SUPABASE_ANON_KEY },
      });
      expect(response.status(), `Private key exposed for ${assessmentId}`).not.toBe(200);
    }
  });
});
