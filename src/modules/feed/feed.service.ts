import Claim from '../claim/claim.model';
import Config from '../config/config.model';
import Event from '../event/event.model';

const FEED_CACHE_TTL_MS = 10_000;
const feedCache = new Map<string, { result: unknown; expiresAt: number }>();
const feedInflight = new Map<string, Promise<FeedResult>>();

export interface FeedOptions {
  limit?: number;
  page?: number;
  runType?: string;
  outcome?: string;
  difficulty?: string | string[];
  player?: string;
  phase?: number;
}

export interface FeedSubEvent {
  id: string;
  eventName: string;
  artifactCode?: string;
  createdAt: string;
}

export interface FeedItem {
  id: string;
  eventName: string;
  player: string;
  runId: string | null;
  difficulty: string | null;
  runType: string | null;
  createdAt: string;
  server: string;
  runStartedAt?: string;
  artifactCode?: string;
  subEvents: FeedSubEvent[];
  runInfo?: {
    dungeon: string | null;
    difficulty: string | null;
    runType: string | null;
    startTime: number | null;
    endTime: number | null;
    datapackVersion: string | null;
    killer: string | null;
  };
}

export interface FeedResult {
  results: FeedItem[];
  page: number;
  limit: number;
  totalPages: number;
  totalResults: number;
}

const SUB_EVENT_NAMES = ['gamestate-player-artifact-submitted', 'clank-maxclank-reached'];


export async function getFeed(options: FeedOptions = {}): Promise<FeedResult> {
  const cacheKey = JSON.stringify(options);
  const cached = feedCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.result as FeedResult;

  const inflight = feedInflight.get(cacheKey);
  if (inflight) return inflight;

  const promise = _fetchFeed(options, cacheKey);
  feedInflight.set(cacheKey, promise);
  promise.finally(() => feedInflight.delete(cacheKey));
  return promise;
}

