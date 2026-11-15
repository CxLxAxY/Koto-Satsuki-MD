import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { formatDuration, sendReply } from '../../utils/formatter.js';

export default {
  name: 'uptime',
  aliases: [],
  description: 'Menampilkan lama proses bot berjalan.',
  category: 'General',
  usage: 'uptime',
  execute: async ({ message, socket }) =>
    sendReply({ message, socket }, `Uptime: ${formatDuration(process.uptime())}`),
};
