// Source: academy_course.pdf, "Planning sample — not yet final approved
// pricing. Final amounts should be admin-controlled in the app." These
// are seed-only defaults; every price stays editable from
// /admin/courses/:id after this runs.
//
// NOTE on "Spoken English" / "Public Speaking": the task brief lists
// both names but also says "The public/display name should be Public
// Speaking... Do not create duplicate Spoken English/Public Speaking
// records." The app already has exactly this override wired up in
// src/lib/courseDisplay.ts (stored name "Spoken English" -> displayed
// as "Public Speaking"). So this file seeds ONE row, named "Spoken
// English", and the existing display-name override takes care of the
// rest — no separate "Public Speaking" row is created. This is why the
// Academic & Skill count below is 15 unique rows, not 16, and the grand
// total is 55, not 56 — see the seed report printed after running this
// script for the full explanation.

export const CATEGORY = {
  COMPETITIVE_EXAMS: 'competitive-exams',
  ACADEMIC_SKILL: 'academic-skill',
  VATTAMS_COMPETITIONS: 'vattams-competitions',
}

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function describe(category, name) {
  switch (category) {
    case CATEGORY.COMPETITIVE_EXAMS:
      return {
        short_description: `Structured preparation for ${name}.`,
        description: `A structured course for ${name}, covering the syllabus with organised lessons and study material to support your exam preparation.`,
      }
    case CATEGORY.ACADEMIC_SKILL:
      return {
        short_description: `Structured lessons for ${name}.`,
        description: `A structured course for ${name}, designed to build understanding and practical skill through organised lessons and study material.`,
      }
    case CATEGORY.VATTAMS_COMPETITIONS:
      return {
        short_description: `Timed knowledge competition: ${name}.`,
        description: `${name} is a timed knowledge competition hosted by VATTAMS ACADEMIA, open to registered participants.`,
      }
    default:
      return { short_description: null, description: null }
  }
}

