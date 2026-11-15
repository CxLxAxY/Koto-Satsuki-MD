import { registerCommand } from '../../handlers/commandHandler.js';
import animeepisode from './animeepisode.js';
import animeinfo from './animeinfo.js';
import animesearch from './animesearch.js';
import animetosho from './animetosho.js';
import gogoanime from './gogoanime.js';
import nimegami from './nimegami.js';
import otakudesu from './otakudesu.js';

const commands = [animesearch, otakudesu, gogoanime, nimegami, animetosho, animeepisode, animeinfo];
let registered = false;

const registerAnimeCommands = () => {
  if (registered) return;
  for (const command of commands) registerCommand(command);
  registered = true;
};

export { registerAnimeCommands };
