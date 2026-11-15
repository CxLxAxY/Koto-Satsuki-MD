import { goodbye } from './settings.js';

export default {
  name: 'goodbye',
  aliases: [],
  description: 'Mengaktifkan atau menonaktifkan goodbye system.',
  category: 'Group',
  usage: 'goodbye <on|off>',
  execute: goodbye,
};
