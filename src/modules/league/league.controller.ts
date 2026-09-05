import httpStatus from 'http-status';
import { Request, Response } from 'express';
import catchAsync from '../utils/catchAsync';
import * as leagueService from './league.service';

// GET /leagues returns ALL leagues (not just active). The lobby + agronet
// caches resolve leagues by slug/runTypeId and must see completed leagues so
// old-season decks still render and old claims still map to a mode. Playability
// is gated separately (at queue time), not by omitting the league here.
export const getActiveLeagues = catchAsync(async (_req: Request, res: Response) => {
  const leagues = await leagueService.getAllLeagues();
  res.send({ results: leagues });
});

export const getLeagueBySlug = catchAsync(async (req: Request, res: Response) => {
  const league = await leagueService.getLeagueBySlug(req.params['slug'] as string);
  if (!league) {
    res.status(httpStatus.NOT_FOUND).send({ code: 404, message: 'League not found' });
    return;
  }
  res.send(league);
});

// GET /leagues/:slug/server-spec — the authoritative runtime provisioning spec
// for a league's servers (dungeon/sandbox). Container entrypoints fetch this by
// slug and drive world source, MC version, datapacks, mods, and resource pack
// directly from it. This is the single source of truth: there is no flat-config
// projection. Returns just the `server` block so the entrypoint contract stays
// minimal and doesn't depend on unrelated league internals (items/trades/deck).
export const getServerSpec = catchAsync(async (req: Request, res: Response) => {
  const league = await leagueService.getLeagueBySlug(req.params['slug'] as string);
  if (!league) {
    res.status(httpStatus.NOT_FOUND).send({ code: 404, message: 'League not found' });
    return;
  }
  res.send(league.server);
});

export const upsertLeague = catchAsync(async (req: Request, res: Response) => {
  const league = await leagueService.upsertLeague(req.body);
  res.status(httpStatus.OK).send(league);
});

export const publishLeague = catchAsync(async (req: Request, res: Response) => {
  const league = await leagueService.publishLeague(req.params['slug'] as string);
  if (!league) {
    res.status(httpStatus.NOT_FOUND).send({ code: 404, message: 'League not found' });
    return;
  }
  res.send(league);
});

export const addEditor = catchAsync(async (req: Request, res: Response) => {
  const league = await leagueService.addEditor(req.params['slug'] as string, req.body.player);
  if (!league) {
    res.status(httpStatus.NOT_FOUND).send({ code: 404, message: 'League not found' });
    return;
  }
  res.send(league);
});

export const removeEditor = catchAsync(async (req: Request, res: Response) => {
  const league = await leagueService.removeEditor(req.params['slug'] as string, req.body.player);
  if (!league) {
    res.status(httpStatus.NOT_FOUND).send({ code: 404, message: 'League not found' });
    return;
  }
  res.send(league);
});

export const addMember = catchAsync(async (req: Request, res: Response) => {
  const league = await leagueService.addMember(req.params['slug'] as string, req.body.player);
  if (!league) {
    res.status(httpStatus.NOT_FOUND).send({ code: 404, message: 'League not found' });
    return;
  }
  res.send(league);
});

export const removeMember = catchAsync(async (req: Request, res: Response) => {
  const league = await leagueService.removeMember(req.params['slug'] as string, req.body.player);
  if (!league) {
    res.status(httpStatus.NOT_FOUND).send({ code: 404, message: 'League not found' });
    return;
  }
  res.send(league);
});
