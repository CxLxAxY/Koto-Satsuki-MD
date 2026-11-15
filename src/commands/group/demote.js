import { demote } from './management.js';

export default {
  name: 'demote',
  aliases: [],
  description: 'Menurunkan admin menjadi anggota grup.',
  category: 'Group',
  usage: 'demote <mention|nomor>',
  execute: demote,
};
