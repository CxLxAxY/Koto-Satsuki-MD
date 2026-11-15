import { registerCommand } from '../../handlers/commandHandler.js';
import add from './add.js';
import autoclosegroup from './autoclosegroup.js';
import autoopengroup from './autoopengroup.js';
import demote from './demote.js';
import goodbye from './goodbye.js';
import groupclose from './groupclose.js';
import groupinfo from './groupinfo.js';
import groupopen from './groupopen.js';
import hidetag from './hidetag.js';
import kick from './kick.js';
import linkgroup from './linkgroup.js';
import promote from './promote.js';
import revoke from './revoke.js';
import setautoclosegroup from './setautoclosegroup.js';
import setautoopengroup from './setautoopengroup.js';
import setdesc from './setdesc.js';
import setgoodbye from './setgoodbye.js';
import setname from './setname.js';
import setwelcome from './setwelcome.js';
import tagall from './tagall.js';
import welcome from './welcome.js';

const groupCommands = [
  kick,
  add,
  promote,
  demote,
  tagall,
  hidetag,
  groupinfo,
  linkgroup,
  revoke,
  groupopen,
  groupclose,
  setname,
  setdesc,
  setwelcome,
  welcome,
  setgoodbye,
  goodbye,
  setautoclosegroup,
  autoclosegroup,
  setautoopengroup,
  autoopengroup,
];

let registered = false;

const registerGroupCommands = () => {
  if (registered) {
    return;
  }
  for (const command of groupCommands) {
    registerCommand(command);
  }
  registered = true;
};

export { groupCommands, registerGroupCommands };
export default registerGroupCommands;
