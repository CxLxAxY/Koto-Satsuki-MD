import { setname } from './management.js';

export default {
  name: 'setname',
  aliases: [],
  description: 'Mengubah nama grup.',
  category: 'Group',
  usage: 'setname <nama>',
  execute: setname,
};
