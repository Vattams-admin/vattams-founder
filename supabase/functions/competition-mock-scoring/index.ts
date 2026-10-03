import {
  createRemoteJWKSet,
  importPKCS8,
  jwtVerify,
  SignJWT,
} from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "";
const FIREBASE_SERVICE_ACCOUNT_JSON =
  Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") || "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SECRET_KEYS = JSON.parse(
  Deno.env.get("SUPABASE_SECRET_KEYS") || "{}",
);
const SUPABASE_SERVICE_ROLE_KEY =
  SUPABASE_SECRET_KEYS["default"] || "";
const SUPABASE_BUCKET = "academia-course-materials";
const COMPETITION_REGISTRY_PATH = "competitions/registry.json";

if (!FIREBASE_PROJECT_ID) {
  throw new Error("Missing FIREBASE_PROJECT_ID");
}

if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
}

const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase function environment variables");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
);

const firebaseJWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getBearerToken(req: Request) {
  const authorization = req.headers.get("Authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim() || null;
}

async function verifyFirebaseUser(token: string) {
  const issuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

  const { payload } = await jwtVerify(token, firebaseJWKS, {
    issuer,
    audience: FIREBASE_PROJECT_ID,
  });

  if (!payload.sub) {
    throw new Error("Firebase token has no subject");
  }

  return payload.sub;
}

async function getGoogleAccessToken() {
  const privateKey = await importPKCS8(
    serviceAccount.private_key,
    "RS256",
  );

  const now = Math.floor(Date.now() / 1000);

  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/datastore",
  })
    .setProtectedHeader({
      alg: "RS256",
      typ: "JWT",
    })
    .setIssuer(serviceAccount.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error("Unable to obtain Firestore service access token");
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error("Firestore service access token was not returned");
  }

  return data.access_token as string;
}

function firestoreBaseUrl() {
  return (
    "https://firestore.googleapis.com/v1/projects/" +
    `${encodeURIComponent(FIREBASE_PROJECT_ID)}` +
    "/databases/(default)/documents"
  );
}

async function firestoreGet(path: string, accessToken: string) {
  const response = await fetch(`${firestoreBaseUrl()}/${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    console.error("Firestore GET failed:", response.status, text);
    throw new Error(`Firestore GET failed: ${response.status}`);
  }

  return await response.json();
}

async function firestoreCommit(writes: unknown[], accessToken: string) {
  const response = await fetch(`${firestoreBaseUrl()}:commit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ writes }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("Firestore commit failed:", text);
    throw new Error("Unable to save mock test result");
  }

  return await response.json();
}

function stringField(document: any, field: string) {
  return document?.fields?.[field]?.stringValue ?? "";
}

function integerField(document: any, field: string) {
  return Number(document?.fields?.[field]?.integerValue ?? 0);
}

function booleanField(document: any, field: string) {
  return document?.fields?.[field]?.booleanValue === true;
}

function arrayStringField(document: any, field: string) {
  const values = document?.fields?.[field]?.arrayValue?.values;

  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value: any) => value?.stringValue)
    .filter(
      (value: unknown): value is string =>
        typeof value === "string" && value.length > 0,
    );
}

