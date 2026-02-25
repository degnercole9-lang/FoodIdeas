# FoodIdeas

FoodIdeas is an iPhone-first web app prototype that turns fridge photos into recipe ideas.

## Features

- In-page camera capture with iPhone-friendly fallback.
- Upload from photo library in the same flow.
- Up to 3 photo inputs per scan.
- On-device image normalization (resize/compress, HEIC compatibility path).
- Ingredient extraction via Claude API.
- Ingredient correction UI before generation.
- Recipe generation via Claude API.
- Local favorites persistence.
- Loading, retry, and manual-entry fallback states.

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment variables:

```bash
cp .env.example .env.local
```

Recommended model for this project:
- `ANTHROPIC_MODEL=claude-haiku-4-5-20251001`

3. Run the app:

```bash
pnpm dev
```

## Verification Commands

```bash
pnpm format
pnpm lint
pnpm test
pnpm typecheck
pnpm build
```

## API Endpoints

- `GET /api/health`
- `POST /api/extract-ingredients`
- `POST /api/generate-recipes`

Health response includes:
- `anthropic.hasServerKey` (`true` means this deployment can serve all devices without browser key override)
- `anthropic.keySource` (which env name is being used)

## Manual Deploy Policy (Vercel via Git)

- User performs deploy manually through Git + Vercel.
- Branch/PR pushes create preview deployments.
- Only `main` is production-eligible.
- Agents do not deploy unless explicitly instructed.

## Preview Troubleshooting

- If preview env vars are not configured yet, you can use the in-app
  **Preview API key override** panel (stored only in your browser) to test.
- For shared usage by all visitors, configure `ANTHROPIC_API_KEY` in Vercel.

## Task Artifacts

- Deployment backlog: `ops/tasks/deployment-backlog.md`
- Run manifest: `ops/runs/run-001-manifest.md`
