import { setwelcome } from './settings.js';

export default {
  name: 'setwelcome',
  aliases: [],
  description: 'Mengatur template pesan welcome grup.',
  category: 'Group',
  usage: 'setwelcome <teks>',
  execute: setwelcome,
};
