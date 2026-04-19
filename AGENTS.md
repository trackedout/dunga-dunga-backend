# AGENTS.md

This file provides guidance to AI coding agents working in this repository.

## Project Overview

`dunga-dunga-backend` — Node.js/Express + TypeScript + Mongoose REST API for the Decked Out 2 tracking system. Receives game events from Minecraft servers, processes them, and serves data to the `ember` frontend.

## Adding a New Endpoint

Follow the existing module pattern:

1. Create `src/modules/<name>/` with:
   - `<name>.service.ts` — business logic / DB queries
   - `<name>.controller.ts` — request handling using `catchAsync` and `pick` from `../utils`
   - `<name>.validation.ts` — Joi schema for query/body params
   - `index.ts` — barrel export of controller and validation
2. Create `src/routes/v1/<name>.route.ts` — wire up `validate()` + controller handler
3. Register the route in `src/routes/v1/index.ts`

See `src/modules/feed/` for a recent example (aggregation pipeline endpoint).

## Key Utilities

Import from `../utils`:
- `catchAsync(fn)` — wraps async handlers, forwards errors to Express error middleware
- `pick(obj, keys)` — safely extract allowed query/body fields
- `getEventMetadata(event)` / `getMetadata(obj)` — normalise Mongoose `Map` or plain object metadata to a `Map<string, any>`

## Common Commands

| Task | Command |
|------|---------|
| Type check | `yarn run compile` |
| Lint | `yarn lint` |
| Dev (watch) | `yarn dev:watch` |

No build script — TypeScript is compiled by the deployment pipeline.

## Deployment

Auto-builds and redeploys on commit to `main`. Check status with:
```bash
kubectl --context=burn logs -n davybones deployments/dunga-dunga --tail 20
```

## MongoDB Collections

```
events    # All game events (4M+). 'metadata.run-id' groups events into a run.
claims    # One per run attempt. 'metadata.run-id' links to events. Contains dungeon/difficulty/timing metadata.
cards     # Player cards (deck items)
scores    # Minecraft scoreboards per player & run type
players   # Known players
tasks     # Distributed work queue
```

Key indexes on `events`: `name`, `createdAt`, `metadata.run-id`, `metadata.run-type`, `player`.
Key index on `claims`: `metadata.run-id`.

Collections marked ignore in the frontend AGENTS.md (cardsBackup, configs, instances, etc.) are legacy/internal — do not query them.

## Public API (`app-public.ts`)

`src/app-public.ts` is a separate Express app exposed to the open internet (currently serves `/v1/feed`). It has stricter security than the internal `app.ts`:

- **CORS**: locked to origins in `PUBLIC_CORS_ORIGINS` env var (comma-separated). If unset, CORS is disabled. Only `GET` is allowed.
- **Rate limit**: 30 req/min per IP (vs 60 in the internal app).
- **Body size**: capped at `10kb`.
- **XSS sanitization**: query params are sanitized via `xss-filters`.
- **MongoDB operator injection**: query params are sanitized via `express-mongo-sanitize`.

When adding new routes to `app-public.ts`, maintain all of the above. Do not relax the rate limit or open CORS without explicit approval.

Set `PUBLIC_CORS_ORIGINS=https://trackedout.org,https://www.trackedout.org` (or equivalent) in the deployment environment.

## Key Conventions

- All metadata fields on `events` and `claims` are stored as a Mongoose `Map` — always use `getEventMetadata()` to read them safely.
- Use `catchAsync` on every controller handler — never use try/catch directly.
- Joi validation schemas live in `<name>.validation.ts` and are applied via `validate()` middleware in the route file.
- Do not add routes outside `src/routes/v1/` — all endpoints are versioned under `/v1/`.
