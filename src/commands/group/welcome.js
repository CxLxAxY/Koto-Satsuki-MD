import { welcome } from './settings.js';

export default {
  name: 'welcome',
  aliases: [],
  description: 'Mengaktifkan atau menonaktifkan welcome system.',
  category: 'Group',
  usage: 'welcome <on|off>',
  execute: welcome,
};
