import config from '../../config/config.js';
import logger from '../../utils/logger.js';
import { sendReply } from '../../utils/formatter.js';

export default {
  name: 'runtime',
  aliases: [],
  description: 'Menampilkan versi Node.js dan informasi runtime.',
  category: 'General',
  usage: 'runtime',
  execute: async ({ message, socket }) =>
    sendReply(
      { message, socket },
      [
        `Node.js: ${process.version}`,
        `Environment: ${process.env.NODE_ENV || config.identity.mode}`,
        `Platform: ${process.platform}`,
        `Arsitektur: ${process.arch}`,
      ].join('\n'),
    ),
};
