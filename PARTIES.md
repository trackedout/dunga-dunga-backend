# Party Queue System

The party queue system allows players to form groups and queue together for minigames. Unlike standard Decked Out 2 dungeon runs (single-player), party games support multiple players in the same instance.

## Collections

### `gameRegistry`

Defines available minigames. Adding a new document here (plus a snapshot in S3 and a `snapshot-source` config) is all that's needed to register a new game — no code changes required.

```js
{
  name: "metro-mayhem",             // unique, used as the dungeon-type value
  displayName: "Metro Mayhem",
  minPlayers: 1,                    // 1 = solo queueable, 2+ = requires party
  maxPlayers: 8,
  permission: "tracked-out.game.metro-mayhem",  // LuckPerms permission required to create a party
  tokenCost: 0,                     // 0 = free, >0 = costs tokens
  tokenType: null,                  // e.g. "party-token" if tokenCost > 0
  enabled: true,
  snapshotSource: "snapshots/games/metro-mayhem/",
  resourcePackUrl: null,            // optional override
  resourcePackSha1: null,
  datapackVersion: "latest",
}
```

### `parties`

Tracks active party state. Created when a player runs `/party create`, disbanded when the game ends or the leader disbands.

```js
{
  leader: "PlayerName",
  game: "metro-mayhem",             // references gameRegistry.name
  members: ["PlayerName", "Player2"],
  invites: ["Player3"],             // pending invites
  state: "forming",                 // forming → queued → in-game → disbanded
  claimId: null,                    // set when leader queues
}
```

## API Endpoints

### Game Registry

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/game-registry` | List enabled minigames (returns `{ results: [...] }`) |
| GET | `/v1/game-registry/:name` | Get a specific minigame config |
| POST | `/v1/game-registry` | Upsert a minigame (admin) |

### Parties

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/v1/parties` | `{ leader, game }` | Create a party |
| GET | `/v1/parties?player=X` | — | Get player's active party |
| POST | `/v1/parties/:id/invite` | `{ player }` | Invite a player |
| POST | `/v1/parties/:id/join` | `{ player }` | Accept an invite |
| POST | `/v1/parties/:id/leave` | `{ player }` | Leave the party |
| POST | `/v1/parties/:id/kick` | `{ player }` | Kick a member (leader only) |
| POST | `/v1/parties/:id/queue` | `{ player }` | Queue up (leader only) |
| DELETE | `/v1/parties/:id` | — | Disband (leader only) |

## Queue Flow

```
1. /party create metro-mayhem
   → Validates LuckPerms permission
   → Creates party (state: forming)

2. /party invite Player2
   → Adds to invites list
   → Player2 sees: "Player1 invited you to play Metro Mayhem! /party join Player1"

3. /party join Player1  (Player2 runs this)
   → Moves from invites to members
   → All members notified

4. /party queue  (leader only)
   → Validates members.length >= minPlayers
   → Validates all members are in-lobby
   → Creates a Claim:
       player: leader
       type: dungeon
       state: pending
       metadata: { dungeon-type: game, party-id, party-players: "P1,P2", run-type: party }
   → Sets all members' state to in-queue
   → Party state → queued

5. Worker picks up leader (in-queue with activeClaimId)
   → Same assignQueuedPlayersToDungeons path as solo dungeons
   → Finds instance matching claimFilters for dungeon-type
   → If none available, launches Fargate (writes dungeon-type config for the game)

6. Instance ready
   → Worker detects party-players in claim metadata
   → Sends bungee-message Connect tasks for ALL party members
   → All teleported simultaneously

7. Game ends (all players leave the instance)
   → Claim invalidated/finalized
   → Party state → disbanded
```

## Claim Integration

The party system reuses the existing claim/instance infrastructure:

- A party queue creates a **single claim** owned by the leader
- The claim's `dungeon-type` metadata value is the game name (e.g. `metro-mayhem`)
- Instance matching uses the existing `claimFilters` mechanism
- Fargate launch uses the existing `launchFargateDungeonIfNeeded` path
- The only difference: at teleport time, `party-players` metadata triggers multi-player Connect

