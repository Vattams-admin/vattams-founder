import fs from 'node:fs';
import path from 'node:path';
import admin from 'firebase-admin';

const PACKAGE = path.resolve(
  '.vattams-550-check/VATTAMS_ACADEMIA_10_DAY_550_LESSONS/ALL_550_LESSONS.json'
);

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountPath) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT is not set.');
}

const serviceAccount = JSON.parse(
  fs.readFileSync(serviceAccountPath, 'utf8')
);

if (serviceAccount.project_id !== 'vattams-academia') {
  throw new Error(
    `Wrong Firebase project: ${serviceAccount.project_id}`
  );
}

const master = JSON.parse(fs.readFileSync(PACKAGE, 'utf8'));

const COURSE_ID_MAP = {
  'school-tuition-6-8': 'school-tuition-6th-8th',
  'school-tuition-9': 'school-tuition-9th',
  'school-tuition-10': 'school-tuition-10th',
  'school-tuition-11': 'school-tuition-11th',
  'school-tuition-12': 'school-tuition-12th',
  'public-speaking': 'spoken-english',
};

const mappedCourseId = (id) => COURSE_ID_MAP[id] ?? id;

if (master.course_count !== 55 || master.lesson_count !== 550) {
  throw new Error(
    `Invalid package counts: ${master.course_count} courses / ${master.lesson_count} lessons`
  );
}

if (master.courses.length !== 55 || master.lessons.length !== 550) {
  throw new Error('Package array counts do not match expected 55/550.');
}

const lessonIds = new Set();
const courseCounts = new Map();

for (const lesson of master.lessons) {
  if (!lesson.lesson_id) {
    throw new Error('Lesson missing lesson_id.');
  }

  if (lessonIds.has(lesson.lesson_id)) {
    throw new Error(`Duplicate lesson_id: ${lesson.lesson_id}`);
  }

  lessonIds.add(lesson.lesson_id);

  courseCounts.set(
    lesson.course_id,
    (courseCounts.get(lesson.course_id) ?? 0) + 1
  );

  if (!mappedCourseId(lesson.course_id)) {
    throw new Error(`Unable to map course: ${lesson.course_id}`);
  }
}

for (const course of master.courses) {
  if ((courseCounts.get(course.id) ?? 0) !== 10) {
    throw new Error(
      `Course ${course.id} does not contain exactly 10 lessons.`
    );
  }
}

console.log('==============================================');
console.log(' VATTAMS ACADEMIA — 550 LESSON IMPORT');
console.log('==============================================');
console.log('Firebase project :', serviceAccount.project_id);
console.log('Courses          :', master.courses.length);
console.log('Lessons          :', master.lessons.length);
console.log('Target status    : draft');
console.log('----------------------------------------------');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'vattams-academia',
});

const db = admin.firestore();

const moduleWrites = [];
const lessonWrites = [];

for (const course of master.courses) {
  const targetCourseId = mappedCourseId(course.id);
  const moduleId = `${targetCourseId}-days-1-10`;

  moduleWrites.push({
    ref: db.collection('course_modules').doc(moduleId),
    data: {
      course_id: targetCourseId,
      title: 'Days 1–10 | Foundation Module',
      description:
        'First ten complete lessons; prepared for admin review before production publishing.',
      sort_order: 1,
      status: 'draft',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
  });
}

for (const lesson of master.lessons) {
  const targetCourseId = mappedCourseId(lesson.course_id);

  const targetLessonId = lesson.lesson_id.replace(
    `${lesson.course_id}-`,
    `${targetCourseId}-`
  );

  const targetModuleId = `${targetCourseId}-days-1-10`;

  lessonWrites.push({
    ref: db.collection('course_lessons').doc(targetLessonId),
    data: {
      course_id: targetCourseId,
      module_id: targetModuleId,
      title: lesson.title,
      content: JSON.stringify(lesson),
      sort_order: lesson.sort_order,
      status: 'draft',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    },
  });
}

console.log('Module writes planned:', moduleWrites.length);
console.log('Lesson writes planned:', lessonWrites.length);
console.log('----------------------------------------------');

async function commitInChunks(items, label) {
  const CHUNK_SIZE = 400;

  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();

    for (const item of chunk) {
      batch.set(item.ref, item.data, { merge: true });
    }

    await batch.commit();

    console.log(
      `${label}: ${Math.min(i + chunk.length, items.length)}/${items.length}`
    );
  }
}

try {
  await commitInChunks(moduleWrites, 'Modules');
  await commitInChunks(lessonWrites, 'Lessons');

  console.log('----------------------------------------------');
  console.log('✅ IMPORT COMPLETE');
  console.log('✅ Modules written : 55');
  console.log('✅ Lessons written : 550');
  console.log('✅ Status          : draft');
  console.log('✅ Existing catalog/auth/tutor/payment data untouched');
} finally {
  await admin.app().delete();
}
