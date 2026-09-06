import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import { Task } from '../task';
import * as leagueService from './league.service';
import * as sandboxService from './league-sandbox.service';
import LeagueSandbox from './league-sandbox.model';
import logger from '../logger/logger';

const scheduleJob = (args: string[]) =>
  Task.create({
    type: 'run-job',
    arguments: args,
    server: 'job-scheduler',
    state: 'SCHEDULED',
    sourceIP: '127.0.0.1',
  });

export const getSandboxInstance = catchAsync(async (req: Request, res: Response) => {
  const slug = req.params['slug'] as string;
  const instance = await sandboxService.getSandboxByLeague(slug);
  if (!instance) {
    res.status(httpStatus.NOT_FOUND).send({ code: 404, message: 'No active sandbox instance' });
    return;
  }
  res.send(instance);
});

export const launchSandbox = catchAsync(async (req: Request, res: Response) => {
  const slug = req.params['slug'] as string;

  const league = await leagueService.getLeagueBySlug(slug);
  if (!league) {
    res.status(httpStatus.NOT_FOUND).send({ code: 404, message: 'League not found' });
    return;
  }

  // A league whose build world is owned by a persistent build server
  // (builders / builders2) must not get an on-demand sandbox — two writers
  // would diverge from the persistent server's restic snapshot.
  if (league.builders?.preventSandboxing) {
    res.status(httpStatus.CONFLICT).send({
      code: 409,
      message: `League '${slug}' is built on a persistent build server; on-demand sandboxes are disabled`,
    });
    return;
  }

  const existing = await sandboxService.getSandboxByLeague(slug);
  if (existing && existing.state !== 'STOPPED') {
    res.send(existing);
    return;
  }

  const slot = await sandboxService.allocateSlot();
  const instance = await sandboxService.createSandboxInstance(slug, slot);

  const env = process.env['NODE_ENV'] === 'production' ? 'prod' : 'dev';
  await scheduleJob([`launch-ecs-sandbox-${env}`, slot, `league=${slug}`]);

  logger.info(`Sandbox launch requested for league ${slug} on slot ${slot}`);
  res.status(httpStatus.ACCEPTED).send(instance);
});

export const stopSandbox = catchAsync(async (req: Request, res: Response) => {
  const slug = req.params['slug'] as string;

  const instance = await sandboxService.getSandboxByLeague(slug);
  if (!instance) {
    res.status(httpStatus.NOT_FOUND).send({ code: 404, message: 'No active sandbox instance' });
    return;
  }

  await sandboxService.updateSandboxState(slug, { state: 'STOPPING' });

  const env = process.env['NODE_ENV'] === 'production' ? 'prod' : 'dev';
  await scheduleJob([`terminate-ecs-sandbox-${env}`, instance.slot]);

  logger.info(`Sandbox stop requested for league ${slug} (slot ${instance.slot})`);
  res.send({ message: 'Stopping sandbox', slot: instance.slot });
});

export const getBuilderAllowlist = catchAsync(async (req: Request, res: Response) => {
  const slug = req.params['slug'] as string;

  const league = await leagueService.getLeagueBySlug(slug);
  if (!league) {
    res.status(httpStatus.NOT_FOUND).send({ code: 404, message: 'League not found' });
    return;
  }

  const playerNames = [league.owner, ...(league.builders?.players || [])];
  const uniqueNames = [...new Set(playerNames)];

  const whitelist = uniqueNames.map((name) => ({ name }));
  res.send(whitelist);
});

export const createLeagueWithSeed = catchAsync(async (req: Request, res: Response) => {
  const { slug, displayName, owner } = req.body;

  const existing = await leagueService.getLeagueBySlug(slug);
  if (existing) {
    res.status(httpStatus.CONFLICT).send({ code: 409, message: 'League already exists' });
    return;
  }

  // The league bootstraps its restic world repo from a fork source on first
  // launch (handled by the sandbox entrypoint). Default to the "_base" repo; a
  // fork request may point at another league's repo + snapshot instead.
  const forkSource = {
    repo: req.body.builders?.forkSource?.repo || '_base',
    ...(req.body.builders?.forkSource?.snapshotId
      ? { snapshotId: req.body.builders.forkSource.snapshotId }
      : {}),
  };

  const leagueData = {
    slug,
    displayName,
    owner,
    description: req.body.description || '',
    display: {
      // runTypeId 0 marks an unpublished draft; publishLeague assigns the real
      // datapack mode (competitive = 2) on publish.
      runTypeId: 0,
      colour: 0xaaaaaa,
      material: 'WHITE_SHULKER_BOX',
    },
    members: [],
    joinPolicy: 'invite-only' as const,
    items: {},
    trades: [],
    deck: {
      defaultCards: [],
    },
    server: {
      dungeonType: slug,
      claimFilters: {},
      worldSource: 'restic' as const,
      minecraft: {},
      datapacks: [
        { repo: 'trackedout/Brilliance', asset: 'brilliance-datapack.zip', version: 'latest', enabled: true, authenticated: true },
      ],
      mods: [
        { repo: 'trackedout/agronet-fabric', asset: 'agronet-1.0.0.jar', version: 'latest', enabled: true, authenticated: true },
      ],
      resourcePack: {},
    },
    phases: [],
    phaseTransition: { autoTransition: false, allocation: { type: 'none' }, actions: [], excludedPlayers: [] },
    scoring: null,
    eventHandlers: [],
    state: 'draft' as const,
    builders: {
      players: req.body.builders?.players || [],
      idleTimeoutMinutes: req.body.builders?.idleTimeoutMinutes || 30,
      preventSandboxing: req.body.builders?.preventSandboxing || false,
      forkSource,
    },
  };

  const league = await leagueService.upsertLeague(leagueData);
  logger.info(`League '${slug}' created; world forks from restic repo '${forkSource.repo}' on first launch`);
  res.status(httpStatus.CREATED).send(league);
});

export const getActiveSandboxes = catchAsync(async (_req: Request, res: Response) => {
  const instances = await sandboxService.getActiveInstances();
  res.send(instances);
});

export const updateSandboxFromEvent = catchAsync(async (req: Request, res: Response) => {
  const { slot, state, taskArn, privateIp } = req.body;

  const instance = await LeagueSandbox.findOne({ slot, state: { $ne: 'STOPPED' } }).exec();

  if (!instance) {
    res.status(httpStatus.NOT_FOUND).send({ code: 404, message: 'No instance for slot' });
    return;
  }

  const update: Record<string, string> = {};
  if (state) update['state'] = state;
  if (taskArn) update['taskArn'] = taskArn;
  if (privateIp) update['privateIp'] = privateIp;

  await sandboxService.updateSandboxState(instance.leagueSlug, update);
  res.send({ message: 'Updated', leagueSlug: instance.leagueSlug });
});
