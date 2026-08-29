import season1League from './season-1';
import season2League from './season-2';
import season3League from './season-3';
import practiceLeague from './practice';
import hardcoreLeague from './hardcore';
import metroMayhemLeague from './metro-mayhem';
import { ILeague } from '../league.interfaces';

const defaultLeagues: ILeague[] = [season1League, season2League, season3League, practiceLeague, hardcoreLeague, metroMayhemLeague];

export default defaultLeagues;
