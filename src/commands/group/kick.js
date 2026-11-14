import { kick } from './management.js';

export default {
  name: 'kick',
  aliases: [],
  description: 'Mengeluarkan anggota dari grup.',
  category: 'Group',
  usage: 'kick <mention|nomor>',
  execute: kick,
};
