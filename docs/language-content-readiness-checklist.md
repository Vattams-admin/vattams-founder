# Language Content Readiness and Release Checklist

This checklist applies to the language discovery catalogue and its starter curriculum in VATTAMS Academia. Catalogue presence is not equivalent to a translated product or a production-ready course.

## 1. Catalogue integrity
- [ ] Language IDs are unique and stable.
- [ ] Display name and native name are present and reviewed.
- [ ] India-connected versus global grouping is accurate and documented.
- [ ] Script family and writing direction have been checked by a knowledgeable reviewer.
- [ ] Unknown script metadata remains marked for review; do not silently assume Latin.
- [ ] Fonts render the language's required characters on supported Android and desktop browsers.

## 2. Starter lesson integrity
- [ ] Every language has the expected starter unit IDs.
- [ ] Each lesson has a meaningful learning objective and an age-appropriate activity.
- [ ] Sample text and its meaning match; examples are not machine-invented placeholders.
- [ ] Pronunciation guides and audio are added only after qualified review.
- [ ] Lesson IDs remain stable across releases and are unique per language and unit.

## 3. Localization quality
- [ ] Native-speaker or qualified language review is recorded for each localized example.
- [ ] Unreviewed scaffolds are visibly labelled as needing localization.
- [ ] Right-to-left layouts, punctuation, text input, and mixed-script content are checked where relevant.
- [ ] Examples are culturally appropriate and suitable for the target learner age.
- [ ] Accessibility checks cover screen readers, language tags, keyboard focus, and text scaling.

## 4. Technical verification
- [ ] Run `npm run languages:seeds:validate` locally or in CI.
- [ ] Run the TypeScript/build checks configured by the repository.
- [ ] Test search by English name, native name, and language ID.
- [ ] Test empty search results and group filters.
- [ ] Review the CI output and fix failures before describing the release as verified.

## 5. Data and release boundaries
- [ ] Seed definitions are reviewed before any future import into a database.
- [ ] A future seed runner must be explicit, idempotent, and tested against a non-production environment first.
- [ ] Do not write to Firebase or Supabase as part of this catalogue-only work without separate authorization.
- [ ] Do not mark the catalogue or a language production-ready solely because starter seed rows exist.

## Readiness labels
- **Catalogue-listed:** searchable metadata exists.
- **Scaffold available:** learning structure exists but needs localization or review.
- **Localized examples included:** some examples exist; this does not mean every lesson is translated.
- **Production-ready:** lesson content, script rendering, accessibility, and automated checks have all been reviewed and verified.
