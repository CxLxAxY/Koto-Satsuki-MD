import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { sendReply } from '../../utils/formatter.js';

export default {
  name: 'owner',
  aliases: [],
  description: 'Menampilkan informasi owner.',
  category: 'General',
  usage: 'owner',
  execute: async ({ message, socket }) =>
    sendReply(
      { message, socket },
      `Nama owner: ${config.identity.ownerName}\nNomor owner: ${config.identity.ownerNumber}`,
    ),
};
