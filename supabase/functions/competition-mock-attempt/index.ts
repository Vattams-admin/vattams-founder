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
const CACHE_TTL_HOURS = 12;

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
  enabled: boolean;
};

type CompetitionRegistry = {
  version: number;
  competitions: Record<string, CompetitionRegistryEntry>;
};

type AgePoolQuestion = {
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

let registryPromise:
  Promise<CompetitionRegistry> | null = null;

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
  if (!registryPromise) {
    registryPromise = (async () => {
      const { data, error } =
        await supabase.storage
          .from(SUPABASE_BUCKET)
          .download("competitions/registry.json");

      if (error || !data) {
        throw new Error(
          `Unable to load competition registry: ${error?.message || "missing file"}`,
        );
      }

      return JSON.parse(
        await data.text(),
      ) as CompetitionRegistry;
    })();
  }

  return registryPromise;
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
 * Current configured competition blueprint.
 *
 * This is intentionally kept identical to the validated
 * Thirukkural Mock/Question-Pool blueprint already used
 * by the project.
 */
const BLUEPRINT: Record<
  string,
  Array<[string, number]>
> = {
  up_to_8: [
    ["Complete second line", 15],
    ["Identify Paal", 15],
  ],

  age_9_12: [
    ["Complete second line", 5],
    ["Identify Paal", 5],
    ["Complete Kural", 8],
    ["Identify Adhigaram", 3],
    ["Identify Iyal", 3],
    ["Chapter range", 6],
  ],

  age_13_15: [
    ["Complete Kural", 5],
    ["Identify Adhigaram", 5],
    ["Identify Iyal", 4],
    ["Chapter range", 2],
    ["Source meaning identification", 7],
    ["Identify source meaning", 7],
  ],

  age_16_plus: [
    ["Complete Kural", 3],
    ["Identify Adhigaram", 4],
    ["Identify Iyal", 3],
    ["Chapter range", 2],
    ["Source meaning identification", 9],
    ["Identify source meaning", 9],
  ],
};

function getQuestionId(
  question: AgePoolQuestion,
): string {
  const id =
    typeof question.id === "string"
      ? question.id
      : typeof question.question_id === "string"
        ? question.question_id
        : "";

  if (!id) {
    throw new Error("Age pool contains question without ID");
  }

  return id;
}

function selectQuestions(
  agePools: AgePools,
  ageBand: string,
): string[] {
  const blueprint = BLUEPRINT[ageBand];

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
    return null;
  }

  const checkedAt =
    new Date(data.checked_at).getTime();

  const ageMs =
    Date.now() - checkedAt;

  if (
    ageMs >
    CACHE_TTL_HOURS * 60 * 60 * 1000
  ) {
    return null;
  }

  return data;
}

function getFirebaseServiceAccount() {
  const raw =
    Deno.env.get("FIREBASE_SERVICE_ACCOUNT") ||
    Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON") ||
    "";

  if (!raw) {
    throw new Error(
      "Firebase service account configuration missing",
    );
  }

  return JSON.parse(raw);
}

function base64UrlDecode(value: string): Uint8Array {
  const padded =
    value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(
        Math.ceil(value.length / 4) * 4,
        "=",
      );

  const binary = atob(padded);

  return Uint8Array.from(
    binary,
    (char) => char.charCodeAt(0),
  );
}

async function firestoreGet(path: string) {
  const account = getFirebaseServiceAccount();

  const now = Math.floor(Date.now() / 1000);

  const header = btoa(
    JSON.stringify({
      alg: "RS256",
      typ: "JWT",
    }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const payload = btoa(
    JSON.stringify({
      iss: account.client_email,
      sub: account.client_email,
      aud: "https://firestore.googleapis.com/",
      iat: now,
      exp: now + 3600,
    }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const signingInput = `${header}.${payload}`;

  const keyData = base64UrlDecode(
    account.private_key
      .replace(
        "-----BEGIN PRIVATE KEY-----",
        "",
      )
      .replace(
        "-----END PRIVATE KEY-----",
        "",
      )
      .replace(/\s/g, ""),
  );

  const cryptoKey =
    await crypto.subtle.importKey(
      "pkcs8",
      keyData,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["sign"],
    );

  const signature =
    await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      cryptoKey,
      new TextEncoder().encode(signingInput),
    );

  const signatureText =
    btoa(
      String.fromCharCode(
        ...new Uint8Array(signature),
      ),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`,
    {
      headers: {
        Authorization:
          `Bearer ${signingInput}.${signatureText}`,
      },
    },
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Firestore access check failed: ${response.status}`,
    );
  }

  const document = await response.json();
  const fields = document.fields || {};
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(fields)) {
    const field = value as Record<string, unknown>;

    if ("stringValue" in field) {
      result[key] = field.stringValue;
    } else if ("booleanValue" in field) {
      result[key] = field.booleanValue;
    } else if ("integerValue" in field) {
      result[key] = Number(field.integerValue);
    } else if ("timestampValue" in field) {
      result[key] = field.timestampValue;
    } else {
      result[key] = null;
    }
  }

  return result;
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

  if (cached) {
    if (
      cached.is_admin ||
      cached.enrolment_active
    ) {
      return {
        dateOfBirth:
          cached.date_of_birth,
      };
    }

    throw new Error(
      "You do not have access to this competition",
    );
  }

  const admin =
    await firestoreGet(
      `admins/${studentId}`,
    );

  const enrolment =
    await firestoreGet(
      `enrolments/${studentId}_${courseId}`,
    );

  const student =
    await firestoreGet(
      `students/${studentId}`,
    );

  const isAdmin =
    admin !== null &&
    admin.is_active === true &&
    [
      "admin",
      "super_admin",
      "instructor",
    ].includes(
      typeof admin.role === "string"
        ? admin.role
        : "",
    );

  const enrolmentActive =
    enrolment !== null &&
    enrolment.status === "active";

  const dateOfBirth =
    typeof student?.date_of_birth === "string"
      ? student.date_of_birth
      : typeof student?.dob === "string"
        ? student.dob
        : null;

  const { error } =
    await supabase
      .from("competition_access_cache")
      .upsert(
        {
          student_id: studentId,
          course_id: courseId,
          is_admin: isAdmin,
          enrolment_active: enrolmentActive,
          date_of_birth: dateOfBirth,
          checked_at: new Date().toISOString(),
        },
        {
          onConflict:
            "student_id,course_id",
        },
      );

  if (error) {
    throw new Error(
      `Access cache write failed: ${error.message}`,
    );
  }

  if (!isAdmin && !enrolmentActive) {
    throw new Error(
      "You do not have access to this competition",
    );
  }

  return {
    dateOfBirth,
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
      `Attempt lookup failed: ${error.message}`,
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

  return {
    attempt_id: attempt.id,
    course_id: attempt.course_id,
    status: attempt.status,
    started_at: attempt.started_at,
    question_ids: attempt.question_ids || [],
    answers,
  };
}

async function startOrResume(
  studentId: string,
  courseId: string,
) {
  const existing =
    await findActiveAttempt(
      studentId,
      courseId,
    );

  if (existing) {
    return attemptResponse(existing);
  }

  const competition =
    await getCompetition(courseId);

  const access =
    await resolveAccess(
      studentId,
      courseId,
    );

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

  const questionIds =
    selectQuestions(
      agePools,
      ageBand,
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

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to start Mock Test",
      },
      400,
    );
  }
});
