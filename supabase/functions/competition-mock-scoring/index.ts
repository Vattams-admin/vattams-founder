import {
  createRemoteJWKSet,
  jwtVerify,
} from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID =
  Deno.env.get("FIREBASE_PROJECT_ID") ||
  Deno.env.get("VITE_FIREBASE_PROJECT_ID") ||
  "";

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") || "";

const SUPABASE_SECRET_KEYS = JSON.parse(
  Deno.env.get("SUPABASE_SECRET_KEYS") || "{}",
);

const SUPABASE_SERVICE_ROLE_KEY =
  SUPABASE_SECRET_KEYS["default"] || "";

const SUPABASE_BUCKET =
  "academia-course-materials";

const COMPETITION_REGISTRY_PATH =
  "competitions/registry.json";

if (!FIREBASE_PROJECT_ID) {
  throw new Error("Missing FIREBASE_PROJECT_ID");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing Supabase function environment variables",
  );
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
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
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function json(
  data: unknown,
  status = 200,
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function getBearerToken(
  req: Request,
) {
  const authorization =
    req.headers.get("Authorization") || "";

  if (!authorization.startsWith("Bearer ")) {
    return null;
  }

  return (
    authorization
      .slice("Bearer ".length)
      .trim() || null
  );
}

async function verifyFirebaseUser(
  token: string,
) {
  const issuer =
    `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

  const { payload } =
    await jwtVerify(token, firebaseJWKS, {
      issuer,
      audience: FIREBASE_PROJECT_ID,
    });

  if (!payload.sub) {
    throw new Error(
      "Firebase token has no subject",
    );
  }

  return payload.sub;
}

function isRecord(
  value: unknown,
): value is Record<string, any> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

type StoredQuestion = Record<string, any>;

type StoredAnswerKey = {
  answer: string;
  correct_option_index: number;
  explanation: string;
};

type StoredAnswerKeyBundle =
  Record<string, StoredAnswerKey>;

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
  competitions: Record<
    string,
    CompetitionRegistryEntry
  >;
};

let questionBundlePromises =
  new Map<
    string,
    Promise<Record<string, StoredQuestion>>
  >();

let answerKeyBundlePromises =
  new Map<
    string,
    Promise<StoredAnswerKeyBundle>
  >();

async function loadCompetitionRegistry(): Promise<CompetitionRegistry> {
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(COMPETITION_REGISTRY_PATH);
  if (error || !data) throw new Error("Competition registry is unavailable");
  let parsed: unknown;
  try { parsed = JSON.parse(await data.text()); } catch { throw new Error("Competition registry is invalid JSON"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Competition registry has an invalid format");
  return parsed as CompetitionRegistry;
}

async function getCompetitionRegistryEntry(
  courseId: string,
) {
  const registry =
    await loadCompetitionRegistry();

  const entry =
    registry.competitions?.[courseId];

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

async function loadQuestionBundle(
  courseId: string,
): Promise<Record<string, StoredQuestion>> {
  let promise =
    questionBundlePromises.get(courseId);

  if (!promise) {
    promise = (async () => {
      const entry =
        await getCompetitionRegistryEntry(
          courseId,
        );

      if (!entry) {
        throw new Error(
          "Competition is not configured",
        );
      }

      const { data, error } =
        await supabase.storage
          .from(SUPABASE_BUCKET)
          .download(
            entry.question_bundle,
          );

      if (error || !data) {
        console.error(
          "Supabase question bundle download failed:",
          error?.message ||
            "No data returned",
        );

        throw new Error(
          "Question bundle is unavailable",
        );
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(
          await data.text(),
        );
      } catch {
        throw new Error(
          "Question bundle is invalid JSON",
        );
      }

      if (
        !isRecord(parsed)
      ) {
        throw new Error(
          "Question bundle has an invalid format",
        );
      }

      /*
       * The current production question bundle format is:
       *
       * {
       *   course_id: "...",
       *   questions: {
       *     questionId: { ... }
       *   }
       * }
       */
      if (
        parsed.course_id !== courseId ||
        !isRecord(parsed.questions)
      ) {
        throw new Error(
          "Question bundle is invalid",
        );
      }

      return parsed.questions as Record<
        string,
        StoredQuestion
      >;
    })();

    questionBundlePromises.set(
      courseId,
      promise,
    );
  }

  try {
    return await promise;
  } catch (error) {
    questionBundlePromises.delete(
      courseId,
    );
    throw error;
  }
}

async function loadAnswerKeyBundle(
  courseId: string,
): Promise<StoredAnswerKeyBundle> {
  let promise =
    answerKeyBundlePromises.get(courseId);

  if (!promise) {
    promise = (async () => {
      const entry =
        await getCompetitionRegistryEntry(
          courseId,
        );

      if (!entry) {
        throw new Error(
          "Competition is not configured",
        );
      }

      const { data, error } =
        await supabase.storage
          .from(SUPABASE_BUCKET)
          .download(
            entry.answer_key_bundle,
          );

      if (error || !data) {
        console.error(
          "Supabase answer-key bundle download failed:",
          error?.message ||
            "No data returned",
        );

        throw new Error(
          "Answer-key bundle is unavailable",
        );
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(
          await data.text(),
        );
      } catch {
        throw new Error(
          "Answer-key bundle is invalid JSON",
        );
      }

      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error(
          "Answer-key bundle has an invalid format",
        );
      }

      return parsed as StoredAnswerKeyBundle;
    })();

    answerKeyBundlePromises.set(
      courseId,
      promise,
    );
  }

  try {
    return await promise;
  } catch (error) {
    answerKeyBundlePromises.delete(
      courseId,
    );
    throw error;
  }
}

async function loadAnswerKey(
  questionId: string,
  courseId: string,
) {
  const bundle =
    await loadAnswerKeyBundle(courseId);

  return bundle[questionId] ?? null;
}

function validQuestion(
  question: StoredQuestion | undefined,
  courseId: string,
  questionId: string,
) {
  return (
    !!question &&
    question.question_id === questionId &&
    question.course_id === courseId &&
    question.question_type ===
      "Multiple Choice" &&
    Array.isArray(question.options) &&
    question.options.length === 4 &&
    new Set(question.options).size === 4 &&
    question.options.every(
      (option: unknown) =>
        typeof option === "string" &&
        option.trim() !== "",
    )
  );
}

function normalizeAnswer(
  value: unknown,
) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isSafeId(
  value: string,
) {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function getSelectedQuestionIds(
  attempt: any,
): string[] {
  const value = attempt?.question_ids;

  if (Array.isArray(value)) {
    return value
      .map((item: unknown) =>
        String(item),
      )
      .filter(Boolean);
  }

  /*
   * question_ids is jsonb in the existing
   * Postgres schema. Supabase normally returns
   * it as a JavaScript array.
   */
  return [];
}

async function loadAttempt(
  attemptId: string,
  studentId: string,
) {
  const { data, error } =
    await supabase
      .from("competition_mock_attempts")
      .select(
        [
          "id",
          "student_id",
          "course_id",
          "status",
          "question_ids",
          "is_mock",
          "score",
          "max_score",
          "submitted_at",
          "scored_at",
        ].join(","),
      )
      .eq("id", attemptId)
      .eq("student_id", studentId)
      .eq("is_mock", true)
      .maybeSingle();

  if (error) {
    console.error(
      "Mock attempt lookup failed:",
      error,
    );

    throw new Error(
      "Unable to load mock attempt",
    );
  }

  if (!data) {
    return {
      error: json(
        { error: "Mock attempt not found" },
        404,
      ),
    };
  }

  if (
    !data.course_id ||
    !isSafeId(String(data.course_id))
  ) {
    return {
      error: json(
        {
          error:
            "Competition course is missing",
        },
        500,
      ),
    };
  }

  const selectedQuestionIds =
    getSelectedQuestionIds(data);

  if (
    selectedQuestionIds.length !== 30 ||
    new Set(selectedQuestionIds).size !== 30 ||
    selectedQuestionIds.some(
      (id) => !isSafeId(id),
    )
  ) {
    return {
      error: json(
        {
          error:
            "Mock attempt has an invalid question set",
        },
        409,
      ),
    };
  }

  return {
    attempt: data,
    courseId: String(
      data.course_id,
    ),
    selectedQuestionIds,
  };
}

async function loadStoredAnswers(
  attemptId: string,
) {
  const { data, error } =
    await supabase
      .from("competition_mock_answers")
      .select(
        [
          "question_id",
          "answer",
          "is_correct",
          "correct_answer",
          "correct_option_index",
          "explanation",
          "marks_awarded",
          "answered_at",
        ].join(","),
      )
      .eq("attempt_id", attemptId);

  if (error) {
    console.error(
      "Mock answer lookup failed:",
      error,
    );

    throw new Error(
      "Unable to load mock answers",
    );
  }

  return data ?? [];
}

function answerResponse(row: any) {
  return {
    questionId: row.question_id,
    answer: row.answer,
    correct: row.is_correct === true,
    correctAnswer:
      row.correct_answer ?? "",
    correctOptionIndex:
      row.correct_option_index ===
        null ||
      row.correct_option_index ===
        undefined
        ? undefined
        : row.correct_option_index,
    explanation:
      row.explanation ?? "",
    marksAwarded: Number(
      row.marks_awarded ?? 0,
    ),
    answeredAt:
      row.answered_at ?? null,
  };
}

async function evaluateAnswer(
  questionId: string,
  courseId: string,
  submittedAnswer: string,
) {
  const questions =
    await loadQuestionBundle(courseId);

  const question =
    questions[questionId];

  if (
    !validQuestion(
      question,
      courseId,
      questionId,
    )
  ) {
    throw new Error(
      "Mock question is unavailable",
    );
  }

  const answerKey =
    await loadAnswerKey(
      questionId,
      courseId,
    );

  if (!answerKey) {
    throw new Error(
      "Answer key is unavailable",
    );
  }

  const correctAnswer =
    String(answerKey.answer ?? "");

  const correctOptionIndex =
    Number(
      answerKey.correct_option_index ??
        -1,
    );

  const explanation =
    String(
      answerKey.explanation ?? "",
    );

  if (!correctAnswer) {
    throw new Error(
      "Answer key is invalid",
    );
  }

  if (
    correctOptionIndex >= 0 &&
    correctOptionIndex >=
      question!.options.length
  ) {
    throw new Error(
      "Answer key option index is invalid",
    );
  }

  const correct =
    normalizeAnswer(
      submittedAnswer,
    ) ===
    normalizeAnswer(
      correctAnswer,
    );

  const marks =
    Number(question!.marks ?? 0);

  return {
    correct,
    correctAnswer,
    correctOptionIndex:
      correctOptionIndex >= 0
        ? correctOptionIndex
        : null,
    explanation,
    marksAwarded:
      correct ? marks : 0,
    marks,
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
      return json(
        { error: "Method not allowed" },
        405,
      );
    }

    const firebaseToken =
      getBearerToken(req);

    if (!firebaseToken) {
      return json(
        { error: "Authentication required" },
        401,
      );
    }

    const studentId =
      await verifyFirebaseUser(
        firebaseToken,
      );

    let body: any = {};

    try {
      body = await req.json();
    } catch {
      return json(
        { error: "Invalid JSON request body." },
        400,
      );
    }

    const action =
      typeof body?.action === "string"
        ? body.action.trim()
        : "";

    if (
      action !== "check_answer" &&
      action !== "save_answer" &&
      action !== "submit_mock"
    ) {
      return json(
        {
          error:
            'action must be "check_answer", "save_answer" or "submit_mock"',
        },
        400,
      );
    }

    const attemptId =
      typeof body?.attemptId === "string"
        ? body.attemptId.trim()
        : "";

    if (
      !attemptId ||
      !isSafeId(
        attemptId.replaceAll("-", ""),
      )
    ) {
      return json(
        {
          error:
            "Valid attemptId is required",
        },
        400,
      );
    }

    const attemptData =
      await loadAttempt(
        attemptId,
        studentId,
      );

    if ("error" in attemptData) {
      return attemptData.error;
    }

    const {
      attempt,
      courseId,
      selectedQuestionIds,
    } = attemptData;

    const selectedQuestionSet =
      new Set(selectedQuestionIds);

    // The browser timer is only UX. Enforce the same time limit on the
    // server so a direct API call cannot continue an expired mock attempt.
    const mockQuestions =
      await loadQuestionBundle(courseId);
    let allowedSeconds = 0;

    for (const questionId of selectedQuestionIds) {
      const question = mockQuestions[questionId];

      if (!validQuestion(question, courseId, questionId)) {
        return json(
          { error: "One or more mock questions are unavailable" },
          409,
        );
      }

      allowedSeconds += Math.max(
        1,
        Number(question.time_seconds) || 60,
      );
    }

    const startedAt =
      new Date(String(attempt.started_at)).getTime();

    if (!Number.isFinite(startedAt)) {
      return json(
        { error: "Mock attempt has an invalid start time." },
        409,
      );
    }

    const elapsedSeconds = Math.floor(
      (Date.now() - startedAt) / 1000,
    );

    if (elapsedSeconds > allowedSeconds + 30) {
      return json(
        { error: "Mock test time has expired." },
        409,
      );
    }

    if (action === "check_answer" || action === "save_answer") {
      const questionId =
        typeof body?.questionId === "string"
          ? body.questionId.trim()
          : "";

      const submittedAnswer =
        String(
          body?.answer ?? "",
        ).trim();

      if (
        !questionId ||
        !isSafeId(questionId)
      ) {
        return json(
          {
            error:
              "Valid questionId is required",
          },
          400,
        );
      }

      if (
        !selectedQuestionSet.has(
          questionId,
        )
      ) {
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
          {
            error:
              "An answer is required",
          },
          400,
        );
      }

      /*
       * First answer wins.
       * Once a row exists, never overwrite it.
       */
      const { data: existingAnswer,
        error: existingAnswerError } =
        await supabase
          .from("competition_mock_answers")
          .select(
            [
              "question_id",
              "answer",
              "is_correct",
              "correct_answer",
              "correct_option_index",
              "explanation",
              "marks_awarded",
              "answered_at",
            ].join(","),
          )
          .eq("attempt_id", attemptId)
          .eq("question_id", questionId)
          .maybeSingle();

      if (existingAnswerError) {
        console.error(
          "Existing mock answer lookup failed:",
          existingAnswerError,
        );

        throw new Error(
          "Unable to load saved mock answer",
        );
      }

      if (existingAnswer && action === "check_answer") {
        return json({
          ok: true,
          action: "check_answer",
          ...answerResponse(
            existingAnswer,
          ),
          alreadyAnswered: true,
        });
      }

      if (
        attempt.status !==
        "in_progress"
      ) {
        return json(
          {
            error:
              "This mock attempt has already been submitted",
          },
          409,
        );
      }

      const evaluated =
        await evaluateAnswer(
          questionId,
          courseId,
          submittedAnswer,
        );

      const now =
        new Date().toISOString();

      const { data: insertedAnswer,
        error: insertAnswerError } =
        await supabase
          .from("competition_mock_answers")
          .upsert({
            attempt_id: attemptId,
            question_id: questionId,
            answer: submittedAnswer,
            is_correct:
              evaluated.correct,
            correct_answer:
              evaluated.correctAnswer,
            correct_option_index:
              evaluated.correctOptionIndex,
            explanation:
              evaluated.explanation,
            marks_awarded:
              evaluated.marksAwarded,
            answered_at: now,
            updated_at: now,
          })
          .select(
            [
              "question_id",
              "answer",
              "is_correct",
              "correct_answer",
              "correct_option_index",
              "explanation",
              "marks_awarded",
              "answered_at",
            ].join(","),
          )
          .maybeSingle();

      if (
        !insertAnswerError &&
        insertedAnswer
      ) {
        return json({
          ok: true,
          action: "check_answer",
          ...answerResponse(
            insertedAnswer,
          ),
          alreadyAnswered: false,
        });
      }

      /*
       * Two simultaneous requests can race.
       * The unique constraint makes exactly one answer win.
       */
      if (
        insertAnswerError?.code !==
        "23505"
      ) {
        console.error(
          "Mock answer insert failed:",
          insertAnswerError,
        );

        throw new Error(
          "Unable to save mock answer",
        );
      }

      const { data: winningAnswer,
        error: winningAnswerError } =
        await supabase
          .from("competition_mock_answers")
          .select(
            [
              "question_id",
              "answer",
              "is_correct",
              "correct_answer",
              "correct_option_index",
              "explanation",
              "marks_awarded",
              "answered_at",
            ].join(","),
          )
          .eq("attempt_id", attemptId)
          .eq("question_id", questionId)
          .maybeSingle();

      if (
        winningAnswerError ||
        !winningAnswer
      ) {
        throw new Error(
          "Unable to resolve saved mock answer",
        );
      }

      return json({
        ok: true,
        action: "check_answer",
        ...answerResponse(
          winningAnswer,
        ),
        alreadyAnswered: true,
      });
    }

    const submittedAnswers =
      Array.isArray(body?.answers)
        ? body.answers.map(
            (item: any) => ({
              questionId:
                typeof item?.questionId ===
                "string"
                  ? item.questionId.trim()
                  : "",
              answer: String(
                item?.answer ?? "",
              ).trim(),
            }),
          )
        : null;

    if (!submittedAnswers) {
      return json(
        {
          error:
            "answers must be an array",
        },
        400,
      );
    }

    if (
      submittedAnswers.length > 30
    ) {
      return json(
        { error: "Too many answers" },
        400,
      );
    }

    const answerIds =
      new Set<string>();

    for (
      const item of submittedAnswers
    ) {
      if (
        !isSafeId(item.questionId)
      ) {
        return json(
          {
            error:
              "Invalid question ID",
          },
          400,
        );
      }

      if (
        answerIds.has(
          item.questionId,
        )
      ) {
        return json(
          {
            error:
              `Duplicate answer for ${item.questionId}`,
          },
          400,
        );
      }

      if (
        !selectedQuestionSet.has(
          item.questionId,
        )
      ) {
        return json(
          {
            error:
              `Question ${item.questionId} does not belong to this mock attempt`,
          },
          400,
        );
      }

      answerIds.add(
        item.questionId,
      );
    }

    /*
     * Idempotent submit.
     * If the attempt was already submitted,
     * return the stored Postgres result.
     */
    if (
      attempt.status !==
      "in_progress"
    ) {
      const storedAnswers =
        await loadStoredAnswers(
          attemptId,
        );

      return json({
        ok: true,
        attemptId,
        score: Number(
          attempt.score ?? 0,
        ),
        maxScore: Number(
          attempt.max_score ?? 0,
        ),
        answeredCount:
          storedAnswers.filter(
            (row: any) =>
              String(
                row.answer ?? "",
              ).trim() !== "",
          ).length,
        submitted: true,
        alreadySubmitted: true,
      });
    }

    /*
     * submit_mock can receive answers directly.
     * Existing answer rows are never overwritten.
     */
    for (
      const item of submittedAnswers
    ) {
      if (!item.answer) {
        continue;
      }

      const { data: existingAnswer,
        error: existingAnswerError } =
        await supabase
          .from("competition_mock_answers")
          .select(
            "question_id,answer",
          )
          .eq("attempt_id", attemptId)
          .eq(
            "question_id",
            item.questionId,
          )
          .maybeSingle();

      if (existingAnswerError) {
        throw new Error(
          "Unable to load saved mock answer",
        );
      }

      if (existingAnswer) {
        continue;
      }

      const evaluated =
        await evaluateAnswer(
          item.questionId,
          courseId,
          item.answer,
        );

      const now =
        new Date().toISOString();

      const { error:
        insertAnswerError } =
        await supabase
          .from("competition_mock_answers")
          .insert({
            attempt_id: attemptId,
            question_id:
              item.questionId,
            answer: item.answer,
            is_correct:
              evaluated.correct,
            correct_answer:
              evaluated.correctAnswer,
            correct_option_index:
              evaluated.correctOptionIndex,
            explanation:
              evaluated.explanation,
            marks_awarded:
              evaluated.marksAwarded,
            answered_at: now,
            updated_at: now,
          }, {
            onConflict: "attempt_id,question_id",
          });

      if (insertAnswerError) {
        console.error(
          "Mock submit answer insert failed:",
          insertAnswerError,
        );

        throw new Error(
          "Unable to save mock answer",
        );
      }

      if (action === "save_answer") {
        return json({ ok: true, action: "save_answer", questionId });
      }
    }

    const storedAnswers =
      await loadStoredAnswers(
        attemptId,
      );

    const questions =
      await loadQuestionBundle(
        courseId,
      );

    let maxScore = 0;

    for (
      const questionId of
        selectedQuestionIds
    ) {
      const question =
        questions[questionId];

      if (
        !validQuestion(
          question,
          courseId,
          questionId,
        )
      ) {
        return json(
          {
            error:
              "One or more mock questions are unavailable",
          },
          409,
        );
      }

      maxScore += Number(
        question.marks ?? 0,
      );
    }

    const score =
      storedAnswers.reduce(
        (
          total: number,
          row: any,
        ) =>
          total +
          Number(
            row.marks_awarded ?? 0,
          ),
        0,
      );

    const answeredCount =
      storedAnswers.filter(
        (row: any) =>
          String(
            row.answer ?? "",
          ).trim() !== "",
      ).length;

    const now =
      new Date().toISOString();

    /*
     * Atomic Postgres state transition:
     *
     * in_progress -> submitted
     *
     * Only one concurrent submit can
     * successfully perform this update.
     */
    const {
      data: updatedAttempt,
      error: updateError,
    } = await supabase
      .from(
        "competition_mock_attempts",
      )
      .update({
        status: "submitted",
        score,
        max_score: maxScore,
        submitted_at: now,
        scored_at: now,
        updated_at: now,
      })
      .eq("id", attemptId)
      .eq(
        "student_id",
        studentId,
      )
      .eq(
        "status",
        "in_progress",
      )
      .select(
        [
          "id",
          "score",
          "max_score",
          "submitted_at",
          "scored_at",
          "status",
        ].join(","),
      )
      .maybeSingle();

    if (updateError) {
      console.error(
        "Mock attempt submit update failed:",
        updateError,
      );

      throw new Error(
        "Unable to submit mock attempt",
      );
    }

    if (!updatedAttempt) {
      const {
        data: committedAttempt,
        error: committedError,
      } = await supabase
        .from(
          "competition_mock_attempts",
        )
        .select(
          [
            "id",
            "status",
            "score",
            "max_score",
            "submitted_at",
            "scored_at",
          ].join(","),
        )
        .eq("id", attemptId)
        .eq(
          "student_id",
          studentId,
        )
        .maybeSingle();

      if (
        committedError ||
        !committedAttempt
      ) {
        throw new Error(
          "Unable to resolve mock submission",
        );
      }

      const finalAnswers =
        await loadStoredAnswers(
          attemptId,
        );

      return json({
        ok: true,
        attemptId,
        score: Number(
          committedAttempt.score ?? 0,
        ),
        maxScore: Number(
          committedAttempt.max_score ??
            0,
        ),
        answeredCount:
          finalAnswers.filter(
            (row: any) =>
              String(
                row.answer ?? "",
              ).trim() !== "",
          ).length,
        submitted: true,
        alreadySubmitted: true,
      });
    }

    /*
     * Preserve the existing Postgres result
     * table for compatibility.
     *
     * The Mock Test flow no longer uses
     * Postgres results.
     */
    const { error: resultError } =
      await supabase
        .from(
          "competition_mock_results",
        )
        .upsert(
          {
            student_id: studentId,
            attempt_id: attemptId,
            course_id: courseId,
            score,
            max_score: maxScore,
            answered_count:
              answeredCount,
            submitted_at: now,
            scored_at: now,
            is_mock: true,
          },
          {
            onConflict:
              "attempt_id",
          },
        );

    if (resultError) {
      /*
       * The attempt is already submitted,
       * so result compatibility failure
       * must not turn a successful submission
       * into a failed submission.
       */
      console.error(
        "Mock result compatibility write failed:",
        resultError,
      );
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
