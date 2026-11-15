import { add } from './management.js';

export default {
  name: 'add',
  aliases: [],
  description: 'Menambahkan anggota ke grup.',
  category: 'Group',
  usage: 'add <nomor>',
  execute: add,
};
