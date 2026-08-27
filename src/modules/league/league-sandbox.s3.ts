import { S3Client, CopyObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import logger from '../logger/logger';

const REGION = 'us-east-1';
const BUCKET = process.env['S3_BACKUP_BUCKET'] || 'tracked-out-backups-dev';
const BUILDERS2_SOURCE = 'snapshots/builders2/dungeon-latest.zip';

const s3Client = new S3Client({ region: REGION });

export const seedLeagueWorld = async (leagueSlug: string): Promise<string> => {
  const destKey = `snapshots/leagues/${leagueSlug}/dungeon-latest.zip`;

  logger.info(`Seeding league world: copying s3://${BUCKET}/${BUILDERS2_SOURCE} -> s3://${BUCKET}/${destKey}`);

  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: BUILDERS2_SOURCE }));
  } catch (_err) {
    throw new Error(`Source snapshot not found: s3://${BUCKET}/${BUILDERS2_SOURCE}`);
  }

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      Key: destKey,
      CopySource: `${BUCKET}/${BUILDERS2_SOURCE}`,
    })
  );

  const snapshotSource = `snapshots/leagues/${leagueSlug}/`;
  logger.info(`League world seeded successfully. Snapshot source: ${snapshotSource}`);
  return snapshotSource;
};
