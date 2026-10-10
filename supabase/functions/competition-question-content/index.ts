import {
  createRemoteJWKSet,
  jwtVerify,
} from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const QUESTION_COUNT = 30;
const SUPABASE_BUCKET = "academia-course-materials";
const REGISTRY_PATH = "competitions/registry.json";

const PUBLIC_FIELDS = [
  "question_id",
  "competition",
  "course_id",
  "age_band",
  "topic",
  "subtopic",
  "question",
  "question_type",
  "options",
  "difficulty",
  "skill",
  "marks",
  "time_seconds",
  "language",
  "review_status",
] as const;

type StoredQuestion = Record<string, any>;

type CompetitionRegistry = Record<string, any>;

let storageJsonCache = new Map<string, Promise<unknown>>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim() || null;
}

const FIREBASE_PROJECT_ID =
  Deno.env.get("FIREBASE_PROJECT_ID") ||
  Deno.env.get("VITE_FIREBASE_PROJECT_ID") ||
  "";

if (!FIREBASE_PROJECT_ID) {
  throw new Error("Firebase project ID is unavailable");
}

const firebaseJWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

async function verifyFirebaseToken(token: string) {
  const issuer =
    `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

  const { payload } = await jwtVerify(
    token,
    firebaseJWKS,
    {
      issuer,
      audience: FIREBASE_PROJECT_ID,
    },
  );

  if (!payload.sub) {
    throw new Error("Firebase token has no subject");
  }

  return {
    uid: payload.sub,
  };
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseSecretKey =
  Deno.env.get("SUPABASE_SECRET_KEYS")
    ? (() => {
        try {
          const parsed = JSON.parse(
            Deno.env.get("SUPABASE_SECRET_KEYS")!,
          );

          return parsed?.default ?? "";
        } catch {
          return "";
        }
      })()
    : "";

if (!supabaseUrl || !supabaseSecretKey) {
  throw new Error("Supabase server credentials are unavailable");
}

const supabase = createClient(
  supabaseUrl,
  supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

async function loadStorageJson(path: string): Promise<any> {
  const cached = storageJsonCache.get(path);

  if (cached) {
    return await cached;
  }

  const pending = (async () => {
    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .download(path);

    if (error || !data) {
      console.error(
        "Storage download failed:",
        path,
        error?.message || "No data",
      );

      throw new Error("Competition content is unavailable");
    }

    try {
      return JSON.parse(await data.text());
    } catch {
      throw new Error("Competition content is invalid JSON");
    }
  })();

  storageJsonCache.set(path, pending);

  try {
    return await pending;
  } catch (error) {
    storageJsonCache.delete(path);
    throw error;
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

async function loadCompetitionSlug(
  courseId: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download(REGISTRY_PATH);
  if (error || !data) throw new Error("Competition registry is unavailable");
  let registry: unknown;
  try { registry = JSON.parse(await data.text()); } catch { throw new Error("Competition registry is invalid"); }

  if (!isRecord(registry)) {
    throw new Error("Competition registry is invalid");
  }

  const entry = registry.competitions?.[courseId];

  if (
    !isRecord(entry) ||
    entry.enabled !== true ||
    typeof entry.slug !== "string" ||
    !/^[a-z0-9-]+$/.test(entry.slug)
  ) {
    return null;
  }

  return entry.slug;
}

async function loadQuestionBundle(
  slug: string,
  courseId: string,
): Promise<Record<string, StoredQuestion>> {
  const bundle = await loadStorageJson(
    `competitions/${slug}/objective/questions.private.json`,
  );

  if (
    !isRecord(bundle) ||
    bundle.course_id !== courseId ||
    !isRecord(bundle.questions)
  ) {
    throw new Error("Question bundle is invalid");
  }

  return bundle.questions as Record<string, StoredQuestion>;
}

function validQuestion(
  question: StoredQuestion | undefined,
  courseId: string,
  questionId: string,
): boolean {
  return (
    !!question &&
    question.question_id === questionId &&
    question.course_id === courseId &&
    question.question_type === "Multiple Choice" &&
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

function publicQuestion(question: StoredQuestion) {
  const result: Record<string, unknown> = {};

  for (const field of PUBLIC_FIELDS) {
    result[field] = question[field];
  }

  return result;
}


async function hasActiveCompetitionAccess(studentId: string, courseId: string): Promise<boolean> {
  const { data, error } = await supabase.from("competition_access_cache")
    .select("student_id,course_id,is_admin,enrolment_active,checked_at")
    .eq("student_id", studentId).eq("course_id", courseId).maybeSingle();
  if (error) throw new Error("Unable to verify competition access.");
  if (!data || (!data.is_admin && !data.enrolment_active)) return false;
  const checkedAt = new Date(data.checked_at).getTime();
  return Number.isFinite(checkedAt) && checkedAt <= Date.now() + 60_000 && Date.now() - checkedAt <= 60 * 60 * 1000;
}

async function authorizeByAttempt(
  attemptId: string,
  uid: string,
  courseId: string,
  questionIds: string[],
): Promise<Response | null> {
  const { data: attempt, error } =
    await supabase
      .from("competition_mock_attempts")
      .select(
        "id,student_id,course_id,status,question_ids,is_mock",
      )
      .eq("id", attemptId)
      .eq("is_mock", true)
      .maybeSingle();

  if (error) {
    return json(
      {
        error:
          `Mock attempt lookup failed: ${error.message}`,
      },
      500,
    );
  }

  if (!attempt) {
    return json(
      { error: "Mock attempt not found." },
      404,
    );
  }

  if (
    attempt.student_id !== uid ||
    attempt.course_id !== courseId
  ) {
    return json(
      {
        error:
          "This mock attempt does not belong to you.",
      },
      403,
    );
  }

  if (attempt.status !== "in_progress") {
    return json(
      {
        error:
          "This mock attempt is no longer in progress.",
      },
      409,
    );
  }

  if (!(await hasActiveCompetitionAccess(uid, courseId))) {
    return json({ error: "You no longer have access to this competition." }, 403);
  }

  const saved = Array.isArray(attempt.question_ids)
    ? attempt.question_ids
    : [];

  if (
    saved.length !== QUESTION_COUNT ||
    new Set(saved).size !== QUESTION_COUNT
  ) {
    return json(
      {
        error:
          "Mock attempt has an invalid question set.",
      },
      409,
    );
  }

  const savedSet = new Set(saved);

  for (const questionId of questionIds) {
    if (!savedSet.has(questionId)) {
      return json(
        {
          error:
            "Requested question is not part of this mock attempt.",
          question_id: questionId,
        },
        403,
      );
    }
  }

  return null;
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

    const firebaseToken = getBearerToken(req);

    if (!firebaseToken) {
      return json(
        { error: "Authentication required" },
        401,
      );
    }

    const firebaseUser =
      await verifyFirebaseToken(firebaseToken);

    let body: any = {};

    try {
      body = await req.json();
    } catch {
      return json(
        { error: "Invalid JSON request body." },
        400,
      );
    }

    const courseId =
      typeof body?.course_id === "string"
        ? body.course_id.trim()
        : "";

    const attemptId =
      typeof body?.attempt_id === "string"
        ? body.attempt_id.trim()
        : "";

    const questionIds: string[] =
      Array.isArray(body?.question_ids)
        ? body.question_ids.map((id: unknown) =>
            typeof id === "string" ? id.trim() : "",
          )
        : [];

    if (
      !courseId ||
      !/^[A-Za-z0-9_-]+$/.test(courseId)
    ) {
      return json(
        { error: "course_id is required." },
        400,
      );
    }

    if (!attemptId) {
      return json({ error: "attempt_id is required." }, 400);
    }

    if (
      !/^[A-Za-z0-9_-]+$/.test(attemptId)
    ) {
      return json(
        { error: "attempt_id is invalid." },
        400,
      );
    }

    if (
      questionIds.length !== QUESTION_COUNT ||
      new Set(questionIds).size !== QUESTION_COUNT ||
      questionIds.some(
        (id) => !/^[A-Za-z0-9_-]+$/.test(id),
      )
    ) {
      return json(
        {
          error:
            `question_ids must contain exactly ${QUESTION_COUNT} unique valid IDs.`,
        },
        400,
      );
    }

    /*
     * The question-pool function has already performed:
     * - competition authorization
     * - active-enrollment authorization
     * - DOB / age-band validation
     * - exact 30-question selection
     *
     * Therefore a fresh request does not repeat those checks.
     *
     * A resumed request uses the saved Postgres mock attempt
     * as the source of truth.
     */

    const denied = await authorizeByAttempt(
      attemptId,
      firebaseUser.uid,
      courseId,
      questionIds,
    );

    if (denied) {
      return denied;
    }

    const slug = await loadCompetitionSlug(courseId);

    if (!slug) {
      return json(
        {
          error:
            "Question bank is not configured for this competition yet.",
          course_id: courseId,
        },
        409,
      );
    }

    const questions = await loadQuestionBundle(
      slug,
      courseId,
    );

    const selected: Record<string, unknown>[] = [];

    for (const questionId of questionIds) {
      const question = questions[questionId];

      if (!validQuestion(question, courseId, questionId)) {
        return json(
          {
            error:
              "A selected question is unavailable.",
            question_id: questionId,
          },
          400,
        );
      }

      selected.push(publicQuestion(question));
    }

    return json({
      ok: true,
      course_id: courseId,
      competition_slug: slug,
      count: selected.length,
      questions: selected,
    });
  } catch (error) {
    console.error(
      "competition-question-content error:",
      error,
    );

    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load competition content.",
      },
      (error as { httpStatus?: number })?.httpStatus ?? 500,
    );
  }
});
