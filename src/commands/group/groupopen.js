import { groupopen } from './management.js';

export default {
  name: 'groupopen',
  aliases: [],
  description: 'Membuka grup agar semua anggota dapat mengirim pesan.',
  category: 'Group',
  usage: 'groupopen',
  execute: groupopen,
};
