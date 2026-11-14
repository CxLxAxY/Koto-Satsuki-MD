import { setgoodbye } from './settings.js';

export default {
  name: 'setgoodbye',
  aliases: [],
  description: 'Mengatur template pesan goodbye grup.',
  category: 'Group',
  usage: 'setgoodbye <teks>',
  execute: setgoodbye,
};
