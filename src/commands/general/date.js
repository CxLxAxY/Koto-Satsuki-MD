import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { formatCurrentDate, sendReply } from '../../utils/formatter.js';

export default {
  name: 'date',
  aliases: [],
  description: 'Menampilkan tanggal saat ini sesuai konfigurasi timezone.',
  category: 'General',
  usage: 'date',
  execute: async ({ message, socket }) =>
    sendReply({ message, socket }, `Tanggal: ${formatCurrentDate()}`),
};
