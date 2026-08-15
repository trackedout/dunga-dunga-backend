import competitiveLeague from './competitive';
import practiceLeague from './practice';
import hardcoreLeague from './hardcore';
import { ILeague } from '../league.interfaces';

const defaultLeagues: ILeague[] = [competitiveLeague, practiceLeague, hardcoreLeague];

export default defaultLeagues;
