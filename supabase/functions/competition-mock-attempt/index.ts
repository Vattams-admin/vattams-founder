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

const SUPABASE_BUCKET = "academia-course-materials";
// Access sync runs every 30 minutes; keep the authorization cache bounded to 1 hour so revocations cannot remain effective for half a day.
const CACHE_TTL_HOURS = 1;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

const firebaseJWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

type CompetitionRegistryEntry = {
  course_id: string;
  competition: string;
  slug: string;
  question_bundle: string;
  answer_key_bundle?: string;
  age_pools: string;
  per_attempt?: number;
  selection_blueprint?: SelectionBlueprint;
  enabled: boolean;
};

type CompetitionRegistry = {
  version: number;
  competitions: Record<string, CompetitionRegistryEntry>;
};

type AgePoolQuestion =
  | string
  | {
      id?: string;
      question_id?: string;
      [key: string]: unknown;
    };

type AgePools = Record<
  string,
  Record<string, AgePoolQuestion[]>
>;

type MockAttemptRow = {
  id: string;
  student_id: string;
  course_id: string;
  status: "in_progress" | "submitted" | string;
  started_at: string;
  question_ids: string[] | null;
  is_mock: boolean;
};

type MockAnswerRow = {
  question_id: string;
  answer: string | null;
  is_correct: boolean | null;
  correct_answer: string | null;
  correct_option_index: number | null;
  explanation: string | null;
  marks_awarded: number | null;
};

async function verifyFirebaseToken(
  authorization: string | null,
): Promise<string> {
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Missing authorization token");
  }

  if (!FIREBASE_PROJECT_ID) {
    throw new Error("Firebase project configuration missing");
  }

  const token = authorization.slice("Bearer ".length).trim();

  const { payload } = await jwtVerify(
    token,
    firebaseJWKS,
    {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    },
  );

  const uid = typeof payload.sub === "string"
    ? payload.sub
    : "";

  if (!uid) {
    throw new Error("Invalid Firebase token");
  }

  return uid;
}

async function loadCompetitionRegistry(): Promise<CompetitionRegistry> {
  const { data, error } = await supabase.storage.from(SUPABASE_BUCKET).download("competitions/registry.json");
  if (error || !data) throw new Error(`Unable to load competition registry: ${error?.message || "missing file"}`);
  return JSON.parse(await data.text()) as CompetitionRegistry;
}

async function getCompetition(
  courseId: string,
): Promise<CompetitionRegistryEntry> {
  const registry = await loadCompetitionRegistry();

  const entry = registry.competitions?.[courseId];

  if (!entry || !entry.enabled) {
    throw new Error("Competition is not enabled");
  }

  if (
    entry.course_id !== courseId ||
    !entry.question_bundle ||
    !entry.age_pools
  ) {
    throw new Error("Competition configuration is incomplete");
  }

  return entry;
}

async function loadAgePools(
  path: string,
): Promise<AgePools> {
  const { data, error } =
    await supabase.storage
      .from(SUPABASE_BUCKET)
      .download(path);

  if (error || !data) {
    throw new Error(
      `Unable to load age pools: ${error?.message || "missing file"}`,
    );
  }

  return JSON.parse(
    await data.text(),
  ) as AgePools;
}

function calculateAge(
  dateOfBirth: string,
): number {
  const dob = new Date(`${dateOfBirth}T00:00:00Z`);
  const now = new Date();

  let age =
    now.getUTCFullYear() -
    dob.getUTCFullYear();

  const month =
    now.getUTCMonth() -
    dob.getUTCMonth();

  if (
    month < 0 ||
    (
      month === 0 &&
      now.getUTCDate() < dob.getUTCDate()
    )
  ) {
    age--;
  }

  return age;
}

function getAgeBand(age: number): string {
  if (age <= 8) return "up_to_8";
  if (age <= 12) return "age_9_12";
  if (age <= 15) return "age_13_15";
  return "age_16_plus";
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(
      Math.random() * (i + 1),
    );

    [result[i], result[j]] =
      [result[j], result[i]];
  }

  return result;
}

/*
 * Runtime selection blueprint is stored with each competition registry entry.
 * This keeps the mock engine competition-agnostic: no subject-specific
 * Thirukkural topics are embedded in the function.
 *
 * Registry format:
 *   selection_blueprint: {
 *     up_to_8: [["Topic A", 15], ["Topic B", 15]],
 *     age_9_12: [...]
 *   }
 *
 * If a bundle does not declare a blueprint, the runtime derives one from
 * the available age-pool topics, allocating the 30-question attempt as
 * evenly as possible. This is only a fallback for already-reviewed pools;
 * the production validator should require an explicit blueprint.
 */
type SelectionBlueprint = Record<string, Array<[string, number]>>;