function normalizeAnswer(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isSafeId(value: string) {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function firestoreResource(collection: string, id: string) {
  return (
    `projects/${FIREBASE_PROJECT_ID}` +
    `/databases/(default)/documents/` +
    `${collection}/${encodeURIComponent(id)}`
  );
}

type StoredAnswerKey = {
  answer: string;
  correct_option_index: number;
  explanation: string;
};

type StoredAnswerKeyBundle = Record<string, StoredAnswerKey>;

type CompetitionRegistryEntry = {
  course_id: string;
  competition: string;
  slug: string;
  question_bundle: string;
  answer_key_bundle: string;
  age_pools: string;
  per_attempt: number;
  enabled: boolean;
};

type CompetitionRegistry = {
  version: number;
  competitions: Record<string, CompetitionRegistryEntry>;
};

let competitionRegistryPromise: Promise<CompetitionRegistry> | null = null;

async function loadCompetitionRegistry(): Promise<CompetitionRegistry> {
  if (!competitionRegistryPromise) {
    competitionRegistryPromise = (async () => {
      const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .download(COMPETITION_REGISTRY_PATH);

      if (error || !data) {
        console.error(
          "Supabase competition registry download failed:",
          error?.message || "No data returned",
        );
        throw new Error("Competition registry is unavailable");
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(await data.text());
      } catch {
        throw new Error("Competition registry is invalid JSON");
      }

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error("Competition registry has an invalid format");
      }

      return parsed as CompetitionRegistry;
    })();
  }

  try {
    return await competitionRegistryPromise;
  } catch (error) {
    competitionRegistryPromise = null;
    throw error;
  }
}

async function getCompetitionRegistryEntry(courseId: string) {
  const registry = await loadCompetitionRegistry();
  const entry = registry.competitions?.[courseId];

  if (!entry || entry.enabled !== true) {
    return null;
  }

  if (
    entry.course_id !== courseId ||
    !entry.question_bundle ||
    !entry.answer_key_bundle
  ) {
    return null;
  }

  return entry;
}

let answerKeyBundlePromises =
  new Map<string, Promise<StoredAnswerKeyBundle>>();

async function loadAnswerKeyBundle(
  courseId: string,
): Promise<StoredAnswerKeyBundle> {
  let promise = answerKeyBundlePromises.get(courseId);

  if (!promise) {
    promise = (async () => {
      const entry = await getCompetitionRegistryEntry(courseId);

      if (!entry) {
        throw new Error("Competition is not configured");
      }

      const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .download(entry.answer_key_bundle);

      if (error || !data) {
        console.error(
          "Supabase answer-key bundle download failed:",
          error?.message || "No data returned",
        );
        throw new Error("Answer-key bundle is unavailable");
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(await data.text());
      } catch {
        throw new Error("Answer-key bundle is invalid JSON");
      }

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error("Answer-key bundle has an invalid format");
      }

      return parsed as StoredAnswerKeyBundle;
    })();

    answerKeyBundlePromises.set(courseId, promise);
  }

  try {
    return await promise;
  } catch (error) {
    answerKeyBundlePromises.delete(courseId);
    throw error;
  }
}

async function loadAnswerKey(
  questionId: string,
  courseId: string,
) {
  const bundle = await loadAnswerKeyBundle(courseId);
  return bundle[questionId] ?? null;
}

async function loadAttempt(
  attemptId: string,
  studentId: string,
  accessToken: string,
) {
  const attempt = await firestoreGet(
    `competition_mock_attempts/${encodeURIComponent(attemptId)}`,
    accessToken,
  );

  if (!attempt?.fields) {
    return {
      error: json({ error: "Mock attempt not found" }, 404),
    };
  }

  if (stringField(attempt, "student_id") !== studentId) {
    return {
      error: json(
        { error: "This mock attempt does not belong to you" },
        403,
      ),
    };
  }

  const courseId = stringField(attempt, "course_id");

  if (!courseId || !isSafeId(courseId)) {
    return {
      error: json({ error: "Competition course is missing" }, 500),
    };
  }

  const course = await firestoreGet(
    `courses/${encodeURIComponent(courseId)}`,
    accessToken,
  );

  if (!course?.fields) {
    return {
      error: json({ error: "Competition course not found" }, 404),
    };
  }

  if (booleanField(course, "is_competition") === false) {
    return {
      error: json(
        { error: "This course is not configured as a competition" },
        409,
      ),
    };
  }

  const selectedQuestionIds = arrayStringField(
    attempt,
    "question_ids",
  );

  if (
    selectedQuestionIds.length !== 30 ||
    new Set(selectedQuestionIds).size !== 30
  ) {
    return {
      error: json(
        { error: "Mock attempt has an invalid question set" },
        409,
      ),
    };
  }

  return {
    attempt,
    courseId,
    selectedQuestionIds,
  };
}