async function _fetchFeed(options: FeedOptions, cacheKey: string): Promise<FeedResult> {
  const limit = Math.min(options.limit ?? 30, 100);
  const page = Math.max(options.page ?? 1, 1);
  const skip = (page - 1) * limit;

  // Build claim match filter
  const matchStage: Record<string, unknown> = {
    'metadata.run-id': { $exists: true, $ne: '' },
  };
  if (options.player) matchStage['player'] = { $regex: options.player, $options: 'i' };

  // Phase filter: look up start/end times from configs and force competitive run type
  if (options.phase != null) {
    const entity = `phase-${options.phase}`;
    const phaseDocs = await Config.find({ entity, key: { $in: ['start-time', 'end-time'] } }).lean();
    const startDoc = phaseDocs.find((d) => d.key === 'start-time');
    const endDoc = phaseDocs.find((d) => d.key === 'end-time');
    if (startDoc) matchStage['createdAt'] = { ...(matchStage['createdAt'] as object ?? {}), $gte: new Date(startDoc.value) };
    if (endDoc) matchStage['createdAt'] = { ...(matchStage['createdAt'] as object ?? {}), $lte: new Date(endDoc.value) };
    // Phase filter always restricts to competitive runs
    matchStage['metadata.run-type'] = { $in: ['c', 'competitive'] };
  } else if (options.runType) {
    // Accept both short codes and full names
    const longForm = { p: 'practice', c: 'competitive', h: 'hardcore' }[options.runType] ?? options.runType;
    matchStage['metadata.run-type'] = { $in: [options.runType, longForm] };
  }
  if (options.outcome === 'win') matchStage['metadata.game-won'] = 'true';
  if (options.outcome === 'loss') matchStage['metadata.game-won'] = { $ne: 'true' };
  if (options.difficulty) {
    const difficulties = Array.isArray(options.difficulty) ? options.difficulty : [options.difficulty];
    matchStage['metadata.difficulty'] = difficulties.length === 1 ? difficulties[0] : { $in: difficulties };
  }

  const [totalResults, docs] = await Promise.all([
    Claim.countDocuments(matchStage),
    Claim.aggregate([
      { $match: matchStage },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      // Look up all relevant events for this run
      {
        $lookup: {
          from: 'events',
          let: { runId: '$metadata.run-id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$metadata.run-id', '$$runId'] },
                    { $in: ['$name', ['game-started', 'game-won', 'game-lost', ...SUB_EVENT_NAMES]] },
                  ],
                },
              },
            },
            { $sort: { createdAt: 1 } },
            {
              $project: {
                _id: 0,
                id: { $toString: '$_id' },
                name: 1,
                createdAt: { $dateToString: { format: '%Y-%m-%dT%H:%M:%S.%LZ', date: '$createdAt' } },
                artifactCode: { $ifNull: ['$metadata.artifact', '$metadata.artifact-id'] },
              },
            },
          ],
          as: '_events',
        },
      },
      { $unset: 'metadata.discord-message-id' },
      {
        $project: {
          _id: 0,
          id: { $toString: '$_id' },
          player: 1,
          server: '$claimant',
          runId: '$metadata.run-id',
          difficulty: '$metadata.difficulty',
          runType: {
            $let: {
              vars: { rt: '$metadata.run-type' },
              in: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$$rt', 'practice'] }, then: 'p' },
                    { case: { $eq: ['$$rt', 'competitive'] }, then: 'c' },
                    { case: { $eq: ['$$rt', 'hardcore'] }, then: 'h' },
                  ],
                  default: '$$rt',
                },
              },
            },
          },
          createdAt: { $dateToString: { format: '%Y-%m-%dT%H:%M:%S.%LZ', date: '$createdAt' } },
          // Derive outcome event name from game-won metadata
          eventName: {
            $cond: {
              if: { $eq: ['$metadata.game-won', 'true'] },
              then: 'game-won',
              else: {
                $cond: {
                  // Has end-time but not won = lost
                  if: { $gt: ['$metadata.end-time', null] },
                  then: 'game-lost',
                  else: 'game-started',
                },
              },
            },
          },
          runStartedAt: {
            $let: {
              vars: {
                startedEvt: {
                  $first: {
                    $filter: { input: '$_events', cond: { $eq: ['$$this.name', 'game-started'] } },
                  },
                },
              },
              in: '$$startedEvt.createdAt',
            },
          },
          subEvents: {
            $map: {
              input: {
                $filter: { input: '$_events', cond: { $in: ['$$this.name', SUB_EVENT_NAMES] } },
              },
              as: 'e',
              in: {
                id: '$$e.id',
                eventName: '$$e.name',
                artifactCode: '$$e.artifactCode',
                createdAt: '$$e.createdAt',
              },
            },
          },
          runInfo: {
            dungeon: '$claimant',
            difficulty: '$metadata.difficulty',
            runType: {
              $switch: {
                branches: [
                  { case: { $eq: ['$metadata.run-type', 'practice'] }, then: 'p' },
                  { case: { $eq: ['$metadata.run-type', 'competitive'] }, then: 'c' },
                  { case: { $eq: ['$metadata.run-type', 'hardcore'] }, then: 'h' },
                ],
                default: '$metadata.run-type',
              },
            },
            startTime: {
              $cond: {
                if: { $gt: ['$metadata.start-time', null] },
                then: { $toInt: '$metadata.start-time' },
                else: null,
              },
            },
            endTime: {
              $cond: {
                if: { $gt: ['$metadata.end-time', null] },
                then: { $toInt: '$metadata.end-time' },
                else: null,
              },
            },
            datapackVersion: '$metadata.datapack-version',
            killer: { $ifNull: ['$metadata.killer', null] },
          },
        },
      },
    ]),
  ]);

  const totalPages = Math.ceil(totalResults / limit);
  const result = { results: docs as FeedItem[], page, limit, totalPages, totalResults };
  feedCache.set(cacheKey, { result, expiresAt: Date.now() + FEED_CACHE_TTL_MS });
  return result;
}