function deriveBlueprint(
  agePools: AgePools,
  perAttempt: number,
): SelectionBlueprint {
  const result: SelectionBlueprint = {};

  for (const [ageBand, topics] of Object.entries(agePools)) {
    const names = Object.keys(topics || {}).filter(
      (topic) => Array.isArray(topics[topic]) && topics[topic].length > 0,
    );

    if (names.length === 0) {
      throw new Error(`No usable topics in age pool: ${ageBand}`);
    }

    const base = Math.floor(perAttempt / names.length);
    let remainder = perAttempt % names.length;

    result[ageBand] = names.map((topic) => {
      const count = base + (remainder-- > 0 ? 1 : 0);
      return [topic, count];
    });
  }

  return result;
}

function getBlueprint(
  competition: CompetitionRegistryEntry,
  agePools: AgePools,
): SelectionBlueprint {
  if (competition.selection_blueprint) {
    return competition.selection_blueprint;
  }

  return deriveBlueprint(
    agePools,
    competition.per_attempt || 30,
  );
}

function getQuestionId(
  question: AgePoolQuestion,
): string {
  // The generated Thirukkural age-pools.json stores question IDs
  // directly as strings. Keep compatibility with object-form pools
  // so older bundles cannot break the Mock Test runtime.
  if (typeof question === "string") {
    const id = question.trim();

    if (!id) {
      throw new Error("Age pool contains question without ID");
    }

    return id;
  }

  const id =
    typeof question.id === "string"
      ? question.id.trim()
      : typeof question.question_id === "string"
        ? question.question_id.trim()
        : "";

  if (!id) {
    throw new Error("Age pool contains question without ID");
  }

  return id;
}

function selectQuestions(
  agePools: AgePools,
  ageBand: string,
  blueprintByAgeBand: SelectionBlueprint,
): string[] {
  const blueprint = blueprintByAgeBand[ageBand];

  if (!blueprint) {
    throw new Error(`Unsupported age band: ${ageBand}`);
  }

  const selected: string[] = [];
  const selectedSet = new Set<string>();

  for (const [topic, count] of blueprint) {
    const pool =
      agePools?.[ageBand]?.[topic];

    if (!Array.isArray(pool)) {
      throw new Error(
        `Missing age pool: ${ageBand}/${topic}`,
      );
    }

    const shuffled = shuffle(pool);

    let added = 0;

    for (const question of shuffled) {
      const id = getQuestionId(question);

      if (selectedSet.has(id)) {
        continue;
      }

      selectedSet.add(id);
      selected.push(id);
      added++;

      if (added === count) {
        break;
      }
    }

    if (added !== count) {
      throw new Error(
        `Insufficient unique questions for ${ageBand}/${topic}`,
      );
    }
  }

  if (selected.length !== 30) {
    throw new Error(
      `Expected 30 unique questions, got ${selected.length}`,
    );
  }

  return shuffle(selected);
}

class MockAccessError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.name = "MockAccessError";
    this.status = status;
  }
}

async function getCachedAccess(
  studentId: string,
  courseId: string,
) {
  const { data, error } =
    await supabase
      .from("competition_access_cache")
      .select(
        "student_id,course_id,is_admin,enrolment_active,date_of_birth,checked_at",
      )
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .maybeSingle();

  if (error) {
    throw new Error(
      `Access cache lookup failed: ${error.message}`,
    );
  }

  if (!data) {
    throw new MockAccessError(
      "Your competition access is not activated yet. Please try again shortly.",
    );
  }

  const checkedAt =
    new Date(data.checked_at).getTime();

  const ageMs =
    Date.now() - checkedAt;

  if (
    !Number.isFinite(checkedAt) ||
    checkedAt > Date.now() + 60_000
  ) {
    throw new MockAccessError(
      "Your competition access information is out of date. Please try again shortly.",
    );
  }

  if (
    ageMs >
    CACHE_TTL_HOURS * 60 * 60 * 1000
  ) {
    throw new MockAccessError(
      "Your competition access information is out of date. Please try again shortly.",
    );
  }

  if (
    !data.date_of_birth ||
    (!data.is_admin && !data.enrolment_active)
  ) {
    throw new MockAccessError(
      "You do not have access to this competition.",
    );
  }

  const dateOfBirth = new Date(
    `${String(data.date_of_birth)}T00:00:00.000Z`,
  );
  const now = new Date();
  const oldestAllowed = new Date(now);
  oldestAllowed.setUTCFullYear(
    oldestAllowed.getUTCFullYear() - 120,
  );

  if (
    !Number.isFinite(dateOfBirth.getTime()) ||
    dateOfBirth > now ||
    dateOfBirth < oldestAllowed
  ) {
    throw new MockAccessError(
      "You do not have access to this competition.",
    );
  }

  return data;
}