## Claim Invalidation & Party Cleanup

When a player leaves the lobby or disconnects:

- **If they own the claim (leader)**: claim invalidated → party disbanded → remaining members reset to in-lobby and notified
- **If they're a non-leader member**: removed from `party-players` metadata
  - If remaining players < `gameRegistry.minPlayers` → claim invalidated, party disbanded, members notified
  - If still enough players → party continues without them, members notified

## Dungeon Boot (davybones)

### `import-dungeon.sh`

The dungeon boot script reads the game's snapshot source from the config API:

```bash
DUNGEON_TYPE="$(curl "${DUNGA_API}/configs?entity=${DUNGEON}&key=dungeon-type" | jq -r '.value // "default"')"
SNAPSHOT_SOURCE="$(curl -s "${DUNGA_API}/configs?entity=${DUNGEON_TYPE}&key=snapshot-source" | jq -r '.value // ""')"

if [[ -n "${SNAPSHOT_SOURCE}" ]]; then
  SOURCE="s3://${S3_BACKUP_BUCKET}/${SNAPSHOT_SOURCE}"
elif [[ "${DUNGEON_TYPE}" == "season-2" ]]; then
  SOURCE="s3://${S3_BACKUP_BUCKET}/snapshots/builders2/"
else
  SOURCE="s3://${S3_BACKUP_BUCKET}/snapshots/builders/"
fi
```

### `builders-entrypoint.sh`

Conditionally loads agronet based on a per-game config:

```bash
NEEDS_AGRONET=$(fetch_config "needs-agronet" "${DUNGEON_TYPE}" "true")
```

## Citadel Plugin (Lobby)

### Commands

| Command | Description |
|---------|-------------|
| `/party create <game>` | Create a party (tab-completes game names) |
| `/party invite <player>` | Invite a player |
| `/party join <leader>` | Accept invite from a specific leader |
| `/party leave` | Leave current party |
| `/party kick <player>` | Kick a member (leader only) |
| `/party queue` | Start queue (leader only) |
| `/party disband` | Disband (leader only) |
| `/party info` | Show party state |

### Generated Client

The citadel plugin uses `PartiesApi` and `GameRegistryApi` from the generated OpenAPI client (`org.trackedout.client.apis`). Regenerate with:

```bash
cd ~/tracked-out && bash generate-models.sh
```

This requires dunga-dunga to be running on `localhost:3000` (port-forward if needed).

### Game Registry Cache

`GameRegistryCache` refreshes every 5 minutes from the API and provides tab completion for `/party create`. The `@gameNames` async completion is registered in `Citadel.kt`.

## Setting Up a New Minigame

1. Insert into `gameRegistry`:
   ```js
   db.gameRegistry.insertOne({
     name: "my-game",
     displayName: "My Game",
     minPlayers: 2,
     maxPlayers: 4,
     permission: "tracked-out.game.my-game",
     tokenCost: 0,
     enabled: true,
     snapshotSource: "snapshots/games/my-game/",
     datapackVersion: "latest",
     createdAt: new Date(),
     updatedAt: new Date()
   })
   ```

2. Add snapshot source config:
   ```js
   db.configs.insertOne({
     entity: "my-game",
     key: "snapshot-source",
     value: "snapshots/games/my-game/",
     createdAt: new Date(),
     updatedAt: new Date()
   })
   ```

3. Upload world to S3:
   ```bash
   aws s3 cp world.zip s3://tracked-out-backups-dev/snapshots/games/my-game/dungeon-latest.zip
   ```

4. Grant permission to players:
   ```
   lp group default permission set tracked-out.game.my-game true
   ```

5. (Optional) Disable agronet for this game:
   ```js
   db.configs.insertOne({ entity: "my-game", key: "needs-agronet", value: "false", createdAt: new Date(), updatedAt: new Date() })
   ```
