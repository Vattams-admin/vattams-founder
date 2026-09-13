# VATTAMS ACADEMIA — First 10 Days Complete Lesson Package

Generated package:
- Courses: 55
- Complete lessons: 550
- Days per course: 10
- Every lesson includes the requested full package fields.
- Per-course JSON files are included for review.
- `ALL_550_LESSONS.json` is the master dataset.
- `seed-days-1-10.mjs` is a deployment-ready Firestore Admin seed template.

## Important
This package is **prepared, not deployed**. It must be reviewed and then pushed/seeding from the actual VATTAMS ACADEMIA repository in Termux.

The lesson structure follows the supplied Public Speaking reference's daily learning philosophy: story/value or concept, thinking, speaking/practice, action, reflection, while adapting the teaching structure to each course category. The reference also emphasises progressive practice and reflection. 

## Termux workflow
1. Copy the package into the repository.
2. Review `ALL_550_LESSONS.json` and the per-course files.
3. Run the repository's normal build/test.
4. Commit and push to GitHub.
5. Run the seed script only with the correct Firebase service-account credentials and after confirming the Firestore schema matches the existing admin code.

Do NOT change Firebase Auth, existing tutor/student data, payments, or Supabase storage as part of this content seed.

## Next update
After these first 10 days are live and reviewed, Days 11–30 can be replaced/expanded course-by-course without changing the underlying content architecture.
