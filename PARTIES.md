# Parties

A party is a group of players who play one league run together. The leader
queues as usual; when the leader passes through the dungeon door, the rest of
the party is sent into the same dungeon.

## Which leagues offer parties

A league's `party` block sets the party size, leader included:

```js
party: { minPlayers: 1, maxPlayers: 10 }
```

A league without a `party` block is solo only (`{ minPlayers: 1, maxPlayers: 1 }`).
Parties can be created only for an `active` league whose `maxPlayers` is above 1.
Today that is `do2-s2-practice` and `metro-mayhem` (1 to 10 players);
`metro-mayhem` is still `draft`, so it offers parties once it goes active.

Change the limits by editing the league doc. The `defaults/` files only seed
a fresh database.

## `parties` collection

```js
{
  leader: "PlayerName",
  slug: "do2-s2-practice",          // the league the party plays
  members: ["PlayerName", "Player2"],
  invites: ["Player3"],             // pending invites
  state: "forming",                 // forming -> queued -> forming (after the run) ... -> disbanded
  claimId: null,                    // the leader's dungeon claim while queued
}
```

A queued party goes back to `forming` once its claim is no longer pending,
acquired or in use (the run finished or was cancelled), so the same group can
queue again. That check runs whenever the party is read.

## API

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/v1/parties` | `{ leader, slug }` | Create a party for a league |
| GET | `/v1/parties?player=X` | | Get a player's active party |
| POST | `/v1/parties/:id/invite` | `{ player }` | Invite a player |
| POST | `/v1/parties/:id/join` | `{ player }` | Accept an invite |
| POST | `/v1/parties/:id/leave` | `{ player }` | Leave (the leader leaving disbands) |
| POST | `/v1/parties/:id/kick` | `{ player }` | Kick a member (leader only) |
| DELETE | `/v1/parties/:id` | | Disband (leader only) |

There is no party queue endpoint: the leader queues through the normal
`trade-requested` / `joined-queue` flow.

## Queue flow

1. `/party create do2-s2-practice` creates a `forming` party. Citadel only
   offers leagues the player can select as a run mode and that allow parties.
2. `/party invite Player2`, then Player2 runs `/party join Player1`.
3. The leader queues as usual. Before the queue cost is taken and again when
   the claim is created, `getPartyReadyToQueue` checks that:
   - the player queueing is the leader (a member cannot queue alone while in a party)
   - the party is `forming` and its league is the one being queued
   - it has at least `minPlayers` members, all in the lobby
4. The leader's claim gets `party-id` and `party-players` metadata. Members
   are set to `in-queue` with `activeClaimId` pointing at the leader's claim,
   and the party becomes `queued`.
5. The worker assigns a dungeon to the claim owner only; members waiting on
   someone else's claim are skipped, and are not counted when deciding
   whether to launch a Fargate dungeon.
6. When the leader passes through the door (or is sent straight in with
   `skip-door`), `movePlayerToDungeon` connects the leader and then every
   member still waiting on that claim.
7. On the dungeon, agronet loads the claim for whoever joins first. Every
   player in `party-players` shares the claim's context (slug, run id); the
   leader's deck is handed out to the leader only.

## Leaving and cancellation

- **Leader leaves the lobby or the network while queued:** the claim is
  invalidated, waiting members go back to the lobby, and the party is disbanded.
- **Member leaves the lobby or the network:** they are removed from
  `party-players`. If fewer than `minPlayers` remain, the claim is invalidated.
- **`/party leave` or `/party kick` while queued:** the player is removed from
  `party-players` and returned to the lobby; the run continues without them.
- **`/party disband` while queued:** members are returned to the lobby and the
  leader's run continues solo.
- **Any claim invalidation** (dungeon unhealthy, lease expired, ...) sends
  members still waiting on the claim back to the lobby and tells them why.

## Citadel commands

| Command | Description |
|---------|-------------|
| `/party create <league>` | Create a party (tab-completes leagues that allow parties) |
| `/party invite <player>` | Invite a player |
| `/party join <leader>` | Accept an invite from a leader |
| `/party leave` | Leave the party |
| `/party kick <player>` | Kick a member (leader only) |
| `/party disband` | Disband (leader only) |
| `/party info` | Show the party |
