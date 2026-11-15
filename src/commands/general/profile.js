import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { sendReply } from '../../utils/formatter.js';

export default {
  name: 'profile',
  aliases: [],
  description: 'Menampilkan identitas pengirim yang tersedia.',
  category: 'General',
  usage: 'profile',
  execute: async ({ message, senderInfo, chatType, socket }) =>
    sendReply(
      { message, socket },
      [
        `Nama profil: ${message?.pushName || 'Tidak tersedia'}`,
        `Nomor WhatsApp: ${senderInfo?.phoneNumber || 'UNRESOLVED'}`,
        `Tipe chat: ${chatType}`,
        `Sender JID: ${senderInfo?.senderJid || 'UNRESOLVED'}`,
        `Sender LID: ${senderInfo?.senderLid || 'UNAVAILABLE'}`,
      ].join('\n'),
    ),
};