export interface RunDetailEvent {
  name: string;
  createdAt: string;
}

export interface RunDetail {
  runId: string;
  player: string;
  runType: string | null;
  difficulty: string | null;
  outcome: 'win' | 'loss' | 'in-progress';
  artifactFound: string | null;
  cardsPlayed: string[];
  cardsBought: string[];
  durationSeconds: number | null;
  startTime: string | null;
  endTime: string | null;
  server: string;
  killer: string | null;
  maxClankReached: boolean;
  events: RunDetailEvent[];
}

export async function getRunById(runId: string): Promise<RunDetail | null> {
  const [events, claim] = await Promise.all([
    Event.find({ 'metadata.run-id': runId }).sort({ createdAt: 1 }).lean(),
    Claim.findOne({ 'metadata.run-id': runId }).lean(),
  ]);

  if (!events.length) return null;

  const first = events[0]!;
  const player: string = first.player ?? '';

  // Derive from any event's metadata (they share run metadata)
  const allMeta = (e: typeof first) => e.metadata as unknown as Record<string, string>;

  // Find the richest metadata (game-won/lost events tend to have end-time)
  const richMeta = events.reduce((best, e) => {
    const m = allMeta(e);
    return m['end-time'] ? m : best;
  }, allMeta(first));

  const rawRunType = richMeta['run-type'] ?? null;
  const runTypeMap: Record<string, string> = { practice: 'p', competitive: 'c', hardcore: 'h' };
  const runType = rawRunType ? (runTypeMap[rawRunType] ?? rawRunType) : null;
  const difficulty = richMeta['difficulty'] ?? null;
  const startTimeSec = richMeta['start-time'] ? parseInt(richMeta['start-time'], 10) : null;
  const endTimeSec = richMeta['end-time'] ? parseInt(richMeta['end-time'], 10) : null;
  const durationSeconds = startTimeSec && endTimeSec ? endTimeSec - startTimeSec : null;
  const killer = richMeta['killer'] ?? null;

  const hasWon = events.some((e) => e.name === 'game-won');
  const hasLost = events.some((e) => e.name === 'game-lost');
  const claimMeta = claim ? (claim.metadata as unknown as Record<string, string>) : null;
  const outcome: RunDetail['outcome'] = hasWon ? 'win'
    : hasLost ? 'loss'
    : claimMeta?.['game-won'] === 'true' ? 'win'
    : claimMeta?.['end-time'] ? 'loss'
    : 'in-progress';

  const artifactEvt = events.find((e) => e.name === 'gamestate-player-artifact-submitted');
  const artifactMeta = artifactEvt ? (artifactEvt.metadata as unknown as Record<string, string>) : null;
  const artifactFound = artifactMeta ? (artifactMeta['artifact'] ?? artifactMeta['artifact-id'] ?? null) : null;

  const cardsPlayed = [...new Set(
    events
      .filter((e) => e.name.startsWith('card-played-'))
      .map((e) => e.name.replace('card-played-', ''))
  )];

  const cardsBought = [...new Set(
    events
      .filter((e) => e.name.startsWith('card-bought-'))
      .map((e) => e.name.replace('card-bought-', ''))
  )];

  const maxClankReached = events.some((e) => e.name === 'clank-maxclank-reached');

  const startEvt = events.find((e) => e.name === 'game-started');
  const startTime = startEvt ? startEvt.createdAt.toISOString() : null;
  const endEvt = events.find((e) => e.name === 'game-won' || e.name === 'game-lost');
  const endTime = endEvt ? endEvt.createdAt.toISOString() : null;

  const server = first.server ?? '';

  const eventList: RunDetailEvent[] = events.map((e) => ({
    name: e.name,
    createdAt: e.createdAt.toISOString(),
  }));

  return {
    runId,
    player,
    runType,
    difficulty,
    outcome,
    artifactFound,
    cardsPlayed,
    cardsBought,
    durationSeconds,
    startTime,
    endTime,
    server,
    killer,
    maxClankReached,
    events: eventList,
  };
}
