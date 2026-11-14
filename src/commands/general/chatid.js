import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { sendReply } from '../../utils/formatter.js';

export default {
  name: 'chatid',
  aliases: [],
  description: 'Menampilkan ID percakapan saat ini.',
  category: 'General',
  usage: 'chatid',
  execute: async ({ message, chatType, socket }) =>
    sendReply(
      { message, socket },
      [
        `Tipe chat: ${chatType}`,
        `Chat ID: ${message?.key?.remoteJid || 'UNAVAILABLE'}`,
      ].join('\n'),
    ),
};
