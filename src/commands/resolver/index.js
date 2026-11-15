import { registerCommand } from '../../handlers/commandHandler.js';
import catbox from './catbox.js';
import doodstream from './doodstream.js';
import gdrive from './gdrive.js';
import krakenfiles from './krakenfiles.js';
import mediafire from './mediafire.js';
import pixeldrain from './pixeldrain.js';
import sfile from './sfile.js';
import unshorten from './unshorten.js';

const commands = [mediafire, sfile, pixeldrain, catbox, gdrive, krakenfiles, doodstream, unshorten];
let registered = false;

const registerResolverCommands = () => {
  if (registered) return;
  for (const command of commands) registerCommand(command);
  registered = true;
};

export { registerResolverCommands };
