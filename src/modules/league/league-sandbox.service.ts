import LeagueSandbox from './league-sandbox.model';
import { ILeagueSandboxDoc, SandboxState } from './league-sandbox.interfaces';

const TOTAL_SLOTS = 10;
const SLOT_PREFIX = 's';
const SLOT_START = 400;

export const getSandboxByLeague = async (leagueSlug: string): Promise<ILeagueSandboxDoc | null> => {
  return LeagueSandbox.findOne({ leagueSlug, state: { $ne: 'STOPPED' } }).exec();
};

export const allocateSlot = async (): Promise<string> => {
  const activeInstances = await LeagueSandbox.find({ state: { $ne: 'STOPPED' } }).exec();
  const usedSlots = new Set(activeInstances.map((i) => i.slot));

  for (let i = 0; i < TOTAL_SLOTS; i++) {
    const slot = `${SLOT_PREFIX}${SLOT_START + i}`;
    if (!usedSlots.has(slot)) {
      return slot;
    }
  }

  throw new Error('No available sandbox slots');
};

export const createSandboxInstance = async (leagueSlug: string, slot: string): Promise<ILeagueSandboxDoc> => {
  await LeagueSandbox.deleteMany({ leagueSlug, state: 'STOPPED' }).exec();

  return LeagueSandbox.create({
    leagueSlug,
    slot,
    state: 'LAUNCHING',
    lastPlayerActivity: new Date(),
  });
};

export const updateSandboxState = async (
  leagueSlug: string,
  update: Partial<{ state: SandboxState; taskArn: string; privateIp: string; lastPlayerActivity: Date }>
): Promise<ILeagueSandboxDoc | null> => {
  return LeagueSandbox.findOneAndUpdate({ leagueSlug, state: { $ne: 'STOPPED' } }, update, { new: true }).exec();
};

export const updateSandboxActivity = async (slot: string): Promise<void> => {
  await LeagueSandbox.updateOne({ slot, state: 'RUNNING' }, { lastPlayerActivity: new Date() }).exec();
};

export const getIdleInstances = async (maxIdleMinutes: number = 30): Promise<ILeagueSandboxDoc[]> => {
  const cutoff = new Date(Date.now() - maxIdleMinutes * 60 * 1000);
  return LeagueSandbox.find({
    state: 'RUNNING',
    lastPlayerActivity: { $lt: cutoff },
  }).exec();
};

export const getActiveInstances = async (): Promise<ILeagueSandboxDoc[]> => {
  return LeagueSandbox.find({ state: { $in: ['LAUNCHING', 'RUNNING'] } }).exec();
};

export const markStopped = async (leagueSlug: string): Promise<void> => {
  await LeagueSandbox.updateOne({ leagueSlug, state: { $ne: 'STOPPED' } }, { state: 'STOPPED' }).exec();
};
