import Event from '../event/event.model';

// Maps old full-name card suffixes (kebab/snake) to shorthands
const CARD_NAME_TO_SHORTHAND: Record<string, string> = {
  "adrenaline-rush":"ADR","adrenaline_rush":"ADR","avalanche":"AVA",
  "beast-master":"BEM","beast_master":"BEM","beast-sense":"BES","beast_sense":"BES",
  "boots-of-swiftness":"BOS","boots_of_swiftness":"BOS",
  "bounding-strides":"BST","bounding_strides":"BST","brilliance":"BRI",
  "cash-cow":"CAC","cash_cow":"CAC","chill-step":"CHS","chill_step":"CHS",
  "cold-snap":"COS","cold_snap":"COS","deepfrost":"DEF",
  "delve-key":"DLV","delve_key":"DLV",
  "dungeon-lackey":"DUL","dungeon_lackey":"DUL",
  "dungeon-maps":"MAP","dungeon_maps":"MAP",
  "dungeon-repairs":"DUR","dungeon_repairs":"DUR",
  "eerie-silence":"EES","eerie_silence":"EES",
  "ember-seeker":"EMS","ember_seeker":"EMS","evasion":"EVA",
  "eyes-on-the-prize":"EOP","eyes_on_the_prize":"EOP",
  "frost-focus":"FRF","frost_focus":"FRF",
  "fuzzy-bunny-slippers":"FBS","fuzzy_bunny_slippers":"FBS",
  "glorious-moment":"GLM","glorious_moment":"GLM",
  "loot-and-scoot":"LAS","loot_and_scoot":"LAS",
  "manipulation":"MNP","moment-of-clarity":"MOC","moment_of_clarity":"MOC",
  "nimble-looting":"NIL","nimble_looting":"NIL",
  "pay-to-win":"P2W","pay_to_win":"P2W",
  "pirates-booty":"PIB","pirates_booty":"PIB",
  "pork-chop-power":"PCP","pork_chop_power":"PCP","quickstep":"QUI",
  "reckless-charge":"REC","reckless_charge":"REC",
  "recon-key":"RCN","recon_key":"RCN",
  "second-wind":"SEW","second_wind":"SEW",
  "silent-runner":"SIR","silent_runner":"SIR",
  "smash-and-grab":"SAG","smash_and_grab":"SAG","sneak":"SNE",
  "speed-runner":"SPR","speed_runner":"SPR","sprint":"SPT","stability":"STA",
  "stumble":"STU","suit-up":"SUU","suit_up":"SUU","swagger":"SWA",
  "tactical-approach":"TAA","tactical_approach":"TAA",
  "tread-lightly":"TRL","tread_lightly":"TRL",
  "treasure-hunter":"TRH","treasure_hunter":"TRH",
};

export const getCardStats = async (runType?: string, since?: string, until?: string) => {
  const nameFilter = {
    $or: [
      { name: { $gte: 'card-played-', $lt: 'card-played.' } },
      { name: { $gte: 'card-bought-', $lt: 'card-bought.' } },
    ],
  };
  const extra: Record<string, unknown> = {};
  if (runType) extra['metadata.run-type'] = runType;
  const dateFilter: Record<string, Date> = {};
  if (since) dateFilter['$gte'] = new Date(since);
  if (until) dateFilter['$lt'] = new Date(until);
  if (Object.keys(dateFilter).length) extra['createdAt'] = dateFilter;
  const match = Object.keys(extra).length ? { $and: [nameFilter, extra] } : nameFilter;

  // 'card-played-' and 'card-bought-' are both 12 chars
  const results = await Event.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          card: { $substr: ['$name', 12, -1] },
          type: {
            $cond: [{ $regexMatch: { input: '$name', regex: '^card-played-' } }, 'played', 'bought'],
          },
        },
        total: { $sum: 1 },
      },
    },
    {
      $group: {
        _id: '$_id.card',
        played: { $sum: { $cond: [{ $eq: ['$_id.type', 'played'] }, '$total', 0] } },
        bought: { $sum: { $cond: [{ $eq: ['$_id.type', 'bought'] }, '$total', 0] } },
      },
    },
    { $sort: { played: -1 } },
    { $project: { _id: 0, card: '$_id', played: 1, bought: 1 } },
  ]);

  // Normalize old full-name suffixes to shorthands, then merge duplicates
  const merged = new Map<string, { played: number; bought: number }>();
  for (const r of results as Array<{ card: string; played: number; bought: number }>) {
    const key = CARD_NAME_TO_SHORTHAND[r.card] ?? r.card;
    const existing = merged.get(key);
    if (existing) {
      existing.played += r.played;
      existing.bought += r.bought;
    } else {
      merged.set(key, { played: r.played, bought: r.bought });
    }
  }

  const normalized = [...merged.entries()]
    .map(([card, { played, bought }]) => ({ card, played, bought }))
    .sort((a, b) => b.played - a.played);

  return { results: normalized };
};