const RAW_ITEMS = [
  // ---------------------------------------------------------------
  // Category 1 — Competitive Exam Courses (23)
  // ---------------------------------------------------------------
  ['TNPSC Group I', CATEGORY.COMPETITIVE_EXAMS, 4999],
  ['TNPSC Group II / IIA', CATEGORY.COMPETITIVE_EXAMS, 3499],
  ['TNPSC Group IV / VAO', CATEGORY.COMPETITIVE_EXAMS, 1999],
  ['TNPSC Complete Package', CATEGORY.COMPETITIVE_EXAMS, 6999],
  ['SSC CGL', CATEGORY.COMPETITIVE_EXAMS, 3499],
  ['SSC CHSL', CATEGORY.COMPETITIVE_EXAMS, 2499],
  ['SSC MTS / GD', CATEGORY.COMPETITIVE_EXAMS, 1499],
  ['SSC Complete Package', CATEGORY.COMPETITIVE_EXAMS, 4999],
  ['Banking – IBPS', CATEGORY.COMPETITIVE_EXAMS, 2999],
  ['SBI Exams', CATEGORY.COMPETITIVE_EXAMS, 2999],
  ['RBI Exams', CATEGORY.COMPETITIVE_EXAMS, 3999],
  ['Banking Complete Package', CATEGORY.COMPETITIVE_EXAMS, 4999],
  ['RRB NTPC', CATEGORY.COMPETITIVE_EXAMS, 2499],
  ['Railway Group D', CATEGORY.COMPETITIVE_EXAMS, 1499],
  ['RRB ALP / Technician', CATEGORY.COMPETITIVE_EXAMS, 1999],
  ['Railway Complete Package', CATEGORY.COMPETITIVE_EXAMS, 3999],
  ['Police Exams', CATEGORY.COMPETITIVE_EXAMS, 1499],
  ['Defence Exams', CATEGORY.COMPETITIVE_EXAMS, 1999],
  ['TET – Tamil / English', CATEGORY.COMPETITIVE_EXAMS, 1999],
  ['TET Complete Package', CATEGORY.COMPETITIVE_EXAMS, 2999],
  ['UGC NET', CATEGORY.COMPETITIVE_EXAMS, 3999],
  ['SET', CATEGORY.COMPETITIVE_EXAMS, 2999],
  ['Teaching & School Jobs', CATEGORY.COMPETITIVE_EXAMS, 1499],

  // ---------------------------------------------------------------
  // Category 2 — Academic & Skill Courses (15 unique — see note above)
  // ---------------------------------------------------------------
  ['School Tuition – 6th–8th', CATEGORY.ACADEMIC_SKILL, 999],
  ['School Tuition – 9th', CATEGORY.ACADEMIC_SKILL, 1499],
  ['School Tuition – 10th', CATEGORY.ACADEMIC_SKILL, 1999],
  ['School Tuition – 11th', CATEGORY.ACADEMIC_SKILL, 1999],
  ['School Tuition – 12th', CATEGORY.ACADEMIC_SKILL, 2499],
  ['College – Individual Subject', CATEGORY.ACADEMIC_SKILL, 1499],
  ['College – Complete Subject Pack', CATEGORY.ACADEMIC_SKILL, 2999],
  ['Competitive Foundation', CATEGORY.ACADEMIC_SKILL, 1499],
  ['Computer Basics', CATEGORY.ACADEMIC_SKILL, 799],
  ['MS Office', CATEGORY.ACADEMIC_SKILL, 999],
  ['Programming Fundamentals', CATEGORY.ACADEMIC_SKILL, 1499],
  // Stored name stays "Spoken English" (historical); publicly displayed
  // as "Public Speaking" via src/lib/courseDisplay.ts.
  ['Spoken English', CATEGORY.ACADEMIC_SKILL, 999],
  ['Soft Skills', CATEGORY.ACADEMIC_SKILL, 999],
  ['Certification – Basic', CATEGORY.ACADEMIC_SKILL, 999],
  ['Certification – Advanced', CATEGORY.ACADEMIC_SKILL, 1999],

  // ---------------------------------------------------------------
  // Category 3 — VATTAMS Competitions (17)
  // ---------------------------------------------------------------
  ['Mathematics Challenge', CATEGORY.VATTAMS_COMPETITIONS, 99],
  ['Science Challenge', CATEGORY.VATTAMS_COMPETITIONS, 99],
  ['English Challenge', CATEGORY.VATTAMS_COMPETITIONS, 99],
  ['Computer Challenge', CATEGORY.VATTAMS_COMPETITIONS, 99],
  ['GK Challenge', CATEGORY.VATTAMS_COMPETITIONS, 99],
  ['Reasoning Challenge', CATEGORY.VATTAMS_COMPETITIONS, 99],
  ['India GK Championship', CATEGORY.VATTAMS_COMPETITIONS, 149],
  ['National Quiz Championship', CATEGORY.VATTAMS_COMPETITIONS, 149],
  ['AI & Technology Challenge', CATEGORY.VATTAMS_COMPETITIONS, 149],
  ['International Knowledge Challenge', CATEGORY.VATTAMS_COMPETITIONS, 199],
  ['National Mathematics Championship', CATEGORY.VATTAMS_COMPETITIONS, 199],
  ['National Science Championship', CATEGORY.VATTAMS_COMPETITIONS, 199],
  ['National English Championship', CATEGORY.VATTAMS_COMPETITIONS, 199],
  ['National Aptitude Championship', CATEGORY.VATTAMS_COMPETITIONS, 199],
  ['National Coding Challenge', CATEGORY.VATTAMS_COMPETITIONS, 249],
  ['National AI Challenge', CATEGORY.VATTAMS_COMPETITIONS, 249],
  ['Mega Inter-School Championship', CATEGORY.VATTAMS_COMPETITIONS, 299],
  ['Indian Classical Literature & Wisdom Championship', CATEGORY.VATTAMS_COMPETITIONS, 0],
  ['Indian Language Literature Masters Series', CATEGORY.VATTAMS_COMPETITIONS, 0],
  ['Thirukkural Mastery Championship', CATEGORY.VATTAMS_COMPETITIONS, 0],
]

export const CATALOG_ITEMS = RAW_ITEMS.map(([name, category, base_fee]) => {
  const { short_description, description } = describe(category, name)
  return {
    name,
    slug: slugify(name),
    category_id: category,
    is_competition: category === CATEGORY.VATTAMS_COMPETITIONS,
    base_fee,
    discount_amount: 0,
    is_free: false,
    level: null,
    duration_text: null,
    instructor_name: null,
    cover_image_url: null,
    preview_video_url: null,
    short_description,
    description,
    is_published: true,
    is_featured: false,
  }
})