async function resolveAccess(
  studentId: string,
  courseId: string,
) {
  const cached =
    await getCachedAccess(
      studentId,
      courseId,
    );

  return {
    dateOfBirth:
      cached.date_of_birth,
  };
}

async function findActiveAttempt(
  studentId: string,
  courseId: string,
) {
  const { data, error } =
    await supabase
      .from("competition_mock_attempts")
      .select(
        "id,student_id,course_id,status,started_at,question_ids,is_mock",
      )
      .eq("student_id", studentId)
      .eq("course_id", courseId)
      .eq("is_mock", true)
      .eq("status", "in_progress")
      .maybeSingle();

  if (error) {
    throw new Error(
      `Attempt lookup failed: ${JSON.stringify({
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })}`,
    );
  }

  return data as MockAttemptRow | null;
}

async function loadAnswers(
  attemptId: string,
) {
  const { data, error } =
    await supabase
      .from("competition_mock_answers")
      .select(
        "question_id,answer,is_correct,correct_answer,correct_option_index,explanation,marks_awarded",
      )
      .eq("attempt_id", attemptId);

  if (error) {
    throw new Error(
      `Answer lookup failed: ${error.message}`,
    );
  }

  return (data || []) as MockAnswerRow[];
}

async function attemptResponse(
  attempt: MockAttemptRow,
) {
  const answers =
    await loadAnswers(attempt.id);

  // During an in-progress attempt, never return scoring metadata to the
  // student. These rows also contain the answer key/explanation fields
  // used by the scoring service. Returning them here would disclose the
  // answers on resume before the student submits each question.
  const studentAnswers = answers.map((answer) => ({
    question_id: answer.question_id,
    answer: answer.answer,
  }));

  return {
    attempt_id: attempt.id,
    course_id: attempt.course_id,
    status: attempt.status,
    started_at: attempt.started_at,
    question_ids: attempt.question_ids || [],
    answers: studentAnswers,
  };
}

async function startOrResume(
  studentId: string,
  courseId: string,
) {
  const competition =
    await getCompetition(courseId);

  const access =
    await resolveAccess(
      studentId,
      courseId,
    );

  const existing =
    await findActiveAttempt(
      studentId,
      courseId,
    );

  if (existing) {
    return attemptResponse(existing);
  }

  if (!access.dateOfBirth) {
    throw new Error(
      "Date of birth is required before starting the Mock Test",
    );
  }

  const age =
    calculateAge(
      access.dateOfBirth,
    );

  if (age < 0 || age > 120) {
    throw new Error(
      "Invalid date of birth",
    );
  }

  const ageBand =
    getAgeBand(age);

  const agePools =
    await loadAgePools(
      competition.age_pools,
    );

  const blueprintByAgeBand = getBlueprint(
    competition,
    agePools,
  );

  const questionIds =
    selectQuestions(
      agePools,
      ageBand,
      blueprintByAgeBand,
    );

  const { data, error } =
    await supabase
      .from("competition_mock_attempts")
      .insert({
        student_id: studentId,
        course_id: courseId,
        status: "in_progress",
        started_at: new Date().toISOString(),
        question_ids: questionIds,
        is_mock: true,
        age_band: ageBand,
      })
      .select(
        "id,student_id,course_id,status,started_at,question_ids,is_mock",
      )
      .single();

  if (error) {
    if (error.code === "23505") {
      const raced =
        await findActiveAttempt(
          studentId,
          courseId,
        );

      if (raced) {
        return attemptResponse(raced);
      }
    }

    throw new Error(
      `Unable to create Mock Test attempt: ${error.message}`,
    );
  }

  return attemptResponse(
    data as MockAttemptRow,
  );
}

function jsonResponse(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders(),
        "Content-Type":
          "application/json",
      },
    },
  );
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods":
      "POST, OPTIONS",
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(
      "ok",
      {
        headers: corsHeaders(),
      },
    );
  }

  try {
    const studentId =
      await verifyFirebaseToken(
        request.headers.get(
          "Authorization",
        ),
      );

    const body =
      await request.json();

    const action =
      body?.action || "start_or_resume";

    if (action !== "start_or_resume") {
      return jsonResponse(
        {
          error:
            "Unsupported action",
        },
        400,
      );
    }

    const courseId =
      typeof body?.course_id === "string"
        ? body.course_id.trim()
        : "";

    if (!courseId) {
      return jsonResponse(
        {
          error:
            "course_id is required",
        },
        400,
      );
    }

    const result =
      await startOrResume(
        studentId,
        courseId,
      );

    return jsonResponse(
      result,
      200,
    );
  } catch (error) {
    console.error(
      "competition-mock-attempt error",
      error,
    );

    const status =
      error instanceof MockAccessError
        ? error.status
        : 400;

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Mock Test",
      },
      status,
    );
  }
});
