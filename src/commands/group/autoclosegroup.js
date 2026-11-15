import { autoclosegroup } from './settings.js';

export default {
  name: 'autoclosegroup',
  aliases: [],
  description: 'Mengaktifkan atau menonaktifkan jadwal auto-close.',
  category: 'Group',
  usage: 'autoclosegroup <on|off>',
  execute: autoclosegroup,
};
