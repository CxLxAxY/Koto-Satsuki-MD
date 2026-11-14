import { groupclose } from './management.js';

export default {
  name: 'groupclose',
  aliases: [],
  description: 'Membatasi pengiriman pesan grup hanya untuk admin.',
  category: 'Group',
  usage: 'groupclose',
  execute: groupclose,
};
