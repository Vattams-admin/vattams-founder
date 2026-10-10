# Academia Content Quality Gates — Operator Runbook

## Purpose

The cross-pillar quality-gate workflow runs the repository's existing local validation scripts for VATTAMS Academia. It is a validation layer for Courses, Competitive & Entrance Exams, Competitions & Olympiads, and shared content infrastructure. It does not establish that all planned content has been authored or independently reviewed.

## How to run

- Open **Actions → Academia Content Quality Gates** in GitHub and select **Run workflow** on the feature branch when a manual run is needed.
- Pull requests and pushes on `feat/academia-core-redesign` trigger the workflow when the configured path filters match.
- Locally, run `npm ci`, then `npm run academia:content:quality-gates -- --list` to inspect the configured validator inventory without running the validators.
- Run `npm run academia:content:quality-gates` to execute the configured read-only validators.

## Reading the result

- **PASS** means every validator configured in the runner exited with status zero for that revision. It is not a guarantee that every syllabus, lesson, question bank, language, exam, or competition is complete.
- **FAIL** identifies validators that returned a non-zero exit, timed out, or could not start. Read the specific validator output in the job log.
- A missing validator file or duplicate path is a configuration error. The runner preflight should stop before any validator executes.
- The job summary, when produced by GitHub Actions, lists each validator's result and elapsed time. If the runner exits during preflight, use the preflight error printed in the job log.

## Failure triage

1. Record the commit SHA and exact failed validator label.
2. Open that validator script and inspect the relevant source data or registry before changing anything.
3. Make the smallest source-backed correction; do not weaken a check merely to make CI green.
4. Re-run the affected validator locally, then the complete quality-gate command.
5. Review the new GitHub Actions run for the exact commit. Do not report success based only on a commit existing or a workflow file being present.

## Safety boundaries

This workflow is intended to execute local validation scripts only. Do not add seeders, publishing, promotion, repair, deployment, or remote-write commands to the validator list. Firebase and Supabase production data, security rules, and project settings are outside the scope of this workflow.

## Readiness reporting

Report readiness separately for each pillar and distinguish:
- **Structural validation** — schemas, identifiers, links, and required fields.
- **Content coverage** — the scope represented by the registry and coverage checks.
- **Content quality** — factual correctness, answer-key verification, age/level suitability, language review, and source evidence.
- **Runtime/release validation** — production workflows and end-to-end checks.

Do not turn a passing structural validator into a claim of full production readiness without supporting evidence for the other dimensions.