type StoredQuestion = {
  competition: string;
  question_id: string;
  course_id?: string;
  question: string;
  question_type: string;
  options: string[];
  marks: number;
  time_seconds: number;
  is_published?: boolean;
};

type StoredQuestionBundle = Record<string, StoredQuestion>;

let questionBundlePromises =
  new Map<string, Promise<StoredQuestionBundle>>();

async function loadQuestionBundle(
  courseId: string,
): Promise<StoredQuestionBundle> {
  let promise = questionBundlePromises.get(courseId);

  if (!promise) {
    promise = (async () => {
      const entry = await getCompetitionRegistryEntry(courseId);

      if (!entry) {
        throw new Error("Competition is not configured");
      }

      const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET)
        .download(entry.question_bundle);

      if (error || !data) {
        console.error(
          "Supabase question bundle download failed:",
          error?.message || "No data returned",
        );
        throw new Error("Question bundle is unavailable");
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(await data.text());
      } catch {
        throw new Error("Question bundle is invalid JSON");
      }

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error("Question bundle has an invalid format");
      }

      return parsed as StoredQuestionBundle;
    })();

    questionBundlePromises.set(courseId, promise);
  }

  try {
    return await promise;
  } catch (error) {
    questionBundlePromises.delete(courseId);
    throw error;
  }
}

