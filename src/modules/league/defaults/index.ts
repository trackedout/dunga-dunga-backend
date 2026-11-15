import do2S1CompLeague from './do2-s1-comp';
import do2S2CompLeague from './do2-s2-comp';
import do2S3CompLeague from './do2-s3-comp';
import practiceLeague from './practice';
import hardcoreLeague from './hardcore';
import metroMayhemLeague from './metro-mayhem';
import { ILeague } from '../league.interfaces';

const defaultLeagues: ILeague[] = [do2S1CompLeague, do2S2CompLeague, do2S3CompLeague, practiceLeague, hardcoreLeague, metroMayhemLeague];

export default defaultLeagues;
