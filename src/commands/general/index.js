import { registerCommand } from '../../handlers/commandHandler.js';
import chatid from './chatid.js';
import date from './date.js';
import help from './help.js';
import info from './info.js';
import jid from './jid.js';
import menu from './menu.js';
import menucat from './menucat.js';
import owner from './owner.js';
import ping from './ping.js';
import profile from './profile.js';
import runtime from './runtime.js';
import status from './status.js';
import system from './system.js';
import time from './time.js';
import uptime from './uptime.js';
import version from './version.js';

const generalCommands = [
  menu,
  menucat,
  help,
  info,
  owner,
  version,
  ping,
  status,
  uptime,
  profile,
  jid,
  chatid,
  time,
  date,
  runtime,
  system,
];

let registered = false;

const registerGeneralCommands = () => {
  if (registered) {
    return;
  }
  for (const command of generalCommands) {
    registerCommand(command);
  }
  registered = true;
};

export { generalCommands, registerGeneralCommands };
export default registerGeneralCommands;
