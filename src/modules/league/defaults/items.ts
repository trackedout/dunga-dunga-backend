import { ILeagueItem } from '../league.interfaces';

// Scoreboard names are the same in every league. A league's scores live in its
// own namespace (the score's `slug`), so no league needs a prefix of its own.
export function standardItems(): Record<string, ILeagueItem> {
  return {
    shards: { scoreboard: 'do2.inventory.shards', startingAmount: 22 },
    crowns: { earned: 'do2.lifetime.escaped.crowns', spent: 'do2.lifetime.spent.crowns' },
    tomes: { earned: 'do2.lifetime.escaped.tomes', spent: 'do2.lifetime.spent.tomes' },
    shardFragments: { earned: 'do2.lifetime.escaped.shard_fragments', spent: 'do2.lifetime.spent.shard_fragments' },
    embers: { scoreboard: 'do2.lifetime.escaped.embers' },
  };
}