async function loadQuestion(
  questionId: string,
  courseId: string,
  _accessToken: string,
) {
  const bundle = await loadQuestionBundle(courseId);
  const question = bundle[questionId];

  if (!question) {
    return null;
  }

  if (
    question.course_id &&
    question.course_id !== courseId
  ) {
    return null;
  }

  if (question.question_id !== questionId) {
    return null;
  }

  if (question.is_published === false) {
    return null;
  }

  if (question.question_type !== "Multiple Choice") {
    return null;
  }

  if (
    !Array.isArray(question.options) ||
    question.options.length !== 4 ||
    new Set(question.options).size !== 4 ||
    question.options.some(
      (option) =>
        typeof option !== "string" ||
        option.trim() === "",
    )
  ) {
    return null;
  }

  return {
    fields: {
      options: {
        arrayValue: {
          values: question.options.map((option) => ({
            stringValue: option,
          })),
        },
      },
      marks: {
        integerValue: String(
          Number.isFinite(Number(question.marks))
            ? Number(question.marks)
            : 1,
        ),
      },
    },
  };
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const firebaseToken = getBearerToken(req);

    if (!firebaseToken) {
      return json({ error: "Authentication required" }, 401);
    }

    const studentId = await verifyFirebaseUser(firebaseToken);
    const body = await req.json();

    const action = String(body.action || "").trim();
    const attemptId = String(body.attemptId || "").trim();

    if (!attemptId || !isSafeId(attemptId)) {
      return json(
        { error: "Valid attemptId is required" },
        400,
      );
    }

    if (
      action !== "check_answer" &&
      action !== "submit_mock"
    ) {
      return json(
        {
          error:
            'action must be "check_answer" or "submit_mock"',
        },
        400,
      );
    }

    const accessToken = await getGoogleAccessToken();

    const attemptData = await loadAttempt(
      attemptId,
      studentId,
      accessToken,
    );

    if ("error" in attemptData) {
      return attemptData.error;
    }

    const {
      attempt,
      courseId,
      selectedQuestionIds,
    } = attemptData;

    const selectedQuestionSet = new Set(selectedQuestionIds);

    if (action === "check_answer") {
      const questionId = String(
        body.questionId || "",
      ).trim();

      const submittedAnswer = String(
        body.answer ?? "",
      ).trim();

      if (!questionId || !isSafeId(questionId)) {
        return json(
          { error: "Valid questionId is required" },
          400,
        );
      }

      if (!selectedQuestionSet.has(questionId)) {
        return json(
          {
            error:
              "This question does not belong to the mock attempt",
          },
          400,
        );
      }

      if (!submittedAnswer) {
        return json(
          { error: "An answer is required" },
          400,
        );
      }

      const question = await loadQuestion(
        questionId,
        courseId,
        accessToken,
      );

      if (!question) {
        return json(
          { error: "Mock question is unavailable" },
          409,
        );
      }

      const answerKey = await loadAnswerKey(questionId, courseId);

      if (!answerKey) {
        return json(
          { error: "Answer key is unavailable" },
          409,
        );
      }

      const correctAnswer = answerKey.answer;

      const correctOptionIndex = answerKey.correct_option_index;

      if (!correctAnswer) {
        return json(
          { error: "Answer key is invalid" },
          500,
        );
      }

      const options = question?.fields?.options?.arrayValue?.values
        ?.map((value: any) => value?.stringValue)
        .filter(
          (value: unknown): value is string =>
            typeof value === "string",
        ) ?? [];

      if (
        options.length !== 4 ||
        new Set(options).size !== 4
      ) {
        return json(
          { error: "Mock question options are invalid" },
          409,
        );
      }

      if (
        correctOptionIndex >= 0 &&
        correctOptionIndex >= options.length
      ) {
        return json(
          { error: "Answer key option index is invalid" },
          500,
        );
      }

      const correct =
        normalizeAnswer(submittedAnswer) ===
        normalizeAnswer(correctAnswer);

      const explanation = answerKey.explanation;

      return json({
        ok: true,
        action: "check_answer",
        questionId,
        correct,
        correctAnswer,
        explanation,
        correctOptionIndex:
          correctOptionIndex >= 0
            ? correctOptionIndex
            : undefined,
      });
    }

    const submittedAnswers = Array.isArray(body.answers)
      ? body.answers.map((item: any) => ({
          questionId: String(
            item?.questionId || "",
          ).trim(),
          answer: String(
            item?.answer ?? "",
          ).trim(),
        }))
      : null;

    if (!submittedAnswers) {
      return json(
        { error: "answers must be an array" },
        400,
      );
    }

    if (submittedAnswers.length > 30) {
      return json(
        { error: "Too many answers" },
        400,
      );
    }

    const answerIds = new Set<string>();

    for (const item of submittedAnswers) {
      if (!isSafeId(item.questionId)) {
        return json(
          { error: "Invalid question ID" },
          400,
        );
      }

      if (answerIds.has(item.questionId)) {
        return json(
          {
            error:
              `Duplicate answer for ${item.questionId}`,
          },
          400,
        );
      }

      if (!selectedQuestionSet.has(item.questionId)) {
        return json(
          {
            error:
              `Question ${item.questionId} does not belong to this mock attempt`,
          },
          400,
        );
      }

      answerIds.add(item.questionId);
    }

    const status = stringField(attempt, "status");
    const resultId = `${studentId}_${attemptId}`;

    if (status !== "in_progress") {
      const existingResult = await firestoreGet(
        `competition_mock_results/${encodeURIComponent(resultId)}`,
        accessToken,
      );

      if (existingResult?.fields) {
        return json({
          ok: true,
          attemptId,
          score: integerField(
            existingResult,
            "score",
          ),
          maxScore: integerField(
            existingResult,
            "max_score",
          ),
          answeredCount: integerField(
            existingResult,
            "answered_count",
          ),
          submitted: true,
          alreadySubmitted: true,
        });
      }

      return json(
        {
          error:
            "This mock attempt has already been submitted",
        },
        409,
      );
    }

    const questionMap = new Map<string, any>();

    for (const questionId of selectedQuestionIds) {
      const question = await loadQuestion(
        questionId,
        courseId,
        accessToken,
      );

      if (question) {
        questionMap.set(questionId, question);
      }
    }

    if (questionMap.size !== 30) {
      return json(
        {
          error:
            "One or more mock questions are unavailable",
        },
        409,
      );
    }

    let score = 0;
    let maxScore = 0;
    let answeredCount = 0;

    for (const questionId of selectedQuestionIds) {
      const question = questionMap.get(questionId);

      if (!question) {
        throw new Error(
          `Missing question ${questionId}`,
        );
      }

      const marks = integerField(
        question,
        "marks",
      );

      maxScore += marks;

      const submitted = submittedAnswers.find(
        (item) => item.questionId === questionId,
      );

      if (
        submitted &&
        submitted.answer.trim() !== ""
      ) {
        answeredCount++;
      }

      const answerKey = await loadAnswerKey(questionId, courseId);

      if (!answerKey) {
        throw new Error(
          `Missing answer key for ${questionId}`,
        );
      }

      const correctAnswer = answerKey.answer;

      if (
        submitted &&
        submitted.answer !== "" &&
        normalizeAnswer(submitted.answer) ===
          normalizeAnswer(correctAnswer)
      ) {
        score += marks;
      }
    }

    const now = new Date().toISOString();

    const resultName = firestoreResource(
      "competition_mock_results",
      resultId,
    );

    const attemptName = firestoreResource(
      "competition_mock_attempts",
      attemptId,
    );

    if (!attempt.updateTime) {
      throw new Error(
        "Mock attempt has no updateTime",
      );
    }

    const existingResult = await firestoreGet(
      `competition_mock_results/${encodeURIComponent(resultId)}`,
      accessToken,
    );

    if (existingResult?.fields) {
      return json({
        ok: true,
        attemptId,
        score: integerField(
          existingResult,
          "score",
        ),
        maxScore: integerField(
          existingResult,
          "max_score",
        ),
        answeredCount: integerField(
          existingResult,
          "answered_count",
        ),
        submitted: true,
        alreadySubmitted: true,
      });
    }

    const writes = [
      {
        update: {
          name: resultName,
          fields: {
            student_id: {
              stringValue: studentId,
            },
            attempt_id: {
              stringValue: attemptId,
            },
            course_id: {
              stringValue: courseId,
            },
            score: {
              integerValue: String(score),
            },
            max_score: {
              integerValue: String(maxScore),
            },
            answered_count: {
              integerValue: String(
                answeredCount,
              ),
            },
            submitted_at: {
              timestampValue: now,
            },
            scored_at: {
              timestampValue: now,
            },
            is_mock: {
              booleanValue: true,
            },
          },
        },
        currentDocument: {
          exists: false,
        },
      },
      {
        update: {
          name: attemptName,
          fields: {
            ...attempt.fields,
            status: {
              stringValue: "submitted",
            },
            score: {
              integerValue: String(score),
            },
            max_score: {
              integerValue: String(maxScore),
            },
            submitted_at: {
              timestampValue: now,
            },
            scored_at: {
              timestampValue: now,
            },
          },
        },
        currentDocument: {
          updateTime: attempt.updateTime,
        },
      },
    ];

    try {
      await firestoreCommit(
        writes,
        accessToken,
      );
    } catch (commitError) {
      const committedResult = await firestoreGet(
        `competition_mock_results/${encodeURIComponent(resultId)}`,
        accessToken,
      );

      if (committedResult?.fields) {
        return json({
          ok: true,
          attemptId,
          score: integerField(
            committedResult,
            "score",
          ),
          maxScore: integerField(
            committedResult,
            "max_score",
          ),
          answeredCount: integerField(
            committedResult,
            "answered_count",
          ),
          submitted: true,
          alreadySubmitted: true,
        });
      }

      throw commitError;
    }

    return json({
      ok: true,
      action: "submit_mock",
      attemptId,
      score,
      maxScore,
      answeredCount,
      submitted: true,
      alreadySubmitted: false,
    });
  } catch (error) {
    console.error(
      "competition-mock-scoring error:",
      error,
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Mock scoring failed",
      },
      500,
    );
  }
});
