import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { sendReply } from '../../utils/formatter.js';

export default {
  name: 'jid',
  aliases: [],
  description: 'Menampilkan JID, LID, dan nomor hasil resolusi pengirim.',
  category: 'General',
  usage: 'jid',
  execute: async ({ message, senderInfo, socket }) =>
    sendReply(
      { message, socket },
      [
        `Sender JID: ${senderInfo?.senderJid || 'UNRESOLVED'}`,
        `Sender LID: ${senderInfo?.senderLid || 'UNAVAILABLE'}`,
        `Nomor hasil resolusi: ${senderInfo?.phoneNumber || 'UNRESOLVED'}`,
      ].join('\n'),
    ),
};
