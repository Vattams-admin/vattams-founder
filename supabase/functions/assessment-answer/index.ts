import { createRemoteJWKSet, jwtVerify } from "npm:jose@6";
import { createClient } from "npm:@supabase/supabase-js@2";

const FIREBASE_PROJECT_ID =
  Deno.env.get("FIREBASE_PROJECT_ID") ||
  Deno.env.get("VITE_FIREBASE_PROJECT_ID") ||
  "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SECRET_KEYS = JSON.parse(
  Deno.env.get("SUPABASE_SECRET_KEYS") || "{}",
);
const SUPABASE_SERVICE_ROLE_KEY = SUPABASE_SECRET_KEYS["default"] || "";

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const firebaseJWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com",
  ),
);

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
  const { payload } = await jwtVerify(token, firebaseJWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });

  const uid = typeof payload.sub === "string" ? payload.sub : "";
  if (!uid) throw new Error("Invalid Firebase token");
  return uid;
}

async function verifyActiveEnrollment(studentId: string, courseId: string, token: string) {
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/(default)/documents:runQuery`;
  const response = await fetch(base, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "enrolments" }],
        where: { compositeFilter: { op: "AND", filters: [
          { fieldFilter: { field: { fieldPath: "student_id" }, op: "EQUAL", value: { stringValue: studentId } } },
          { fieldFilter: { field: { fieldPath: "course_id" }, op: "EQUAL", value: { stringValue: courseId } } },
          { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } },
        ]}},
        limit: 1,
      },
    }),
  });
  if (!response.ok) throw new Error("Unable to verify course enrolment");
  const rows = await response.json();
  if (!(Array.isArray(rows) && rows.some((row: any) => row?.document))) {
    throw new Error("You no longer have access to this assessment");
  }
}

\nasync function canonicalSha256(value: unknown): Promise<string> {
  const canonical = JSON.stringify(value);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}


async function attemptIntegrityHash(attempt: any): Promise<string> {
  return canonicalSha256({ release_version: attempt.release_version, release_public_sha256: attempt.release_public_sha256, release_private_sha256: attempt.release_private_sha256, question_ids: attempt.question_ids, option_orders: attempt.option_orders });
}

async function verifyRegisteredBank(definition: any, publicParsed: unknown, privateParsed?: unknown): Promise<void> {
  if (typeof definition.bank_manifest !== "string" || !definition.bank_manifest) {
    throw new Error("Assessment bank manifest is not registered");
  }
  const manifestFile = await supabase.storage.from(SUPABASE_BUCKET).download(definition.bank_manifest);
  if (manifestFile.error || !manifestFile.data) throw new Error("Unable to load assessment bank manifest");
  const manifest = JSON.parse(await manifestFile.data.text());
  if (manifest.assessmentId !== definition.assessment_id || manifest.questionCount !== definition.question_count || manifest.answerKeyPrivate !== true) {
    throw new Error("Assessment bank manifest does not match registry");
  }
  if (definition.release_version !== manifest.version) throw new Error("Published assessment release version is not pinned to its bank manifest");
  if (definition.release_public_sha256 !== manifest.publicSha256 || definition.release_private_sha256 !== manifest.privateSha256) throw new Error("Published assessment release hashes do not match its bank manifest");
  if (manifest.publicBank !== definition.question_bank_public || manifest.privateAnswerKey !== definition.answer_key) {
    throw new Error("Assessment bank paths do not match registered manifest");
  }
  const publicHash = await canonicalSha256(publicParsed);
  if (publicHash !== manifest.publicSha256) throw new Error("Public assessment bank integrity check failed");
  if (privateParsed !== undefined) {
    const privateHash = await canonicalSha256(privateParsed);
    if (privateHash !== manifest.privateSha256) throw new Error("Private assessment answer-key integrity check failed");
  }
}

async function saveAnswer(
  studentId: string,
  attemptId: string,
  questionId: string,
  answer: string,
  selectedOptionIndex: number | null,
  token: string,
) {
  const { data: attempt, error: attemptError } = await supabase
    .from("assessment_attempts")
    .select("id,student_id,course_id,assessment_id,status,started_at,question_ids,option_orders,release_version,release_public_sha256,release_private_sha256,integrity_sha256,option_orders,expires_at")
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError) {
    throw new Error(`Attempt lookup failed: ${attemptError.message}`);
  }
  if (!attempt) throw new Error("Assessment attempt not found");
  if (attempt.student_id !== studentId) {
    throw new Error("Assessment attempt does not belong to this student");
  }
  if (!attempt.expires_at || !Number.isFinite(Date.parse(attempt.expires_at))) throw new Error("Assessment attempt has an invalid deadline");
  if (Date.now() >= Date.parse(attempt.expires_at)) throw new Error("Assessment attempt time has expired");

  if (!attempt.integrity_sha256 || await attemptIntegrityHash(attempt) !== attempt.integrity_sha256) throw new Error("Assessment attempt integrity check failed");
  await verifyActiveEnrollment(studentId, attempt.course_id, token);
  if (attempt.status !== "in_progress") {
    throw new Error("Assessment attempt is no longer active");
  }
  if (!attempt.expires_at || Date.now() >= Date.parse(attempt.expires_at)) {
    throw new Error("Assessment attempt time has expired");
  }

  const startedAtMs = Date.parse(attempt.started_at);
  if (!Number.isFinite(startedAtMs)) {
    throw new Error("Assessment attempt has an invalid start time");
  }

  const { data: registryFile, error: registryError } = await supabase.storage
    .from("academia-course-materials")
    .download("assessments/registry.json");
  if (registryError || !registryFile) {
    throw new Error("Unable to load assessment registry");
  }
  const registry = JSON.parse(await registryFile.text());
  const definition = registry.assessments?.[attempt.assessment_id];
  if (!definition || definition.status !== "published") throw new Error("Assessment is not published");
  if (attempt.release_version !== definition.release_version || attempt.release_public_sha256 !== definition.release_public_sha256 || attempt.release_private_sha256 !== definition.release_private_sha256) throw new Error("Assessment release changed after this attempt started; the attempt is locked to its original release");
  if (!definition || definition.status !== "published" || !Number.isInteger(definition.time_seconds) || definition.time_seconds <= 0) {
    throw new Error("Assessment time limit is unavailable");
  }
  if (Date.now() > startedAtMs + definition.time_seconds * 1000) {
    throw new Error("Assessment time has expired");
  }\n\n  const publicBankForIntegrity = await loadJson(definition.question_bank_public, "public question bank");\n  await verifyRegisteredBank(definition, publicBankForIntegrity);

  const questionIds = Array.isArray(attempt.question_ids)
    ? attempt.question_ids.filter((id: unknown): id is string =>
        typeof id === "string"
      )
    : [];

  if (!questionIds.includes(questionId)) {
    throw new Error("Question does not belong to this assessment attempt");
  }

  if (selectedOptionIndex !== null &&
      (!Number.isInteger(selectedOptionIndex) ||
       selectedOptionIndex < 0 ||
       selectedOptionIndex > 3)) {
    throw new Error("selected_option_index must be between 0 and 3");
  }

  const normalizedAnswer = answer.trim();
  if (selectedOptionIndex !== null) {
    const order = Array.isArray((attempt as any).option_orders?.[questionId])
      ? (attempt as any).option_orders[questionId]
      : [0,1,2,3];
    if (order.length !== 4 || new Set(order).size !== 4 || order.some((x: unknown) => !Number.isInteger(x) || x < 0 || x > 3)) {
      throw new Error("Assessment option permutation is invalid");
    }
    selectedOptionIndex = order[selectedOptionIndex];
  }
  if (normalizedAnswer.length > 2000) {
    throw new Error("Answer is too long");
  }

  const { data, error } = await supabase
    .from("assessment_answers")
    .upsert(
      {
        attempt_id: attemptId,
        question_id: questionId,
        answer: normalizedAnswer,
        selected_option_index: selectedOptionIndex,
        answered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "attempt_id,question_id" },
    )
    .select("question_id,answer,selected_option_index,answered_at,updated_at")
    .single();

  if (error) {
    throw new Error(`Unable to save answer: ${error.message}`);
  }

  return {
    attempt_id: attemptId,
    answer: data,
    saved: true,
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    const authorization = request.headers.get("Authorization");
    const studentId = await verifyFirebaseToken(authorization);
    const token = authorization!.slice("Bearer ".length).trim();
    const body = await request.json();

    if ((body?.action || "save_answer") !== "save_answer") {
      return jsonResponse({ error: "Unsupported action" }, 400);
    }

    const attemptId =
      typeof body?.attempt_id === "string" ? body.attempt_id.trim() : "";
    const questionId =
      typeof body?.question_id === "string" ? body.question_id.trim() : "";
    const answer =
      typeof body?.answer === "string" ? body.answer : "";
    const selectedOptionIndex =
      body?.selected_option_index === null ||
      body?.selected_option_index === undefined
        ? null
        : body.selected_option_index;

    if (!attemptId || !questionId) {
      return jsonResponse(
        { error: "attempt_id and question_id are required" },
        400,
      );
    }

    return jsonResponse(
      await saveAnswer(
        studentId,
        attemptId,
        questionId,
        answer,
        selectedOptionIndex,
        token,
      ),
    );
  } catch (error) {
    console.error("assessment-answer error", error);
    return jsonResponse(
      {
        error: error instanceof Error
          ? error.message
          : "Unable to save assessment answer",
      },
      400,
    );
  }
});
