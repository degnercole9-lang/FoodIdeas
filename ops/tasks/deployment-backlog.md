# Deployment Backlog

This file is the canonical task list to reach a deployed private preview app.

## Task Status Legend
- `done`: completed and verified
- `in_progress`: actively being worked
- `blocked`: waiting on dependency or decision
- `queued`: ready, not started

## Ordered Tasks

### TASK-001: Bootstrap repository conventions
- Status: `done`
- Owner: `manager`
- Scope:
  - create `AGENTS.md`
  - define setup commands, guardrails, DoD
- Acceptance criteria:
  - `AGENTS.md` exists and includes required sections

### TASK-002: Scaffold app and baseline tooling
- Status: `done`
- Owner: `specialist-ui-foundation`
- Scope:
  - initialize Next.js + TypeScript + Tailwind
  - configure `pnpm` scripts: `dev`, `test`, `lint`, `format`, `typecheck`
  - switch lint/format to Biome
- Acceptance criteria:
  - `pnpm lint`, `pnpm test`, `pnpm typecheck`, `pnpm format` succeed

### TASK-003: iPhone-first capture and library flow
- Status: `done`
- Owner: `specialist-capture-ui`
- Scope:
  - action-first mobile screen
  - center `Take Photo` CTA
  - side `Library` pill
  - shared photo tray (max 3)
  - delete + undo for both sources
  - camera fallback to file input
- Acceptance criteria:
  - iPhone users can take or upload photos in same flow
  - delete/undo behavior works for camera and library items

### TASK-004: Image preprocessing pipeline
- Status: `done`
- Owner: `specialist-image-pipeline`
- Dependencies: `TASK-003`
- Scope:
  - on-device resize/compression before upload
  - HEIC compatibility path to JPEG
  - enforce size/type/count guardrails with UX errors
- Acceptance criteria:
  - captures/uploads are normalized for API calls
  - large/unusable files show clear errors

### TASK-005: Ingredient extraction API
- Status: `done`
- Owner: `specialist-vision-api`
- Dependencies: `TASK-004`
- Scope:
  - `POST /api/extract-ingredients`
  - Claude vision prompt and schema validation
  - extraction response mapping to app model
- Acceptance criteria:
  - API returns structured ingredient list from submitted images
  - invalid model output is handled gracefully

### TASK-006: Ingredient edit UI
- Status: `done`
- Owner: `specialist-ingredient-editor`
- Dependencies: `TASK-005`
- Scope:
  - add/remove/rename ingredient entries
  - optional quantity and unit edits
  - transition to recipe generation request
- Acceptance criteria:
  - user can correct extraction output before recipe generation

### TASK-007: Recipe generation API + results
- Status: `done`
- Owner: `specialist-recipe-engine`
- Dependencies: `TASK-006`
- Scope:
  - `POST /api/generate-recipes`
  - recipe cards + details
  - have-vs-need ingredient split
- Acceptance criteria:
  - app returns and renders at least 3 recipes per successful request

### TASK-008: Favorites persistence
- Status: `done`
- Owner: `specialist-favorites`
- Dependencies: `TASK-007`
- Scope:
  - save/remove favorites in local storage
  - restore favorites on refresh
- Acceptance criteria:
  - favorites survive browser refresh on same device

### TASK-009: Error handling and loading states
- Status: `done`
- Owner: `specialist-resilience`
- Dependencies: `TASK-005`, `TASK-007`
- Scope:
  - extraction/generation loading states
  - retry UX on API failure
  - manual-entry fallback for extraction failure
- Acceptance criteria:
  - user never gets stuck without a next action

### TASK-010: Private preview deployment setup
- Status: `done`
- Owner: `specialist-deploy`
- Dependencies: `TASK-009`
- Scope:
  - Vercel project config for preview deployments
  - environment variable checklist
  - manual deploy instructions for user
- Acceptance criteria:
  - branch pushes create preview builds
  - `main` is production-eligible only

### TASK-011: Release readiness verification
- Status: `done`
- Owner: `manager`
- Dependencies: `TASK-010`
- Scope:
  - run full verification suite
  - update docs
  - final diff summary
- Acceptance criteria:
  - checks green
  - deployment handoff ready for user Git push
