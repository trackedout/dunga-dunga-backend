import express, { Router } from 'express';
import { Request, Response } from 'express';
import catchAsync from '../../modules/utils/catchAsync';
import Config from '../../modules/config/config.model';

const router: Router = express.Router();

router.route('/').get(
  catchAsync(async (_req: Request, res: Response) => {
    const [phaseConfigs, seasonConfigs] = await Promise.all([
      Config.find({ entity: { $regex: /^phase-\d+$/ } }).lean(),
      Config.find({ entity: 'comp-season', key: 'current-phase' }).lean(),
    ]);

    const activePhase = seasonConfigs[0] ? Number(seasonConfigs[0].value) : undefined;

    const phaseMap: Record<number, { phase: number; start?: string; end?: string }> = {};
    for (const doc of phaseConfigs) {
      const num = Number(doc.entity.replace('phase-', ''));
      if (!phaseMap[num]) phaseMap[num] = { phase: num };
      if (doc.key === 'start-time') phaseMap[num]!.start = doc.value;
      if (doc.key === 'end-time') phaseMap[num]!.end = doc.value;
    }

    const phases = Object.values(phaseMap).sort((a, b) => a.phase - b.phase);

    res.send({ activePhase, phases });
  })
);

export default router;
