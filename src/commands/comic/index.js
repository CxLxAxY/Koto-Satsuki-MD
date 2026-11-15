import { registerCommand } from '../../handlers/commandHandler.js';
import asura from './asura.js';
import bacakomik from './bacakomik.js';
import comicchapter from './comicchapter.js';
import comicsearch from './comicsearch.js';
import kiryuu from './kiryuu.js';
import komikcast from './komikcast.js';
import komikindo from './komikindo.js';
import komiku from './komiku.js';
import mangabats from './mangabats.js';
import mangadex from './mangadex.js';
import manhwaindo from './manhwaindo.js';

const commands = [
  comicsearch,
  komikindo,
  komiku,
  asura,
  kiryuu,
  komikcast,
  mangadex,
  bacakomik,
  manhwaindo,
  mangabats,
  comicchapter,
];
let registered = false;

const registerComicCommands = () => {
  if (registered) return;
  for (const command of commands) registerCommand(command);
  registered = true;
};

export { registerComicCommands };
