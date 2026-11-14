import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { formatCurrentTime, sendReply } from '../../utils/formatter.js';

export default {
  name: 'time',
  aliases: [],
  description: 'Menampilkan waktu saat ini sesuai konfigurasi timezone.',
  category: 'General',
  usage: 'time',
  execute: async ({ message, socket }) =>
    sendReply({ message, socket }, `Waktu saat ini: ${formatCurrentTime()}`),
};
