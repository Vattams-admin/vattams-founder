# VATTAMS Academia — Curriculum Authoring Control

## Purpose

This control plane connects the 948-track production backlog to the syllabus evidence gate. A backlog entry is only an authoring target; it is never treated as curriculum-approved content.

## Mandatory progression

1. Official syllabus/curriculum evidence is collected.
2. Evidence is verified with source, version, effective date, retrieval time and hash.
3. Evidence is approved by the authorized reviewer.
4. Curriculum map and content authoring may advance.
5. Quality review may begin only with approved evidence.
6. Publication requires approved evidence plus the existing content-package, answer-key, assessment and governance gates.

## Current intake

The first controlled intake is school-cbse-class-1. Its evidence state is intentionally collected with no evidence ID yet. This prevents the repository from pretending that a web search result is a verified curriculum artifact.

The current official CBSE academic site exposes 2026–27 curriculum material and circulars; the actual source artifact must be captured and hashed before the track can advance.

## Safety rule

Do not replace a missing evidence hash with a placeholder, URL hash, or generated value. The hash must represent the captured source artifact. Do not mark evidence approved merely because the source is official; verification and approval remain separate governance steps.

## Relationship to content

This control does not generate lessons, questions, answer keys or assessments. It only gates their lifecycle so production content cannot silently bypass curriculum evidence.
