# Fargate Dungeons

Fargate dungeons (d700–d799) are on-demand ECS tasks launched when no k3s dungeon instances are available.

## Lifecycle

1. **Launch**: When `assignQueuedPlayersToDungeons` can't find an available k3s dungeon, `launchFargateDungeonIfNeeded` allocates the next free name in d700–d799 and creates a `launch-ecs-dungeon` task for the job-scheduler.
2. **Registration**: The Fargate dungeon starts, connects to the network, and registers itself as an instance (same as k3s dungeons).
3. **Use**: Normal dungeon flow — reserved for a player, prepared, player enters, run completes.
4. **Termination**: After use, `terminateFargateDungeonIfNeeded` creates a `terminate-ecs-dungeon` task and deletes the Instance record from the DB.

## Launch Guards

- Global toggle: `Config { entity: 'global', key: 'enable-fargate-launches', value: 'false' }` disables all launches.
- Per-player toggle: `Config { entity: playerName, key: 'enable-fargate-launches', value: 'false' }`.
- Concurrency limit: max 20 active d7xx instances across all states.
- Distributed lock (`launch-fargate/{player}/{claimId}`, 120s TTL) prevents duplicate launches for the same player/claim.
- Deduplication: skips if a `launch-ecs-dungeon` task already exists for the player.

## Dungeon Type Propagation

Before launching, the system writes a `Config { entity: dungeonName, key: 'dungeon-type' }` record so the dungeon knows what type to configure itself as (e.g. `default`, `deadly`).

## Termination Safety Mechanisms

Four layers ensure unused Fargate dungeons get terminated:

### 1. Lease Expiry (`releaseDungeonIfLeaseExpired`)

If a dungeon stays in `RESERVED` state for >5 minutes without the player entering, the system invalidates the claim, refunds the player, and terminates the Fargate task.

### 2. Empty Dungeon Teardown (`tearDownDungeonIfEmpty`)

If a dungeon is `IN_USE` with 0 active players for >1 minute, it gets shut down and the Fargate task is terminated.

### 3. Claim Invalidation (`invalidateClaims` → `releaseDungeonLeaseForPlayer`)

If a player's state becomes inconsistent (e.g. back in lobby with an active claim), the claim is invalidated and the reserved dungeon is released, triggering Fargate termination.

### 4. Idle Fargate Failsafe (`terminateIdleFargateDungeons`)

Runs every worker loop. Finds any d7xx dungeon in `AVAILABLE` or `RESERVED` state for >5 minutes and terminates it unconditionally. This is the catch-all for broken control plane state.

### 5. External Orphan Cleanup (outside this codebase)

A separate job terminates ECS tasks that have no matching Instance record in the database. This covers the case where `degradeDungeon()` deletes the DB record (after 5 minutes of failed RCON health checks) but doesn't explicitly create a termination task — the external job catches the now-orphaned Fargate task.

Between layers 4 and 5, any orphaned ECS task is caught regardless of whether the control plane lost track of it or deleted the record prematurely.

## Termination Deduplication

`terminateFargateDungeonIfNeeded` checks for a `terminate-ecs-dungeon` task created in the last 60 seconds before creating a new one, preventing duplicate termination requests.

## Naming Convention

- `d7xx` (d700–d799): Fargate dungeons
- `d8xx`: k3s dungeons (prioritized over Fargate when available)

## Task Types

| Task | Target | Purpose |
|------|--------|---------|
| `launch-ecs-dungeon` | `job-scheduler` | Start a new Fargate task |
| `terminate-ecs-dungeon` | `job-scheduler` | Stop a Fargate task |

Arguments for launch: `[launch-ecs-dungeon-{env}, dungeonName, player={name}, dungeon-type={type}]`
Arguments for terminate: `[terminate-ecs-dungeon-{env}, dungeonName]`
