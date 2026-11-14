import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { sendReply } from '../../utils/formatter.js';

export default {
  name: 'ping',
  aliases: [],
  description: 'Mengukur waktu pemrosesan lokal bot.',
  category: 'General',
  usage: 'ping',
  execute: async ({ message, receivedAt, socket }) => {
    const elapsed = Math.max(0, performance.now() - receivedAt);
    return sendReply(
      { message, socket },
      `Pong!\nWaktu pemrosesan lokal: ${elapsed.toFixed(2)} ms.\nNilai ini bukan pengukuran latency jaringan WhatsApp.`,
    );
  },
};
