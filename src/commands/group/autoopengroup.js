import { autoopengroup } from './settings.js';

export default {
  name: 'autoopengroup',
  aliases: [],
  description: 'Mengaktifkan atau menonaktifkan jadwal auto-open.',
  category: 'Group',
  usage: 'autoopengroup <on|off>',
  execute: autoopengroup,
};
