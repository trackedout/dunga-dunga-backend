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
3. Register the route in `src/routes/v1/index.ts` (internal API)
4. Register the route in `src/app-public.ts` (public API) — add import + `app.use('/v1/<name>', route)`

See `src/modules/feed/` or `src/modules/killers/` for recent examples.

## Key Utilities

Import from `../utils`:
- `catchAsync(fn)` — wraps async handlers, forwards errors to Express error middleware
- `pick(obj, keys)` — safely extract allowed query/body fields
- `getEventMetadata(event)` / `getMetadata(obj)` — normalise Mongoose `Map` or plain object metadata to a `Map<string, any>`

## Common Commands

| Task | Command |
|------|---------|
| Type check | `bunx tsc --noEmit` |
| Lint | `bun run lint` (note: eslint config warning is pre-existing, not a blocker) |
| Dev public API (watch) | `bun run dev:public` |
| Dev main API (watch) | `bun run dev` |

No build script — Bun runs TypeScript directly.

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
players   # Known players with state, lastSeen, server, lastQueuedAt
instances # Dungeon server instances with state, reservedBy, activePlayers
tasks     # Distributed work queue
```

Key indexes on `events`: `name`, `createdAt`, `metadata.run-id`, `metadata.run-type`, `player`.
Key index on `claims`: `metadata.run-id`, `createdAt`.

Collections marked ignore in the frontend AGENTS.md (cardsBackup, configs, etc.) are legacy/internal — do not query them.

## Metadata Access

All `metadata` fields on `events` and `claims` are stored as a Mongoose `Map`. To read them safely:
```ts
const meta = event.metadata as unknown as Record<string, string>;
const runId = meta['run-id'];
```
Or use `getMetadata(obj)` from `../utils` which returns a `Map<string, any>`.

## Key Event Metadata Fields

On `events`:
- `metadata.run-id` — links event to a run
- `metadata.run-type` — `practice`/`competitive`/`hardcore` (old) or `p`/`c`/`h` (new)
- `metadata.difficulty` — `easy`/`medium`/`hard`/`deadly`/`deepfrost`
- `metadata.start-time` / `metadata.end-time` — unix seconds (string)
- `metadata.game-won` — `"true"` if the run was won
- `metadata.killer` / `metadata.killer-type` — on `player-died` events
- `metadata.death-message` — on `player-died` events

On `claims`:
- Same run-id, difficulty, run-type, start/end times as events
- `state` — `active` | `invalid` | `complete`
- `claimant` — the dungeon server name (e.g. `d099`)

## Season 2

Season 2 started `2026-03-15T00:00:00Z`. Before this date, card events used full names (e.g. `card-played-stumble`) instead of shorthands (`card-played-STU`). The `cardStats` service normalizes these via `CARD_NAME_TO_SHORTHAND`. The `killers` and `card-stats` endpoints accept a `since` ISO date param; the frontend defaults to the Season 2 start date.

## Public API (`app-public.ts`)

`src/app-public.ts` is a separate Express app exposed to the open internet. Currently serves:
- `GET /v1/feed` — paginated run feed
- `GET /v1/runs/:runId` — full run detail
- `GET /v1/players/:name` — player scores + recent run stats
- `GET /v1/overview` — online players + dungeon instances
- `GET /v1/killers` — kill stats (unique per run)
- `GET /v1/card-stats` — card played/bought counts

Security constraints (do not relax without explicit approval):
- **CORS**: locked to `PUBLIC_CORS_ORIGINS` env var. Only `GET` allowed.
- **Rate limit**: 30 req/min per IP.
- **Body size**: capped at `10kb`.
- **XSS sanitization**: via `xss-filters`.
- **MongoDB operator injection**: via `express-mongo-sanitize`.

## Key Conventions

- All metadata fields on `events` and `claims` are stored as a Mongoose `Map` — cast to `Record<string, string>` to read.
- Use `catchAsync` on every controller handler — never use try/catch directly.
- Joi validation schemas live in `<name>.validation.ts` and are applied via `validate()` middleware in the route file.
- Do not add routes outside `src/routes/v1/` — all endpoints are versioned under `/v1/`.
- `difficulty` on a run should be read from `claim.metadata['difficulty']` first, then event metadata as fallback — claims are more reliable.
- Run type normalization: old events use `practice`/`competitive`/`hardcore`; new use `p`/`c`/`h`. Always normalize to short codes in responses.

## End of Dev Cycle Checklist

1. `bunx tsc --noEmit` — must pass
2. `git add <changed files> && git commit -m "<short description>"`
3. Update AGENTS.md if architecture/API/conventions changed
