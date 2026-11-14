import { setautoopengroup } from './settings.js';

export default {
  name: 'setautoopengroup',
  aliases: [],
  description: 'Mengatur waktu auto-open harian dalam WIB dan mengaktifkannya.',
  category: 'Group',
  usage: 'setautoopengroup <HH:mm>',
  execute: setautoopengroup,
};
