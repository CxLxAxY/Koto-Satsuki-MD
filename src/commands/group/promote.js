import { promote } from './management.js';

export default {
  name: 'promote',
  aliases: [],
  description: 'Mengangkat anggota menjadi admin grup.',
  category: 'Group',
  usage: 'promote <mention|nomor>',
  execute: promote,
};
