import { ILeagueItem } from '../league.interfaces';

export function standardItems(prefix: string): Record<string, ILeagueItem> {
  return {
    shards: { scoreboard: `do2.inventory.shards.${prefix}`, startingAmount: 22 },
    crowns: { earned: `${prefix}-do2.lifetime.escaped.crowns`, spent: `${prefix}-do2.lifetime.spent.crowns` },
    tomes: { earned: `${prefix}-do2.lifetime.escaped.tomes`, spent: `${prefix}-do2.lifetime.spent.tomes` },
    shardFragments: { earned: `${prefix}-do2.lifetime.escaped.shard_fragments`, spent: `${prefix}-do2.lifetime.spent.shard_fragments` },
    embers: { scoreboard: `${prefix}-do2.lifetime.escaped.embers` },
  };
}
