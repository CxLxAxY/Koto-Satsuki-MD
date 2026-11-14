import { setautoclosegroup } from './settings.js';

export default {
  name: 'setautoclosegroup',
  aliases: [],
  description: 'Mengatur waktu auto-close harian dalam WIB.',
  category: 'Group',
  usage: 'setautoclosegroup <HH:mm>',
  execute: setautoclosegroup,
};
