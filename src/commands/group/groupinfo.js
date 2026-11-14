import { groupinfo } from './management.js';

export default {
  name: 'groupinfo',
  aliases: [],
  description: 'Menampilkan informasi grup saat ini.',
  category: 'Group',
  usage: 'groupinfo',
  execute: groupinfo,
};
