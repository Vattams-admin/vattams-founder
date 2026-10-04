import fs from "node:fs";
import admin from "firebase-admin";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));

const MODES = new Set([
  "--count-only",
  "--dry-run",
  "--apply",
]);

const modeArgs = [...args].filter((arg) => MODES.has(arg));

if (modeArgs.length > 1) {
  throw new Error(
    "Choose only one mode: --count-only, --dry-run, or --apply.",
  );
}

const mode = modeArgs[0] || "--dry-run";

const maxReadsArg = [...args].find((arg) =>
  arg.startsWith("--max-reads="),
);

const maxReads = maxReadsArg
  ? Number(maxReadsArg.split("=")[1])
  : 5000;

if (!Number.isInteger(maxReads) || maxReads < 1) {
  throw new Error("--max-reads must be a positive integer.");
}

const registryPath =
  process.env.COMPETITION_REGISTRY_PATH ||
  ".tmp-competition-registry/registry.json";

const firebaseCredentials =
  process.env.GOOGLE_APPLICATION_CREDENTIALS;

const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!firebaseCredentials) {
  throw new Error(
    "GOOGLE_APPLICATION_CREDENTIALS is not set.",
  );
}

if (!supabaseUrl) {
  throw new Error(
    "SUPABASE_URL is not set.",
  );
}

if (
  mode !== "--count-only" &&
  !supabaseServiceRoleKey
) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is not set.",
  );
}

if (!fs.existsSync(firebaseCredentials)) {
  throw new Error(
    `Firebase service-account file not found: ${firebaseCredentials}`,
  );
}

async function loadRegistry() {
  if (fs.existsSync(registryPath)) {
    return JSON.parse(fs.readFileSync(registryPath, "utf8"));
  }

  if (!supabase) {
    throw new Error(
      `Competition registry not found: ${registryPath}`,
    );
  }

  const { data, error } = await supabase.storage
    .from("academia-course-materials")
    .download("competitions/registry.json");

  if (error || !data) {
    throw new Error(
      `Competition registry not found locally and could not be loaded from Supabase Storage: ${error?.message || "missing file"}`,
    );
  }

  return JSON.parse(await data.text());
}

const serviceAccount =
  JSON.parse(
    fs.readFileSync(
      firebaseCredentials,
      "utf8",
    ),
  );

admin.initializeApp({
  credential: admin.credential.cert(
    serviceAccount,
  ),
});

const db = admin.firestore();

const supabase =
  supabaseServiceRoleKey
    ? createClient(
        supabaseUrl,
        supabaseServiceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        },
      )
    : null;

const registry = await loadRegistry();

const competitions =
  Object.values(
    registry.competitions || {},
  ).filter(
    (entry) =>
      entry &&
      entry.enabled === true &&
      typeof entry.course_id === "string" &&
      entry.course_id.trim(),
  );

if (!competitions.length) {
  throw new Error(
    "No enabled competitions found in the registry.",
  );
}

const managedCourseIds =
  new Set(
    competitions.map(
      (entry) => entry.course_id,
    ),
  );

let firestoreReads = 0;

function reserveReads(count) {
  if (
    firestoreReads + count >
    maxReads
  ) {
    throw new Error(
      `Firestore read safety limit exceeded: projected ${firestoreReads + count}, max ${maxReads}. Aborting before writes.`,
    );
  }

  firestoreReads += count;
}

function validDateOfBirth(value) {
  if (!value) return null;

  const date =
    value instanceof admin.firestore.Timestamp
      ? value.toDate()
      : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  const now = new Date();

  if (date > now) {
    return null;
  }

  const oldest =
    new Date(now);

  oldest.setFullYear(
    oldest.getFullYear() - 120,
  );

  if (date < oldest) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function isActiveAdmin(data) {
  return Boolean(
    data &&
    data.is_active === true &&
    [
      "admin",
      "super_admin",
      "instructor",
    ].includes(
      typeof data.role === "string"
        ? data.role
        : "",
    ),
  );
}

function isActiveEnrolment(data) {
  return Boolean(
    data &&
    data.status === "active",
  );
}

function getStudentId(data) {
  return String(
    data?.student_id ??
    data?.user_id ??
    data?.uid ??
    "",
  ).trim();
}

async function loadActiveEnrolments(
  courseId,
) {
  const snapshot =
    await db
      .collection("enrolments")
      .where(
        "course_id",
        "==",
        courseId,
      )
      .where(
        "status",
        "==",
        "active",
      )
      .get();

  reserveReads(1);

  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }))
    .map((item) => ({
      ...item,
      studentId:
        getStudentId(item.data) ||
        item.id.split("_")[0],
    }))
    .filter(
      (item) => item.studentId,
    );
}

async function getStudent(
  studentId,
) {
  reserveReads(1);

  const snap =
    await db
      .collection("students")
      .doc(studentId)
      .get();

  return snap.exists
    ? snap.data()
    : null;
}

async function getAdmin(
  studentId,
) {
  reserveReads(1);

  const snap =
    await db
      .collection("admins")
      .doc(studentId)
      .get();

  return snap.exists
    ? snap.data()
    : null;
}

