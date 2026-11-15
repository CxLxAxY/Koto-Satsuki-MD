import { revoke } from './management.js';

export default {
  name: 'revoke',
  aliases: [],
  description: 'Memperbarui link undangan grup.',
  category: 'Group',
  usage: 'revoke',
  execute: revoke,
};
