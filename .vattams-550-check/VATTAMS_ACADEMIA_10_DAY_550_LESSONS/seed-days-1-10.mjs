/**
 * LEGACY — VATTAMS ACADEMIA Days 1–10 / 550 lesson seed
 * DO NOT USE FOR THE COMPETITION MODULE.
 * Competition curricula now follow the scalable Thirukkural Mastery model.
 * This script is retained only for historical/non-competition course migration.
 * Run from the repository after installing the existing Firebase Admin dependency.
 *
 * IMPORTANT:
 * - Review in staging/admin first.
 * - This script creates/merges course_modules and course_lessons only.
 * - It does not modify courses, auth, tutor data, payments, or Supabase storage.
 */
import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountPath) throw new Error("Set FIREBASE_SERVICE_ACCOUNT to your service-account JSON path.");
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"))) });
const db = admin.firestore();

const master = JSON.parse(fs.readFileSync(path.resolve("ALL_550_LESSONS.json"), "utf8"));

async function main() {
  let count = 0;
  for (const course of master.courses) {
    const moduleId = `${course.id}-days-1-10`;
    await db.collection("course_modules").doc(moduleId).set({
      course_id: course.id,
      title: "Days 1–10 | Foundation Module",
      description: "First ten complete lessons; prepared for admin review before production publishing.",
      sort_order: 1,
      status: "draft",
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    for (const lesson of master.lessons.filter(x => x.course_id === course.id)) {
      const ref = db.collection("course_lessons").doc(lesson.lesson_id);
      await ref.set({
        course_id: lesson.course_id,
        module_id: lesson.module_id,
        title: lesson.title,
        content: JSON.stringify(lesson),
        sort_order: lesson.sort_order,
        status: "draft",
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      count++;
    }
  }
  console.log(`Prepared ${count} lessons across ${master.courses.length} courses.`);
}
main().catch(err => { console.error(err); process.exit(1); });
