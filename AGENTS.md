# AGENTS.md

## Purpose
- `AGENTS.md` is required always-on context for all agent tasks in this repository.
- If instructions conflict, precedence is: system instructions, developer instructions, user instructions, then this file.

## Setup Commands (pnpm)
Run from repo root:

```bash
pnpm install
pnpm dev
pnpm test
pnpm lint
pnpm format
pnpm typecheck
```

## Repo Conventions
- Source of truth for formatting and linting: `Biome`.
- Folder conventions:
  - `app/`
  - `components/`
  - `lib/`
  - `styles/`
  - `tests/`
  - `ops/`
- Naming rules:
  - Files and directories: `kebab-case`
  - React components: `PascalCase`
  - Variables and functions: `camelCase`
  - Constants: `SCREAMING_SNAKE_CASE`

## Guardrails
- No production execution by agents.
- No secret logging.
- No plaintext secrets in repository files or commits.
- Sandbox-only operations unless explicitly approved.
- No destructive git operations unless explicitly requested.
- No autonomous social-posting automation.

## Deployment Policy (Vercel via Git)
- User deploys manually through Git + Vercel.
- Agents never deploy unless explicitly instructed by the user.
- Preview deploys are allowed on branch/PR pushes.
- Production deploys are allowed only from `main`.
- Pushes happen only when the user explicitly commands push.

## Manager + Specialist Operating Model
- Manager owns the plan, integration/merges, and final diff/report.
- Each specialist handles one narrow task.
- Parallel work must run in isolated git worktrees.
- File ownership boundaries are strict with no overlap between active specialist tasks.
- Manager integrates specialist work via cherry-pick.

## Task Context Artifacts
- Task specs live in `ops/tasks/`.
- Run artifacts live in `ops/runs/<run-id>/`.
- Keep context in small repo artifacts, not giant prompts.

## Specialist Handoff Contract (Required Keys)
Every specialist must return the same structured bundle with these keys:
- `changed_files`
- `commands_run`
- `notes/risks`
- `next_steps`
- `diff_summary`

## Definition of Done
- Relevant tests pass.
- Lint, format, and typecheck pass.
- Acceptance criteria are satisfied.
- Documentation is updated when behavior or process changes.
- Manager summary includes merged SHAs and final diff summary.

## Execution Checklists
Pre-task checklist:
- Read `AGENTS.md`.
- Confirm task scope.
- Confirm allowed files for the task.
- Confirm required verification commands.

Post-task checklist:
- Run required checks.
- Produce the structured handoff bundle.
- Hand off to manager for integration/review.

## Public Interfaces / Types Affected
- No product API/interface changes are introduced by this bootstrap step.
- New operational interface: specialist handoff bundle contract with required keys listed above.