async function getExistingManagedRows() {
  const rows = [];
  let from = 0;

  while (true) {
    const to = from + 999;

    const { data, error } =
      await supabase
        .from("competition_access_cache")
        .select(
          "student_id,course_id",
        )
        .in(
          "course_id",
          [...managedCourseIds],
        )
        .range(from, to);

    if (error) {
      throw new Error(
        `Supabase cache read failed: ${error.message}`,
      );
    }

    rows.push(...(data || []));

    if (!data || data.length < 1000) {
      break;
    }

    from += 1000;
  }

  return rows;
}

async function buildDesiredState() {
  const desired = new Map();

  for (const competition of competitions) {
    const enrolments =
      await loadActiveEnrolments(
        competition.course_id,
      );

    console.log(
      `${competition.competition}: ${enrolments.length} active enrolments`,
    );

    const studentIds =
      [
        ...new Set(
          enrolments
            .map(
              (item) =>
                item.studentId,
            )
            .filter(Boolean),
        ),
      ];

    for (const studentId of studentIds) {
      const [student, adminDoc] =
        await Promise.all([
          getStudent(studentId),
          getAdmin(studentId),
        ]);

      const dateOfBirth =
        validDateOfBirth(
          student?.date_of_birth ??
          student?.dob,
        );

      const isAdmin =
        isActiveAdmin(adminDoc);

      const enrolmentActive =
        enrolments.some(
          (item) =>
            item.studentId ===
              studentId &&
            isActiveEnrolment(
              item.data,
            ),
        );

      if (
        !dateOfBirth ||
        (!isAdmin &&
          !enrolmentActive)
      ) {
        continue;
      }

      const key =
        `${studentId}::${competition.course_id}`;

      desired.set(key, {
        student_id: studentId,
        course_id:
          competition.course_id,
        is_admin: isAdmin,
        enrolment_active:
          enrolmentActive,
        date_of_birth:
          dateOfBirth,
        checked_at:
          new Date().toISOString(),
      });
    }
  }

  return desired;
}

async function applyDesiredState(
  desired,
) {
  const rows = [...desired.values()];

  for (
    let i = 0;
    i < rows.length;
    i += 500
  ) {
    const chunk =
      rows.slice(i, i + 500);

    const { error } =
      await supabase
        .from(
          "competition_access_cache",
        )
        .upsert(
          chunk,
          {
            onConflict:
              "student_id,course_id",
          },
        );

    if (error) {
      throw new Error(
        `Supabase cache upsert failed: ${error.message}`,
      );
    }
  }

  const existing =
    await getExistingManagedRows();

  const obsolete =
    existing.filter(
      (row) =>
        !desired.has(
          `${row.student_id}::${row.course_id}`,
        ),
    );

  for (
    let i = 0;
    i < obsolete.length;
    i += 500
  ) {
    const chunk =
      obsolete.slice(i, i + 500);

    for (const row of chunk) {
      const { error } =
        await supabase
          .from(
            "competition_access_cache",
          )
          .delete()
          .eq(
            "student_id",
            row.student_id,
          )
          .eq(
            "course_id",
            row.course_id,
          );

      if (error) {
        throw new Error(
          `Supabase cache delete failed: ${error.message}`,
        );
      }
    }
  }

  return {
    written: rows.length,
    deleted: obsolete.length,
  };
}

try {
  console.log(
    `Competition access sync mode: ${mode}`,
  );

  console.log(
    `Enabled competition courses: ${competitions.length}`,
  );

  for (const competition of competitions) {
    console.log(
      `- ${competition.competition} (${competition.course_id})`,
    );
  }

  if (mode === "--count-only") {
    let total = 0;

    for (const competition of competitions) {
      const enrolments =
        await loadActiveEnrolments(
          competition.course_id,
        );

      console.log(
        `${competition.competition}: ${enrolments.length} active enrolments`,
      );

      total += enrolments.length;
    }

    console.log(
      `TOTAL ACTIVE COMPETITION ENROLMENTS: ${total}`,
    );

    console.log(
      `Firestore reads used: ${firestoreReads}/${maxReads}`,
    );

    console.log(
      "Count-only complete. No Supabase writes performed.",
    );

    process.exit(0);
  }

  if (mode === "--dry-run") {
    const desired =
      await buildDesiredState();

    const existing =
      await getExistingManagedRows();

    const obsolete =
      existing.filter(
        (row) =>
          !desired.has(
            `${row.student_id}::${row.course_id}`,
          ),
      );

    console.log(
      `Desired cache rows: ${desired.size}`,
    );

    console.log(
      `Existing managed rows: ${existing.length}`,
    );

    console.log(
      `Rows that would be deleted: ${obsolete.length}`,
    );

    console.log(
      `Firestore reads used: ${firestoreReads}/${maxReads}`,
    );

    console.log(
      "Dry-run complete. No Supabase writes performed.",
    );

    process.exit(0);
  }

  const desired =
    await buildDesiredState();

  const result =
    await applyDesiredState(
      desired,
    );

  console.log(
    `Applied cache rows: ${result.written}`,
  );

  console.log(
    `Deleted obsolete managed rows: ${result.deleted}`,
  );

  console.log(
    `Firestore reads used: ${firestoreReads}/${maxReads}`,
  );

  console.log(
    "Competition access sync completed.",
  );
} catch (error) {
  console.error(
    `Competition access sync failed: ${
      error instanceof Error
        ? error.message
        : String(error)
    }`,
  );

  process.exitCode = 1;
} finally {
  await admin.app().delete().catch(() => {});
}
