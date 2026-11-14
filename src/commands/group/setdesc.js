import { setdesc } from './management.js';

export default {
  name: 'setdesc',
  aliases: [],
  description: 'Mengubah deskripsi grup.',
  category: 'Group',
  usage: 'setdesc <deskripsi>',
  execute: setdesc,
};
